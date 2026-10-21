# Player X: « Séquence Réacteur », final spec for the auto-update experience

**Status:** final, implementation-ready. One engineer, one pass, no new npm dependency.
**Request (FR):** « retravaille l'autoupdate animation bien plus poussé + et impressionnant ».
**Base:** `main @2243fbc` (0.5.1, so this ships as **0.6.0**). Brand rules from `docs/design/spec.md` (Nuit Néon) and `docs/design/motion-premium.md` §1, §2, §8 and §9 still apply. Where this spec departs from them it says so and gives the reason.
**Stack facts used:** Electron 44 (Chromium ~152), React 19, TypeScript 7, electron-vite, electron-updater 6.8.9, NSIS silent install through `quitAndInstall(true, true)`, sql.js kv (`db.setKv` persists with `writeFileSync`).

Conventions in this document:

- "Full" means `:root[data-fx='on']`, "Sober" means effects off, "Reduced" means `.reduce-motion` or `prefers-reduced-motion`. Tier is read through `tier()` (§4.2), never through `fxOn()` alone.
- Timings are in ms from the start of the phase. Easings are tokens from `tokens.css` (`--ease-out`, `--ease-in`, `--ease-in-out`, `--ease-glide`) plus two new ones (§4.1).
- Every motion is `transform` or `opacity`. Canvas is used only for two short bursts (warp ≤ 1 s, reveal ≤ 0.6 s). Nothing animates `filter`, `box-shadow`, `backdrop-filter`, `width`, `height` or SVG stroke properties. Nothing uses `will-change`.
- Copy is French with *tu*. Every string is in the copy deck (§13). Code identifiers are English.

---

## 0. Decisions

### 0.1 The idea

The update is one continuous object: the **reactor**, a 52 px core in a fixed-size card.

1. **Réacteur.** While downloading, 24 ticks light up one by one with the real percent. Packets of light run along the card's edge into the core, at a pace set by the real speed.
2. **Bouclier.** While the signature is checked, a shield appears. The steps count 1/3, 2/3, 3/3, and the real SHA-512 fingerprint types itself out.
3. **Armement.** Once signed, the shield stamps a check, ten energy cells ignite, and they go out one per real second while « Redémarrer » fills up.
4. **Saut.** On restart, the whole interface is sucked into the core (a View Transition snapshot, so nothing live is re-rasterised). A violet flash fires, the PX mark flies out to the centre, hyperspace streaks burst, and the window closes on a still frame about 1.2 s later.
5. **Allumage.** The relaunched window opens on the same frame: night blue with the mark in the same place. It comes out of hyperspace with real numbers (« 0.5.1 → 0.6.0 », « Signée · 3f9a1c0e », « De retour en 12 s »). Then the mark flies into the rail logo and Quoi de neuf opens.

### 0.2 Base and grafts

| From | Taken |
|---|---|
| **Séquence Réacteur** (base) | Reactor, shield, energy cells, hyperspace warp, match cut across the NSIS gap, boot reveal, main-owned clamped restart delay with failsafe, kv handoff with measured « de retour en N s », `initialTier()`, step queue, stall handling, refused-shield card. |
| **Métamorphose** | Motion is data (zero infinite animations while downloading), translate-not-scale fills, `anim()` tier gate for WAAPI, mark flying into `.favrail-logo .brand-mark` at the end of the reveal, `PX_UPDATE_SIM` dev simulator, no ETA, data lines in `--text-2`, preview never invents a target version. |
| **Overdrive** | Counter-translated gradient bar, zero-animation mini pill while a game runs, celebration deferred to the next focus, mandatory hover and focus-within countdown pause, WAAPI charge fill inside « Redémarrer », error tone by code, `check()` guard, WhatsNew stat chips, « Voir l'aperçu » in the shipping WhatsNew, « Copier l'empreinte », « Plus tard » toast, 1 MiB hashing chunks, `gotProgress` rule, `win.setProgressBar`. |
| **New here** | The implosion uses a **View Transition snapshot** instead of animating `.shell`. `install()` returns an `InstallResult` and the renderer has its own watchdog, which fixes the stuck UI. The reveal holds a static frame until `.boot` is gone. Relaunch restores the window bounds. SVG "line draws" are replaced by transform/opacity stamps. |

### 0.3 Judge issues and their fixes

| # | Issue raised | Fix in this spec |
|---|---|---|
| 1 | Ticks too fine (40 ticks at r=23 ≈ 1.16 px dashes) | 24 explicit `<line>` ticks, 4 px long and 2 px wide with round caps, 5.9 px pitch. No `pathLength` dashes and no masks (§5.3). |
| 2 | Core stacks too many layers (ticks, arc, glow, orbit, spark, scan, ping) | No scan. The orbit is shown only during the signature step. The inner arc is shown only during the hash step. At most 4 layers are visible at once (§5.3 matrix). |
| 3 | `.shell` scale and opacity over backdrop-filter and Ambient canvases (raster hitch, blur pop) | The implosion animates `::view-transition-old(root)`, a flat bitmap. Live blur elements are never inside a fading group. Fallback is a veil fade over the live UI (§7.2). |
| 4 | Stuck UI: `install()` can return without emitting anything | `install()` returns `{ ok: false }` at once when it cannot run. The renderer aborts on `ok:false`, on a rejected IPC call, on `ready` after `installing`, or on a watchdog at `delay + 10 s` (§7.5). |
| 5 | Vestibular: full-window radial motion is on by default | Total full-window motion is ≤ 1.0 s for the warp and ≤ 0.6 s for the arrival streaks. Alpha ≤ .7, no camera zoom in the reveal, and the snapshot shrinks only to .92. Turning off « Effets visuels » gives Sober (no streaks). Windows' "Animation effects" off, or « Réduire les animations », gives Reduced (§14.4). |
| 6 | Reveal too long (2.75 s), run during the busiest boot moment, input captured | About 2.0 s after a hold that waits for `.boot` to disappear (min 400 ms, max 1500 ms). Only the first click or key is swallowed, as a skip. From 1400 ms on, input passes through. Install-at-quit launches get the 1.06 s Sober variant. Unfocused gets a 260 ms fade (§8). |
| 7 | Sober reveal still held a 1.6 s veil when unfocused | Unfocused gets a quiet 260 ms fade with no hold (§8.5). |
| 8 | Download not quiet when focused (4 loops, 900 ms dashoffset paints) | Zero infinite animations. Ticks change opacity, the head spark and glow use `rotate`/`scale`/`opacity`, the bar uses `translate`. Paint happens only on the 52 px SVG when a tick lights (§5.5, §15). |
| 9 | Warp p95 target 24 ms looser than house 20 ms | p95 ≤ 20 ms. Adaptive streak count (120 → 60). Backing store capped at 3 MP (§7.4, §15). |
| 10 | No in-game compact mode | 188 × 40 mini pill while a game runs, with `getAnimations().length === 0` inside the dock (§5.8). |
| 11 | Ready title ellipsises at 420 px; Overdrive's stacked buttons don't fit 76 px | The card is 480 × 76 with side-by-side `btn-sm` buttons. The ready text column is 186 px (the longest ready sub is about 176 px), and every ready string is checked against it. Overflow is a test assertion (§5.1, §16). |
| 12 | HUD drift (scan lines, typed telemetry, 40 ticks); "panels never glow" | No scan lines and no typed telemetry. 24 ticks. The glow is a light inside the indicator, at max opacity .6, and the card itself never glows (§5.3). |
| 13 | ETA is a guess | Cut. Only measured numbers are shown (§1). |
| 14 | Preview shows the installed version as an incoming update | `PreviewFrame` has no version, byte or fingerprint fields. Card copy reads « Exemple de mise à jour » (§11). |
| 15 | Hover or focus countdown pause only "recommended" | Mandatory. It is part of `counting` (§6.6). |
| 16 | No dev simulator | `PX_UPDATE_SIM=1\|unsigned\|stall\|offline`, dev only, drives the real main code path (§3.9). |
| 17 | `tier()` read before App sets `data-fx` | `tier()` falls back to `initialTier()` (pg.ui + matchMedia) while `data-fx` is unset. The stage writes its own `data-tier` (§4.2). |
| 18 | Moving the `pg.lastVersion` write changes when Quoi de neuf opens | WhatsNew keeps writing it, at the same moment as today. `session.ts` only reads it at module load (§9). |
| 19 | Odometer drift, 3-slice morph seams, springs, 520 ms hover morph | All cut. The countdown digit remounts with a one-shot. The card never changes size. The mini pill does not expand on hover. No springs (§19). |
| 20 | Brand gradient translated whole shows mostly cyan at low % | Counter-translation: the window translates by `(p−1)`, the fill by `(1−p)`. Violet leads, cyan only near 100 % (§5.4). |
| 21 | Renderer-owned delay; localStorage handoff at quit | The delay is owned by main (clamped ≤ 1500 ms). The handoff is in main kv, written synchronously before the quit timer starts (§3). |
| 22 | Glitch, scanlines, shatter, jolt, particle burst over the rail | Cut. Refused is a crossed shield, danger filament and text. Interrupted is calm (§6.8). |
| 23 | « 96 Mo à télécharger » from `info.files` (wrong with differential) | Cut. The size appears only after verification, from `fs.stat` (§1). |
| 24 | Dwell before ready up to 1.5–2.5 s | Dwell is capped at 1200 ms after `ready` arrives in Full, about 900 ms in Sober and 0 in Reduced. Errors are never queued (§6.3). |
| 25 | Keydown capture must not leak to Shell's handlers | The skip handler runs in the capture phase with `stopPropagation()` and `preventDefault()`, and only once (§8.6). |
| 26 | `role="status"` on the ready card re-announces every second | One polite live region per dock, written only on phase changes (§14.1). |

---

## 1. Where every number comes from

| Shown | Source | Rule |
|---|---|---|
| Percent | `download-progress.percent`, floored, clamped 0–100 | As received. The digits never tween. |
| « 38,1 / 92,4 Mo » | `transferred` / `total` | With a differential download `total` is the delta, so this is "bytes in transit", which is true. |
| « 4,2 Mo/s » | `bytesPerSecond` (electron-updater's average since start) | Hidden while stalled. |
| Packet pace | the `bytesPerSecond` bucket | Motion only, no number. |
| « en attente du réseau » | 6 s without a progress event | Clears on the next event. |
| Hash percent | `hashed / total` from our own stream | `total` comes from `fs.stat`. |
| Fingerprint | hex of the SHA-512 we computed for the downloaded installer | Shown during step 3 as « Empreinte ». Labelled « Signée » only after `verifyUpdateSignature` returned true. |
| Installer size | `fs.stat(downloadedFile).size` | Shown only after verification (About, WhatsNew). |
| « Téléchargée en 38 s » | `update-downloaded` time minus `update-available` time | Only if at least one progress event arrived (`gotProgress`). A cached installer gets no duration. |
| « De retour en 12 s » | `installedAt − quitAt`, both `Date.now()` in main | Only when `relaunch: true` and the value is 0 < x ≤ 180 s. |
| Countdown | 10 real seconds, counted only while allowed (§6.6) | Unchanged rule. |
| Versions | `info.version`, `app.getVersion()`, `pg.lastVersion` | The preview never shows a version other than the running one. |

**Cut:** ETA, and any pre-download size.

---

## 2. State machine

```
idle ─► checking ─► none
                 └► downloading{percent, transferred?, total?, bytesPerSecond?}
                        │  (error, has version) ─► error{code:'network'|'other', version}
                        ▼
                    verifying{step:'signature'}
                        ├─ fetch failed ─────────► error{code:'verify', version}
                        ├─ no / bad signature ───► error{code:'unsigned', version}
                        ▼
                    verifying{step:'hash', hashed, total}
                        ▼
                    verifying{step:'check', fingerprint}
                        ├─ signature invalid ────► error{code:'unsigned', version}
                        ▼
                    ready{fingerprint, size, downloadMs?}
                        │ install({delayMs})
                        ▼
                    installing{quitAt} ──(quitAndInstall fails, error event, or 8 s failsafe)──► ready
                        ▼
                    process quits ─ NSIS /S ─ relaunch ─► updateLast {thisBoot:true}
```

Renderer display phases (§6) map onto this: `download`, `verify`, `lock` → `armed`, `refused`, `interrupted`, `installing`, plus `mini` while a game runs.

---

## 3. Main process

### 3.1 `src/shared/types.ts` (backwards compatible: only new optional fields and new variants)

```ts
/** Why an update failed. Absent on errors from older code paths and on check errors. */
export type UpdateErrorCode = 'unsigned' | 'verify' | 'network' | 'other'

export type UpdateState =
  | { state: 'disabled' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; checkedAt: number }
  | {
      state: 'downloading'
      version: string
      percent: number
      /** Bytes received / bytes to receive (with a differential download, the delta). */
      transferred?: number
      total?: number
      /** electron-updater's average since the start of the download. */
      bytesPerSecond?: number
    }
  /** Downloaded; the signature is being checked. Nothing installs, not even at quit. */
  | {
      state: 'verifying'
      version: string
      step: 'signature' | 'hash' | 'check'
      hashed?: number
      total?: number
      /** SHA-512 of the installer, 128 hex characters. Present from step 'check'. */
      fingerprint?: string
    }
  | {
      state: 'ready'
      version: string
      fingerprint?: string
      size?: number
      downloadMs?: number
    }
  /** installUpdate accepted: Player X closes at quitAt (Date.now() in main). */
  | { state: 'installing'; version: string; quitAt: number }
  | { state: 'error'; message: string; code?: UpdateErrorCode; version?: string }

export interface InstallResult {
  ok: boolean
  /** When ok: the moment main calls quitAndInstall. */
  quitAt?: number
}

/** The last update installed on this PC, written by main when the new version first starts. */
export interface LastUpdate {
  from: string
  to: string
  fingerprint?: string
  size?: number
  downloadMs?: number
  installedAt: number
  /** true: restart from Player X (« Redémarrer »); false: installed when Player X was closed. */
  relaunch: boolean
  /** installedAt − quitAt, only when relaunch and ≤ 180 s. */
  backMs?: number
  /** true only on the launch that installed it. */
  thisBoot: boolean
}
```

`LauncherApi` changes:

```ts
  /** Redémarre l'appli pour installer la mise à jour téléchargée. `delayMs` (0 à 1500) laisse jouer l'animation ; sans argument : tout de suite. */
  installUpdate(opts?: { delayMs?: number }): Promise<InstallResult>
  /** Dernière mise à jour installée sur ce PC (null si aucune connue). */
  getLastUpdate(): Promise<LastUpdate | null>
```

Callers that ignore the result keep working: `Promise<void>` → `Promise<InstallResult>` is compatible.

### 3.2 `src/preload/index.ts`

```ts
  installUpdate: (opts?: { delayMs?: number }) => ipcRenderer.invoke('update:install', opts),
  getLastUpdate: () => ipcRenderer.invoke('update:last'),
```

### 3.3 New pure module `src/main/services/updateHandoff.ts` (no Electron import, unit-tested)

```ts
// Passage de relais entre la version qui se ferme et celle qui démarre : ce qui est mesuré (durée, empreinte) survit au redémarrage.
import type { LastUpdate } from '@shared/types'

export interface WindowBounds { x: number; y: number; width: number; height: number; maximized: boolean }

export interface PendingUpdate {
  from: string
  to: string
  fingerprint?: string
  size?: number
  downloadMs?: number
  quitAt: number
  relaunch: boolean
  bounds?: WindowBounds
}

/** Délai maximal avant quitAndInstall, quoi que demande l'interface. */
export const MAX_INSTALL_DELAY = 1500
/** Au-delà, « de retour en » ne veut plus rien dire (PC en veille, installeur bloqué…). */
export const MAX_BACK_MS = 180_000

export function clampDelay(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
  return Math.min(MAX_INSTALL_DELAY, Math.max(0, n))
}

const str = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

export function isPending(v: unknown): v is PendingUpdate {
  const p = v as PendingUpdate | null
  return (
    !!p && typeof p === 'object' && str(p.from) && str(p.to) && num(p.quitAt) && typeof p.relaunch === 'boolean' &&
    (p.fingerprint === undefined || (typeof p.fingerprint === 'string' && /^[0-9a-f]{128}$/.test(p.fingerprint))) &&
    (p.size === undefined || num(p.size)) && (p.downloadMs === undefined || num(p.downloadMs))
  )
}

/** `null` si la version qui démarre n'est pas celle qui devait s'installer (installation ratée ou annulée). */
export function lastFromPending(p: PendingUpdate, version: string, now: number): LastUpdate | null {
  if (p.to !== version) return null
  const back = now - p.quitAt
  return {
    from: p.from,
    to: p.to,
    fingerprint: p.fingerprint,
    size: p.size,
    downloadMs: p.downloadMs,
    installedAt: now,
    relaunch: p.relaunch,
    backMs: p.relaunch && back > 0 && back <= MAX_BACK_MS ? back : undefined,
    thisBoot: true
  }
}
```

The `import type` line is erased by `--experimental-strip-types`, so the module runs under plain Node for tests (§16.6).

### 3.4 `src/main/services/updateSignature.ts`

```ts
/** SHA-512 (base64). `onProgress` reçoit le nombre d'octets lus ; lecture par blocs de 1 Mio. */
export function sha512File(path: string, onProgress?: (hashed: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    let hashed = 0
    createReadStream(path, { highWaterMark: 1 << 20 })
      .on('data', (chunk) => {
        hash.update(chunk)
        hashed += chunk.length
        onProgress?.(hashed)
      })
      .on('error', reject)
      .on('end', () => resolve(hash.digest('base64')))
  })
}
```

Nothing else changes in this file.

### 3.5 `src/main/services/updater.ts`

New module state and constants:

```ts
import { app, BrowserWindow, net, screen } from 'electron'
import { stat } from 'node:fs/promises'
import * as db from '../db'
import type { InstallResult, LastUpdate, UpdateErrorCode, UpdateState } from '@shared/types'
import { clampDelay, isPending, lastFromPending, type PendingUpdate, type WindowBounds } from './updateHandoff'

const PENDING_KEY = 'updatePending'
const LAST_KEY = 'updateLast'
/** Si l'appli tourne encore 8 s après quitAndInstall, on rend la main à l'interface. */
const FAILSAFE_MS = 8_000
/** Au plus 2 messages de progression par seconde (en plus de chaque point de pourcentage). */
const PROGRESS_EVERY = 500
const HASH_EVERY = 100

const OFFLINE = 'Pas de connexion à Internet. Player X réessaiera plus tard.'
const NO_ANSWER = 'GitHub ne répond pas pour le moment. Réessaie plus tard.'
const VERIFY_LATER = 'Impossible de vérifier la mise à jour pour le moment. Player X réessaiera plus tard.'
// UNSIGNED: unchanged text.

type Ready = Extract<UpdateState, { state: 'ready' }>
let readyState: Ready | null = null
let gotProgress = false
let downloadStartedAt = 0
let lastSentAt = 0
let failsafe: ReturnType<typeof setTimeout> | null = null
let lastUpdate: LastUpdate | null = null
let relaunchBounds: WindowBounds | null = null
```

`describeUpdateError` returns the `OFFLINE` and `NO_ANSWER` constants instead of literals (same text).

`setState` also drives the taskbar:

```ts
function setState(next: UpdateState): void {
  state = next
  if (next.state === 'ready') readyState = next
  const bar = next.state === 'downloading' ? next.percent / 100 : next.state === 'verifying' ? 2 /* indéterminé */ : -1
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    w.webContents.send('update:state', next)
    w.setProgressBar(bar)
  }
}
```

**Handoff:**

```ts
function currentBounds(): WindowBounds | undefined {
  const w = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed())
  if (!w) return undefined
  return { ...w.getNormalBounds(), maximized: w.isMaximized() }
}

function savePending(p: PendingUpdate): void {
  db.setKv(PENDING_KEY, p) // écriture synchrone sur disque (db.persist)
}

/** Au démarrage, avant createWindow : la mise à jour attendue est-elle arrivée ? */
function consumePending(): void {
  const raw = db.getKv<unknown>(PENDING_KEY, null)
  if (raw !== null) db.deleteKv(PENDING_KEY)
  if (isPending(raw)) {
    const last = lastFromPending(raw, app.getVersion(), Date.now())
    if (last) {
      db.setKv(LAST_KEY, { ...last, thisBoot: false })
      lastUpdate = last
      if (raw.relaunch && raw.bounds) relaunchBounds = raw.bounds
      return
    }
  }
  const stored = db.getKv<LastUpdate | null>(LAST_KEY, null)
  lastUpdate = stored ? { ...stored, thisBoot: false } : null
}

/** Position de la fenêtre avant le redémarrage, si elle tient encore sur un écran. Une seule fois. */
export function takeRelaunchBounds(): WindowBounds | null {
  const b = relaunchBounds
  relaunchBounds = null
  if (!b || b.width < 1024 || b.height < 640) return null
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width - 64 && b.x + b.width > a.x + 64 && b.y >= a.y - 8 && b.y < a.y + a.height - 64)
  return visible ? b : null
}
```

**Check guard:**

```ts
if (!u || state.state === 'ready' || state.state === 'downloading' || state.state === 'verifying' || state.state === 'installing') return Promise.resolve(state)
```

**Install (main owns the delay):**

```ts
function install(opts?: { delayMs?: unknown }): InstallResult {
  if (state.state === 'installing') return { ok: true, quitAt: state.quitAt } // idempotent
  if (!(updater || sim) || state.state !== 'ready') return { ok: false }
  const u = updater
  const ready = state
  const delay = clampDelay(opts?.delayMs)
  const quitAt = Date.now() + delay
  savePending({
    from: app.getVersion(), to: ready.version, fingerprint: ready.fingerprint, size: ready.size,
    downloadMs: ready.downloadMs, quitAt, relaunch: true, bounds: currentBounds()
  })
  setState({ state: 'installing', version: ready.version, quitAt })
  setTimeout(() => {
    try {
      // Installation silencieuse puis relance. En cas d'échec, l'événement « error » ramène l'état à « ready ».
      if (sim) sim.relaunch()
      else u!.quitAndInstall(true, true)
    } catch (e) {
      logger.error(e)
      return revert()
    }
    failsafe = setTimeout(revert, FAILSAFE_MS)
  }, delay)
  return { ok: true, quitAt }
}

/** L'appli ne s'est pas fermée : la mise à jour redevient « prête » et l'interface reprend la main. */
function revert(): void {
  if (failsafe) clearTimeout(failsafe)
  failsafe = null
  if (state.state !== 'installing' || !readyState) return
  db.deleteKv(PENDING_KEY)
  setState(readyState)
}
```

`setTimeout(…, 0)` still lets the IPC reply leave first. That reply is sent from a microtask, while the timer is a macrotask, so this works the same way as today's `setImmediate`.

**Install at quit:**

```ts
app.on('before-quit', () => {
  // Fermeture normale avec une mise à jour prête : electron-updater l'installe sans relancer.
  if (state.state !== 'ready' || !updater?.autoInstallOnAppQuit) return
  savePending({ from: app.getVersion(), to: state.version, fingerprint: state.fingerprint, size: state.size,
    downloadMs: state.downloadMs, quitAt: Date.now(), relaunch: false })
})
```

`before-quit` fires before electron-updater's `quit` handler. During `installing` it does nothing, because the pending record with `relaunch: true` is already saved.

**Events:**

```ts
u.on('update-available', (info) => {
  gotProgress = false
  downloadStartedAt = Date.now()
  setState({ state: 'downloading', version: info.version, percent: 0 })
})
u.on('download-progress', (p) => {
  if (state.state !== 'downloading') return
  gotProgress = true
  const percent = Math.max(0, Math.min(100, Math.floor(p.percent)))
  const now = Date.now()
  if (percent === state.percent && now - lastSentAt < PROGRESS_EVERY) return
  lastSentAt = now
  setState({ state: 'downloading', version: state.version, percent,
    transferred: Math.round(p.transferred), total: Math.round(p.total), bytesPerSecond: Math.round(p.bytesPerSecond) })
})
u.on('update-downloaded', (info) => {
  u.autoInstallOnAppQuit = false
  const downloadMs = gotProgress ? Date.now() - downloadStartedAt : undefined
  setState({ state: 'verifying', version: info.version, step: 'signature' })
  verifyDownloaded(u, info, downloadMs).catch((e) => {
    logger.error(e)
    refuse(VERIFY_LATER, 'verify', isVersion(info.version) ? info.version : undefined)
  })
})
u.on('error', (err) => {
  // quitAndInstall a échoué (install() renvoie false via dispatchError) : on rend la main.
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
```

### 3.6 `verifyDownloaded` with real steps

```ts
async function verifyDownloaded(u: AppUpdater, info: UpdateDownloadedEvent, downloadMs: number | undefined): Promise<void> {
  const v = info.version
  const file = info.files.find((f) => f.url.toLowerCase().endsWith('.exe'))?.url ?? info.path
  if (!isVersion(v) || !/^[\w.-]+\.exe$/i.test(file ?? '')) return refuse(UNSIGNED, 'unsigned', isVersion(v) ? v : undefined)
  let signature: string | null
  try {
    signature = await fetchSignature(v, file)
  } catch {
    return refuse(VERIFY_LATER, 'verify', v)
  }
  // Pas de signature publiée : refusée tout de suite, inutile de calculer l'empreinte.
  if (!signature) return refuse(UNSIGNED, 'unsigned', v)

  const { size } = await stat(info.downloadedFile)
  setState({ state: 'verifying', version: v, step: 'hash', hashed: 0, total: size })
  let last = 0
  const b64 = await sha512File(info.downloadedFile, (hashed) => {
    const now = Date.now()
    if (now - last < HASH_EVERY) return
    last = now
    setState({ state: 'verifying', version: v, step: 'hash', hashed, total: size })
  })
  const fingerprint = Buffer.from(b64, 'base64').toString('hex')
  setState({ state: 'verifying', version: v, step: 'check', hashed: size, total: size, fingerprint })

  if (!verifyUpdateSignature(v, b64, signature)) return refuse(UNSIGNED, 'unsigned', v)
  u.autoInstallOnAppQuit = true
  ;(u as unknown as { addQuitHandler?: () => void }).addQuitHandler?.()
  setState({ state: 'ready', version: v, fingerprint, size, downloadMs })
}

function refuse(message: string, code: UpdateErrorCode, version?: string): void {
  logger.warn(message)
  setState({ state: 'error', message, code, version })
  scheduleRetry()
}
```

### 3.7 IPC and init

```ts
export function initUpdater(): void {
  consumePending() // avant createWindow (ordre de index.ts : initDb → … → initUpdater → … → createWindow)
  handle('update:get', () => state)
  handle('update:check', () => check())
  handle('update:install', (_e, opts) => install(opts && typeof opts === 'object' ? (opts as { delayMs?: unknown }) : undefined))
  handle('update:last', () => lastUpdate)
  if (!app.isPackaged) {
    if (process.env.PX_UPDATE_SIM) return startSim(process.env.PX_UPDATE_SIM) // §3.9
    state = { state: 'disabled' }
    return
  }
  // … unchanged: wire(u), first check after 10 s, then every 6 h
  app.on('before-quit', onBeforeQuit) // §3.5
}
```

### 3.8 `src/main/index.ts` (P1: the window comes back where it was)

```ts
import { initUpdater, takeRelaunchBounds } from './services/updater'

function createWindow(): void {
  const b = takeRelaunchBounds()
  const win = new BrowserWindow({
    ...(b ? { x: b.x, y: b.y, width: b.width, height: b.height } : { width: 1440, height: 900 }),
    // … everything else unchanged (backgroundColor '#0b0d14' is the match-cut colour: keep it)
  })
  if (b?.maximized) win.maximize()
  // …
}
```

### 3.9 Dev simulator `PX_UPDATE_SIM` (P1, recommended early: it is how you build the main path in `npm run dev`)

`src/main/services/updateSim.ts` is imported by `updater.ts` only behind `!app.isPackaged`. It replays real-shaped events through the **same** `setState`, `install`, `revert`, `consumePending` and `sha512File` code. It never runs in the installed app, so its numbers are not shown to users.

| `PX_UPDATE_SIM` | Behaviour |
|---|---|
| `1` | 3 s after start: `downloading` of `app.getVersion()` (the running version "arrives", so the reveal can play after the fake restart). A total of 96 888 422 bytes at 4.4 MB/s, with one progress event per 1000 ms. Then `verifying`: signature (wait 600 ms), hash of `process.execPath` for real (real `stat`, real progress, real fingerprint), check (300 ms), then `ready`. |
| `unsigned` | As `1`, but the signature step resolves to `null` and goes to `error{code:'unsigned'}`. |
| `stall` | As `1`, but progress stops at 38 % for 12 s and then resumes. |
| `offline` | As `1`, but at 41 % it emits `error{code:'network', message: OFFLINE}`. |

`startSim()` sets the module variable `sim` (`{ relaunch(): void } | null`, `null` in the installed app), which is why `install()` tests `updater || sim`. In sim mode `install()` keeps the same contract: it saves pending with `from: process.env.PX_UPDATE_SIM_FROM ?? '0.0.0-sim'`, sets `installing`, and at `quitAt` calls `sim.relaunch()` (below) instead of `quitAndInstall`:

```ts
function simRelaunch(): void {
  const w = BrowserWindow.getAllWindows()[0]
  w?.hide()
  setTimeout(() => {
    consumePending() // to === app.getVersion() → lastUpdate.thisBoot = true, backMs ≈ 2500
    setState({ state: 'none', checkedAt: Date.now() })
    w?.webContents.reload()
    w?.show()
  }, 2_500)
}
```

`PX_UPDATE_SIM_FAIL=1` makes `simRelaunch` do nothing, so the 8 s failsafe path can be exercised.


---

## 4. Renderer architecture

### 4.0 File list

| File | Status | Role | ≈ LOC |
|---|---|---|---|
| `src/shared/types.ts` | edit | §3.1 | +50 |
| `src/preload/index.ts` | edit | §3.2 | +2 |
| `src/main/services/updateHandoff.ts` | **new** | §3.3, pure | 60 |
| `src/main/services/updateHandoff.test.ts` | **new** | `node:test` (§16.6) | 70 |
| `src/main/services/updateSignature.ts` | edit | §3.4 | +6 |
| `src/main/services/updater.ts` | edit | §3.5–3.7 | +150 |
| `src/main/services/updateSim.ts` | **new** | §3.9, dev only | 120 |
| `src/main/index.ts` | edit | §3.8 | +4 |
| `src/renderer/src/styles/tokens.css` | edit | §4.1 | +8 |
| `src/renderer/src/update/session.ts` | **new** | versions, tiers, `anim()`, `fx()`, stores, last update | 150 |
| `src/renderer/src/update/format.ts` | **new** | fr-FR bytes, speed, durations, fingerprint | 60 |
| `src/renderer/src/update/keyframes.ts` | **new** | every WAAPI keyframe set and timing in one place | 140 |
| `src/renderer/src/update/Reactor.tsx` | **new** | 52 px core (§5.3) | 160 |
| `src/renderer/src/update/useCardPhase.ts` | **new** | display phase, step queue, stall, arming, countdown (§6) | 230 |
| `src/renderer/src/update/TextSwap.tsx` | **new** | 3-row text block crossfade (§6.1) | 50 |
| `src/renderer/src/update/TickRing.tsx` | **new** | 48-tick 160 px ring for warp and reveal | 50 |
| `src/renderer/src/update/streaks.ts` | **new** | canvas streak engine (§7.4) | 170 |
| `src/renderer/src/update/stage.ts` | **new** | stage store, `requestRestart`, abort, reveal scheduling | 230 |
| `src/renderer/src/update/UpdateStage.tsx` | **new** | warp and reveal overlay, portal to body (§7, §8) | 260 |
| `src/renderer/src/update/VersionRoll.tsx` | **new** | per-character version entrance (reveal, WhatsNew) | 40 |
| `src/renderer/src/update/preview.ts` | **new** | « Voir l'aperçu » timeline (§11) | 160 |
| `src/renderer/src/update/stage.css` | **new** | stage layout and Sober keyframes | 170 |
| `src/renderer/src/components/UpdateNotice.tsx` | **rewrite** | dock, card, mini pill, live region | 260 |
| `src/renderer/src/components/update.css` | **rewrite** | card, reactor, stream, mini | 300 |
| `src/renderer/src/components/WhatsNew.tsx` | edit | waits for reveal, chips, VersionRoll, preview, « Voir l'aperçu » | +70 |
| `src/renderer/src/components/whatsnew.css` | edit | chips, sheen | +40 |
| `src/renderer/src/components/settings/AboutSection.tsx` | edit | new states, fingerprint, last update, preview row | +90 |
| `src/renderer/src/components/settings/settings.css` | edit | counter-translated track, fingerprint | +30 |
| `src/renderer/src/components/ui/Icon.tsx` | edit | `shield`, `shield-check`, `shield-x`, `download` | +4 |
| `src/renderer/src/contracts.ts` | edit | `UpdateNoticeProps.inGame` | +2 |
| `src/renderer/src/App.tsx` | edit | import session first, mount `UpdateStage`, pass `inGame` | +6 |
| `docs/release-notes/0.6.0.md` | edit or new | one bullet (§13.9) | +2 |
| `scripts/qa/update-anim.mjs`, `scripts/qa/launcher-mock.js` | **new** | Playwright harness (§16) | 400 |

`useUpdateState()` moves to `update/session.ts`. `UpdateNotice.tsx` re-exports it so the existing AboutSection import keeps compiling.

### 4.1 Tokens (`tokens.css`, inside `:root`)

```css
  /* Mises à jour */
  --ease-warp: cubic-bezier(0.7, 0, 0.84, 0); /* aspiration : tient, puis plonge */
  --ease-arrive: cubic-bezier(0.16, 1, 0.3, 1); /* sortie d'hyperespace : très rapide puis se pose */
  --upd-w: 480px;
  --upd-h: 76px;
  --z-warp: 100; /* au-dessus des toasts (80) : redémarrage et retour */
  --font-mono: ui-monospace, 'Cascadia Mono', Consolas, monospace;
```

`keyframes.ts` mirrors the easings as strings (`EASE.warp = 'cubic-bezier(.7,0,.84,0)'`, and so on), because WAAPI does not resolve `var()` in `easing`.

### 4.2 `update/session.ts`

```ts
import { useSyncExternalStore } from 'react'
import type { LastUpdate, UpdateState } from '@shared/types'

export const VERSION = window.launcher.version
const read = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }

/** Lu au chargement du module, AVANT que WhatsNew n'écrive pg.lastVersion (même règle que WhatsNew.shouldOpen). */
export const PREVIOUS_VERSION = read('pg.lastVersion')
export const UPDATED_THIS_LAUNCH = PREVIOUS_VERSION ? PREVIOUS_VERSION !== VERSION : read('pg.setup') !== null

export type Tier = 'full' | 'sober' | 'reduced'

/** Pour tout ce qui s'affiche avant le premier effet d'App (qui pose data-fx et .reduce-motion). */
export function initialTier(): Tier {
  let ui: { visualFx?: boolean; reduceMotion?: boolean } = {}
  try { ui = JSON.parse(read('pg.ui') ?? '{}') } catch { /* défauts */ }
  if (ui.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced'
  return ui.visualFx === false ? 'sober' : 'full' // défaut d'App : visualFx true
}

/** Palier courant. Avant le premier effet d'App, data-fx n'existe pas encore : on retombe sur initialTier(). */
export function tier(): Tier {
  const root = document.documentElement
  if (root.dataset.fx === undefined) return initialTier()
  if (motionReduced()) return 'reduced'
  return root.dataset.fx === 'on' ? 'full' : 'sober'
}

/** Fenêtre en arrière-plan : lu à l'instant (data-window peut avoir un événement de retard). */
export function isIdle(): boolean {
  return document.visibilityState !== 'visible' || !document.hasFocus()
}

/** Effets riches permis maintenant. */
export const fx = (): boolean => tier() === 'full' && !isIdle()

type AnimOpts = KeyframeAnimationOptions & { level?: 'full' | 'sober'; whenIdle?: boolean }
/**
 * Seule porte vers Element.animate pour les mises à jour : WAAPI ignore la règle globale « 0.01 ms » de .reduce-motion.
 * null en Reduced, sous le palier demandé, ou fenêtre inactive (sauf whenIdle).
 */
export function anim(el: Element | null | undefined, frames: Keyframe[], o: AnimOpts = {}): Animation | null {
  const { level = 'full', whenIdle = false, ...opts } = o
  const t = tier()
  if (!el || t === 'reduced' || (level === 'full' && t !== 'full') || (!whenIdle && isIdle())) return null
  return el.animate(frames, opts)
}

// Petit store observable (pas de dépendance) : stage, aperçu, révélation, dernière mise à jour.
export interface Store<T> { get(): T; set(v: T | ((p: T) => T)): void; subscribe(cb: () => void): () => void }
export function createStore<T>(init: T): Store<T> { /* Set de listeners, set() notifie si Object.is diffère */ }
export function useStore<T>(s: Store<T>): T { return useSyncExternalStore(s.subscribe, s.get) }

/** Dernière mise à jour connue de main. loaded passe à true à l'arrivée, ou après 400 ms (valeur null en attendant). */
export const lastUpdate = createStore<{ loaded: boolean; value: LastUpdate | null }>({ loaded: false, value: null })
const t400 = setTimeout(() => lastUpdate.set((p) => ({ ...p, loaded: true })), 400)
window.launcher.getLastUpdate?.()
  .then((value) => lastUpdate.set({ loaded: true, value: value ?? null }))
  .catch(() => lastUpdate.set({ loaded: true, value: null }))
  .finally(() => clearTimeout(t400))

export function useUpdateState(): [UpdateState | null, (s: UpdateState) => void] { /* moved unchanged from UpdateNotice.tsx */ }
```

`App.tsx` imports `./update/session` (and `./update/stage`) **before** `./components/WhatsNew`, so `PREVIOUS_VERSION` is read before WhatsNew's first render writes the key.

### 4.3 `update/format.ts`

```ts
const NB = ' '
const MiB = 1024 * 1024
const one = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export const pct = (n: number): string => `${n}${NB}%`
export const mo = (b: number): string => (b >= MiB ? `${one.format(b / MiB)}${NB}Mo` : `${int.format(b / 1024)}${NB}Ko`)
/** « 38,1 / 92,4 Mo » (unité une seule fois quand elle est la même). */
export function pair(done: number, total: number): string {
  if (total >= MiB) return `${one.format(done / MiB)} / ${one.format(total / MiB)}${NB}Mo`
  return `${int.format(done / 1024)} / ${int.format(total / 1024)}${NB}Ko`
}
export const speed = (bps: number): string => `${mo(bps)}/s`
export type Rate = 'slow' | 'mid' | 'fast'
export const rate = (bps = 0): Rate => (bps < MiB ? 'slow' : bps < 8 * MiB ? 'mid' : 'fast')
/** « 38 s », « 1 min 12 s », « 4 min ». */
export function duration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s}${NB}s`
  const m = Math.floor(s / 60), r = s % 60
  return r ? `${m}${NB}min ${r}${NB}s` : `${m}${NB}min`
}
export const fpShort = (hex: string): string => `${hex.slice(0, 8)}…${hex.slice(-8)}`
/** 32 premiers caractères par groupes de 4, pour À propos. */
export const fpGroups = (hex: string): string => `${hex.slice(0, 32).match(/.{4}/g)!.join(' ')} …`
```

### 4.4 Component tree

```
App
└─ ToastProvider
   ├─ Shell
   │   └─ .shell
   │       ├─ … (rail, topbar, backdrop, content, friends)
   │       ├─ UpdateNotice inGame={anyRunning} launching={realPending && !anyRunning}   ← dock (card | mini) + live region
   │       ├─ LaunchDock                                         ← 0.7.0: launch card, stacked above (§6.10)
   │       └─ WhatsNew                                           ← waits for revealDone
   ├─ UpdateStage                                                ← portal to body, z --z-warp; warp + reveal
   └─ LaunchStage                                                ← 0.7.0: portal to body, z --z-launch (launch-sequence.md)
```

`UpdateStage` sits inside `ToastProvider`, so it can raise the abort toast, and outside `.shell`, so `inert` on the shell never reaches it.

### 4.5 `update/keyframes.ts` (every WAAPI keyframe set lives here)

```ts
export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)', in: 'cubic-bezier(.4,0,1,1)', inOut: 'cubic-bezier(.65,0,.35,1)',
  glide: 'cubic-bezier(.22,1,.36,1)', warp: 'cubic-bezier(.7,0,.84,0)', arrive: 'cubic-bezier(.16,1,.3,1)'
} as const
type K = { frames: Keyframe[]; opts: KeyframeAnimationOptions }
const k = (frames: Keyframe[], duration: number, easing: string, delay = 0): K => ({ frames, opts: { duration, easing, delay, fill: 'both' } })

export const KF = {
  // card
  cardIn:      k([{ transform: 'translateY(14px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], 420, EASE.glide),
  cardInSober: k([{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.out),
  cardLeave:   k([{ transform: 'none', opacity: 1 }, { transform: 'translateY(8px) scale(.98)', opacity: 0 }], 200, EASE.in),
  sheen:       k([{ transform: 'translateX(-100%)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translateX(100%)', opacity: 0 }], 1100, EASE.inOut),
  rxSpinIn:    k([{ transform: 'rotate(-120deg)', opacity: 0 }, { transform: 'rotate(0)', opacity: 1 }], 420, EASE.glide, 140),
  pingArrive:  k([{ transform: 'scale(.6)', opacity: 0.8 }, { transform: 'scale(2.2)', opacity: 0 }], 700, EASE.out, 300),
  pingStage:   k([{ transform: 'scale(.7)', opacity: 0.6 }, { transform: 'scale(2)', opacity: 0 }], 700, EASE.out),
  pingLock:    k([{ transform: 'scale(.7)', opacity: 0.7 }, { transform: 'scale(2)', opacity: 0 }], 600, EASE.out),
  sparkPulse:  k([{ transform: 'scale(1)', opacity: 0.6 }, { transform: 'scale(1.7)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.6 }], 320, EASE.out),
  packet: (p: number, ms: number, i: number): K =>
    k([{ transform: `translateX(${p}%)`, opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { transform: 'translateX(0%)', opacity: 0 }], ms, EASE.in, i * 140),
  textIn:      k([{ transform: 'translateY(4px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.out, 100),
  textOut:     k([{ opacity: 1 }, { opacity: 0 }], 140, EASE.in),
  fpChar: (i: number): K => k([{ transform: 'translateY(2px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 140, EASE.out, i * 24),
  shieldIn:    k([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 260, EASE.glide, 80),
  shieldFill:  k([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 260, EASE.glide),
  stamp:       k([{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 220, EASE.out, 140),
  shieldOut:   k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.8)', opacity: 0 }], 240, EASE.in, 600),
  glowSettle:  k([{ opacity: 1 }, { opacity: 0.6 }], 500, EASE.out),
  glowTick: (critical: boolean): K => k([{ opacity: 0.6 }, { opacity: critical ? 1 : 0.85 }, { opacity: 0.6 }], 600, EASE.inOut),
  secIn:       k([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220, EASE.glide),
  rise: (i: number): K => k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.glide, 600 + i * 60),
  charge: (D: number): K => ({ frames: [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], opts: { duration: D * 1000, easing: 'linear', fill: 'both' } }),
  // stage: warp (t = 0 at VT ready)
  oldRoot: (cx: number, cy: number): K =>
    k([{ transform: 'scale(1)', opacity: 1, transformOrigin: `${cx}px ${cy}px` }, { transform: 'scale(.92)', opacity: 0, transformOrigin: `${cx}px ${cy}px` }], 520, EASE.warp, 40),
  veilIn:      k([{ opacity: 0 }, { opacity: 1 }], 520, EASE.warp, 40),
  flash:       k([{ transform: 'scale(.2)', opacity: 0 }, { opacity: 0.85, offset: 0.35 }, { transform: 'scale(1.6)', opacity: 0 }], 200, EASE.out, 400),
  markFly: (dx: number, dy: number): K =>
    k([{ transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], 360, EASE.glide, 460),
  ringLight:   k([{ opacity: 0 }, { opacity: 1 }], 120, EASE.out, 600),
  ringOut:     k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], 180, EASE.out, 720),
  warpText:    k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 200, EASE.glide, 760),
  canvasOut:   k([{ opacity: 1 }, { opacity: 0 }], 120, EASE.out, 880),
  // stage: reveal (t = 0 at the end of the hold)
  ringGroup: (g: number): K => k([{ opacity: 0 }, { opacity: 1 }], 180, EASE.out, g * 60),
  kicker:      k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.glide, 150),
  from:        k([{ transform: 'translateX(-6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.glide, 250),
  toChar: (i: number): K => k([{ transform: 'translateY(.5em)', opacity: 0 }, { transform: 'none', opacity: 1 }], 360, EASE.glide, 350 + i * 40),
  chip: (i: number, base = 600): K => k([{ transform: 'translateY(4px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.glide, base + i * 60),
  skipIn:      k([{ opacity: 0 }, { opacity: 1 }], 260, EASE.out, 500),
  contentOut:  k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.98)', opacity: 0 }], 240, EASE.in),
  ringExit:    k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], 400, EASE.in),
  shock:       k([{ transform: 'scale(.3)', opacity: 0.5 }, { transform: 'scale(2.6)', opacity: 0 }], 500, EASE.out),
  markToRail: (dx: number, dy: number, s: number, ms = 600): K =>
    k([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], ms, EASE.glide),
  markFadeInPlace: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], 400, EASE.out),
  veilOut: (ms = 500, delay = 50): K => k([{ opacity: 1 }, { opacity: 0 }], ms, EASE.out, delay),
  fade: (ms: number, delay = 0): K => k([{ opacity: 0 }, { opacity: 1 }], ms, EASE.out, delay),
  fadeOut: (ms: number, delay = 0): K => k([{ opacity: 1 }, { opacity: 0 }], ms, EASE.out, delay)
} as const
```

Usage is always `anim(el, KF.x.frames, { ...KF.x.opts, level })`, overriding `delay` where a timeline table gives another start (for example the refused cross stamp at 200 ms). In the reveal the exit keyframes are scheduled at 1400 ms (or at once on skip, with durations multiplied by `300 / 600` for the FLIP and veil and `150 / 240` for the content).

---

## 5. The card

### 5.1 Layout (fixed size in every phase: nothing resizes, nothing morphs)

```
┌────────────────────────────────────────────────────────────────────┐ 480 × 76, r14, --surface-3, 1 px --line-2, --sh-2
│▌ ╭──────╮  TÉLÉCHARGEMENT                                          │ kicker 11/14 600 caps .06em --accent-text
│▌ │  41  │  Player X 0.6.0                                          │ title 13.5/18 600 --text-1
│▌ ╰──────╯  38,1 / 92,4 Mo · 4,2 Mo/s                               │ sub 12/16 400 --text-2
│▌   ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰●· · ·                                            │ stream bar: left/right 16, bottom 4, 2 px
└────────────────────────────────────────────────────────────────────┘
 ▌ 2 px filament (existing ::before)   ╭╮ Reactor 52 px   ● head   · packets
```

Ready:

```
┌────────────────────────────────────────────────────────────────────┐
│▌ ╭──────╮  ⛨ SIGNÉE ET PRÊTE                 [ Redémarrer ][Plus tard] │ buttons btn-sm (30 px), side by side, gap 6
│▌ │  7   │  0.5.1 → 0.6.0                                           │
│▌ ╰──────╯  Redémarrage dans 7 s                                    │
└────────────────────────────────────────────────────────────────────┘
```

Width budget. Padding is 11 / 12 / 11 / 14 with a 1 px border, so the content box is 452 × 52.

| Phase | Reactor | Gaps | Right column | Text column |
|---|---|---|---|---|
| download, verify | 52 | 12 (one gap, no right column) | none | **388 px** |
| ready | 52 | 2 × 12 | « Redémarrer » ≈ 98 + 6 + « Plus tard » ≈ 86 = 190 | **186 px** |
| refused, interrupted | 52 | 2 × 12 | « Détails » ≈ 76 + 6 + × 30 = 112 | **264 px** |

The longest ready sub is « En pause jusqu'à ton retour » (27 chars ≈ 176 px at 12 px Inter), which fits in 186 px. Every text row still has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` attribute as a safety net, and §16 asserts there is no overflow.

```css
.upd-dock {
  position: fixed;
  left: calc(var(--nav-w) + 20px);       /* 0.7.0: rail + sidebar */
  bottom: 20px;
  z-index: calc(var(--z-scrim) - 5);
  width: min(var(--upd-w), calc(100vw - var(--nav-w) - 40px));
}
.upd-dock[data-mode='mini'] { width: auto; }
.shell:has(.upd-dock[data-mode='card']) > .content { padding-bottom: 104px; }
.shell:has(.upd-dock[data-mode='mini']) > .content { padding-bottom: 68px; }
@media (max-width: 1279px) {         /* 0.7.0 breakpoint */
  #root:has(.upd-dock[data-mode='card']) .toasts { bottom: 108px; }
  #root:has(.upd-dock[data-mode='mini']) .toasts { bottom: 72px; }
}

.upd-card {
  --p: 0;
  position: relative;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  box-sizing: border-box;
  width: 100%;
  height: var(--upd-h);
  padding: 11px 12px 11px 14px;
  background: var(--surface-3);         /* opaque: no backdrop-filter (removed) */
  border: 1px solid var(--line-2);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-2);              /* static, never animated */
  overflow: hidden;
}
.upd-card::before {                      /* existing 2 px filament, unchanged except colour by phase */
  background: var(--accent);
}
.upd-card[data-phase='refused']::before { background: var(--danger); }
.upd-card[data-phase='interrupted']::before { background: var(--text-3); }

.upd-text { display: grid; grid-template-rows: 14px 18px 16px; row-gap: 2px; min-width: 0; position: relative; }
.upd-text > * { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.upd-kicker { display: flex; align-items: center; gap: 4px; font: 600 11px/14px var(--font-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-text); }
.upd-card[data-phase='refused'] .upd-kicker { color: var(--danger-text); }
.upd-card[data-phase='interrupted'] .upd-kicker { color: var(--text-2); }
.upd-title { font: 600 13.5px/18px var(--font-ui); color: var(--text-1); }
.upd-sub { font: 400 12px/16px var(--font-ui); color: var(--text-2); }
.upd-fp { font: 500 11px/16px var(--font-mono); color: var(--text-2); }
.upd-fp-label { color: var(--text-3); margin-right: 6px; }
.upd-actions { display: flex; gap: 6px; }

/* Card that opens À propos while downloading or verifying: one transparent button over the whole card. */
.upd-hit { position: absolute; inset: 0; border-radius: inherit; background: transparent; cursor: pointer; }
.upd-hover { position: absolute; inset: 0; border-radius: inherit; background: rgb(255 255 255 / 0.04); opacity: 0; pointer-events: none;
  transition: opacity var(--d-in) var(--ease-out); }
.upd-card:has(.upd-hit:hover) .upd-hover { opacity: 1; }   /* hover = overlay opacity, never a background-colour transition */
.upd-hit:focus-visible { box-shadow: var(--focus); }  /* focus ring is not animated */

/* No transition at all while the window is in the background (zero frames between events). */
:root[data-window='idle'] .upd-dock *, :root[data-window='idle'] .upd-dock *::before { transition: none !important; }
```

**With the launch card (0.7.0).** The launch card (`.launch-dock`, `launch-sequence.md` §4.2) has the same corner, width and height. The update dock never moves: the launch card stacks above it, at `bottom: calc(20px + var(--upd-h) + 10px)` (106 px) when the full card shows (during a launch that is the armed, refused or interrupted card) and at `70px` above the mini pill. The reserved room grows to `padding-bottom` 190 px (154 px with the mini pill), and narrow-window toasts rise to 194 px (158 px).

`.upd-sheen` is a real span (it was `::after`), so it can be replayed by WAAPI:

```css
.upd-sheen { position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.07) 50%, transparent 65%); }
```

### 5.2 Card DOM

```tsx
<div className="upd-dock" data-mode={mini ? 'mini' : 'card'}>
  <span className="sr-only" role="status" aria-live="polite">{announce}</span>
  {mini ? <MiniPill … /> : (
    <div className="upd-card" data-phase={phase} data-rate={rateBucket} ref={cardRef}
         style={{ '--p': p.toFixed(3) } as React.CSSProperties}
         role="group" aria-label="Mise à jour de Player X"
         onPointerEnter={…} onPointerLeave={…} onFocus={…} onBlur={…}>
      <span className="upd-sheen" aria-hidden="true" />
      <span className="upd-hover" aria-hidden="true" />
      <Reactor … />
      <TextSwap swapKey={textKey} aria-hidden={hasHit || undefined}>
        <span className="upd-kicker">{kickerIcon}{kicker}</span>
        <span className="upd-title">{title}</span>
        <span className="upd-sub">{sub}</span>
      </TextSwap>
      {actions && <div className="upd-actions">{actions}</div>}
      {phase === 'download' && <Stream />}
      {hasHit && <button className="upd-hit" onClick={onOpenAbout} aria-label={hitLabel} title="Voir les détails dans Paramètres › À propos" />}
    </div>
  )}
</div>
```

- The same `.upd-card` element persists through `download → verify → lock → armed → installing` (keyed by version only), so the reactor's CSS transitions carry from phase to phase.
- `--p` is written once per progress event, as a React style prop. No rAF ever writes it.
- `hasHit` is true in `download` and `verify`. In those phases the text block is `aria-hidden`, because the hit button's label says the same thing.

### 5.3 The reactor (`update/Reactor.tsx`), 52 × 52

Geometry (centre 26, 26; angles clockwise from 12 o'clock):

```ts
const C = 26
const polar = (r: number, deg: number): [number, number] => {
  const t = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(t), C + r * Math.sin(t)]
}
const arcD = (r: number, a0: number, a1: number): string => {
  const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}
/** 24 ticks: lines from r 20.5 to 24.5 every 15°. Pitch at r 22.5 = 5.9 px, so the gap is 3.9 px next to a 2 px stroke. */
export const TICKS = Array.from({ length: 24 }, (_, i) => [polar(20.5, i * 15), polar(24.5, i * 15)] as const)
/** 10 energy cells: 28° arcs with 8° gaps, r 22.5, stroke 4 (same band as the ticks). */
export const CELLS = Array.from({ length: 10 }, (_, j) => arcD(22.5, j * 36 + 4, j * 36 + 32))
export const ORBIT_D = arcD(17, 0, 70)
export const INNER_C = 2 * Math.PI * 17 // 106.81

// Brand gradient sampled per tick: #7c3aed (0) → #4f7cff (.55) → #22d3ee (1). Progress may use it; cyan only appears in the last ticks.
const STOPS: [number, [number, number, number]][] = [[0, [124, 58, 237]], [0.55, [79, 124, 255]], [1, [34, 211, 238]]]
function gradientAt(t: number): string {
  const k = STOPS.findIndex(([o]) => o >= t)
  if (k <= 0) return `rgb(${STOPS[0][1].join(' ')})`
  const [o0, c0] = STOPS[k - 1], [o1, c1] = STOPS[k]
  const u = (t - o0) / (o1 - o0)
  return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * u)).join(' ')})`
}
export const TICK_COLORS = TICKS.map((_, i) => gradientAt(i / 23))
```

DOM (no `<defs>`, no masks, no ids):

```tsx
<span className="rx" aria-hidden="true">
  <span className="rx-glow" />                                   {/* 72 px radial violet */}
  <svg className="rx-svg" viewBox="0 0 52 52" width="52" height="52">
    <g className="rx-ticks">
      {TICKS.map(([a, b], i) => <line key={i} className="rx-tick-track" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}
      {TICKS.map(([a, b], i) => <line key={i} className={`rx-tick-lit${i < lit ? ' on' : ''}`} stroke={TICK_COLORS[i]} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}
    </g>
    <g className="rx-cells">
      {CELLS.map((d, j) => <path key={j} className="rx-cell-track" d={d} />)}
      {CELLS.map((d, j) => <path key={j} className={`rx-cell-lit${j < cellsOn ? ' on' : ''}`} d={d} style={{ '--j': j } as React.CSSProperties} />)}
    </g>
    <g className="rx-inner" transform="rotate(-90 26 26)">
      <circle className="rx-inner-track" cx="26" cy="26" r="17" />
      <circle className="rx-inner-val" cx="26" cy="26" r="17" strokeDasharray={INNER_C} strokeDashoffset={INNER_C * (1 - hashP)} />
    </g>
  </svg>
  <svg className="rx-shield" viewBox="0 0 52 52" width="52" height="52">       {/* its own outer <svg>: transforms on it are composited */}
    <path className="rx-shield-fill" d="M26 13.5l9 3.4v7.1c0 5.9-3.9 10.3-9 12.4-5.1-2.1-9-6.5-9-12.4v-7.1z" />
    <path className="rx-shield-line" d="M26 13.5l9 3.4v7.1c0 5.9-3.9 10.3-9 12.4-5.1-2.1-9-6.5-9-12.4v-7.1z" />
  </svg>
  <svg className="rx-mark" viewBox="0 0 52 52" width="52" height="52">
    <path className="rx-check" d="M21.8 25.2l3 3 5.6-6.2" />
    <path className="rx-cross" d="M22.5 21.5l7 7M29.5 21.5l-7 7" />
  </svg>
  <span className="rx-orbit fx-loop"><svg viewBox="0 0 52 52" width="52" height="52"><path d={ORBIT_D} /></svg></span>
  <span className="rx-head"><i /></span>                         {/* rotate = --p turn */}
  <span className="rx-ping" />                                   {/* one-shot shock ring, WAAPI only */}
  <span className="rx-center">{center}</span>                   {/* percent / seconds / icon */}
</span>
```

`lit = Math.floor(percent * 24 / 100)`. `cellsOn` is 10 during lock and armed, then `left` while counting. `hashP = hashed / total`, which is redrawn (not animated) at most every 100 ms during the hash step only.

```css
.rx { position: relative; width: 52px; height: 52px; display: grid; place-items: center; }
.rx > * { grid-area: 1 / 1; }
.rx-glow {
  width: 72px; height: 72px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgb(124 58 237 / 0.55), rgb(124 58 237 / 0));
  opacity: calc(0.15 + var(--p) * 0.45);
  scale: calc(0.75 + var(--p) * 0.25);
  transition: opacity 900ms var(--ease-out), scale 900ms var(--ease-out);
}
.rx-svg, .rx-shield, .rx-mark, .rx-orbit, .rx-orbit > svg { width: 52px; height: 52px; overflow: visible; }
.rx-ticks, .rx-cells, .rx-inner, .rx-shield, .rx-mark, .rx-orbit, .rx-head { transition: opacity 240ms var(--ease-out); }
.rx-tick-track { stroke: var(--line-2); stroke-width: 2; stroke-linecap: round; }
.rx-tick-lit { stroke-width: 2; stroke-linecap: round; opacity: 0; transition: opacity 240ms var(--ease-out); }
.rx-tick-lit.on { opacity: 1; }
.rx-cell-track { fill: none; stroke: var(--line-2); stroke-width: 4; }
.rx-cell-lit { fill: none; stroke: var(--accent); stroke-width: 4; opacity: 0; transition: opacity 240ms var(--ease-out); }
.rx-cell-lit.on { opacity: 1; }
.upd-card.is-critical .rx-cell-lit { stroke: var(--accent-text); }          /* colour swaps instantly, never animated */
.upd-card.is-locking .rx-cell-lit { transition-delay: calc(200ms + var(--j) * 30ms); }  /* ignition sweep, Full */
.rx-inner-track { fill: none; stroke: var(--line-1); stroke-width: 2; }
.rx-inner-val { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
.rx-shield-fill { fill: var(--accent-solid); opacity: 0; }
.rx-shield-line { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-linejoin: round; }
.upd-card[data-phase='refused'] .rx-shield-line { stroke: var(--danger); }
.rx-check { fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
.rx-cross { fill: none; stroke: var(--danger); stroke-width: 2; stroke-linecap: round; opacity: 0; }
.rx-orbit path { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
:root[data-fx='on'] .rx-orbit { animation: rx-orbit 1100ms linear infinite; }  /* the ONLY infinite animation, signature step only */
@keyframes rx-orbit { to { rotate: 1turn; } }
.rx-head { position: absolute; inset: 0; rotate: calc(var(--p) * 1turn); transition: rotate 900ms var(--ease-out), opacity 240ms var(--ease-out); }
.rx-head > i { position: absolute; left: 23.5px; top: 1px; width: 5px; height: 5px; border-radius: 50%;
  background: radial-gradient(circle, #fff 0, #e9e3ff 45%, rgb(196 181 253 / 0) 70%); }
.rx-ping { width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid var(--accent-line); opacity: 0; pointer-events: none; }
.rx-center { position: relative; display: grid; place-items: center; font: 700 13px/1 var(--font-display); font-variant-numeric: tabular-nums; color: var(--text-1); }
.rx-center small { font-size: 9px; margin-left: 1px; color: var(--text-2); }
.rx-sec { font-size: 16px; }
.upd-card.is-critical .rx-sec { color: #fff; }
.upd-card.is-held .rx-sec { opacity: 0.5; transition: opacity 120ms var(--ease-out); }
```

Visibility matrix, set by `[data-phase]` and `[data-step]` rules on `.upd-card` (opacity only):

| Layer | download | verify: signature | verify: hash | verify: check | lock → armed | refused | interrupted | installing |
|---|---|---|---|---|---|---|---|---|
| `.rx-ticks` | 1 | .35 | .35 | .35 | 1 → 0 (200–440 ms) | .25 | .35 | 0 |
| `.rx-cells` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| `.rx-inner` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `.rx-orbit` | 0 | 1 (spins in Full) | 0 | 0 | 0 | 0 | 0 | 0 |
| `.rx-shield` (line) | 0 | 1 | 1 | 1 | fill + line, out at 600 ms | 1 (danger) | 0 | 0 |
| `.rx-mark` | 0 | 0 | 0 | 0 | check, out at 600 ms | cross | 0 | 0 |
| `.rx-head` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `.rx-glow` | `.15 + p·.45` | .3 | .3 | .3 | .6 | 0 | .1 | .6 |
| `.rx-center` | « 41 % » | hidden (shield) | hidden | hidden | seconds / pause / check | hidden | alert icon | check icon |

At most four layers are visible at any moment, which answers the "visual noise" objection.

**Sober:** the same matrix. `.rx-glow` is fixed at `opacity: .22; scale: 1` with no transition. The head spark transitions in 300 ms, ticks in 200 ms, and the orbit does not spin (it shows as a static 70° arc). **Reduced:** the same DOM; the global rule removes every transition.

### 5.4 Stream bar (download only)

```tsx
<span className="upd-stream" aria-hidden="true">
  <span className="upd-stream-win"><span className="upd-stream-fill" /></span>
  <span className="upd-stream-head"><i /></span>
  <span className="upd-pk"><i /></span><span className="upd-pk"><i /></span><span className="upd-pk"><i /></span>
</span>
```

```css
.upd-stream { position: absolute; left: 16px; right: 16px; bottom: 4px; height: 2px; border-radius: 1px; background: var(--line-1); pointer-events: none; }
.upd-stream-win { position: absolute; inset: 0; overflow: hidden; border-radius: inherit;
  transform: translateX(calc((var(--p) - 1) * 100%)); transition: transform 900ms var(--ease-out); }
.upd-stream-fill { position: absolute; inset: 0;
  background: linear-gradient(90deg, #7c3aed 0%, #4f7cff 55%, #22d3ee 100%);   /* the brand gradient, horizontal */
  transform: translateX(calc((1 - var(--p)) * 100%)); transition: transform 900ms var(--ease-out); }
.upd-stream-head { position: absolute; inset: 0; transform: translateX(calc(var(--p) * 100%)); transition: transform 900ms var(--ease-out); }
.upd-stream-head > i { position: absolute; left: -3px; top: -2px; width: 6px; height: 6px; border-radius: 50%;
  background: radial-gradient(circle, #fff 0, #c4b5fd 45%, rgb(196 181 253 / 0) 72%); }
.upd-pk { position: absolute; inset: 0; opacity: 0; }                 /* 100 % wide: translateX(%) = bar widths */
.upd-pk > i { position: absolute; left: -10px; top: 0; width: 10px; height: 2px; border-radius: 1px;
  background: linear-gradient(90deg, rgb(196 181 253 / 0), #c4b5fd); }
:root:not([data-fx='on']) .upd-stream-win, :root:not([data-fx='on']) .upd-stream-fill,
:root:not([data-fx='on']) .upd-stream-head { transition-duration: 300ms; }
```

The window and the fill move in opposite directions, so the gradient stays pinned to the bar. Violet leads, and cyan shows only as the fill nears 100 %. Nothing is ever scaled.

If `percent` goes down (a new download starts), the card sets `data-reset` for one frame, which applies `transition: none` to the stream and the head, so nothing sweeps backwards.

### 5.5 Download motion (one-shots per real event, no loops)

On each `downloading` event, `useCardPhase` (§6) calls `onProgress(prev, next)`, which does the following. Every call is gated by `fx()`: Full and focused.

| Trigger | Element | Keyframes (`keyframes.ts`) | Timing |
|---|---|---|---|
| Every event, packets by speed bucket: slow (< 1 MiB/s) 1 packet, mid (< 8 MiB/s) 2, fast 3 | `.upd-pk[i]` | `[{transform:'translateX(P%)',opacity:0},{opacity:.9,offset:.2},{transform:'translateX(0%)',opacity:0}]`, where P = `percent` (packets fly from the head into the core) | slow 1000 ms, mid 800, fast 620; delay `i × 140`; `EASE.in` (`--ease-in`). Previous packet animations on the same element are cancelled first. |
| `lit` increases | `.rx-head > i` | `scale [1, 1.7, 1]`, `opacity [.6, 1, .6]` | 320 ms `--ease-out` |
| Crosses 25 / 50 / 75 % | `.rx-ping` | `scale .7 → 2`, `opacity .6 → 0` | 700 ms `--ease-out` |

The CSS transitions (stream, head, glow, tick opacity) run in every tier except Reduced, and never while idle. At 1 event per second that means at most about 1.3 s of compositor work per second, plus one 240 ms repaint of the 52 px SVG each time a tick lights (about every 4 %).

**Stall:** after 6 s without an event, the sub reads « 38,1 / 92,4 Mo · en attente du réseau » and the speed is hidden. Nothing moves.

### 5.6 Arrival (first `downloading` of a version)

| t | Element | Keyframes | Easing |
|---|---|---|---|
| 0–420 | `.upd-card` | `translateY(14px) scale(.96)`, opacity 0 → none, 1 | `--ease-glide` |
| 260–1360 | `.upd-sheen` | `translateX(-100%)` opacity 0 → (offset .3 opacity 1) → `translateX(100%)` opacity 0 | `--ease-in-out` |
| 140–560 | `.rx-svg` | `rotate(-120deg)` opacity 0 → `rotate(0)` opacity 1 | `--ease-glide` |
| 300–1000 | `.rx-ping` | `scale .6 → 2.2`, `opacity .8 → 0` | `--ease-out` |
| 380–620 | `.upd-text` | `translateY(4px)` opacity 0 → none, 1 | `--ease-out` |

**Sober:** `.upd-card` `translateY(10px)` opacity 0 → none, 260 ms `--ease-out` (`anim(…, { level: 'sober' })`), and nothing else. **Reduced:** it appears. **Idle at mount** (for example a download that starts while you're in game): it appears, with no entrance at all.

### 5.7 Text swap (`TextSwap.tsx`)

When `swapKey` changes, the previous rows stay in an absolutely positioned `.upd-text.is-out` layer for the out duration, then unmount.

| Tier | Out (old block) | In (new block) |
|---|---|---|
| Full | opacity 1 → 0, 140 ms `--ease-in` | `translateY(4px)` opacity 0 → none, 240 ms `--ease-out`, delay 100 |
| Sober | opacity 1 → 0, 100 ms | opacity 0 → 1, 160 ms, delay 60 |
| Reduced / idle | none (instant swap) | none |

The sub row alone (percent, bytes, seconds) changes text in place, without a swap.

### 5.8 Mini pill (a game is running or a launch is pending, phase `download` or `verify`)

```
╭──────────────────────────────╮ 188 × 40, r pill, --surface-3, 1 px --line-2
│ ◔  0.6.0 · 41 %              │ ring 24 px, text 600 12/16 --text-1 tabular
╰──────────────────────────────╯
```

```tsx
<button className="upd-mini" onClick={onOpenAbout} aria-label={`Mise à jour ${v} : ${percent} %. Voir les détails`}>
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <circle className="upd-mini-track" cx="12" cy="12" r="10" />
    <circle className="upd-mini-val" cx="12" cy="12" r="10" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - percent} transform="rotate(-90 12 12)" />
  </svg>
  <span>{v} · {verify ? 'vérification' : pct(percent)}</span>
</button>
```

```css
.upd-mini { display: flex; align-items: center; gap: 8px; width: 188px; height: 40px; padding: 0 12px 0 8px; border-radius: var(--r-pill);
  background: var(--surface-3); border: 1px solid var(--line-2); box-shadow: var(--sh-2); font: 600 12px/16px var(--font-ui); color: var(--text-1); }
.upd-mini, .upd-mini * { transition: none !important; animation: none !important; }
.upd-mini-track { fill: none; stroke: var(--line-2); stroke-width: 2.5; }
.upd-mini-val { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; }
.upd-mini:hover { background: var(--surface-2); }          /* no transition */
.upd-mini:focus-visible { box-shadow: var(--focus); }
```

The contract is that `document.getAnimations().filter(a => a.effect?.target?.closest?.('.upd-dock')).length === 0` while the mini pill is shown. Switching between card and pill is instant in both directions. The pill never expands on hover. `ready`, `refused` and `interrupted` always use the full card, even in game or during a launch, because they carry buttons. They are static while idle, and the countdown is paused in game and during a launch (§6.6, §6.10).


---

## 6. Card phases (`update/useCardPhase.ts`)

### 6.1 Contract

```ts
export type CardPhase = 'hidden' | 'download' | 'verify' | 'lock' | 'armed' | 'refused' | 'interrupted' | 'installing'
export type HoldReason = 'unfocused' | 'hover' | 'game' | 'launch' | 'blocked' | null   // 'launch': 0.7.0 (§6.10)

export interface CardModel {
  phase: CardPhase
  mini: boolean                      // quiet && (download | verify), quiet = inGame || launching (§6.10)
  version: string
  percent: number                    // download
  p: number                          // 0..1 written to --p
  bytes?: { done: number; total: number; bps?: number }
  stalled: boolean
  step?: 'signature' | 'hash' | 'check'  // displayed step (queued)
  hashP: number
  fingerprint?: string
  left: number                       // countdown seconds
  hold: HoldReason                   // why the countdown is not running
  errorCode?: UpdateErrorCode
  preview: boolean
}

export function useCardPhase(real: UpdateState | null, o: { inGame: boolean; launching: boolean; cardRef: RefObject<HTMLElement> }): {
  model: CardModel
  restart(origin?: DOMRect | null): void
  later(): void
  close(): void
  setHovered(v: boolean): void
}
```

The preview (§11) feeds the same hook through a `PreviewFrame` in place of `real`, so the card has a single rendering path.

### 6.2 Visibility

| Real state | Card |
|---|---|
| `disabled`, `idle`, `checking`, `none` | hidden |
| `downloading` | `download` (or mini) |
| `verifying` | `verify` (or mini), queued (§6.3) |
| `ready` | `lock` once, then `armed` |
| `installing` | `installing` (visible only in Reduced or hidden, otherwise under the stage veil) |
| `error` with `version` and `code: 'unsigned'` | `refused` |
| `error` with `version` and another code | `interrupted` |
| `error` without `version` (a failed check) | hidden, as today: À propos only |

Dismissal (« Plus tard », ×) stores the key `${state}:${version}:${code ?? ''}` as it does today. A new version or a new phase shows the card again.

### 6.3 Step queue (verify)

The real steps can arrive in a few ms. The queue makes each one readable without slowing anything that matters.

- Minimum dwell per displayed step: Full `signature 260 / hash 400 / check 540` ms (540 is the 17-character fingerprint entrance), Sober `200 / 300 / 400`, Reduced `0 / 0 / 0`.
- The displayed step advances through `signature → hash → check` in order. If a real step was skipped (a tiny file can go from signature straight to check), `hash` is shown at 100 %, which is true because the hash finished.
- The displayed values are always the newest real ones (hash percent, fingerprint).
- `ready` is displayed when the current dwell ends, but **never more than 1200 ms after `ready` arrived**. That cap is lower in Sober (the dwells add up to 900 ms) and 0 in Reduced.
- `error` bypasses the queue at once.
- Idle: dwells still apply (they are timers, not frames), but nothing animates.

### 6.4 Verify visuals

Entering from download:

| t | Element | Change | Tier |
|---|---|---|---|
| 0–240 | `.rx-ticks` | opacity 1 → .35 (CSS) | Full, Sober |
| 0–240 | `.rx-head`, `.rx-center` | opacity → 0 (CSS) | Full, Sober |
| 0 | `.upd-stream` | unmounts | all |
| 80–340 | `svg.rx-shield` | `scale(.7)` opacity 0 → `scale(1)` opacity 1, `--ease-glide` (WAAPI; Sober: opacity only, 180 ms) | Full / Sober |
| 0 | `.rx-orbit` | opacity 1 and spinning during `signature` only (CSS `.fx-loop`, so it pauses when idle) | Full (Sober: static arc) |

Per displayed step:

| Step | Kicker | Sub | Core |
|---|---|---|---|
| `signature` | « Vérification · 1/3 » | « Récupération de la signature… » | orbit |
| `hash` | « Vérification · 2/3 » | « Empreinte SHA-512 · 63 % » (real `hashed/total`) | inner arc = `hashP` (stepped redraw) |
| `check` | « Vérification · 3/3 » | `SHA-512` (label, `--text-3`) + `3f9a1c0e…a77d8b21` (`.upd-fp`, `title` = all 128 hex) | shield only |

Fingerprint entrance (Full): 17 `<span>`s (8 hex, `…`, 8 hex), each going from `translateY(2px)` opacity 0 to none, 140 ms `--ease-out`, delay `i × 24` ms, for about 520 ms in total. These are the real characters in order. Nothing is scrambled. **Sober:** the whole line fades in, 160 ms. **Reduced:** it appears.

The title stays « Player X 0.6.0 » throughout. The kicker swaps text in place (no TextSwap), so only the digit changes.

### 6.5 Lock (once per version, when `armed` is displayed right after a visible verify, focused, Full)

`useCardPhase` sets phase `lock` and class `is-locking` for 900 ms, then switches to `armed`.

| t | Element | Keyframes | Easing |
|---|---|---|---|
| 0–260 | `.rx-shield-fill` (inside `svg.rx-shield`, `transform-box: view-box; transform-origin: 26px 25px`) | `scale(.6)` opacity 0 → `scale(1)` opacity 1 | `--ease-glide` |
| 140–360 | `svg.rx-mark .rx-check` (same origin) | `scale(.5)` opacity 0 → `scale(1)` opacity 1 | `--ease-out` |
| 0–600 | `.rx-ping` | `scale .7 → 2`, `opacity .7 → 0` | `--ease-out` |
| 0–500 | `.rx-glow` | opacity 1 → .6 (the "flash" is the glow settling: no filter) | `--ease-out` |
| 200–440 | `.rx-ticks` | opacity .35 → 0 (CSS) | `--ease-out` |
| 200–590 | `.rx-cell-lit` ×10 | opacity 0 → 1, 120 ms each, `transition-delay: 200 + j × 30` (CSS, `.is-locking`) | `--ease-out` |
| 600–840 | `svg.rx-shield`, `svg.rx-mark` | opacity 1 → 0, `scale 1 → .8` | `--ease-in` |
| 700–920 | `.rx-sec` (« 10 ») | `translateY(60%)` opacity 0 → none, 1 | `--ease-glide` |
| 300 | text | TextSwap to the ready rows (out 140, in 240 at +100) | as §5.7 |
| 600, 660 | « Redémarrer », « Plus tard » | `translateY(6px)` opacity 0 → none, 240 ms | `--ease-glide` |
| 300–1400 | `.upd-sheen` | as §5.6 | `--ease-in-out` |

**Sober (≈ 400 ms):** the shield fill and check fade in (180 ms), cells appear all together (200 ms), the shield fades out at 220 ms, and the text swaps. **Reduced:** the armed frame appears.

**Arrived while idle** (the window is in the background, or you're in game): the static armed frame is shown, with no lock. On the next `focus` the **arming accent** (650 ms, Full) plays once per version:

| t | Element | Keyframes |
|---|---|---|
| 0–600 | `.rx-ping` | `scale .7 → 2`, `opacity .7 → 0`, `--ease-out` |
| 0–650 | `.rx-glow` | opacity `[.6, 1, .6]`, `--ease-in-out` |
| 0–470 | `.rx-cell-lit` | `.is-locking` sweep (opacity 0 → 1, `j × 30` ms) |
| 0–1100 | `.upd-sheen` | as §5.6 |

If the app starts already `ready` (the state was fetched at boot), the card enters (§5.6) straight into `armed`, and the arming accent plays on focus.

### 6.6 Countdown

```ts
const D = 10 // RESTART_DELAY, unchanged
const counting =
  phase === 'armed' && !dismissed && !blocked && !installing && !preview?.stopped &&
  focused && !hovered && !focusWithin && !quiet && lockDone   // quiet = inGame || launching (§6.10)
```

- **Existing rules are unchanged.** 10 s, counted only while the window is focused, and restarting from 10 for each new version.
- **New rules can only delay a restart.** The countdown pauses while the pointer is over the card or focus is inside it (WCAG 2.2.1), while a game is running, and while a launch is pending. After a failed restart (`blocked`) it does not run again for that version.
- Ticks come from a `setTimeout` chain of 1000 ms, restarted on resume, so the next tick is a full second after resuming. `left` keeps its value through pauses, as it does today.
- At `left === 0`: `restart(reactorRect)`.

Per tick (only while `counting`):

| Element | Change | Tier |
|---|---|---|
| `.rx-cell-lit[j = left]` | loses `.on`: opacity 1 → 0, 240 ms (CSS). One cell goes out per second. | Full, Sober |
| `.rx-sec` | remounts (`key={left}`) with `translateY(60%)` opacity 0 → none, 220 ms `--ease-glide` | Full (Sober: opacity 120 ms) |
| `.rx-glow` | opacity `[.6, .85, .6]`, 600 ms `--ease-in-out`; for the last 3 s `[.6, 1, .6]` | Full |
| `.upd-card` | `.is-critical` when `left ≤ 3`: cells `--accent-text`, digit white (instant) | all |
| `.upd-charge` in « Redémarrer » | one WAAPI animation per version: `translateX(-100%) → translateX(0)`, `D × 1000` ms linear, `fill: both`. Each tick sets `currentTime = (D − left) × 1000`. It is paused when `counting` is false and played when true, so it can never drift from the cells. | Full |

```css
.upd-go { position: relative; overflow: hidden; isolation: isolate; }
.upd-charge { position: absolute; inset: 0; z-index: -1; background: rgb(255 255 255 / 0.14); transform: translateX(-100%); pointer-events: none; }
```

Hold states (no countdown, no motion):

| `hold` | Centre | Sub |
|---|---|---|
| `unfocused` | `pause` icon (crossfade 120 ms) | « En pause jusqu'à ton retour » |
| `hover` | digit at opacity .5 (`.is-held`) | « Redémarrage en pause » |
| `game` | `pause` icon | « En pause pendant ta partie » |
| `launch` | `pause` icon | « En pause pendant le lancement » |
| `blocked` | `check` icon | « Redémarre quand tu veux » |

### 6.7 « Plus tard »

```ts
later(): the card plays upd-leave and then sets dismissed = key.
notify('La 0.6.0 s'installera quand tu fermeras Player X', { kind: 'info', id: 'update' })
```

`upd-leave` (Full and Sober): opacity 1 → 0, `translateY(0) → translateY(8px)`, `scale 1 → .98`, 200 ms `--ease-in`. Reduced: instant. `installUpdate` is not called. The at-quit install stays armed by main.

### 6.8 Refused and interrupted

| | Refused (`code: 'unsigned'`) | Interrupted (`verify`, `network`, `other`) |
|---|---|---|
| Kicker | `shield-x` 12 + « Refusée » (`--danger-text`) | « Interrompue » (`--text-2`) |
| Title | « Player X 0.6.0 » | `network` « Connexion perdue »; `verify` « Vérification impossible »; `other` « Téléchargement interrompu » |
| Sub | « Non signée · rien n'est installé » | « 0.6.0 · nouvel essai dans 30 min » (`RETRY_DELAY`, real) |
| Core | ticks .25; `svg.rx-shield` line in `--danger` (`scale(.6)` opacity 0 → 1, 260 ms `--ease-glide`); cross stamp (`scale(.5)` opacity 0 → 1, 220 ms at 200 ms) | ticks .35; `alert-circle` 16 at the centre (opacity 0 → 1, 180 ms) |
| Filament | `--danger` | `--text-3` |
| Actions | « Détails » (ghost sm → Paramètres › À propos), × (`aria-label="Fermer"`) | the same |
| Persistence | Until closed. A security event must be seen, not only in À propos. | Until closed, or until the next state. |

Neither card has any motion after its entrance: no jolt, no shatter, no loop. In Sober the shield and cross fade in over 180 ms. Reduced is static. Colour is never the only signal: there is always a shape (crossed shield, alert icon) and text.

### 6.9 Installing (card)

Buttons are disabled and the sub reads « Redémarrage… ». The centre shows the `check` icon. No animation.

### 6.10 During a game launch (0.7.0)

A launch from Player X (`launch-sequence.md`) gets the in-game contract before the game is confirmed running.

- **Inputs.** `UpdateNotice` gets `inGame = games.some(g => g.running)` and `launching = realPending && !inGame`, where `realPending` means a non-demo launch in `checking`, `sending`, `waiting` or `relay` (`useLaunchPending().real`). `useCardPhase` takes `{ inGame, launching, cardRef }` and works from `quiet = inGame || launching`.
- **Mini pill** only in `download` and `verify`: `mini = quiet && !view.preview && (phase === 'download' || phase === 'verify')`. The entrance is suppressed on `quiet`, as it is in game.
- **Hold:** `inGame ? 'game' : launching ? 'launch' : …`. `HOLD_SUB.launch` is « En pause pendant le lancement ». The armed card stays full size and the launch card stacks above it (§5.1).
- **Preview:** `gameRunning` (`update/session.ts`) is true while a game runs **or a real launch is pending**, so the preview is refused during a launch, as in game. A demo launch never sets it: the preview and the countdown are untouched.

---

## 7. Saut (restart → quit)

### 7.1 Triggers and the call order

The triggers are « Redémarrer » on the card, the countdown reaching 0, and « Redémarrer pour mettre à jour » in À propos. All three call `requestRestart`. Install-at-quit (closing the window) has **no** animation: closing stays instant.

```ts
// update/stage.ts
const DELAY: Record<Tier | 'hidden', number> = { full: 1200, sober: 450, reduced: 150, hidden: 0 }

export function requestRestart(o: { version: string; origin: DOMRect | null; trigger: HTMLElement | null; preview?: boolean }): void {
  const t: Tier | 'hidden' = document.hidden ? 'hidden' : tier()
  const delayMs = DELAY[t]
  // 1. THE IPC FIRST, before any visual work, in its own try: whatever happens to the animation, main has the order.
  let result: Promise<InstallResult | void>
  if (o.preview) result = Promise.resolve({ ok: true, quitAt: Date.now() + delayMs })
  else {
    try { result = window.launcher.installUpdate({ delayMs }) } catch (e) { result = Promise.reject(e) }
  }
  const session = newWarpSession(o, t, delayMs)  // watchdog, state listener, cleanup registry
  result.then(
    (r) => (r && r.ok === false ? session.abort('refused') : session.armSafety(r?.quitAt ?? Date.now() + delayMs)),
    () => session.abort('ipc')
  )
  if (t === 'hidden') return
  // 2. Visuals. Any exception is caught; main still quits on its own timer.
  try { session.startVisuals() } catch (e) { console.error(e); session.showFinalFrame() }
}
```

`delayMs` by tier is Full **1200**, Sober **450**, Reduced **150**, and 0 when hidden. Main clamps it to `MAX_INSTALL_DELAY = 1500` (§3.3), so a frozen renderer can never hold the install for longer.

### 7.2 Full: the View Transition implosion

```ts
function startFull(s: WarpSession): void {
  const root = document.documentElement
  const C = center(s.origin) ?? { x: innerWidth / 2, y: innerHeight / 2 }  // reactor or button centre
  const canVT = typeof document.startViewTransition === 'function' && !root.classList.contains('vt-active') && !document.hidden
  const mount = (): void => {
    flushSync(() => stage.set({ mode: 'warp', tier: 'full', origin: C, version: s.version, preview: s.preview, phase: 'run' }))
    document.querySelector('.shell')?.setAttribute('inert', '')
  }
  if (!canVT) { mount(); return s.runTimeline({ vt: false, C }) }
  root.classList.add('vt-warp')
  const t = document.startViewTransition(mount)
  s.onCleanup(() => root.classList.remove('vt-warp'))
  t.ready.then(() => s.runTimeline({ vt: true, C }), () => s.runTimeline({ vt: false, C }))
  t.finished.catch(() => {}).finally(() => root.classList.remove('vt-warp'))
}
```

What the transition captures:

- **old(root)** is a flat bitmap of the whole UI. Blur, Ambient canvases and toasts are frozen into it, so nothing live is re-rasterised or changes look mid-fade (this fixes judge issue 3).
- **new(root)** is the UI with `.stage-veil` on top: opaque `--bg-0`, the match-cut colour.
- **`.stage-fx`** has `view-transition-name: px-warp`. It holds the canvas, flash, ring, mark and text, and is captured as a **live** layer above everything, so the canvas and WAAPI animations inside it render normally.

```css
/* stage.css */
html.vt-warp::view-transition-group(root) { animation: none; }
html.vt-warp::view-transition-old(root),
html.vt-warp::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
html.vt-warp::view-transition-old(root) { z-index: 1; }      /* the snapshot stays above the veil while it shrinks away */
html.vt-warp::view-transition-group(px-warp) { animation: none; z-index: 2; }
html.vt-warp::view-transition-new(px-warp) { animation: none; }
.stage-fx { position: fixed; inset: 0; contain: layout paint; pointer-events: none; }
.stage[data-mode='warp'] .stage-fx { view-transition-name: px-warp; }   /* named only during the warp */
```

**Degradation.** If Chromium ignores `z-index` on the old image, the veil covers the snapshot at once. The streaks, flash, mark and text still play on top, which is an acceptable result. §16 checks this on real frames. If the transition is skipped or aborted (another transition starts, the call throws, the tab is hidden), the timeline runs with `vt: false`. In that case `.stage-veil` fades in over the live UI, with the same timing as the snapshot fade.

### 7.3 Full timeline (t = 0 at `ready`; everything ends by 1000 ms, before the safety point at `quitAt − 120`)

| t (ms) | Layer | Keyframes | Easing |
|---|---|---|---|
| 0 | card | buttons disabled, sub « Redémarrage… » (already under the snapshot) | — |
| 0–480 | canvas, **aspiration** | 120 streaks converge on C (§7.4) | τ³ |
| 40–560 | `::view-transition-old(root)` (WAAPI `pseudoElement`) | `transform: scale(1)` opacity 1 → `scale(.92)` opacity 0, `transform-origin: C` | `--ease-warp` |
| 40–560 | (no-VT fallback) `.stage-veil` | opacity 0 → 1 | `--ease-warp` |
| 400–600 | `.stage-flash` at C (420 px disc) | `scale(.2)` opacity 0 → (offset .35, opacity .85) → `scale(1.6)` opacity 0 | `--ease-out` |
| 460–820 | `.stage-mark` | `translate(C − M) scale(.35)` opacity 0 → (offset .25, opacity 1) → `translate(0,0) scale(1)` opacity 1. The core becomes the logo. | `--ease-glide` |
| 540–900 | canvas, **burst** | streaks burst from M (§7.4) | τ² |
| 600–720 | `.stage-ring` (TickRing 160 px) | opacity 0 → 1 | `--ease-out` |
| 720–900 | `.stage-ring` | `scale(1)` opacity 1 → `scale(1.25)` opacity 0 | `--ease-out` |
| 760–960 | `.stage-text` | `translateY(6px)` opacity 0 → none, 1 | `--ease-glide` |
| 880–1000 | `canvas` element | opacity 1 → 0 | `--ease-out` |
| `quitAt − 120` | — | **safety:** `finish()` on every stage animation, stop the streaks, show the final frame | — |
| `quitAt` | main | `quitAndInstall(true, true)`. The window closes on the final frame. | — |

M is the mark centre at `(50 %, 50 % − 40 px)`. **Final frame:** `--bg-0`, the PX mark (BrandMark height 40, about 84 px wide) at M, and the text below. Nothing loops on it.

```
                       [PX]                    mark, centre at 50 % − 40 px
                    REDÉMARRAGE                overline 11/14 caps --accent-text   (top: 50 % + 56 px)
               Installation de la 0.6.0        Sora 600 18/24 --text-1
   Player X se ferme quelques secondes et revient tout seul.   12/16 --text-3
```

### 7.4 Streak engine (`update/streaks.ts`)

```ts
export type StreakMode = 'aspire' | 'burst' | 'arrive'
export interface StreakPhase { mode: StreakMode; at: number; dur: number; origin: { x: number; y: number } }
export function runStreaks(canvas: HTMLCanvasElement, phases: StreakPhase[], o?: { count?: number }): { done: Promise<void>; stop(): void }
```

- **Data.** `Float32Array`s `theta`, `r0 ∈ [.25, 1]` and `v ∈ [.6, 1.4]`, plus a `Uint8Array` colour bucket: 70 % `#9b6cff`, 25 % `#4f7cff`, 5 % `#e9e3ff`. **Never cyan.** Indices are interleaved by bucket, so dropping the second half keeps the mix.
- **Size.** `dpr = Math.min(1.25, devicePixelRatio, Math.sqrt(3e6 / (innerWidth * innerHeight)))`, so the backing store is at most 3 MP. `canvas.width = innerWidth * dpr`, then `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
- **Per frame.** `clearRect`, `globalCompositeOperation = 'lighter'`, `lineWidth = 1.25`, `lineCap = 'round'`. For each of the 3 buckets: one `beginPath`, all `moveTo`/`lineTo`, then one `stroke()` with `globalAlpha = phaseAlpha`. That is **3 strokes per frame**.
- **Time-based.** `t = now − start`, so dropped frames skip ahead instead of slowing down. R is the distance from the origin to the farthest window corner.

| Mode | τ | Head radius | Tail | Alpha |
|---|---|---|---|---|
| `aspire` (toward C) | `t / dur`, k = τ³ | `r0·R·(1 − k)` | outward, `(12 + 120·k)·v` px | `.7·min(1, τ/.4)` |
| `burst` (from M) | `t / dur` | `(0.03 + v·1.3·τ²)·R` | inward, `(0.05 + 0.5·τ)·v·0.25·R` | `.7·(1 − smoothstep(.6, 1, τ))` |
| `arrive` (from M, reveal) | `t / dur`, e = 1 − (1 − τ)⁴ | `r0·R·(0.7 + 0.3·e)` | inward, `(1 − e)·0.35·R·v` (shrinks to a point) | `.7·(1 − τ²)` |

- **Adaptive.** If the first 8 frames average more than 20 ms, `count` drops from 120 to 60 for the rest of the run.
- **Self-stopping.** At the end of the last phase, and on `stop()`: `cancelAnimationFrame`, `clearRect`, `canvas.width = 0` (frees the backing store), then `done` resolves. No rAF survives a run.

### 7.5 Abort paths (the UI is never stuck)

| Trigger | Detected by |
|---|---|
| `installUpdate` resolved `{ ok: false }` (not ready, no updater) | `result.then` |
| `installUpdate` rejected | `result.then` |
| Main re-emits `ready` after `installing` (quitAndInstall failed, or the 8 s failsafe) | the session subscribes to `onUpdateState` |
| No quit by `delayMs + 10 000` ms | the renderer watchdog `setTimeout` |

```ts
abort(reason): run once —
  hide .stage-fx (mark and text would otherwise snap back to their visible CSS state); stop the streaks; cancel all stage animations; remove html.vt-warp, html.px-revealing
  stage → fade out (.stage opacity 1→0, 220 ms --ease-out, anim level 'sober'), then mode 'idle'
  .shell.removeAttribute('inert'); restore focus to o.trigger if still connected, else to the card's « Redémarrer »
  card: blocked = true for this version → hold 'blocked', sub « Redémarre quand tu veux »
  notify('Le redémarrage n'a pas marché. Réessaie, ou ferme Player X pour installer la 0.6.0.', { kind: 'error', id: 'update' })
```

`armSafety(quitAt)` schedules the final-frame safety at `quitAt − 120` and keeps the watchdog. Cleanup is registered once and runs in `finally` for both the abort and the preview end.

### 7.6 Sober and Reduced

**Sober (450 ms to quit):** no View Transition, canvas, flash or ring, and the shell stays still. `.stage-veil` goes opacity 0 → 1 over 0–240 ms `--ease-out`. `.stage-mark` goes from `scale(.96)` opacity 0 to none, 60–300 ms `--ease-glide`. `.stage-text` fades in over 120–300 ms. The safety point is at 330 ms.
**Reduced (150 ms):** the final frame appears at once (veil, mark, text), then the quit.
**Hidden window:** no visuals, IPC only (delay 0).

The shell gets `inert` in every visible tier. Focus moves to `body`. The stage's own `sr-only` status announces « Redémarrage de Player X pour installer la 0.6.0. ».

### 7.7 The gap

While NSIS `/S` runs, nothing can be shown, because the installer needs Player X to exit. The final frame said « quelques secondes » and gave no number, because the install time is unknown in advance. The relaunched window paints `backgroundColor #0b0d14` (unchanged in `index.ts`). With P1 it opens at the same bounds, and the first React frame is the same veil with the same mark at M. The cut is a match cut.

---

## 8. Allumage (first launch after an update)

### 8.1 When it runs

```ts
// stage.ts, at module load (imported by App before anything renders)
const revealed = read('pg.update.revealed')                    // `${version}|${installedAt ?? 0}`
const startTier = initialTier()
export const REVEAL_AT_BOOT = UPDATED_THIS_LAUNCH && startTier !== 'reduced' && !revealed?.startsWith(`${VERSION}|`)
if (REVEAL_AT_BOOT) document.documentElement.classList.add('px-revealing')   // hides the real rail logo (§8.4)
export const revealDone = createStore<boolean>(!REVEAL_AT_BOOT)
```

- `UPDATED_THIS_LAUNCH` uses the same rule as WhatsNew (§4.2), so a fresh install never shows a reveal.
- **Async path** (the simulator, or a same-version reinstall): when `lastUpdate` loads with `thisBoot && to === VERSION` and `revealed !== `${VERSION}|${installedAt}``, it starts the reveal, but only while the hold (§8.3) is still running. Otherwise it is skipped.
- `pg.update.revealed` is written when the reveal **starts**, so a reload or crash never replays it.
- **Reduced:** no stage. `revealDone` is true from the start, and WhatsNew carries every value.
- **Hidden window** (started minimised): no reveal. `revealDone` becomes true.

### 8.2 Variant

| Condition at the end of the hold | Variant |
|---|---|
| `startTier === 'full'`, visible, and (focused, or `lastUpdate.relaunch && backMs` defined, because you just clicked « Redémarrer » and Windows may not have handed over focus) | **Cinematic** (§8.4) |
| `startTier === 'sober'`, or `lastUpdate.relaunch === false` (installed when you closed Player X, maybe days ago) | **Sober** (§8.5) |
| visible but unfocused, with no recent relaunch | **Quiet**: veil and mark fade out, 260 ms `--ease-out`. No content. |

No record at all (for example the first update **into** 0.6.0, done by 0.5.1, which does not write one) counts as `relaunch` unknown and gives the cinematic variant with versions only.

### 8.3 First frame and hold

- The stage mounts in App's first commit with `data-mode="reveal" data-phase="hold" data-tier={startTier}`: an opaque `.stage-veil` and `.stage-mark` at M, static. This is the warp's final frame without the text. The stage CSS keys off `.stage[data-tier]` rather than `:root[data-fx]` because it paints before App's effect sets `data-fx`. **This is the documented exception.**
- **Hold:** wait until `document.querySelector('.boot') === null` (a `MutationObserver` on `#root`, with `childList` and `subtree`). That is at least 400 ms in Full or 300 ms in Sober (which also gives `lastUpdate` time to load) and at most 1500 ms. Then wait 2 rAF, so the first painted UI frame exists under the veil.
- During the hold, nothing animates, and input is swallowed as a skip (§8.6).

### 8.4 Cinematic timeline (Full; t = 0 at the end of the hold)

```
                           ·    ✦      ·
                     ╭──── 48-tick ring ────╮
                     │         [PX]         │          mark at M (static since the first frame)
                     ╰──────────────────────╯
                      MISE À JOUR INSTALLÉE              overline 11/14 caps --accent-text
                        0.5.1  →  0.6.0                  from: Sora 500 20 --text-3 · arrow --text-3 · to: Sora 700 44 --text-1
          ⛨ Signée · 3f9a1c0e   Téléchargée en 38 s   De retour en 12 s       chips 12/16 --text-2 on --surface-2, r pill, h 24
                 Clique ou appuie sur une touche pour passer                    12/16 --text-3, bottom 32 px
```

| t (ms) | Layer | Keyframes | Easing |
|---|---|---|---|
| 0–600 | canvas `arrive` from M | out of hyperspace: decelerating streaks shrinking to points | e = 1 − (1 − τ)⁴ |
| 0–600 | `.stage-ring` (8 groups of 6 ticks) | each group opacity 0 → 1, 180 ms, delay `g × 60` | `--ease-out` |
| 150–410 | `.stage-kicker` | `translateY(6px)` opacity 0 → none | `--ease-glide` |
| 250–510 | `.stage-from` and arrow | `translateX(-6px)` opacity 0 → none | `--ease-glide` |
| 350–750 | `.stage-to` (VersionRoll: one span per real character, ≤ 8) | `translateY(.5em)` opacity 0 → none, 360 ms, delay `i × 40` | `--ease-glide` |
| 600–900 | `.stage-chip` ×≤3 | `translateY(4px)` opacity 0 → none, 240 ms, delay `k × 60` | `--ease-glide` |
| 500–760 | `.stage-skip` | opacity 0 → 1 | `--ease-out` |
| 1400–1640 | `.stage-text` | opacity 1 → 0, `scale(1) → scale(.98)` | `--ease-in` |
| 1400–1800 | `.stage-ring` | `scale(1)` opacity 1 → `scale(1.3)` opacity 0 | `--ease-in` |
| 1400–1900 | `.stage-shock` (160 px ring, 1.5 px `--accent-line`) | `scale(.3)` opacity .5 → `scale(2.6)` opacity 0 | `--ease-out` |
| 1400–2000 | `.stage-mark` | **FLIP to `.favrail-logo .brand-mark`**: `translate(dx, dy) scale(15 / 40)`. Rects are read once at 1400 ms. | `--ease-glide` |
| 1450–1950 | `.stage-veil` | opacity 1 → 0: the UI appears under the flying mark | `--ease-out` |
| 1400 | `.stage` | `pointer-events` stays `none`; the skip listeners are removed, so input reaches the UI from here on | — |
| 2000 | — | remove `html.px-revealing` (the real logo shows exactly where the flying mark lands), unmount the stage, `revealDone.set(true)` | — |

If `.favrail-logo .brand-mark` is missing (macOS, Login or Setup on screen), the mark fades in place instead: `scale(1) → scale(.9)`, opacity → 0, 400 ms.

Data:

- `from` = `lastUpdate.from` when `thisBoot && to === VERSION`, otherwise `PREVIOUS_VERSION`, otherwise omitted (then there is no arrow).
- Chips come only from `lastUpdate` with `thisBoot`: « Signée · 3f9a1c0e » when there is a fingerprint (a fingerprint is only stored after a valid signature), « Téléchargée en 38 s » with `downloadMs`, « De retour en 12 s » with `backMs`. A chip whose value is unknown is not rendered.

### 8.5 Sober timeline (≈ 1.06 s after the hold)

The mark is static from the first frame. Over 0–260 ms the kicker, versions and chips fade in together (opacity, `--ease-out`). They hold until 860 ms. Over 860–1060 ms the veil, mark and content fade out. No canvas, ring, FLIP or shock.

### 8.6 Skip

```ts
const onSkip = (e: Event): void => { e.stopPropagation(); e.preventDefault(); skip() }
addEventListener('keydown', onSkip, { capture: true, once: true })
addEventListener('pointerdown', onSkip, { capture: true, once: true })
```

These are active from the hold until 1400 ms, then removed (both are removed when either fires). A skip jumps to the exit, compressed to 300 ms: content and ring out in 150 ms, the mark FLIP in 300 ms, the veil in 300 ms. The first key or click is swallowed and never reaches Shell's shortcuts, and WhatsNew is not open yet, so Esc cannot close it. The overlay never takes focus.

A safety timeout removes `html.px-revealing` and the listeners 5 s after mount (hold ≤ 1.5 s + timeline 2 s + margin), whatever happens.


### 8.7 Stage DOM and CSS (`UpdateStage.tsx`, `stage.css`)

```tsx
createPortal(
  <div className="stage" data-mode={mode} data-phase={phase} data-tier={tier} data-preview={preview || undefined}>
    <div className="stage-veil" />
    <div className="stage-fx">
      <canvas className="stage-canvas" ref={canvasRef} />
      <span className="stage-flash" style={{ left: C.x, top: C.y }} />
      <span className="stage-shock" />
      <TickRing className="stage-ring" />                       {/* 160 px, 48 ticks from r 68 to r 76, stroke 2, round caps, colours sampled like TICK_COLORS, 8 <g> groups of 6 */}
      <img className="stage-mark brand-mark" src={mark} alt="" draggable={false} />  {/* height 40 */}
      <div className="stage-text">{mode === 'warp' ? <WarpText /> : <RevealText />}</div>
      {mode === 'reveal' && <p className="stage-skip">Clique ou appuie sur une touche pour passer</p>}
      {preview && <span className="stage-badge">Aperçu · Échap pour arrêter</span>}
    </div>
    <span className="sr-only" role="status">{announce}</span>
  </div>,
  document.body
)
```

```css
.stage { position: fixed; inset: 0; z-index: var(--z-warp); pointer-events: none; }
.stage[data-mode='warp'] { pointer-events: auto; }                 /* the warp swallows clicks; the reveal never does */
.stage-veil { position: absolute; inset: 0; background: var(--bg-0); }
.stage[data-mode='warp'][data-phase='run'] .stage-veil { opacity: 1; }  /* opaque in new(root); WAAPI fades it in on the no-VT path */
.stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.stage-flash { position: absolute; width: 420px; height: 420px; margin: -210px 0 0 -210px; border-radius: 50%; opacity: 0;
  background: radial-gradient(closest-side, rgb(233 227 255 / 0.9), rgb(155 108 255 / 0.5) 40%, rgb(124 58 237 / 0)); }
.stage-mark, .stage-ring, .stage-shock { position: absolute; left: 50%; top: calc(50% - 40px); translate: -50% -50%; }
.stage-mark { height: 40px; width: auto; }
.stage-ring { width: 160px; height: 160px; opacity: 0; }
.stage-shock { width: 160px; height: 160px; border-radius: 50%; border: 1.5px solid var(--accent-line); opacity: 0; }
.stage-text { position: absolute; left: 0; right: 0; top: calc(50% + 56px); display: grid; justify-items: center; gap: 6px; text-align: center; padding: 0 16px; }
.stage-kicker { font: 600 11px/14px var(--font-ui); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-text); }
.stage-line { font: 600 18px/24px var(--font-display); color: var(--text-1); }
.stage-caption { font: 400 12px/16px var(--font-ui); color: var(--text-3); }
.stage-versions { display: flex; align-items: baseline; gap: 14px; font-family: var(--font-display); font-variant-numeric: tabular-nums; }
.stage-from { font-weight: 500; font-size: 20px; color: var(--text-3); }
.stage-arrow { font-size: 20px; color: var(--text-3); }
.stage-to { font-weight: 700; font-size: 44px; line-height: 52px; color: var(--text-1); }
.stage-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
.stage-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: var(--r-pill);
  background: var(--surface-2); font: 500 12px/16px var(--font-ui); color: var(--text-2); }
.stage-chip .num-mono { font-family: var(--font-mono); }
.stage-skip { position: absolute; left: 0; right: 0; bottom: 32px; text-align: center; font: 400 12px/16px var(--font-ui); color: var(--text-3); opacity: 0; }
.stage-badge { position: absolute; top: 60px; left: 50%; translate: -50% 0; height: 24px; padding: 0 10px; border-radius: var(--r-pill);
  background: var(--accent-soft); color: var(--accent-text); font: 600 11px/24px var(--font-ui); letter-spacing: .06em; text-transform: uppercase; }
html.px-revealing .favrail-logo .brand-mark { opacity: 0; }
/* Reveal: hidden during the hold; WAAPI entrances use fill 'both', so a skipped animation (anim() → null) just shows the element. */
.stage[data-mode='reveal'][data-phase='hold'] :is(.stage-text, .stage-skip, .stage-ring) { opacity: 0; }
.stage[data-mode='reveal'][data-phase='run'][data-tier='full'] .stage-ring { opacity: 1; }
.stage[data-mode='reveal'][data-tier='full'] .stage-ring g { opacity: 0; }      /* the 8 groups power up one by one */
.stage[data-mode='warp'] .stage-ring g { opacity: 1; }

/* Sober and reduced reveal: everything at rest, faded by WAAPI (level 'sober') or shown as is. */
.stage[data-tier='reduced'] .stage-ring, .stage[data-tier='sober'] .stage-ring, .stage[data-tier='sober'] .stage-canvas { display: none; }

@keyframes stage-fade-in { from { opacity: 0; } }
@keyframes stage-fade-out { to { opacity: 0; } }
```

All the warp and reveal motion is WAAPI from `keyframes.ts`, gated by `anim()`. The stage passes `whenIdle: true` only for the quiet reveal fade and the abort fade, which must run even when unfocused. CSS keyframes appear only where WAAPI is not worth it (the Sober fades use `stage-fade-in` and `stage-fade-out` with `animation: stage-fade-in 260ms var(--ease-out) both`, plus the `rx-orbit` loop).

---

## 9. Quoi de neuf (WhatsNew)

- `shouldOpen(version)` is unchanged and still runs in the `useState` initialiser, so `pg.lastVersion` is written at the same moment as today (judge issue 18).
- The dialog renders only when `open && revealDone && lastUpdate.loaded`. `useEscape` uses the same condition. After a cinematic reveal it opens right as the mark lands. In Reduced it opens as it does today (at most 400 ms later, while `lastUpdate` loads).
- **Header:** the existing `BrandMark` 22, kicker and title, with the version wrapped in `VersionRoll` (Full: characters `translateY(.5em)` opacity 0 → none, 360 ms `--ease-glide`, delay `120 + i × 40`; Sober: one 200 ms fade; Reduced: static). One header sheen (`.wn-sheen` span, the §5.6 keyframes, 1100 ms, delay 300). `.wn-glow` stays as it is (static).
- **Chips** (row under the title, the same `.stage-chip` style, each rendered only if known):
  1. « 0.5.1 → 0.6.0 », with `from` resolved as in §8.4;
  2. `shield-check` 12 + « Signée · 3f9a1c0e » (`title` = the full fingerprint);
  3. « Téléchargée en 38 s »;
  4. « De retour en 12 s ».
  Entrance (Full): `translateY(4px)` opacity 0 → none, 240 ms, delay `300 + k × 60`.
- **« Voir l'aperçu »:** when `VERSION === PREVIEW_INTRO` (`'0.6.0'`, a constant in `preview.ts`) and not in preview, a ghost button sits left of « Voir sur GitHub ». It closes the dialog, then calls `startPreview({ from: 'whatsnew' })`. Its `title` is « Rejoue l'animation de mise à jour, sans rien installer ».
- **Preview mode** (§11): the kicker reads « Aperçu · Mise à jour installée », the chips come only from a stored `LastUpdate` whose `to === VERSION`, and closing it ends the preview.
- `autoFocus` stays on « C'est parti ».

---

## 10. Paramètres › À propos

`UpdateStatus` gets the new cases (the switch stays exhaustive):

| State | Phrase (`role="status"`) | Detail (`aria-hidden` when it changes often) | Track |
|---|---|---|---|
| `downloading` | « Téléchargement de 0.6.0… » | « 41 % · 38,1 / 92,4 Mo » | counter-translated, `--p = percent/100` |
| `verifying` | « Vérification de 0.6.0… » | « signature (1/3) » / « empreinte 63 % (2/3) » / « contrôle (3/3) » | `hashed/total` during hash, full otherwise |
| `ready` | « 0.6.0 est prête et signée » | « · elle s'installera aussi à la fermeture de Player X » | — |
| `installing` | « Redémarrage pour installer la 0.6.0… » | — | — |
| `error` | `message` (unchanged texts) | — | — |

- **Track:** `.set-ab-track` gains `.set-ab-win` and `.set-ab-fill` with the §5.4 counter-translation (`--p` on the track, 420 ms `--ease-out`, none when idle or Reduced). This replaces the `scaleX` fill.
- **Buttons:** `canCheck` also excludes `verifying` and `installing`. In `ready`, « Redémarrer pour mettre à jour » calls `requestRestart({ version, origin: button.getBoundingClientRect(), trigger: button })`. While `installing` it is disabled with a spinner and « Redémarrage… ». The old 15 s re-enable is gone: the abort path (§7.5) re-enables it.
- **New rows**, inside the existing `.set-rows`:

| Row | Shown when | Value | Control |
|---|---|---|---|
| « Empreinte de la 0.6.0 » (P1) | `fingerprint` known (`verifying` step 3 or `ready`) | `3f9a 1c0e 77b2 … ` (`fpGroups`, `--font-mono` 12/16 `--text-2`, `title` = all 128 hex) | « Copier l'empreinte » (ghost, `copy` 14) → `navigator.clipboard.writeText(hex)`, then the toast « Empreinte copiée » (success) or « Copie impossible » (error) |
| « Dernière mise à jour » (P2) | `lastUpdate.value` | « 0.5.1 → 0.6.0 · il y a 2 j · signée » (+ « · 92,4 Mo » when size is known) | — |
| « Animation de mise à jour » | always | « Rejoue la séquence sans rien télécharger ni installer » | « Voir l'aperçu » (secondary). Disabled during a real `downloading`, `verifying`, `ready` or `installing`, with `title` « Indisponible pendant une vraie mise à jour ». |

The help text under the rows is unchanged.

---

## 11. Aperçu (preview) — `update/preview.ts`

### 11.1 Honesty rules

- `PreviewFrame` has **no** version, byte, speed or fingerprint fields:

```ts
export type PreviewFrame =
  | { phase: 'download'; percent: number }
  | { phase: 'verify'; step: 'signature' | 'hash' | 'check'; hashP: number }
  | { phase: 'ready'; left: number }
```

- The card title reads « Exemple de mise à jour ». Every kicker starts with « Aperçu · ». The warp and reveal show the `stage-badge` « Aperçu · Échap pour arrêter ».
- The only fingerprint shown is the **real** one of the running version, and only if a stored `LastUpdate` has `to === VERSION`. It is labelled « Empreinte de ta version ».
- The reveal shows the running `VERSION` (which is installed) with the kicker « Aperçu · mise à jour installée », with no `from` and no invented target.
- The preview never calls `installUpdate`. `requestRestart({ preview: true })` resolves locally (§7.1).

### 11.2 Timeline (the visuals of the current tier)

| t (ms) | Frame |
|---|---|
| 0 | the card arrives in `download` at 0 % (§5.6) |
| 500 … 5000 | `percent` += 10 every 500 ms; packets as speed bucket `mid` |
| 5000 | `verify` / `signature` |
| 5600 | `hash`, `hashP` 0 → 1 in 6 steps of 100 ms |
| 6200 | `check` (fingerprint line only if the real one is known; otherwise the sub reads « Aucune vérification réelle ») |
| 6800 | `ready` → lock (900 ms) → countdown **5 s** with the same pause rules (hover pauses it, which is a good demo) |
| left 0, or « Redémarrer » | `requestRestart({ preview: true })`: warp with the preview text |
| warp end + 600 | stage → `reveal` (preview), skipping the hold (the UI is already there) |
| `revealDone` | WhatsNew opens in preview mode |
| WhatsNew closed | the preview ends: « Aperçu terminé » in the live region |

### 11.3 Stop and cleanup

The preview stops on Esc (at any phase; during the reveal, Esc is a skip that also stops), on × on the card (`aria-label` « Arrêter l'aperçu », present in every preview phase), on « Plus tard » during preview ready, on the window going idle, and on any real `downloading`, `verifying`, `ready` or `installing` event, which always wins.

```ts
export async function startPreview(o: { from: 'about' | 'whatsnew'; trigger?: HTMLElement | null }): Promise<void> {
  if (preview.get().active) return
  const ctl = new AbortController()
  try { await runPreview(ctl.signal) }                     // timers registered on ctl.signal
  finally {
    stopStreaks(); cancelStageAnimations()
    document.querySelector('.shell')?.removeAttribute('inert')
    document.documentElement.classList.remove('vt-warp', 'px-revealing')
    stage.set(IDLE); preview.set(PREVIEW_IDLE); revealDone.set(true)
    o.trigger?.isConnected && o.trigger.focus()
  }
}
```

---

## 12. How the user sees it right away

1. **Installing 0.6.0 itself.** 0.5.1 downloads it with its old card and restarts with no warp (that is old code). On the first launch of 0.6.0, `pg.lastVersion` is `0.5.1`, so the **Allumage** plays: it comes out of hyperspace with « 0.5.1 → 0.6.0 », then the mark flies into the rail. There are no chips, because 0.5.1 wrote no record and nothing is invented.
2. Quoi de neuf opens with the « 0.5.1 → 0.6.0 » chip and **« Voir l'aperçu »** (`PREVIEW_INTRO`). One click plays the whole sequence (card, shield, lock, countdown, warp, reveal) without downloading or installing anything.
3. Anytime: **Paramètres › À propos › Animation de mise à jour › Voir l'aperçu**.
4. The release notes have one bullet pointing there (§13.9).
5. From 0.6.0 to the next version, everything is real: real bytes, real fingerprint, real « De retour en N s ».

---

## 13. Copy deck (FR, *tu*, short)

Kickers are written in sentence case. CSS sets uppercase. `{v}` is the version, `{from}` the previous one. Numbers use `format.ts` (non-breaking space before units).

### 13.1 Card: download

| Key | Text |
|---|---|
| kicker | « Téléchargement » |
| title | « Player X {v} » |
| sub, before bytes | « Téléchargement en arrière-plan » |
| sub | « 38,1 / 92,4 Mo · 4,2 Mo/s » |
| sub, stalled | « 38,1 / 92,4 Mo · en attente du réseau » |
| hit `aria-label` | « Téléchargement de Player X {v} : 41 %. Voir les détails » |
| hit `title` | « Voir les détails dans Paramètres › À propos » |
| mini | « {v} · 41 % » / « {v} · vérification » |
| mini `aria-label` | « Mise à jour {v} : 41 %. Voir les détails » / « Mise à jour {v} : vérification. Voir les détails » |

### 13.2 Card: verify

| Key | Text |
|---|---|
| kicker | « Vérification · 1/3 », « Vérification · 2/3 », « Vérification · 3/3 » |
| title | « Player X {v} » |
| sub, step 1 | « Récupération de la signature… » |
| sub, step 2 | « Empreinte SHA-512 · 63 % » |
| sub, step 3 | « SHA-512 » + `3f9a1c0e…a77d8b21` |
| hit `aria-label` | « Vérification de Player X {v}. Voir les détails » |

### 13.3 Card: ready

| Key | Text |
|---|---|
| kicker | « Signée et prête » (with `shield-check`) |
| title | « {running} → {v} » |
| sub | « Redémarrage dans 7 s » |
| sub, unfocused | « En pause jusqu'à ton retour » |
| sub, hover or focus | « Redémarrage en pause » |
| sub, game | « En pause pendant ta partie » |
| sub, launch | « En pause pendant le lancement » |
| sub, blocked | « Redémarre quand tu veux » |
| sub, installing | « Redémarrage… » |
| primary | « Redémarrer » (`title` « Installer la {v} maintenant ») |
| ghost | « Plus tard » (`title` « Elle s'installera quand tu fermeras Player X ») |
| toast, Plus tard | « La {v} s'installera quand tu fermeras Player X » |

### 13.4 Card: refused and interrupted

| Key | Text |
|---|---|
| refused kicker | « Refusée » |
| refused title | « Player X {v} » |
| refused sub | « Non signée · rien n'est installé » |
| interrupted kicker | « Interrompue » |
| interrupted title | `network` « Connexion perdue » · `verify` « Vérification impossible » · `other` « Téléchargement interrompu » |
| interrupted sub | « {v} · nouvel essai dans 30 min » |
| buttons | « Détails » · × `aria-label` « Fermer » |

### 13.5 Warp

| Key | Text |
|---|---|
| overline | « Redémarrage » |
| line | « Installation de la {v} » |
| caption | « Player X se ferme quelques secondes et revient tout seul. » |
| preview overline | « Aperçu » |
| preview line | « Player X ne se ferme pas » |
| preview caption | « C'est ce que tu verras au prochain redémarrage. » |
| abort toast | « Le redémarrage n'a pas marché. Réessaie, ou ferme Player X pour installer la {v}. » |

### 13.6 Reveal and WhatsNew

| Key | Text |
|---|---|
| kicker | « Mise à jour installée » / preview « Aperçu · mise à jour installée » |
| chips | « {from} → {v} » · « Signée · 3f9a1c0e » · « Téléchargée en 38 s » · « De retour en 12 s » |
| skip | « Clique ou appuie sur une touche pour passer » |
| badge | « Aperçu · Échap pour arrêter » |
| WhatsNew button | « Voir l'aperçu » (`title` « Rejoue l'animation de mise à jour, sans rien installer ») |
| WhatsNew title | « Quoi de neuf dans la {v} » (unchanged) |

### 13.7 Preview card

| Key | Text |
|---|---|
| title | « Exemple de mise à jour » |
| kickers | « Aperçu · téléchargement », « Aperçu · vérification · 2/3 », « Aperçu · prête » |
| subs | « Aucun téléchargement réel » · « Aucune vérification réelle » · « Empreinte de ta version : 3f9a1c0e…a77d8b21 » · « Redémarrage simulé dans 4 s » · « Aperçu en pause » |
| × `aria-label` | « Arrêter l'aperçu » |

### 13.8 À propos

| Key | Text |
|---|---|
| downloading | « Téléchargement de {v}… » + « 41 % · 38,1 / 92,4 Mo » |
| verifying | « Vérification de {v}… » + « signature (1/3) » / « empreinte 63 % (2/3) » / « contrôle (3/3) » |
| ready | « {v} est prête et signée » + « · elle s'installera aussi à la fermeture de Player X » |
| installing | « Redémarrage pour installer la {v}… » |
| fingerprint row | label « Empreinte de la {v} » · button « Copier l'empreinte » · toasts « Empreinte copiée » / « Copie impossible » |
| last update row | label « Dernière mise à jour » · « {from} → {to} · il y a 2 j · signée » |
| animation row | label « Animation de mise à jour » · « Rejoue la séquence sans rien télécharger ni installer » · « Voir l'aperçu » · disabled `title` « Indisponible pendant une vraie mise à jour » |

### 13.9 Live regions and release note

| Event | Announcement (polite, once) |
|---|---|
| download starts | « Téléchargement de Player X {v} en arrière-plan. » |
| verify starts | « Vérification de la mise à jour {v}. » |
| armed | « Player X {v} est prête et signée. Redémarrage automatique dans 10 secondes, ou choisis Plus tard. » |
| refused | « Mise à jour {v} refusée : elle n'est pas signée par Player X. Rien n'est installé. » |
| interrupted | « Mise à jour {v} interrompue. Nouvel essai dans 30 minutes. » |
| restart | « Redémarrage de Player X pour installer la {v}. » |
| reveal | « Player X {v} est installée. » |
| preview start / end | « Aperçu de l'animation de mise à jour. Échap pour arrêter. » / « Aperçu terminé. » |

Release note bullet (`docs/release-notes/0.6.0.md`, under the first section):

> - **Mises à jour plus vivantes** : le téléchargement, la vérification de la signature et le redémarrage ont leur propre animation, avec les vrais chiffres (vitesse, empreinte, durée). Pendant une partie, la carte devient une petite pastille immobile. Pour la voir tout de suite : **Paramètres › À propos › Voir l'aperçu**.

---

## 14. Accessibility

1. **Live region.** One `sr-only` polite `role="status"` per dock, written only on phase changes (§13.9). The countdown is never announced each second, and `role="status"` is removed from the card. The stage has its own region for the warp and reveal. Toasts keep their own.
2. **Timing (WCAG 2.2.1).** The countdown pauses on hover, focus-within, an unfocused window, a running game and a pending launch. « Plus tard » turns it off for this version. A restart is always available from À propos. A failed restart never retries on its own.
3. **Motion (WCAG 2.2.2, 2.3.1).** During the download there are no infinite animations. The only loop is the signature spinner, an activity indicator, `.fx-loop`, which pauses when idle. There is one flash, 200 ms, under 3 per second.
4. **Vestibular.** Full-window radial motion is limited to ≤ 1.0 s (warp) and ≤ 0.6 s (arrival). Alpha ≤ .7, the snapshot shrinks only to .92, and there is no camera zoom in the reveal. Turning off « Effets visuels » removes the streaks (Sober). « Réduire les animations », or Windows' animation setting, gives Reduced: nothing moves and every value stays (card text, WhatsNew chips).
5. **Focus.** Nothing in the card auto-focuses, which would pause the countdown. During the warp the shell is `inert`, and focus goes back to the trigger on abort. The reveal never takes focus. Its skip swallows the skip event and, when it is a modifier (Ctrl+K…), the chord key that follows. WhatsNew keeps `autoFocus` on « C'est parti ».
6. **Not colour alone.** Refused is a crossed shield plus « Refusée » plus danger. Interrupted is an alert icon plus text. Critical seconds keep the number.
7. **Contrast.** Data lines use `--text-2` on `--surface-3` (`--text-3` is 4.498:1 there, just under 4.5, and about 3.97:1 on hover, so no small text uses it; the fingerprint label uses `--text-2`). The fingerprint is 11 px mono in `--text-2`, not 10.5 px in `--text-3`.
8. **Keyboard.** The download and verify card is one button (Enter opens À propos). Ready has two buttons. Refused and interrupted have « Détails » and ×. The mini pill is a button. In preview, Esc stops at any phase.

---

## 15. Performance budget and checks

| Phase | Budget |
|---|---|
| Download, focused | 0 infinite animations, 0 rAF. Per progress event: ≤ 3 packet animations (≤ 1 s), CSS transitions on transforms and opacity (≤ 900 ms), one 52 px SVG repaint when a tick lights. |
| Download, idle or in game | 0 animations and 0 transitions. One repaint of the changed text per event. In mini: `getAnimations()` inside the dock is empty. |
| Verify | One spinner (signature step only, `.fx-loop`). The inner arc is redrawn ≤ 10 Hz during the hash. |
| Armed | One-shots per real second only. The charge is one paused or playing WAAPI animation. |
| Warp | ≤ 1.0 s. Canvas ≤ 3 MP backing, 3 strokes per frame, 120 → 60 streaks. p95 frame ≤ **20 ms** on the reference PC (motion-premium §8). The snapshot is a GPU texture. |
| Reveal | Hold ≤ 1.5 s (static), then ≤ 2.0 s. Canvas 0.6 s. 8 ring groups, ≤ 8 characters, ≤ 3 chips. |
| Memory | `canvas.width = 0` after each run. Every animation ends or is cancelled. No listeners survive the stage. |

Greps for review (each must return nothing, except where noted):

```sh
rg -n "will-change" src/renderer/src/update src/renderer/src/components/update.css
rg -n "transition:[^;]*(width|height|filter|box-shadow|stroke)" src/renderer/src/update src/renderer/src/components/update.css
rg -n "backdrop-filter" src/renderer/src/components/update.css
rg -n "infinite" src/renderer/src/update src/renderer/src/components/update.css          # only rx-orbit
rg -n "requestAnimationFrame" src/renderer/src/update                                   # only streaks.ts and the 2-rAF hold in stage.ts
rg -n "\.animate\(" src/renderer/src/update src/renderer/src/components/UpdateNotice.tsx src/renderer/src/components/WhatsNew.tsx  # only inside anim() and the VT pseudo call
rg -n "#22d3ee|--live|--brand-cyan" src/renderer/src/update/streaks.ts                    # none: streaks are never cyan
```

`rg -n "fx-loop"` must match `.rx-orbit` only.

---

## 16. Test plan

### 16.1 Harness

- Build: `npx electron-vite build`, then serve: `http-server out/renderer -p 4173 -s` (the build uses relative `./assets` paths). Playwright 1.56 is installed globally: run `NODE_PATH=$(npm root -g) node scripts/qa/update-anim.mjs`. Nothing is added to `package.json`.
- Contexts: 1440 × 900 DPR 1, 1280 × 800 DPR 1.25, 1024 × 640 DPR 1.5 (the minimum window). `recordVideo` is on for every scenario. For the warp and reveal, a CDP `Page.startScreencast` (`everyNthFrame: 1`, png) saves timestamped frames to `scripts/qa/out/<scenario>/`.
- Time: `page.clock.install()` for the stall, countdown, watchdog and retry timers. Visual frame captures run in real time.

### 16.2 `scripts/qa/launcher-mock.js` (via `page.addInitScript`)

```js
(() => {
  const listeners = new Set()
  const gamesListeners = new Set()
  const px = (window.__px = {
    state: { state: 'none', checkedAt: Date.now() },
    calls: [],
    installResult: { ok: true },          // { ok:false } | 'reject' | 'hang'
    lastUpdate: null,
    focused: true,
    raf: 0,
    emit(s) { px.state = s; for (const cb of listeners) cb(s) },
    setFocused(v) { px.focused = v; window.dispatchEvent(new Event(v ? 'focus' : 'blur')); document.dispatchEvent(new Event('visibilitychange')) },
    games: [{ id: 'demo-1', name: 'Demo', store: 'steam', running: false }]
  })
  Object.defineProperty(Document.prototype, 'hasFocus', { configurable: true, value() { return px.focused } })
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => { px.raf++; return raf(cb) }
  const base = {
    version: '0.6.0',
    platform: 'win32',
    getUpdateState: async () => px.state,
    checkForUpdates: async () => px.state,
    onUpdateState: (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    async installUpdate(opts) {
      px.calls.push({ fn: 'installUpdate', opts, at: performance.now() })
      const r = px.installResult
      if (r === 'reject') throw new Error('ipc')
      if (r === 'hang') return new Promise(() => {})
      if (!r.ok) return r
      const quitAt = Date.now() + (opts?.delayMs ?? 0)
      px.emit({ state: 'installing', version: px.state.version, quitAt })
      return { ok: true, quitAt }
    },
    getLastUpdate: async () => px.lastUpdate,
    getSettings: async () => ({ demoMode: true }),                 // extend with whatever Shell needs to reach .shell
    getGames: async () => px.games,
    onGamesChanged: (cb) => (gamesListeners.add(cb), () => gamesListeners.delete(cb))
  }
  px.setRunning = (v) => { px.games = px.games.map((g, i) => (i === 0 ? { ...g, running: v } : g)); for (const cb of gamesListeners) cb() }
  window.launcher = new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : typeof k === 'string' && k.startsWith('on') ? () => () => {} : async () => null)
  })
  try { localStorage.setItem('pg.setup', '1') } catch {}
})()
```

Helpers in `update-anim.mjs`:

- `dockAnims()`: `document.getAnimations().filter(a => a.effect?.target?.closest?.('.upd-dock'))`.
- `infinite()`: animations whose `getComputedTiming().iterations === Infinity`.
- `overflow()`: every `.upd-text > *` and `.stage-text *` with `scrollWidth > clientWidth`.
- `rafDelta(ms)`: `__px.raf` before and after. Always compared against a **baseline** taken with the card hidden on the same screen, because Ambient may use rAF.

### 16.3 Scenarios

| # | Scenario | Steps | Assertions | Captures |
|---|---|---|---|---|
| S1 | Download, Full, focused | emit `downloading` 0, then 12 events 1 s apart (+3.5 %, `transferred`/`total` 92.4 MiB, `bytesPerSecond` 4.4 MB/s) | text per §13.1; `--p` matches; `infinite()` empty; `rafDelta(3000)` = baseline; ≤ 3 packet anims per event; `lit` = floor(p·24); no overflow | screenshots at 0 / 41 / 100 % (each DPR); screencast 2 s around a tick light |
| S2 | Speed buckets | `bytesPerSecond` 0.5 / 4 / 20 MiB/s | 1 / 2 / 3 packets, durations 1000 / 800 / 620 | screencast 1.5 s each |
| S3 | Idle during download | `setFocused(false)`, then 3 events | `dockAnims()` empty; computed `transition-duration` of `.upd-stream-win` is `0s`; text updated | screenshot |
| S4 | Mini in game | `__px.setRunning(true)` | `.upd-mini` is 188 × 40; text « 0.6.0 · 41 % »; `dockAnims()` empty for 5 s; `.content` padding-bottom 68 px | screenshot each DPR |
| S5 | Stall | clock +6 s with no event | sub « … · en attente du réseau »; speed hidden; next event clears it | screenshot |
| S6 | Verify queue | emit signature, then hash (5 events, 100 ms), check (fingerprint 128 hex), ready, all within 50 ms | displayed kicker 1/3 → 2/3 → 3/3 with dwell ≥ 260 / 400 / 540 ms; 17 fingerprint spans; `title` = 128 hex; armed shown ≤ 1200 ms after `ready` | screencast 0–2.5 s |
| S7 | Lock and countdown | continue S6, focused | lock 900 ms; then cells `on` count = `left` each second; `.upd-charge` `currentTime ≈ (10 − left)·1000 ± 50`; `.is-critical` at ≤ 3 | screencast lock; screenshots at 10, 3, 1 |
| S8 | Pauses | hover the card; Tab into it; `setFocused(false)`; set running | `left` frozen per cause; subs per §13.3; centre pause icon or dimmed digit; charge paused; resume resumes from the same `left` | screenshots per cause |
| S9 | Arming deferred | `ready` emitted while unfocused | `dockAnims()` empty; then `setFocused(true)`: accent anims for ≤ 700 ms; a second focus plays nothing | screencast |
| S10 | Plus tard | click | leave anim 200 ms; card gone; toast text; `calls` empty; re-emit the same `ready`: still hidden; new version: card back | screenshot of the toast |
| S11 | Errors | `error` unsigned + version; network / verify / other + version; error without version | refused and interrupted per §13.4; danger filament; × closes; no card without version; no anims after entrance | screenshots |
| S12 | Warp, Full | click « Redémarrer » | `calls.length === 1`, `opts.delayMs === 1200`, `calls[0].at` ≤ the start of the first stage animation; `html.vt-warp` during the transition; `.shell[inert]`; all stage anims `finished` by `quitAt − 120`; no rAF from streaks afterwards; canvas `width === 0` | screencast 0–1200 ms (check that the snapshot recedes **over** the veil; if not, log it as the documented degradation); final-frame screenshot. In the mock nothing quits, so end the scenario before the watchdog aborts at 11.2 s. |
| S13 | Warp, other tiers | Sober (`pg.ui.visualFx = false`), Reduced, `document.hidden` | delayMs 450 / 150 / 0; Sober: no canvas, no `vt-warp`; Reduced: 0 stage anims, final frame at once; hidden: no stage | screencast Sober; screenshot Reduced |
| S14 | Warp failures | `installResult` `{ok:false}`; `'reject'`; `'hang'` + clock `delay + 10 s`; ok then emit `ready` | each: stage gone ≤ 300 ms; no `inert`; focus on « Redémarrer »; sub « Redémarre quand tu veux »; error toast; countdown never restarts for that version | screenshot after abort |
| S15 | Reveal, cinematic | `pg.lastVersion = '0.5.1'`; `lastUpdate = {from:'0.5.1', to:'0.6.0', fingerprint, downloadMs:38000, backMs:12000, relaunch:true, thisBoot:true, installedAt}`; reload | first frame = veil + mark at M (pixel diff of the mark region vs the S12 final frame < 2 %); hold until `.boot` is gone; timeline; at 2000 ms the flying mark rect equals `.favrail-logo .brand-mark` rect ± 1 px; `px-revealing` removed; WhatsNew opens with 4 chips | screencast 0–2200 ms; WhatsNew screenshot |
| S16 | Reveal variants | `relaunch:false`; unfocused; Reduced; no record; skip by key (with a `keydown` spy on `document`); reload after reveal | Sober ≈ 1.06 s; quiet 260 ms; Reduced: no `.stage`, WhatsNew at once; no record: versions only, no chips; skip: exit ≤ 300 ms and the spy is **not** called; reload: no reveal (`pg.update.revealed`) | screencasts |
| S17 | Preview | À propos › « Voir l'aperçu »; let it run; repeat with Esc in each phase; repeat with a real `downloading` mid-way | `calls` stays empty; every card kicker starts with « Aperçu »; the only version text is `VERSION`; Esc cleans up (no `inert`, no `vt-warp`, no `.stage`, no `px-revealing`); a real event stops it | full video; screenshots per phase |
| S18 | À propos | each state; copy the fingerprint (grant `clipboard-write`) | phrases per §13.8; `canCheck` false in verifying and installing; clipboard = 128 hex; toast « Empreinte copiée »; the preview button is disabled during real states | screenshots |
| S19 | Layout | every phase × 3 contexts | `overflow()` empty; dock does not cover `.content` text (padding 104 / 68); toasts at 108 / 72 px under 1312 px | screenshot matrix |

### 16.4 Frames to keep (attach to the PR)

`download-41.png`, `verify-3of3.png`, `lock-450ms.png`, `armed-3s.png`, `mini.png`, `refused.png`, `interrupted.png`, `warp-200ms.png`, `warp-500ms.png`, `warp-700ms.png`, `warp-final.png`, `reveal-0ms.png`, `reveal-700ms.png`, `reveal-1700ms.png`, `whatsnew-chips.png`, `about-ready.png`, at DPR 1 and 1.25, plus the S12, S15 and S17 videos.

### 16.5 Windows manual pass (reference PC, packaged dev build)

- W1. `PX_UPDATE_SIM=1 npm run dev`: the full real main path. Download → verify (real hash of `electron.exe`) → ready → warp → hide 2.5 s → reload → reveal with « De retour en 3 s ».
- W2. `PX_UPDATE_SIM=unsigned`, `stall`, `offline`, and `PX_UPDATE_SIM_FAIL=1` (the 8 s failsafe gives the UI back).
- W3. DevTools Performance: warp and reveal p95 ≤ 20 ms. Download focused: no frames between events except the transitions. Unfocused: no frames.
- W4. Task Manager while a game runs on the other screen and the download progresses: Player X's GPU process stays at its idle level.
- W5. 125 % and 150 % scaling: ticks and cells are crisp, no text clipping.
- W6. Taskbar: progress during the download, indeterminate during the verify, cleared after.

### 16.6 Main unit tests (`src/main/services/updateHandoff.test.ts`)

Run with `node --experimental-strip-types --test src/main/services/updateHandoff.test.ts`, and add `"test:update"` to `scripts`. This uses Node's built-in runner, so there is no new dependency.

- `clampDelay`: `undefined → 0`, `-5 → 0`, `1200 → 1200`, `99999 → 1500`, `NaN → 0`, `'1200' → 0`.
- `isPending`: accepts a full record; rejects a bad fingerprint (not 128 hex), a missing `relaunch`, or a negative `quitAt`.
- `lastFromPending`: a version mismatch gives `null`; `relaunch:true` with 12 s gives `backMs 12000`; `relaunch:false` gives no `backMs`; 200 s gives no `backMs`; a negative difference gives no `backMs`; `thisBoot` is true.

---

## 17. Risks and edge cases

| Risk | Mitigation |
|---|---|
| Chromium ignores `z-index` on `::view-transition-old(root)` | The veil covers the snapshot at once and the streaks, flash and mark still play. S12 inspects frames. |
| Another View Transition starts during the warp (it aborts ours) | `ready` or `finished` rejects, and the timeline continues with `vt:false` (veil fade over the live UI). The shell is inert, so user-triggered transitions cannot start. |
| The relaunched window is not focused (Windows foreground lock) | The cinematic still plays when the window is visible and `relaunch && backMs` (§8.2). |
| A slow HDD makes the hash take seconds | That is real time, shown as a real percent. The step queue only adds a minimum, never a maximum. |
| `addQuitHandler` is internal to electron-updater | This risk exists today. Only install-at-quit depends on it. |
| A quit is cancelled after `before-quit` saved a pending record | `consumePending` deletes it on the next boot (`to !== version`). |
| A download restarts (percent goes down) | `data-reset` frame: no backward sweep. |
| A differential download's `total` is the delta | The label is "bytes in transit", which is true. The real size comes later from `fs.stat`. |
| macOS: no rail logo | The mark fades in place. |
| Boot work competes with the reveal | Hold until `.boot` is gone, plus 2 rAF, the adaptive streak count, and no blocking. |
| Clock difference between `quitAt` (main) and the renderer | Same machine, same `Date.now()`. The safety point uses 120 ms of margin. |
| An 8 s failsafe fires after the installer started but the app did not quit | State returns to `ready`. A second `quitAndInstall` is ignored once (electron-updater resets its flag), then works. The UI explains through the toast. |

---

## 18. Build order (one pass) and cut lines

| Order | Work | Priority |
|---|---|---|
| 1 | `types.ts`, preload, `updateHandoff.ts` + tests | P0 |
| 2 | `updater.ts`: verifying steps, error codes, `install` / `revert` / failsafe, handoff, `before-quit`, check guard, `update:last` | P0 |
| 3 | `updateSim.ts` (`PX_UPDATE_SIM`) | P1, build it early |
| 4 | `tokens.css`, `session.ts`, `format.ts`, `keyframes.ts` | P0 |
| 5 | `Reactor`, card, stream, `TextSwap`, `useCardPhase` (download, verify queue, lock, countdown with every pause rule, Plus tard, refused, interrupted), mini pill, live region | P0 |
| 6 | `stage.ts` + `UpdateStage`: warp (VT + fallback), Sober, Reduced, hidden, abort and watchdog, final-frame safety | P0 |
| 7 | Reveal: hold, cinematic, Sober, quiet, skip, `revealed` key; mark fade in place | P0 |
| 8 | WhatsNew waits for `revealDone` | P0 |
| 9 | Preview (card + warp + reveal + WhatsNew preview) and the À propos row | P0 (it is how the user sees it now) |
| 10 | À propos new states and track | P0 |
| 11 | QA harness S1–S19, main tests | P0 |
| 12 | Mark FLIP into `.favrail-logo` | P1 |
| 13 | WhatsNew chips, `VersionRoll`, « Voir l'aperçu » (`PREVIEW_INTRO`) | P1 |
| 14 | Fingerprint row and « Copier l'empreinte » | P1 |
| 15 | Window bounds restore, `setProgressBar` | P1 |
| 16 | Arming accent on focus (otherwise the static armed frame) | P1 |
| 17 | « Dernière mise à jour » row, WhatsNew header sheen | P2 |

**Cut lines if time runs short.** Drop all of P2 first. Then drop P1 in this order: the header sheen, bounds restore, the arming accent, the FLIP (keep the fade in place), and `setProgressBar`. Never cut items 5–11: they are the experience, the safety (abort, watchdog, failsafe) and the proof.

---

## 19. What was cut, and why

1. **ETA** (« ≈ 13 s »). It is a prediction, not a measurement.
2. **Infinite loops during the download** (6 s orbit, packet stream, bar sweep). Motion now comes from real events only, so a stalled download is still.
3. **40-tick ring, SVG masks and `pathLength` dashes.** Too fine at 100 % scaling, and fragile. Replaced by 24 explicit ticks and 10 explicit arcs.
4. **SVG line-draw animations** (`stroke-dashoffset` on the shield, check and cross). They are not transform or opacity. Replaced by stamps (`scale` + `opacity`).
5. **Scan line inside the core, full-window scan line and typed telemetry in the reveal.** Tactical-HUD drift and boot-time cost.
6. **WhatsNew 112 px decorative ring and bullets lighting up.** Noise. The chips carry the data.
7. **Animating the whole `.shell`** (scale and opacity). It caused a raster hitch and blur pop. Replaced by the View Transition snapshot.
8. **2.75 s reveal.** Now about 2 s after a static hold, 1.06 s for install-at-quit launches, and 260 ms when unfocused.
9. **From Métamorphose:** the 3-slice morph, liquid orb, odometer digits and spring easings. Seams, drift bugs, and §1.3 conflicts.
10. **From Overdrive:** RGB-split glitch, scanlines, shatter and jolt on refusal, particle level-up burst, breathing halo loop and segment chase. Off-brand for Nuit Néon, and playful on a security event.
11. **« 96 Mo à télécharger » before the first byte.** Wrong with differential downloads.
12. **`follow()` rAF smoothing of the percent** (and `useSmoothPercent`). Replaced by CSS transitions on `--p`.
13. **Shell unfold during the reveal.** It animated four big layers during boot. Only the mark flies.
14. **Filament pulse in the last seconds.** One more effect for little gain. The cells, digit and charge carry it.
15. **Renderer-owned restart delay and localStorage handoff.** Main owns the clamped delay and writes the handoff synchronously.
16. **Mini pill expanding on hover.** It was a 520 ms layout morph. The pill is a button to À propos.
