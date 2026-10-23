import { BrowserWindow } from 'electron'

// Fenêtres de Player X : la fenêtre principale, et la fenêtre de l'overlay CS2 (services/cs2Overlay.ts), transparente et
// sans clic, posée par-dessus le jeu. Tout ce qui parle de « la fenêtre » (zone de notification, lancement, bilans, mises à
// jour, alertes) vise la principale : jamais l'overlay.

const overlays = new WeakSet<BrowserWindow>()

/** À appeler dès la création de la fenêtre de l'overlay. */
export function markOverlay(w: BrowserWindow): void {
  overlays.add(w)
}

export function isOverlay(w: BrowserWindow): boolean {
  return overlays.has(w)
}

/** Fenêtres de l'appli (sans l'overlay), encore ouvertes. */
export function appWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !overlays.has(w))
}

/** La fenêtre principale, si elle existe. */
export function mainWindow(): BrowserWindow | undefined {
  return appWindows()[0]
}
