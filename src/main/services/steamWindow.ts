import { execFile } from 'node:child_process'
import { mainWindow } from '../windows'

// « Mettre à jour », « Installer », « Voir dans Steam » : Steam n'a aucun moyen de lancer un téléchargement sans montrer
// sa fenêtre. Player X ouvre donc ses téléchargements (ce qui lance ou reprend le téléchargement), puis réduit la fenêtre
// de Steam dans la barre des tâches et revient devant. Windows seulement ; ailleurs, Steam reste ouvert.

/** Temps maximal d'attente de la fenêtre de Steam (Steam fermé met quelques secondes à démarrer). */
const WAIT_MS = 12_000
/** Après la première réduction, on surveille encore un peu : Steam remonte parfois sa fenêtre juste après. */
const SETTLE_MS = 1_500
const STEP_MS = 250

// Fenêtres visibles et non réduites des processus de Steam (son interface tourne dans steamwebhelper), réduites avec
// ShowWindowAsync(SW_MINIMIZE). Rien n'est fermé : le téléchargement continue.
const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -Namespace PX -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
'@
$deadline = [DateTime]::Now.AddMilliseconds(${WAIT_MS})
$first = $null
while ([DateTime]::Now -lt $deadline) {
  foreach ($p in Get-Process -Name steam, steamwebhelper) {
    $h = $p.MainWindowHandle
    if ($h -ne [IntPtr]::Zero -and [PX.W]::IsWindowVisible($h) -and -not [PX.W]::IsIconic($h)) {
      [void][PX.W]::ShowWindowAsync($h, 6)
      if (-not $first) { $first = [DateTime]::Now; $deadline = $first.AddMilliseconds(${SETTLE_MS}) }
    }
  }
  Start-Sleep -Milliseconds ${STEP_MS}
}
if ($first) { 'reduit' } else { 'absent' }
`

let running = false

/** Ramène la fenêtre principale devant (Windows refuse souvent le focus sans ce passage par « toujours devant »). */
function bringBack(): void {
  const win = mainWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.setAlwaysOnTop(true)
  win.focus()
  win.moveTop()
  setTimeout(() => {
    if (!win.isDestroyed()) win.setAlwaysOnTop(false)
  }, 300)
}

/** Réduit la fenêtre de Steam dès qu'elle apparaît, puis remet Player X au premier plan. Ne bloque pas. */
export function tuckSteamAway(): void {
  if (process.platform !== 'win32' || running) return
  running = true
  execFile(
    'powershell.exe',
    // Script encodé (UTF-16LE en base64) : ni guillemets ni retours à la ligne à faire passer par la ligne de commande.
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(PS_SCRIPT, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: WAIT_MS + 10_000, encoding: 'utf8' },
    () => {
      running = false
      bringBack()
    }
  )
}
