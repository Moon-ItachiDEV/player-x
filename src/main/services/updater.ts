// Mises à jour automatiques : GitHub Releases via electron-updater, seulement dans la version installée.
// La source (owner/repo) vient de app-update.yml, écrit par electron-builder à partir de `build.publish`.
// En développement, PX_UPDATE_SIM rejoue une mise à jour sur ce même code (updateSim.ts, jamais chargé par la version installée).
import { stat } from 'node:fs/promises'
import { app, BrowserWindow, net, screen } from 'electron'
// Import par défaut : marche que le main soit bundlé en CJS (le cas ici, dépendance externe → require) ou en ESM.
import updaterPkg, { type AppUpdater, type Logger, type UpdateDownloadedEvent } from 'electron-updater'
import type { InstallResult, LastUpdate, UpdateErrorCode, UpdateState } from '@shared/types'
import * as db from '../db'
import { handle } from '../ipc'
import { clampDelay, isLast, isPending, lastFromPending, visibleBounds, type PendingUpdate, type WindowBounds } from './updateHandoff'
import { isVersion, sha512File, verifyUpdateSignature } from './updateSignature'
import type { SimHooks } from './updateSim'

const FIRST_CHECK_DELAY = 10_000
const CHECK_INTERVAL = 6 * 60 * 60 * 1000
/** Après une erreur (hors ligne, GitHub indisponible…), on retente plus tôt que la vérification suivante. */
const RETRY_DELAY = 30 * 60 * 1000
/** Signatures publiées à côté de l'installeur (même dépôt que `build.publish` dans package.json). */
const RELEASES = 'https://github.com/Moon-ItachiDEV/player-x/releases/download'
/** Passage de relais (updateHandoff.ts) : écrit juste avant de fermer pour installer, relu au démarrage suivant. */
const PENDING_KEY = 'updatePending'
const LAST_KEY = 'updateLast'
/** Si l'appli tourne encore 8 s après quitAndInstall, on rend la main à l'interface. */
const FAILSAFE_MS = 8_000
/** Au plus 2 messages de progression par seconde (en plus de chaque point de pourcentage). */
const PROGRESS_EVERY = 500
/** Empreinte en cours de calcul : au plus 10 messages par seconde. */
const HASH_EVERY = 100

const OFFLINE = 'Pas de connexion à Internet. Player X réessaiera plus tard.'
const NO_ANSWER = 'GitHub ne répond pas pour le moment. Réessaie plus tard.'
const VERIFY_LATER = 'Impossible de vérifier la mise à jour pour le moment. Player X réessaiera plus tard.'
/** Message affiché quand la version téléchargée n'est pas signée par Player X : elle n'est jamais installée. */
const UNSIGNED = 'Mise à jour refusée : elle n’est pas signée par Player X. Elle ne sera pas installée.'

type Ready = Extract<UpdateState, { state: 'ready' }>

let state: UpdateState = { state: 'idle' }
let updater: AppUpdater | null = null
let inflight: Promise<UpdateState> | null = null
let retry: ReturnType<typeof setTimeout> | null = null
/** Dernier « ready » : ce que retrouve l'interface si l'appli ne se ferme pas pour installer. */
let readyState: Ready | null = null
/** Au moins un événement de progression : sinon l'installeur venait du cache et sa durée ne veut rien dire. */
let gotProgress = false
let downloadStartedAt = 0
let lastSentAt = 0
/** quitAndInstall appelé (et pas encore annulé) : une fermeture qui suit est la nôtre. */
let installStarted = false
let failsafe: ReturnType<typeof setTimeout> | null = null
let lastUpdate: LastUpdate | null = null
/** Position enregistrée avant le redémarrage, vérifiée par takeRelaunchBounds. */
let relaunchBounds: unknown = null
/** Simulateur de développement : toujours null dans la version installée (voir initUpdater). */
let sim: SimHooks | null = null

function setState(next: UpdateState): void {
  state = next
  if (next.state === 'ready') readyState = next
  // Barre des tâches : progression du téléchargement, indéterminée pendant la vérification, rien sinon.
  const bar = next.state === 'downloading' ? next.percent / 100 : next.state === 'verifying' ? 2 : -1
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    try {
      w.webContents.send('update:state', next)
      w.setProgressBar(bar)
    } catch (e) {
      // Page en plein rechargement : elle redemandera l'état (update:get).
      logger.warn(e)
    }
  }
}

/** Version qui tourne. Le simulateur fait comme si c'était une plus ancienne (PX_UPDATE_SIM_FROM). */
const runningVersion = (): string => sim?.from ?? app.getVersion()

// ---------- journal (sans jetons) ----------

function redact(value: unknown): string {
  const text = value instanceof Error ? value.stack || value.message : String(value)
  return text
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '[jeton masqué]')
    .replace(/(authorization|token)(["']?\s*[:=]\s*["']?)(?:bearer\s+|token\s+)?[^\s"',}]+/gi, '$1$2[masqué]')
    .slice(0, 2000)
}

const logger: Logger = {
  info: (m) => console.log('[mises à jour]', redact(m)),
  warn: (m) => console.warn('[mises à jour]', redact(m)),
  error: (m) => console.error('[mises à jour]', redact(m))
}

// ---------- erreurs → messages courts ----------

/** Codes d'electron-updater qui veulent dire « aucune version publiée (ou pas encore complète) » : ce n'est pas une panne. */
const NO_RELEASE = new Set(['ERR_UPDATER_NO_PUBLISHED_VERSIONS', 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'])

/** `null` : pas de version publiée sur GitHub, à traiter comme « à jour ». Sinon, le message à montrer. */
export function describeUpdateError(err: unknown): string | null {
  const e = (err ?? {}) as { code?: unknown; statusCode?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  // Sans le flux XML qu'electron-updater colle parfois au message (il peut contenir n'importe quel texte de version).
  const raw = err instanceof Error ? err.stack || err.message : String(err)
  const text = `${code} ${raw.split('\nXML:\n')[0]}`
  // Les erreurs HTTP sont parfois emballées : le statut reste lisible dans le texte (« HttpError: 404 … »).
  const status = typeof e.statusCode === 'number' ? e.statusCode : Number(/HttpError: (\d{3})/.exec(text)?.[1] ?? 0)

  if (NO_RELEASE.has(code) || /No published versions on GitHub/i.test(text)) return null
  // Que des préversions sur GitHub : /releases/latest répond 404, ce n'est pas une panne.
  if ((code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' || /Unable to find latest version on GitHub/i.test(text)) && status === 404) return null
  if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_NETWORK_CHANGED|ERR_ADDRESS_UNREACHABLE|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH/.test(text))
    return OFFLINE
  if (status === 429 || status === 403 || /rate limit/i.test(text))
    return 'GitHub limite les vérifications pour le moment. Réessaie dans quelques minutes.'
  if (status >= 500 || /ERR_CONNECTION_|ERR_TIMED_OUT|ERR_PROXY|ERR_TUNNEL|ERR_SSL|ERR_CERT|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT/.test(text))
    return NO_ANSWER
  if (code === 'ERR_CHECKSUM_MISMATCH' || /checksum mismatch/i.test(text))
    return 'La mise à jour téléchargée est incomplète. Elle sera retéléchargée à la prochaine vérification.'
  if (/ENOSPC/.test(text)) return 'Pas assez d’espace disque pour télécharger la mise à jour.'
  return 'La recherche de mise à jour a échoué. Réessaie plus tard.'
}

// ---------- passage de relais (redémarrage) ----------

function currentBounds(): WindowBounds | undefined {
  try {
    const w = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed())
    return w ? { ...w.getNormalBounds(), maximized: w.isMaximized() } : undefined
  } catch {
    return undefined
  }
}

/** Écriture synchrone sur disque (db.persist), faite avant que la fermeture soit programmée. */
function savePending(p: PendingUpdate): void {
  try {
    db.setKv(PENDING_KEY, p)
  } catch (e) {
    // Sans relais, l'installation se fait quand même : seul « de retour en » manquera.
    logger.warn(e)
  }
}

/** Au démarrage, avant createWindow : la mise à jour attendue est-elle arrivée ? */
function consumePending(): void {
  try {
    const raw = db.getKv<unknown>(PENDING_KEY, null)
    if (raw !== null) db.deleteKv(PENDING_KEY)
    const pending = isPending(raw) ? raw : null
    // Version différente de celle attendue : installation ratée ou fermeture annulée, on oublie.
    const last = pending && lastFromPending(pending, app.getVersion(), Date.now())
    if (pending && last) {
      db.setKv(LAST_KEY, { ...last, thisBoot: false })
      lastUpdate = last
      relaunchBounds = pending.relaunch ? (pending.bounds ?? null) : null
      return
    }
    const stored = db.getKv<unknown>(LAST_KEY, null)
    lastUpdate = isLast(stored) ? { ...stored, thisBoot: false } : null
  } catch (e) {
    // Base illisible : l'appli démarre quand même, sans « dernière mise à jour ».
    logger.warn(e)
  }
}

/** Position de la fenêtre avant le redémarrage, si elle tient encore sur un écran. Une seule fois. */
export function takeRelaunchBounds(): WindowBounds | null {
  const b = relaunchBounds
  relaunchBounds = null
  if (!b) return null
  try {
    return visibleBounds(b, screen.getAllDisplays().map((d) => d.workArea))
  } catch {
    return null
  }
}

// ---------- vérification ----------

function check(): Promise<UpdateState> {
  const u = updater
  // Déjà téléchargée, en cours, en vérification ou en train de s'installer : rien à vérifier (évite de faire clignoter l'état).
  if (!u || state.state === 'ready' || state.state === 'downloading' || state.state === 'verifying' || state.state === 'installing')
    return Promise.resolve(state)
  inflight ??= (async () => {
    try {
      const result = await u.checkForUpdates()
      // L'échec du téléchargement passe aussi par l'événement « error » : on évite juste le rejet non géré.
      result?.downloadPromise?.catch(() => {})
    } catch {
      /* état déjà posé par l'événement « error » */
    } finally {
      inflight = null
    }
    return state
  })()
  return inflight
}

// ---------- installation ----------

/** Redémarre pour installer. Le délai, borné ici quoi que demande l'interface, laisse jouer l'animation. */
function install(opts?: { delayMs?: unknown }): InstallResult {
  if (state.state === 'installing') return { ok: true, quitAt: state.quitAt } // déjà programmée
  const u = updater
  // Rien à installer : l'interface reprend la main tout de suite.
  if (!u || state.state !== 'ready') return { ok: false }
  const ready = state
  const delay = clampDelay(opts?.delayMs)
  const quitAt = Date.now() + delay
  savePending({
    from: runningVersion(),
    to: ready.version,
    fingerprint: ready.fingerprint,
    size: ready.size,
    downloadMs: ready.downloadMs,
    quitAt,
    relaunch: true,
    bounds: currentBounds()
  })
  setState({ state: 'installing', version: ready.version, quitAt })
  // Même à 0 ms, le minuteur laisse partir la réponse IPC avant la fermeture.
  setTimeout(() => {
    if (state.state !== 'installing') return
    installStarted = true
    try {
      // Installation silencieuse (pas d'assistant à refaire) puis relance. Si elle échoue, l'événement « error » ramène « ready ».
      u.quitAndInstall(true, true)
    } catch (e) {
      logger.error(e)
      return revert()
    }
    if (state.state === 'installing') failsafe = setTimeout(revert, FAILSAFE_MS)
  }, delay)
  return { ok: true, quitAt }
}

/** L'appli ne s'est pas fermée : la mise à jour redevient « prête » et l'interface reprend la main. */
function revert(): void {
  if (failsafe) clearTimeout(failsafe)
  failsafe = null
  installStarted = false
  if (state.state !== 'installing') return
  logger.warn('Player X ne s’est pas fermé pour installer la mise à jour : elle reste prête.')
  try {
    db.deleteKv(PENDING_KEY)
  } catch (e) {
    logger.warn(e)
  }
  setState(readyState?.version === state.version ? readyState : { state: 'ready', version: state.version })
}

function onBeforeQuit(): void {
  // Simulateur (dev) : il n'installe jamais en quittant, et sa base est celle de l'appli de dev ; aucun faux relais.
  if (sim) {
    try {
      db.deleteKv(PENDING_KEY)
    } catch {
      /* rien à effacer */
    }
    return
  }
  // Fermeture normale avec une mise à jour prête (ou pendant le délai de « Redémarrer », avant quitAndInstall) :
  // electron-updater l'installe en quittant, sans relancer. Après quitAndInstall, le relais du redémarrage est déjà écrit.
  const r = state.state === 'ready' ? state : state.state === 'installing' && !installStarted ? readyState : null
  if (!r || !updater?.autoInstallOnAppQuit) return
  savePending({
    from: runningVersion(),
    to: r.version,
    fingerprint: r.fingerprint,
    size: r.size,
    downloadMs: r.downloadMs,
    quitAt: Date.now(),
    relaunch: false
  })
}

// ---------- signature ----------

async function fetchSignature(version: string, file: string): Promise<string | null> {
  try {
    const res = await net.fetch(`${RELEASES}/v${version}/${file}.sig`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HttpError: ${res.status}`)
    const text = await res.text()
    return text.length <= 512 ? text : null
  } catch (e) {
    logger.warn(e)
    throw e
  }
}

/** Vérifie l'installeur téléchargé avant de le proposer : sans signature valide, il reste en attente et n'est jamais lancé. */
async function verifyDownloaded(u: AppUpdater, info: UpdateDownloadedEvent, downloadMs: number | undefined): Promise<void> {
  const v = info.version
  const file = info.files.find((f) => f.url.toLowerCase().endsWith('.exe'))?.url ?? info.path
  if (!isVersion(v) || !/^[\w.-]+\.exe$/i.test(file ?? '')) return refuse(UNSIGNED, 'unsigned', isVersion(v) ? v : undefined)

  // 1/3 : la signature publiée à côté de l'installeur (le simulateur de développement fournit la sienne).
  let signature: string | null
  try {
    signature = sim ? await sim.signature(v) : await fetchSignature(v, file)
  } catch {
    return refuse(VERIFY_LATER, 'verify', v)
  }
  // Pas de signature publiée : refusée tout de suite, inutile de calculer l'empreinte.
  if (!signature) return refuse(UNSIGNED, 'unsigned', v)

  // 2/3 : l'empreinte SHA-512 de l'installeur téléchargé, avec sa vraie progression.
  const { size } = await stat(info.downloadedFile)
  setState({ state: 'verifying', version: v, step: 'hash', hashed: 0, total: size })
  let last = 0
  const b64 = await sha512File(info.downloadedFile, (hashed) => {
    const now = Date.now()
    if (now - last < HASH_EVERY) return
    last = now
    setState({ state: 'verifying', version: v, step: 'hash', hashed: Math.min(hashed, size), total: size })
  })
  const fingerprint = Buffer.from(b64, 'base64').toString('hex')

  // 3/3 : la signature correspond à cette version et à cette empreinte (clé de Player X ; clé jetable dans le simulateur).
  setState({ state: 'verifying', version: v, step: 'check', hashed: size, total: size, fingerprint })
  if (sim) await sim.pause('check')
  if (!verifyUpdateSignature(v, b64, signature, sim?.publicKey)) return refuse(UNSIGNED, 'unsigned', v)
  u.autoInstallOnAppQuit = true
  // electron-updater n'arme l'installation en quittant qu'au téléchargement, quand elle était encore désactivée : on l'arme maintenant.
  // Méthode interne : si elle disparaît un jour, seul « installer en quittant » manque, « Redémarrer » marche toujours.
  ;(u as unknown as { addQuitHandler?: () => void }).addQuitHandler?.()
  setState({ state: 'ready', version: v, fingerprint, size, downloadMs })
}

function refuse(message: string, code: UpdateErrorCode, version?: string): void {
  logger.warn(message)
  setState({ state: 'error', message, code, version })
  scheduleRetry()
}

function scheduleRetry(): void {
  if (retry) clearTimeout(retry)
  retry = setTimeout(() => {
    retry = null
    void check()
  }, RETRY_DELAY)
}

/** Octets ou octets/s d'electron-updater, arrondis ; absents s'ils sont illisibles. */
const bytes = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined)

function wire(u: AppUpdater): void {
  u.logger = logger
  u.autoDownload = true
  // Installée en quittant seulement une fois la signature vérifiée (voir verifyDownloaded).
  u.autoInstallOnAppQuit = false
  // La signature Ed25519 ne couvre que l'.exe : un latest.yml qui ajoute un paquet d'installeur web est refusé.
  u.disableWebInstaller = true
  u.on('checking-for-update', () => setState({ state: 'checking' }))
  u.on('update-not-available', () => setState({ state: 'none', checkedAt: Date.now() }))
  u.on('update-available', (info) => {
    gotProgress = false
    downloadStartedAt = Date.now()
    lastSentAt = 0
    setState({ state: 'downloading', version: info.version, percent: 0 })
  })
  u.on('download-progress', (p) => {
    if (state.state !== 'downloading') return
    gotProgress = true
    const percent = Number.isFinite(p.percent) ? Math.max(0, Math.min(100, Math.floor(p.percent))) : state.percent
    const now = Date.now()
    // Un message par point de pourcentage, et entre deux au plus un toutes les 500 ms (octets et vitesse avancent quand même).
    if (percent === state.percent && now - lastSentAt < PROGRESS_EVERY) return
    lastSentAt = now
    setState({
      state: 'downloading',
      version: state.version,
      percent,
      transferred: bytes(p.transferred),
      total: bytes(p.total),
      bytesPerSecond: bytes(p.bytesPerSecond)
    })
  })
  u.on('update-downloaded', (info) => {
    // Même pendant la vérification, rien ne s'installe en quittant.
    u.autoInstallOnAppQuit = false
    // Sans aucune progression, l'installeur sortait du cache : pas de durée de téléchargement.
    const downloadMs = gotProgress ? Date.now() - downloadStartedAt : undefined
    setState({ state: 'verifying', version: info.version, step: 'signature' })
    verifyDownloaded(u, info, downloadMs).catch((e) => {
      logger.error(e)
      refuse(VERIFY_LATER, 'verify', isVersion(info.version) ? info.version : undefined)
    })
  })
  u.on('error', (err) => {
    // quitAndInstall a échoué (electron-updater le signale par cet événement) : on rend la main.
    if (state.state === 'installing') return revert()
    // Une erreur après coup ne masque ni une mise à jour prête ni une vérification en cours.
    if (state.state === 'ready' || state.state === 'verifying') return
    const message = describeUpdateError(err)
    if (message === null) return setState({ state: 'none', checkedAt: Date.now() })
    const version = state.state === 'downloading' ? state.version : undefined
    const code: UpdateErrorCode = message === OFFLINE || message === NO_ANSWER ? 'network' : 'other'
    setState({ state: 'error', message, code, version })
    scheduleRetry()
  })
}

/** Développement seulement : PX_UPDATE_SIM=1|unsigned|stall|offline rejoue une mise à jour sur le vrai code (updateSim.ts). */
function startSim(mode: string): void {
  // Le simulateur remplace la clé de vérification : jamais dans la version installée, quel que soit l'appelant.
  if (app.isPackaged) return
  state = { state: 'idle' }
  import('./updateSim')
    .then(({ createSim }) => {
      const s = createSim(mode, { consumePending, logger })
      sim = s.hooks
      wire(s.updater)
      updater = s.updater
      app.on('before-quit', onBeforeQuit)
      setTimeout(() => void check(), s.firstCheck)
    })
    .catch((e) => logger.error(e))
}

/** À appeler une fois, après `app.whenReady()` et initDb, avant createWindow : enregistre l'IPC et planifie les vérifications. */
export function initUpdater(): void {
  // D'abord le relais du redémarrage : createWindow en a besoin (takeRelaunchBounds), l'interface aussi (update:last).
  consumePending()
  handle('update:get', () => state)
  handle('update:check', () => check())
  handle('update:install', (_e, opts: unknown) => install(opts && typeof opts === 'object' ? (opts as { delayMs?: unknown }) : undefined))
  handle('update:last', () => lastUpdate)

  if (!app.isPackaged) {
    state = { state: 'disabled' }
    if (process.env.PX_UPDATE_SIM) startSim(process.env.PX_UPDATE_SIM)
    return
  }
  try {
    // Le getter crée l'instance au premier accès : jamais en développement. Une erreur ici ne doit pas empêcher l'appli de démarrer.
    const u = updaterPkg.autoUpdater
    wire(u)
    updater = u
  } catch (e) {
    logger.error(e)
    state = { state: 'error', message: 'Les mises à jour automatiques ne sont pas disponibles sur cette installation.' }
    return
  }
  app.on('before-quit', onBeforeQuit)
  setTimeout(() => {
    void check()
    setInterval(() => void check(), CHECK_INTERVAL)
  }, FIRST_CHECK_DELAY)
}
