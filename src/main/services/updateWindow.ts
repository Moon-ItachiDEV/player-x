// Fenêtre « Mise à jour de Player X » (Windows) : pendant l'installation silencieuse, Player X est fermé ; une petite fenêtre
// (installer/cmd/update, Go + WebView2) montre où en est l'installation, puis s'efface quand la nouvelle version est ouverte
// et joue l'animation du retour (renderer/update/stage.ts).
//
// Elle ne fait qu'observer : si elle manque, ne démarre pas ou plante, l'installation se fait exactement comme avant.
// Avant quitAndInstall, elle est copiée dans %TEMP%\PlayerXUpdate\<n>\ : NSIS vide le dossier d'installation et refuse
// d'installer tant qu'un programme de ce dossier tourne. Au redémarrage, la nouvelle version écrit done.json dans ce dossier
// (sa version, puis « page dessinée ») : la fenêtre coche « Vérification » et s'efface.
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, sep } from 'node:path'
import { app, screen } from 'electron'
import { isWindowDir } from './updateHandoff'

const EXE = 'player-x-update.exe'
/** Dossiers laissés par les mises à jour précédentes : effacés au démarrage au-delà de ce délai (la fenêtre est fermée depuis). */
const STALE_MS = 30 * 60 * 1000
/** Au plus autant de fichiers comptés pour la taille du dossier d'installation (quelques centaines en vrai). */
const MAX_FILES = 20_000

let child: number | null = null
/** Dossier de la fenêtre lancée par la version précédente (relu au démarrage) : done.json y est écrit. */
let doneDir: string | null = null
let doneVersion = ''
let doneOk = false

function root(): string {
  return join(app.getPath('temp'), 'PlayerXUpdate')
}

/** Taille du dossier d'installation : la fenêtre compare les octets écrits par NSIS à cette taille. */
function dirSize(dir: string): number {
  let total = 0
  let files = 0
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (files >= MAX_FILES) return
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) {
        files++
        total += statSync(p).size
      }
    }
  }
  // app.asar compté comme un fichier (sans cela, Electron le présente comme un dossier).
  const noAsar = process.noAsar
  process.noAsar = true
  try {
    walk(dir)
  } finally {
    process.noAsar = noAsar
  }
  return total
}

/**
 * Lance la fenêtre juste avant quitAndInstall. Synchrone : tout est écrit avant que la fermeture soit programmée.
 * Renvoie son dossier (enregistré dans le relais de mise à jour), ou null si elle n'est pas lancée.
 */
export function startUpdateWindow(o: { from: string; to: string; center?: { x: number; y: number } }): string | null {
  if (process.platform !== 'win32' || !app.isPackaged) return null
  try {
    const src = join(process.resourcesPath, 'update-window', EXE)
    if (!existsSync(src)) return null
    const dir = join(root(), String(Date.now()))
    mkdirSync(dir, { recursive: true })
    const exe = join(dir, EXE)
    copyFileSync(src, exe)
    const installDir = dirname(process.execPath)
    let center = { x: 0, y: 0 }
    if (o.center) {
      // Pixels d'écran (la fenêtre est un programme Windows à part) : même écran que Player X, même avec une mise à l'échelle.
      const p = screen.dipToScreenPoint(o.center)
      center = { x: Math.round(p.x), y: Math.round(p.y) }
    }
    const config = {
      pid: process.pid,
      installDir,
      exe: basename(process.execPath),
      from: o.from,
      to: o.to,
      expected: dirSize(installDir),
      x: center.x,
      y: center.y,
      done: join(dir, 'done.json')
    }
    const cfg = join(dir, 'config.json')
    writeFileSync(cfg, JSON.stringify(config))
    const c = spawn(exe, ['--config', cfg], { detached: true, stdio: 'ignore' })
    c.on('error', () => {
      /* fenêtre non lancée : l'installation se fait sans elle */
    })
    c.unref()
    child = c.pid ?? null
    return dir
  } catch {
    return null
  }
}

/** L'installation n'aura pas lieu ou ne relancera pas Player X (fermeture annulée, « Quitter » pendant le délai) : la fenêtre part. */
export function stopUpdateWindow(): void {
  if (child === null) return
  try {
    process.kill(child)
  } catch {
    /* déjà fermée */
  }
  child = null
}

function writeDone(shown: boolean): void {
  if (!doneDir) return
  try {
    writeFileSync(join(doneDir, 'done.json'), JSON.stringify({ version: doneVersion, ok: doneOk, shown }))
  } catch {
    /* fenêtre déjà partie, dossier effacé : rien à prévenir */
  }
}

/**
 * Au démarrage (consumePending) : la version précédente avait lancé la fenêtre. On lui dit quelle version a démarré
 * (ok : c'est celle attendue), elle coche « Vérification ».
 */
export function updateWindowBoot(dir: unknown, version: string, ok: boolean): void {
  if (!isWindowDir(dir, root(), sep)) return
  doneDir = dir
  doneVersion = version
  doneOk = ok
  writeDone(false)
}

/** Page de Player X dessinée (did-finish-load) : la fenêtre s'efface sur l'animation du retour. Une seule fois. */
export function updateWindowShown(): void {
  writeDone(true)
  doneDir = null
}

/** Au démarrage, en arrière-plan : efface les dossiers des fenêtres précédentes (fermées depuis longtemps). */
export function cleanupUpdateWindows(): void {
  if (process.platform !== 'win32') return
  setTimeout(() => {
    try {
      const r = root()
      if (!existsSync(r)) return
      const now = Date.now()
      for (const name of readdirSync(r)) {
        const p = join(r, name)
        if (!/^\d{10,16}$/.test(name) || p === doneDir) continue
        if (now - Number(name) > STALE_MS) rmSync(p, { recursive: true, force: true })
      }
    } catch {
      /* fichier encore ouvert : effacé une prochaine fois */
    }
  }, 60_000)
}
