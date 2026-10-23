import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import type { Cs2OverlayConfig } from '@shared/types'
import { handle } from '../ipc'
import { appWindows, isOverlay, markOverlay } from '../windows'
import { cs2IsRunning, onCs2Running } from './cs2Live'
import { getSettings } from './settings'

// Overlay CS2 (bêta) : une fenêtre transparente posée par-dessus le jeu, qui ne prend jamais les clics ni le clavier et
// n'est jamais au premier plan à la place du jeu. Rien n'est injecté dans CS2 : c'est une fenêtre de Player X, visible
// quand le jeu est en « plein écran fenêtré » (Windows ne montre rien devant un jeu en plein écran exclusif).
// Elle n'existe que pendant que CS2 tourne (ou pendant un aperçu lancé depuis Paramètres). Ce qu'elle affiche vient des
// mêmes envois que la fiche (cs2:live, cs2:recap) ; son style et Alt+X passent par cs2:overlay-config.

const HOTKEY = 'Alt+X'
/** Aperçu depuis Paramètres : le temps de voir les quatre pièces. */
const PREVIEW_MS = 24_000

let win: BrowserWindow | null = null
let hidden = false
let previewAt: number | undefined
let previewTimer: ReturnType<typeof setTimeout> | undefined
let hotkey = false
/** Une fenêtre de Player X a le focus : l'overlay s'efface pour ne pas la couvrir. */
let appFocused = false

/** Proposé sur le canal Bêta et sur une version de test (la même règle que la ligne de Paramètres). */
export function overlayAllowed(): boolean {
  return getSettings().updateChannel === 'beta' || app.getVersion().includes('-')
}

function config(): Cs2OverlayConfig {
  const style = overlayAllowed() ? getSettings().cs2Overlay : 'off'
  // L'aperçu se lance depuis Paramètres, donc Player X au premier plan : il se voit quand même.
  return { style, hidden: hidden || (appFocused && previewAt === undefined), ...(previewAt !== undefined ? { previewAt } : {}) }
}

function send(): void {
  if (win && !win.isDestroyed()) win.webContents.send('cs2:overlay-config', config())
}

function wanted(): boolean {
  return config().style !== 'off' && (cs2IsRunning() || previewAt !== undefined)
}

function create(): void {
  // L'écran principal en entier : CS2 en plein écran fenêtré le couvre.
  const { bounds } = screen.getPrimaryDisplay()
  const w = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Player X · overlay',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false
    }
  })
  markOverlay(w)
  // Au-dessus d'une fenêtre de jeu en plein écran fenêtré.
  w.setAlwaysOnTop(true, 'screen-saver')
  // Les clics traversent : la souris reste au jeu.
  w.setIgnoreMouseEvents(true)
  // Affichée seulement quand la page a peint son fond transparent (cs2:overlay-ready), jamais le fond de l'appli.
  w.on('closed', () => win === w && (win = null))
  const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
  if (devUrl) void w.loadURL(`${devUrl}#overlay`)
  else void w.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  win = w
}

function destroy(): void {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
}

/** Alt+X : masquer ou réafficher l'overlay. Pris seulement pendant que l'overlay existe, pour ne gêner aucun autre jeu. */
function syncHotkey(): void {
  const need = !!win
  if (need === hotkey) return
  if (need) {
    try {
      hotkey = globalShortcut.register(HOTKEY, () => {
        hidden = !hidden
        send()
      })
    } catch {
      hotkey = false
    }
  } else {
    globalShortcut.unregister(HOTKEY)
    hotkey = false
  }
}

/** Ouvre ou ferme la fenêtre selon le réglage, CS2 et l'aperçu ; sinon prévient la fenêtre d'un changement de réglage. */
export function syncCs2Overlay(): void {
  if (wanted() && !win) create()
  else if (!wanted() && win) destroy()
  else send()
  syncHotkey()
}

function preview(): void {
  if (!overlayAllowed()) return
  clearTimeout(previewTimer)
  previewAt = Date.now()
  hidden = false
  syncCs2Overlay()
  previewTimer = setTimeout(() => {
    previewAt = undefined
    syncCs2Overlay()
  }, PREVIEW_MS)
}

export function startCs2Overlay(): void {
  handle('cs2:overlay-config', () => config())
  handle('cs2:overlay-preview', () => preview())
  handle('cs2:overlay-ready', (e) => {
    if (win && !win.isDestroyed() && e.sender === win.webContents && !win.isVisible()) win.showInactive()
  })
  // Player X au premier plan (fenêtre principale) : l'overlay ne la couvre pas. Il revient quand on retourne au jeu.
  app.on('browser-window-focus', (_e, w) => {
    if (isOverlay(w) || appFocused) return
    appFocused = true
    send()
  })
  app.on('browser-window-blur', () => {
    setTimeout(() => {
      const now = appWindows().some((w) => w.isFocused())
      if (now === appFocused) return
      appFocused = now
      send()
    }, 0)
  })
  onCs2Running((now) => {
    // Nouvelle partie : l'overlay revient visible.
    if (now) hidden = false
    syncCs2Overlay()
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
  syncCs2Overlay()
}

/** La fenêtre principale se ferme (pas rangée près de l'horloge) : l'overlay part avec elle, sinon l'appli ne quitte pas. */
export function closeCs2Overlay(): void {
  clearTimeout(previewTimer)
  previewAt = undefined
  destroy()
  syncHotkey()
}
