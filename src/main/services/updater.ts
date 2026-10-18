// Mises à jour automatiques : GitHub Releases via electron-updater, seulement dans la version installée.
// La source (owner/repo) vient de app-update.yml, écrit par electron-builder à partir de `build.publish`.
import { app, BrowserWindow, ipcMain } from 'electron'
// Import par défaut : marche que le main soit bundlé en CJS (le cas ici, dépendance externe → require) ou en ESM.
import updaterPkg, { type AppUpdater, type Logger } from 'electron-updater'
import type { UpdateState } from '@shared/types'

const FIRST_CHECK_DELAY = 10_000
const CHECK_INTERVAL = 6 * 60 * 60 * 1000
/** Après une erreur (hors ligne, GitHub indisponible…), on retente plus tôt que la vérification suivante. */
const RETRY_DELAY = 30 * 60 * 1000

let state: UpdateState = { state: 'idle' }
let updater: AppUpdater | null = null
let inflight: Promise<UpdateState> | null = null
let retry: ReturnType<typeof setTimeout> | null = null

function setState(next: UpdateState): void {
  state = next
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:state', next)
  }
}

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
    return 'Pas de connexion à Internet. Player X réessaiera plus tard.'
  if (status === 429 || status === 403 || /rate limit/i.test(text))
    return 'GitHub limite les vérifications pour le moment. Réessaie dans quelques minutes.'
  if (status >= 500 || /ERR_CONNECTION_|ERR_TIMED_OUT|ERR_PROXY|ERR_TUNNEL|ERR_SSL|ERR_CERT|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT/.test(text))
    return 'GitHub ne répond pas pour le moment. Réessaie plus tard.'
  if (code === 'ERR_CHECKSUM_MISMATCH' || /checksum mismatch/i.test(text))
    return 'La mise à jour téléchargée est incomplète. Elle sera retéléchargée à la prochaine vérification.'
  if (/ENOSPC/.test(text)) return 'Pas assez d’espace disque pour télécharger la mise à jour.'
  return 'La recherche de mise à jour a échoué. Réessaie plus tard.'
}

// ---------- vérification ----------

function check(): Promise<UpdateState> {
  const u = updater
  // Déjà téléchargée ou en cours : rien à vérifier (évite de faire clignoter l'état).
  if (!u || state.state === 'ready' || state.state === 'downloading') return Promise.resolve(state)
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

function install(): void {
  if (!updater || state.state !== 'ready') return
  // Installation silencieuse (pas d'assistant à refaire) puis relance de Player X.
  // Le tick suivant laisse la réponse IPC partir avant la fermeture.
  const u = updater
  setImmediate(() => u.quitAndInstall(true, true))
}

function wire(u: AppUpdater): void {
  u.logger = logger
  u.autoDownload = true
  u.autoInstallOnAppQuit = true
  u.on('checking-for-update', () => setState({ state: 'checking' }))
  u.on('update-not-available', () => setState({ state: 'none', checkedAt: Date.now() }))
  u.on('update-available', (info) => setState({ state: 'downloading', version: info.version, percent: 0 }))
  u.on('download-progress', (p) => {
    if (state.state !== 'downloading') return
    const percent = Math.max(0, Math.min(100, Math.floor(p.percent)))
    // Un message par point de pourcentage, pas à chaque paquet reçu.
    if (percent !== state.percent) setState({ ...state, percent })
  })
  u.on('update-downloaded', (info) => setState({ state: 'ready', version: info.version }))
  u.on('error', (err) => {
    const message = describeUpdateError(err)
    // Une erreur après coup ne doit pas masquer une mise à jour déjà prête.
    if (state.state === 'ready') return
    if (message === null) return setState({ state: 'none', checkedAt: Date.now() })
    setState({ state: 'error', message })
    if (retry) clearTimeout(retry)
    retry = setTimeout(() => {
      retry = null
      void check()
    }, RETRY_DELAY)
  })
}

/** À appeler une fois, après `app.whenReady()` : enregistre l'IPC et planifie les vérifications. */
export function initUpdater(): void {
  ipcMain.handle('update:get', () => state)
  ipcMain.handle('update:check', () => check())
  ipcMain.handle('update:install', () => install())

  if (!app.isPackaged) {
    state = { state: 'disabled' }
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
  setTimeout(() => {
    void check()
    setInterval(() => void check(), CHECK_INTERVAL)
  }, FIRST_CHECK_DELAY)
}
