// Simulateur de mise à jour pour `npm run dev` (PX_UPDATE_SIM) : un faux electron-updater branché sur le vrai code de updater.ts
// (états, limites de progression, codes d'erreur, empreinte, vérification Ed25519, installation, relais, failsafe).
// Chargé seulement quand l'appli n'est pas installée (import dynamique dans initUpdater) : ses chiffres ne sont jamais montrés aux joueurs.
import { generateKeyPairSync, sign } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppUpdater, Logger, UpdateDownloadedEvent } from 'electron-updater'
import { sha512File, signedMessage } from './updateSignature'
import { mainWindow } from '../windows'

/** Ce que la vérification de updater.ts demande au simulateur à la place de GitHub. */
export interface SimHooks {
  /** Version « installée » de départ (PX_UPDATE_SIM_FROM), écrite dans le relais à la place de app.getVersion(). */
  from: string
  /** Remplace la signature publiée sur GitHub : signée ici avec une clé jetable, ou null en mode unsigned. */
  signature(version: string): Promise<string | null>
  /** Clé publique jetable qui va avec : la vraie vérification Ed25519 tourne, avec cette clé. */
  publicKey: string
  /** Attente d'une étape qui, en vrai, est instantanée. */
  pause(step: 'check'): Promise<void>
}

export interface Sim {
  updater: AppUpdater
  hooks: SimHooks
  /** Délai avant la première vérification. */
  firstCheck: number
}

type Mode = '1' | 'unsigned' | 'stall' | 'offline'

/** 92,4 Mo à 4,2 Mo/s : environ 22 s de téléchargement. */
const TOTAL = 96_888_422
const RATE = 4_400_000
/** electron-updater envoie sa progression une fois par seconde. */
const TICK = 1000
/** Arrondis vers le haut : 38 % et 41 % pile une fois le pourcentage arrondi à l'entier inférieur. */
const STALL_AT = Math.ceil(TOTAL * 0.38)
const STALL_MS = 12_000
const OFFLINE_AT = Math.ceil(TOTAL * 0.41)
/** La fenêtre reste cachée le temps d'une « installation ». */
const RELAUNCH_MS = 2_500

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Notes de la release comme GitHub les donne (HTML), rendues ici depuis docs/release-notes/<version>.md :
 * titres, listes et gras seulement, assez pour le résumé de la carte. Rien si le fichier manque.
 */
function releaseNotes(version: string): string | null {
  let md: string
  try {
    md = readFileSync(join(app.getAppPath(), 'docs', 'release-notes', `${version}.md`), 'utf8')
  } catch {
    return null
  }
  const out: string[] = []
  let list = false
  for (const line of md.split(/\r?\n/)) {
    const li = /^\s*[-*]\s+(.+)/.exec(line)
    if (list && !li) out.push('</ul>')
    if (li && !list) out.push('<ul>')
    list = !!li
    const inline = (t: string): string => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    const h = /^#{1,3}\s+(.+)/.exec(line)
    if (h) out.push(`<h2>${inline(h[1])}</h2>`)
    else if (li) out.push(`<li>${inline(li[1])}</li>`)
    else if (line.trim()) out.push(`<p>${inline(line.trim())}</p>`)
  }
  if (list) out.push('</ul>')
  return out.join('\n')
}

export function createSim(raw: string, ctx: { consumePending(): void; logger: Logger }): Sim {
  const known: Mode[] = ['1', 'unsigned', 'stall', 'offline']
  const mode: Mode = known.includes(raw as Mode) ? (raw as Mode) : '1'
  if (mode !== raw) ctx.logger.warn(`PX_UPDATE_SIM=${raw} inconnu : simulation normale (1, unsigned, stall ou offline).`)
  ctx.logger.info(`Simulation de mise à jour : ${mode}`)

  // Le « nouvel installeur » est l'exécutable d'Electron : vraie taille, vraie empreinte, vraie progression du calcul.
  const file = process.execPath
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  let digest: Promise<string> | null = null
  /** Comme le cache d'electron-updater : un installeur déjà téléchargé ne se retélécharge pas (aucune progression). */
  let cached = false
  /** Le réseau ne tombe qu'une fois : la vérification suivante passe. */
  let offlineDone = false
  let running = false

  const info = (version: string): UpdateDownloadedEvent => ({
    version,
    files: [{ url: `Player-X-Setup-${version}.exe`, sha512: '', size: TOTAL }],
    path: `Player-X-Setup-${version}.exe`,
    sha512: '',
    releaseDate: new Date().toISOString(),
    releaseNotes: releaseNotes(version),
    downloadedFile: file
  })

  const u = new EventEmitter() as EventEmitter & Record<string, unknown>
  Object.assign(u, {
    logger: null,
    autoDownload: true,
    autoInstallOnAppQuit: false,
    disableWebInstaller: false,
    checkForUpdates: (): Promise<null> => {
      if (!running) void run().catch((e) => ctx.logger.error(e))
      return Promise.resolve(null)
    },
    quitAndInstall: relaunch,
    addQuitHandler: (): void => {}
  })

  async function run(): Promise<void> {
    running = true
    try {
      // La version qui tourne « arrive » : après le faux redémarrage, la révélation peut se jouer.
      const version = app.getVersion()
      u.emit('checking-for-update')
      await wait(300)
      u.emit('update-available', info(version))
      // Empreinte calculée d'avance pour signer, pendant le téléchargement simulé.
      if (!digest && mode !== 'unsigned') {
        digest = sha512File(file)
        digest.catch(() => {})
      }
      if (!cached) {
        const started = Date.now()
        let transferred = 0
        let stalled = false
        // Comme electron-updater : vitesse moyenne depuis le début (elle retombe après un arrêt).
        const progress = (next: number): void => {
          const elapsed = Math.max(1, Date.now() - started) / 1000
          u.emit('download-progress', { total: TOTAL, delta: next - transferred, transferred: next, percent: (next / TOTAL) * 100, bytesPerSecond: Math.round(next / elapsed) })
          transferred = next
        }
        while (transferred < TOTAL) {
          await wait(TICK)
          const next = Math.min(TOTAL, transferred + RATE)
          if (mode === 'offline' && !offlineDone && next >= OFFLINE_AT) {
            progress(OFFLINE_AT)
            await wait(TICK)
            offlineDone = true
            u.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'))
            return
          }
          const stall = mode === 'stall' && !stalled && next >= STALL_AT
          progress(stall ? STALL_AT : next)
          if (stall) {
            stalled = true
            await wait(STALL_MS - TICK) // + le TICK de la boucle : 12 s sans événement
          }
        }
        cached = true
      } else await wait(200)
      u.emit('update-downloaded', info(version))
    } finally {
      running = false
    }
  }

  /** quitAndInstall : la fenêtre se cache, puis « la nouvelle version » démarre (relais relu, page rechargée). */
  function relaunch(): void {
    // PX_UPDATE_SIM_FAIL=1 : l'appli « ne se ferme pas », le failsafe de 8 s doit rendre la main.
    if (process.env.PX_UPDATE_SIM_FAIL === '1') return ctx.logger.warn('PX_UPDATE_SIM_FAIL : quitAndInstall ignoré.')
    const w = mainWindow()
    w?.hide()
    setTimeout(() => {
      cached = false
      ctx.consumePending() // to === app.getVersion() → lastUpdate.thisBoot, backMs ≈ 2500
      u.emit('update-not-available', info(app.getVersion()))
      if (w && !w.isDestroyed()) {
        w.webContents.reload()
        w.show()
      }
    }, RELAUNCH_MS)
  }

  return {
    updater: u as unknown as AppUpdater,
    firstCheck: 2_700,
    hooks: {
      from: process.env.PX_UPDATE_SIM_FROM || '0.0.0-sim',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      signature: async (version) => {
        await wait(600)
        if (mode === 'unsigned' || !digest) return null
        return sign(null, signedMessage(version, await digest), privateKey).toString('base64')
      },
      pause: () => wait(300)
    }
  }
}
