import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'

/** Seule la page de Player X, dans le cadre principal d'une de ses fenêtres, peut appeler le processus principal. */
export function isTrustedSender(e: IpcMainInvokeEvent): boolean {
  const frame = e.senderFrame
  if (!frame || frame.parent !== null || !BrowserWindow.fromWebContents(e.sender)) return false
  let url: URL
  try {
    url = new URL(frame.url)
  } catch {
    return false
  }
  const dev = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
  if (dev) return url.origin === new URL(dev).origin
  return url.protocol === 'file:'
}

/** Comme `ipcMain.handle`, mais refuse les appels qui ne viennent pas de la page de l'appli. */
export function handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Appel refusé.')
    return listener(event, ...args)
  })
}
