# Player X: « Séquence Mise à feu », the game launch (0.7.0)

**Status:** shipped in 0.7.0. The Windows checks in §14 are still to tick before the release.
**Base:** PR #7 @ `b632587`. `arene-abysse.md` (colour roles), `motion-premium.md` (tiers, ≤ 340 ms responses, `.fx-loop`) and `update-reactor.md` (`anim()`, `Run`, the card family, the in-game contract) still apply. Where this document departs from them it says so.
**Data rule:** only real signals. No bar, no percentage, no ETA. Every guess is worded « peut », « peut-être » or « pas encore ».
**Contract:** types in `src/shared/launch.ts`, API in `src/shared/types.ts` (`launchGame(id, opts)`, `cancelLaunch`, `listLaunches`, `onLaunchStatus`), channels in `src/preload/index.ts`.

Conventions: Full, Sober and Reduced are the tiers of `motion-premium.md` §2, read through `tier()`. French strings are quoted as they are in the code, with the typographic apostrophe ’. `{jeu}` is `cleanName(game.name)`.

---

## 1. Concept

When you press Jouer, the game's cover lifts out of the spot you clicked and lights up in yellow at the moment Windows really hands the link to Steam, Epic Games or l’EA app. It settles into a small launch card in the bottom-left corner in under a second, without blocking a click or taking focus. The card then says where the launch stands, and turns cyan « En jeu » 1 to 3 s after the game's process appears, instead of 20 to 60+ s later. Player X cannot restyle another program's window (the dialog the EA app shows before some games is the EA app's). It owns what comes before, around and after it.

### 1.1 Ground rules

1. **Main owns the phases.** The reducer and the orchestrator live in `src/main/services/launches.ts`, a leaf module (no electron import, `import type` only). The renderer never reduces: it merges statuses by `launchId` and keeps the highest `rev`.
2. **The click goes first.** `api.launchGame()` is the first statement of `startLaunch()`, and `handoff()` is the first call in main. Nothing is checked before the hand-off: the protocol handler is read right after `openExternal` has started, for wording only.
3. **The watcher only nominates.** One coalesced `pollNow()` confirms through the existing `runningGameIds`, the same truth as the cyan badges. Playtime sessions are still opened by the tracker only. Steam's `RunningAppID` only nominates, and `Apps\<id>\Updating` is a copy hint only: both are undocumented.
4. **Doubt is worded.** `storeWasOpen` comes from a tracker snapshot up to 90 s old, so the copy says « semblait fermé ».
5. **Buttons never invite a second launch.** « Lancement… » → « En attente… » → « En jeu », never « Démarrage » (Player X cannot see a game boot). They stay « En attente… » until `gave-up` at 300 s; `slow` only changes the copy.
6. **The EA app is « l’EA app ».** The copy never quotes the EA app's dialog title (it depends on its language and version) and never says what the EA app is doing, only what it may do.
7. **A false « En jeu » never locks you out.** A click on a running game runs a fresh `pollNow()` first, then shows `already` with « Relancer quand même ».
8. **An exit within 30 s of detection is a relay**, not an exit (bootstrapper chains such as Steam → EA app → game): a 60 s grace with hedged copy, no « Jeu fermé », no window restore, no « Vérifier les fichiers ».
9. **Nothing moves under the cursor.** No `getGames()` after a launch, and the launching game's `lastPlayed` is frozen while it is pending (all tiers), so lists never reorder mid-launch.
10. **The sheet stays open.** A launch from it plays a local ignition on its poster, never the stage. Focus is never stolen (§8) and never moved (§12).
11. **Demo plays the whole labelled sequence, in memory.** It never feeds `gameRunning`, the update hold, the library badges or the hero. Cyan appears only where « Démo » is written.

## 2. Signals (the only facts a state may claim)

| Signal | Source | Proves | Doesn't prove |
|---|---|---|---|
| `click` | renderer, in the click frame | the click was handled | anything else |
| `handoff:ok` / `handoff:err` | `shell.openExternal(url)` or `shell.openPath(exe)` resolves or rejects | Windows passed the link or exe on, or refused it | that the store accepted it, or that a game will start |
| `handler` | `app.getApplicationNameForProtocol(url) !== ''`, read after the hand-off started | an app is registered for `steam://`, `origin2://`, `com.epicgames.launcher://` | wording only, if the hand-off stalls |
| `storeWasOpen` | last tracker snapshot ≤ 90 s old (`steam`, `EpicGamesLauncher`, `EADesktop`) | the client existed at the last check | that it is still open |
| `nominate` | watcher sample: a **new PID** (not in the pre-click baseline) with one of the game's exe names, or `RunningAppID == appid` | a candidate exists | nothing: it only triggers `confirm` |
| `confirm` | `pollNow()` (coalesced), then `isRunning(gameId)` (path first, name when the path is empty) | the same truth as the cyan badges | that the game is on screen |
| `window` | watcher `W:` flag (`MainWindowHandle ≠ 0`) on a matched PID | the process owns a top-level window | timing of the minimise only |
| `gone` | every live name missed in ≥ 2 valid samples (> 20 processes each) spanning ≥ 4 s | the process stopped | an exit counts only after `pollNow()` |
| `trackerChange` | existing `onChange` → `reconcile()` | the 60 s poll or a nudge saw a start or stop | — |
| `steamUpdating` | `HKCU\Software\Valve\Steam\Apps\<appid>\Updating = 1` | Steam says it updates that app | copy only |
| time | main timers (300 s, 60 s grace); renderer buckets from `clickAt` and `handedAt` | only that time passed | copy only |
| `cancel` / `suspend` / demo toggle / `will-quit` | × « Ne plus attendre », `powerMonitor`, settings, app | the user stopped following, or a reset | — |

The baseline is the PID set of the latest snapshot taken **before** the click: the watcher's last sample if ≤ 10 s old, else the 60 s poll if ≤ 90 s old. It catches fast-starting exes and a fast relaunch after an early exit.

## 3. State machine

### 3.1 Phases

Main owns every phase except the renderer-local `checking`, and pushes each change on `launch:status`. Time buckets (`relais` 0–15 s, `waiting` 15–90 s, `slow` 90–300 s, `stalled` ≥ 5 s in `sending`) are wording only, derived in the renderer (`launch/phase.ts`).

```
 click, running game ──► [checking] ── fresh pollNow: running ──► [already]
                              │ not running                           │ Relancer quand même
 click, idle game ────────────┴──► [sending] ◄────────────────────────┘
                                       │ handoff:err ──► [failed]
                                       │ handoff:ok, not Windows ──► [untracked]
                                       │ handoff:ok, forced on a running game ──► [resent]
                                       │ 300 s ──► [gave-up]
                                       ▼ handoff:ok
                                   [waiting] ── 300 s ──► [gave-up]
                                       │ nominate → confirm ✓, or trackerChange
                                       ▼
                                   [running] ── gone < 30 s ──► [relay] ── 60 s, not running ──► [early-exit]
                                       │  ▲                        │
                                       │  └─ new PID + confirm ✓ ──┘
                                       ▼ gone ≥ 30 s, confirmed not running
                                    [ended] (no card)

 × during sending, waiting or relay ──► [cancelled] · suspend while pending ──► [gave-up] (silent)
```

| Phase | Entered on | Leaves to | Card |
|---|---|---|---|
| `checking` (renderer) | click on a game whose `game.running` is true | `already`, or `sending` | one `pollNow`, ~0.5–1.5 s |
| `sending` | record created before the hand-off | `waiting`, `failed`, `untracked`, `resent`, `cancelled`, `gave-up` | « stalled » copy from 5 s |
| `waiting` | `handoff:ok` on Windows | `running`, `gave-up`, `cancelled` | `gave-up` 300 s after `handedAt` |
| `running` | `confirm` ✓, or `trackerChange` running | `relay`, `ended` | leaves after 4 s of active time; the record stays for buttons and window policy |
| `relay` | `gone` < 30 s after `detectedAt` | `running`, `early-exit`, `cancelled` | 60 s grace, then `pollNow` (a failed poll retries in 5 s) |
| `ended` | `gone` ≥ 30 s and confirmed not running, or `trackerChange` stop while unwatched | removed | none (A5 only) |
| `early-exit` | grace ended with nothing seen | removed | until ×, action or 10 s active |
| `gave-up` | 300 s pending, or `suspend` while pending (`silent`) | removed | 8 s active (none if silent) |
| `failed` | `handoff:err`, no launch target, game not found | removed | until ×, action or 10 s active (paused on hover and focus-within) |
| `already` | fresh check says running, or the check failed while `game.running` was true | removed | 8 s active |
| `resent` | « Relancer quand même » handed off while the tracker still says running | removed | 6 s active, no watcher |
| `untracked` | `handoff:ok`, not Windows | removed | 6 s active |
| `cancelled` | × during `sending`, `waiting` or `relay` | removed | leaves at once; a late hand-off is still recorded, never shown |

**Active time** counts only while `document.visibilityState === 'visible' && document.hasFocus()`, so a card that settles while you play waits for you. Every card is dropped silently 10 min after its last phase change.

### 3.2 Edge cases

| Case | Behaviour |
|---|---|
| Spam on a pending game | No IPC. The card is brought forward (one sheen in Full) and A11 is announced. Main dedupes too. |
| Launch B while A is pending | Allowed. Each game keeps its record and buttons (A stays « En attente… »). The card shows the newest record; a `failed` record takes over from a newer pending one. One shared watcher. |
| Two games running | Home hero and Profile pick the one with the latest `runningSince`. |
| Store missing, protocol unregistered | `openExternal` rejects → `failed:no-handler`. If Windows' "choose an app" prompt hangs it instead: « stalled », with C2b when `handler === false`. × always works. |
| Game needs an update | Steam: C6 if the registry says so. Others: C4. Stays pending up to 300 s. |
| Uninstalled EA game (`autoDownload=1`) | waiting → slow → `gave-up`. Never cyan. |
| Anti-cheat game (empty path) | The watcher reads names only; confirmation uses today's name fallback. |
| Exe deeper than 3 folders | Not nominated by name. Steam: `RunningAppID` nominates and the path poll confirms. Others: nudges at 20 s and 45 s, then the 60 s poll. |
| PowerShell fails, times out or is blocked | `runningProcesses()` returns `null`: no conclusion. 3 watcher failures → kill it, `detect: 'poll'`, `pollNow` at +20 s and +45 s, watcher off for 10 min, copy C3f. |
| Sleep | `suspend`: pending → silent `gave-up`, watcher killed, `minimizedBy` cleared. `resume` → `pollNow()` after 5 s. |
| Player X quits mid-launch | stdin closes, the watcher exits on EOF, records are lost. |
| Renderer reload or HMR | `launch:list` hydrates; the card comes back with no motion. |
| Demo toggled mid-launch | `launches.reset()`: all cancelled silently, timers cleared, watcher killed; the renderer clears its store. |
| Update ready while pending | The countdown holds with « En pause pendant le lancement »; the preview is refused. |
| Game started outside Player X | Unchanged: badges from the 60 s poll, no card. |

## 4. Surfaces

### 4.1 The stage `<LaunchStage/>` (Full only)

**Plays only when** `tier() === 'full'`, `!isIdle()`, `!document.hidden`, `!warpActive()`, `revealDone.get()`, the source is not the sheet, `via === 'play'`, the launch did not come through `checking`, no other launch is pending, and this game did not play a stage in the last 10 min (renderer memory). It plays in demo, with the « Mode démo » kicker. Otherwise the glide (§6) runs, and nothing moves when the window is idle at the click (Enter right after alt-tab).

**Mounting.** A portal into `document.body` next to `<UpdateStage/>`: `position: fixed; inset: 0; z-index: var(--z-launch)` (75: above modals 70, under toasts 80 and the warp 100), `pointer-events: none`, `aria-hidden="true"`. Never `inert`, modal or focused. It mounts with `flushSync` plus the commit waiter (`stage.ts` pattern, 400 ms fallback). Geometry is read once from `.shell > .content` into `--cl/--ct/--cw/--ch/--cx/--cy`.

| Element | Spec |
|---|---|
| `.launch-veil` | the content area only (rail, sidebar and top bar stay visible), `color-mix(in srgb, var(--bg-0) 55%, transparent)` |
| `.launch-band` | full content width, 280 px tall (220 px when `--ch` < 560) around `--cy`, static top and bottom mask; the art is `heroUrl` only if already decoded, else `coverUrl`, else `generatedBackground(name)`. Nothing is decoded at click time. |
| `.launch-band-shade` | static `--bg-0` gradient 30 → 82 → 92 %, plus a blue `rgb(47 124 246 / .28)` radial behind the poster |
| `.launch-poster` | 168 × 252 (132 × 198 when `--cw` < 760 or `--ch` < 560), `--r-md`, static shadow, `<Cover variant="portrait">` (same URL as the source, so cached) |
| `.launch-sheen`, `.launch-shock` | white 105° sheen inside the poster; 168 px `--accent-line` ring; both `opacity: 0` at rest |
| `.launch-kicker` / `-title` / `-sub` | 600 12/16 caps `--accent-text` (`--text-2` in demo) / 800 36/0.95 display caps, 2 lines, `text-wrap: balance` (28 px narrow) / 400 14/20 `--text-2` |

**FLIP from the source.** Sources: rail `.favrail-art`, hero `.hh-poster`, library `.lib-card-cover`, profile `.prof-gt-box` (« À reprendre » `.rc-art` is landscape, so it never flies). A source is usable when it is connected, on screen, ≥ 24 px wide, with h/w between 0.9 and 1.7. `s = src.w / dst.w`, `dx = src.left − dst.left`, `dy = src.top + (src.h − dst.h·s) / 2 − dst.top`. A ratio off by more than 15 % (the rail's square tile) also fades the poster in over 90 ms. No usable source: scale .94 → 1 with a fade.

**Timeline.** Every animation goes through `anim()` with `fill: 'both'` and is cancelled when it finishes; keyframes are `LKF` in `launch/keyframes.ts`.

| t (ms) | Element | Motion | Easing |
|---|---|---|---|
| 0 | — | `api.launchGame()` sent **first**; source rect read; stage and card (opacity 0, thumb hidden) mounted; A1 announced | — |
| 0–180 | veil | opacity 0 → 1 | `EASE.out` |
| 0–280 | poster | **Prise**: FLIP to centre (or scale .94 → 1 with a fade, 220 ms) | `EASE.glide` |
| 40–280 | band | opacity 0 → 1, `translateX(16px)` → 0 | `EASE.glide` |
| 100–380 | kicker, title, sub | `translateY(6px)` → 0 with a fade, 220 ms each, stagger 40 | `EASE.out` |
| **F** = max(280, hand-off) | — | **Mise à feu**, only if the hand-off lands by 560 ms; otherwise the card filament flashes once (`LKF.ignite`) when it lands | — |
| F → F+440 | shock | `scale(.7)` → `scale(1.8)`, opacity .6 → 0 | `EASE.out` |
| F+40 → F+400 | sheen | `translateX(-120%)` → `120%`, opacity 0 → .3 → 0 | `EASE.inOut` |
| F | kicker, sub | `TextSwap`: « Lancement » → « Envoyé à Steam », « Envoi à Steam… » → the relais line | existing |
| **D** = min(F+300, 700), 560 without ignition | text / veil, band | **Départ**: opacity → 0 in 140 / 220 ms | `EASE.in` |
| D → D+280 | poster | flight to the card thumbnail (`s = 36/168`, both exactly 2:3) | `EASE.inOut` |
| D+60 → D+300 | card frame | `translateY(10px)` → 0, opacity 0 → 1 | `EASE.out` |
| D+280 | — | thumbnail shown and stage unmounted in the same frame | — |

Nominal F = 280, D = 580, end ≈ 880 ms. Worst case D = 700, end ≈ 1000 ms. On `handoff:err` before D: no ignition, the card lands in `failed` with its danger filament, no shake.

**Exits, never a hard snap.** On `blur` or `visibilitychange` (the EA case), `pointerdown` or `wheel` (capture, not prevented, so the click still lands) and Esc (capture, `preventDefault` + `stopPropagation`): `run.settle('fade')` cancels every timer and keyframe, the card jumps to its final state, the stage root plays `LKF.skipFade` (160 ms, `whenIdle: true`) and unmounts on finish (220 ms timer fallback for hidden documents). Watchdog: unmount at 1.6 s whatever happens.

**Cost.** At most 7 composited layers for under a second, transform and opacity only, DOM removed afterwards. No fuse line, nothing fills from left to right. No canvas, `filter`, `backdrop-filter` or `box-shadow` animation. No View Transition: it would contend for `motion.ts`'s single `running` flag with the sheet and the update warp, paint above toasts and freeze rendering.

### 4.2 The launch card `<LaunchDock/>` (all tiers)

Rendered inside `.shell` right after `<UpdateNotice/>`, so it sits in the natural tab order. It never takes focus. Same family as the update card: `--upd-w` × `--upd-h` (480 × 76), opaque, fixed size in every phase.

| Part | Spec |
|---|---|
| `.launch-dock` | `position: fixed; left: calc(var(--nav-w) + 20px); bottom: 20px; z-index: calc(var(--z-scrim) - 5)`, `width: min(var(--upd-w), calc(100vw - var(--nav-w) - 40px))`, `pointer-events: none` (children `auto`), `data-open` while a card shows |
| Stacking | above the update card: `bottom: 106px` when `.upd-dock[data-mode='card']` is shown (this covers the armed card), `70px` above the mini pill. Transition `bottom` `--d-3 --ease-glide` (Full), `--d-2 --ease-out` (Sober), none (Reduced). |
| Room kept | `.content` `padding-bottom` 104 px; 190 px with the update card, 154 px with the mini pill. Toasts (≤ 1279 px wide): `bottom` 108 px; 194 px with the update card, 158 px with the mini pill. |
| `.launch-card` | grid `36px minmax(0,1fr) auto 28px`, gap 12, padding `11px 10px 11px 14px`, `--surface-3`, `1px solid var(--line-2)`, `--r-lg`, static `--sh-2`. `role="group"`, `aria-labelledby` on the title. |
| Filament `::before` | 2 px on the left; colour switches **instantly** by state, never animated. `.launch-ignite` is a sibling overlay used only by `LKF.ignite`. |
| `.launch-thumb` | 36 × 54, `--r-sm`, `<Cover variant="portrait">`, ring `--line-2` (`--live` when running); no cover: a `StoreTag` monogram. `.launch-ping` ring over it, `opacity: 0` at rest. |
| Rows | kicker 600 11/14 caps `.06em` + elapsed `m:ss` (`.num` 500 11/14 `--text-2`, `aria-hidden`, pending phases from 3 s, 1 Hz only while visible and active); name 600 13.5/18 `--text-1`; sub 400 12/16 `--text-2`, full text in `title` |
| Action, close | at most one `btn btn-secondary btn-sm`, **never a yellow fill**; `icon-btn` 28 × 28 with `x` 14 |

**Copy budgets** (enforced by `copy.test.ts`). Text column: 480 − 24 − 48 − 40 = 368 px. Kickers are ≤ 30 characters, « Mode démo · » included.

| Situation | Text width | Sub budget |
|---|---|---|
| No action | 368 px | ≤ 60 characters |
| « Réessayer » or « Réanalyser » | ≈ 264 px | ≤ 42 |
| « Relancer quand même » | ≈ 216 px | ≤ 32 |

| State | Filament | Kicker | Thumb | Action |
|---|---|---|---|---|
| sending, stalled, waiting (relais, waiting), relay, steamUpdating | `--accent` | `--accent-text` | normal | — |
| waiting (slow) | `--accent-line` | `--text-2` | normal | — |
| running | `--live` | static 6 px `--live` dot + `--live-text` | `--live` ring | — |
| already | `--live` | dot + `--live-text` | `--live` ring | « Relancer quand même » |
| resent, untracked, gave-up, demo pending | `--text-3` | `--text-2` | normal | — |
| early-exit | `--warning` | `--warning` | normal | « Réessayer » |
| failed | `--danger` | `--danger-text` | normal | « Réessayer », « Réanalyser » or none |
| demo running | `--live` | dot + `--live-text`, text starts « Mode démo · » | `--live` ring | — |

**Motion is information.** The card has zero infinite animations in every tier and state: `document.getAnimations()` filtered to `.launch-dock` is empty except within 700 ms of an event. `:root[data-window='idle'] .launch-dock * { transition: none }`, and every running WAAPI is `finish()`ed when the window goes idle (the `useCardPhase.ts` pattern).

| Beat | Full | Sober | Reduced |
|---|---|---|---|
| Enter | landing from the stage, or the glide | `KF.cardInSober` + thumb glide if the source is usable | instant |
| Text change | `TextSwap` (140 out / 240 in) | `TextSwap` | instant |
| Late hand-off | `LKF.ignite` on `.launch-ignite`, once | none | none |
| Detection | one `KF.pingStage` on `.launch-ping`, only if `fx()` then | instant colour switch | instant |
| Brought forward | one `LKF.cardSheen` (white 7 %, 600 ms) | the card reappears | instant |
| Leave | `KF.cardLeave` (200 ms), then unmount | `KF.cardLeave` | instant |

### 4.3 Play controls

`usePlayState(game)` returns `'idle' | 'sending' | 'checking' | 'pending' | 'running' | 'demo-running'` plus `{ label, ariaLabel, title, className, icon, onActivate }`. **running**: `game.running`, or a non-demo record in `running`. **sending**: the record is `sending`, and for at least 600 ms after the click so labels don't flicker. **pending**: `waiting` or `relay`. **demo-running**: a demo record in `running`.

- Controls use `aria-disabled` (never `disabled`) plus a guard in the click handler, so focus survives every label change. A pending control brings the card forward; a running one starts `checking`.
- **Spinner rule:** `.spinner.launch-spin` only in `sending` (< 5 s) and `checking`; from 5 s of `sending` it becomes the static `clock` icon. No spinner turns during the wait. `.btn-play:is(.is-sending, .is-waiting, .is-live)` keeps the `min-width` of its size; swaps are instant, with no shine and no magnetic effect.

| Surface | sending / checking | pending | running | demo-running |
|---|---|---|---|---|
| Hero `.btn-play` (xl, 196 px), « À reprendre » `.rc-play` (sm, 132 px), sheet `.sheet-play` (lg, 172 px) | `.is-sending`: solid `--accent-solid` / `--on-accent` at opacity 1, spinner, « LANCEMENT… » / « VÉRIFICATION… » | `.is-waiting`: `--accent-soft`, `--accent-text`, inset `--accent-line`, `clock` 16, « EN ATTENTE… » | `.is-live`: `--live-soft`, `--live-text`, inset `--live-line`, 8 px `--live` dot, « EN JEU »; focus ring stays `--focus` | `.is-live` look, « DÉMO · EN JEU » |
| Library card | pill forced visible, spinner « Lancement… »; meta « Lancement… » | pill `.is-waiting`, « En attente… »; meta « En attente · Steam »; `aria-busy` | as before (glow, badge); hover pill cyan « En jeu » | pill « Démo · en jeu », no glow or badge |
| Rail `.favrail-item` | `.favrail-busy` overlay with `.launch-spin` | static 2 px `--accent-line` ring, `aria-busy` | cyan ring and dot | idle look (no visible text, so no cyan) |
| Profile `.prof-gt-play` | spinner | `clock` | static `--live` dot | idle look |
| Sheet `.sheet-launch-line` (under the play row, 12/16, not a live region) | « {sub} » | « {sub} · {m:ss} », `clock` | hidden (« Partie en cours » is there) | « Mode démo · {sub} » |

The sheet line keeps `failed` (« Lancement impossible · {sub} », `--danger-text`, `alert-circle`, the action as a `link-btn`), `early-exit` (« Jeu fermé · {sub} ») and `gave-up` (« Jeu non détecté · {sub} ») until the sheet closes or a new launch starts.

## 5. Colour story

- **Yellow** is your action travelling: the click, the hand-off, the wait.
- **Cyan** appears only after `confirm` (and in demo, only where « Démo » is written).
- **No brand violet → cyan** anywhere in `launch-*`. Glows behind art are blue `rgb(47 124 246 / …)`.
- New tokens: `--z-launch: 75`, `--live-line: rgba(63, 208, 255, .45)` (twin of `--accent-line`). Everything else reuses the Abysse tokens.

## 6. Motion per tier

| Moment | Full | Sober (« Effets visuels » off) | Reduced |
|---|---|---|---|
| Click | stage (§4.1) | card `KF.cardInSober` + `LKF.thumbGlide` (FLIP from the source into the thumb, 280 ms glide, `level: 'sober'`) | label swap; the card appears |
| Click on the skip list | glide, with `KF.cardIn` (420 ms) | as above | instant |
| Click from the sheet | `.launch-shock` (440 ms) + `.launch-sheen` (360 ms) on `.sheet-poster` at the hand-off; card `KF.cardIn` under the scrim | card `KF.cardInSober` | instant |
| Waiting | nothing animates | nothing | nothing |
| Detection | one ping, only if the window is active | instant | instant |
| Any pending launch | `:root[data-launching] .fx-loop { animation-play-state: paused }` (hero drift, live-dot beat, rail dot) | same | n/a |

Only `data-launching` pauses `.fx-loop`. The existing idle pause already covers play, and the owner may watch Player X on a second screen. `LKF` (all transform or opacity; `EASE` and `k()` come from `update/keyframes.ts`, where `k` is exported for this):

```ts
veilIn 180 out · bandIn 240 glide +40 · posterIn 220 glide · posterFrom(dx,dy,s,fade) 280 glide · textRise(i) 220 out +100+40i
shock 440 out · sheen 360 inOut +40 · textOut 140 in · stageOut 220 in · posterTo(dx,dy,s) 280 inOut · cardLand 240 out +60
skipFade 160 out · thumbGlide(dx,dy,s) 280 glide · ignite 280 out · cardSheen 600 inOut   (+ KF.cardIn/cardInSober/cardLeave/pingStage)
```

## 7. Copy deck (FR, *tu*)

Typographic apostrophe ’, « » with no-break spaces, kickers in sentence case (CSS capitalises them), elapsed `m:ss`, detected-after « 24 s » / « 1 min 12 ». Stores (`copy.ts` `STORE_FORMS`, mirroring `STORE_LONG`): Steam (« à Steam », « de Steam »), Epic Games (« à Epic Games », « d’Epic Games »), L’EA app / l’EA app (« à l’EA app », « de l’EA app »). Never « app EA ».

### 7.1 Card

| Id | State | Kicker | Sub | Action |
|---|---|---|---|---|
| C1 | sending | « Lancement » | « Envoi à Steam… », « Envoi à Epic Games… », « Envoi à l’EA app… », « Ouverture de l’exécutable… » | — |
| C2 | sending ≥ 5 s | « Lancement » | « Windows n’a pas encore transmis le lien » (exe: « Windows n’a pas encore ouvert le jeu ») | — |
| C2b | sending ≥ 5 s, `handler === false` | « Lancement » | « Windows te demande peut-être quelle appli utiliser » | — |
| C3 | relais (0–15 s) | « Envoyé à Steam », « Envoyé à Epic Games », « Envoyé à l’EA app », « Exécutable ouvert » | C3a–e | — |
| C3a–c | relais, by store | | « Steam peut ouvrir sa propre fenêtre avant le jeu », « Epic Games peut ouvrir sa propre fenêtre avant le jeu », « L’EA app peut ouvrir sa propre fenêtre avant le jeu » | — |
| C3d | relais, exe | | « Le jeu peut mettre quelques secondes à s’afficher » | — |
| C3e | relais, store seemed closed | | « Steam semblait fermé · il peut mettre un moment à s’ouvrir », « Epic Games semblait fermé · il peut mettre un moment », « L’EA app semblait fermée · elle peut ouvrir sa fenêtre » | — |
| C3f | any bucket, `detect: 'poll'` | (bucket kicker) | « Vérification à 20 s, 45 s, puis chaque minute » | — |
| C4 | waiting (15–90 s) | « En attente du jeu » | « Steam peut d’abord mettre à jour ou synchroniser », « Epic Games peut d’abord synchroniser tes sauvegardes », « L’EA app peut d’abord vérifier ou mettre à jour le jeu », « Certains jeux mettent du temps à démarrer » | — |
| C5 | slow (90–300 s) | « Toujours en attente » | « Pas encore détecté · regarde la fenêtre de Steam », « Pas encore détecté · regarde la fenêtre d’Epic Games », « Pas encore détecté · regarde la fenêtre de l’EA app »; exe: « Pas encore détecté · regarde ta barre des tâches » | — |
| C6 | `steamUpdating` | « Mise à jour Steam » | « Steam indique une mise à jour de ce jeu » | — |
| C7 | relay | « En attente du jeu » | « Un programme du jeu s’est fermé · un autre peut suivre » | — |
| C8 | running | « En jeu » | « Détecté après {24 s} · bonne partie ! » | — |
| C9 | already | « Déjà en jeu » | « Tourne sur ce PC depuis {21:04} » (no `runningSince`: « Il tourne déjà sur ce PC ») | « Relancer quand même » |
| C10 | resent | « Lien renvoyé » | « Le jeu semblait déjà tourner · Steam décide de la suite » (same with Epic Games, l’EA app; exe: « Le jeu semblait déjà tourner · rien n’a été fermé ») | — |
| C11 | early-exit | « Jeu fermé » | « Fermé {n} s après avoir été détecté » | « Réessayer » |
| C12 | failed: no-handler | « Lancement impossible » | « Le lien de Steam n’a pas pu s’ouvrir », « Le lien d’Epic Games n’a pas pu s’ouvrir », « Le lien de l’EA app n’a pas pu s’ouvrir »; `title`: « Vérifie que {store} est installé. Windows : {message} » (« installée » for l’EA app) | « Réessayer » |
| C13 | failed: exe-missing | « Lancement impossible » | « Exécutable introuvable sur ce PC »; `title`: « Il a peut-être été déplacé ou supprimé. » | « Réanalyser » (`loadGames(true)`) |
| C14 | failed: no-target | « Lancement impossible » | « Player X ne sait pas lancer ce jeu » | — |
| C15 | failed: not-found | « Lancement impossible » | « Ce jeu n’est plus dans ta bibliothèque » | — |
| C16 | failed: other | « Lancement impossible » | « Le lancement a échoué »; `title`: « Windows : {message} » | « Réessayer » |
| C17 | gave-up | « Jeu non détecté » | « Pas vu en 5 min · « En jeu » s’affichera s’il démarre » (from sending: « Windows n’a pas transmis le lien en 5 min », or « Windows n’a pas démarré le jeu en 5 min » for an exe) | — |
| C18 | untracked | « Envoyé à Steam » (etc.) | « Détection du jeu disponible sous Windows seulement » | — |
| C19 | demo pending | « Mode démo · Lancement » → « Mode démo · En attente du jeu » | « Simulation · rien n’est lancé sur ton PC » | — |
| C20 | demo running | « Mode démo · En jeu » | « Partie simulée · rien ne tourne vraiment » | — |
| C21 | close | — | `aria-label` / `title`: « Ne plus attendre {jeu} » (pending), « Fermer » (otherwise) | — |
| C22 | card group | — | `aria-label`: « Lancement de {jeu} » | — |

### 7.2 Buttons, library, rail, profile, sheet

| Id | Where | French |
|---|---|---|
| B1 | label | « Jouer », « Lancement… », « Vérification… », « En attente… », « En jeu », « Démo · en jeu » |
| B2 | `aria-label` | « Jouer à {jeu} », « Lancement de {jeu}… », « Vérification de {jeu}… », « {jeu} : en attente du jeu. Afficher le suivi », « {jeu} est en jeu », « Mode démo : partie simulée de {jeu} » |
| B3 | `title` | pending « Afficher le suivi du lancement », running « Tourne sur ce PC », demo « Mode démo : rien ne tourne vraiment » |
| B4 | library meta | « Lancement… », « En attente · Steam », « En attente · Epic Games », « En attente · EA app », « En attente · exécutable », « En jeu · {durée} » (existing), « Démo · en jeu » |
| B5 | rail tooltip | under the name (`.favrail-tip-hint`): « Lancement… · clic droit : fiche », « En attente… · clic droit : fiche », « En jeu · clic droit : fiche » (idle « Clic : jouer · clic droit : fiche »); `aria-label` « {jeu}, en attente », « {jeu}, en jeu » |
| B6 | profile `title` | « Lancement… », « En attente… », « En jeu » |
| B7 | sheet line | « {sub} · {m:ss} », « Lancement impossible · {sub} », « Jeu fermé · {sub} », « Jeu non détecté · {sub} », « Mode démo · {sub} » |

### 7.3 Live region (polite, phase changes only, never the counter)

| Id | When | French |
|---|---|---|
| A1 | click | « Lancement de {jeu}. » |
| A2 | hand-off | « {jeu} envoyé à Steam. », « {jeu} envoyé à l’EA app. Elle peut ouvrir sa propre fenêtre. », « Exécutable de {jeu} ouvert. » |
| A3 | enters slow (90 s) | « {jeu} n’est toujours pas détecté. » |
| A4 | running | « {jeu} est en jeu. » |
| A5 | ended | « {jeu} s’est fermé. » |
| A6 | early-exit | « {jeu} s’est fermé {n} secondes après avoir été détecté. » (« 1 seconde » au singulier) |
| A7 | failed | « Impossible de lancer {jeu} : {sub}. » |
| A8 | gave-up | « {jeu} n’a pas été détecté en 5 minutes. » (from sending: « Windows n’a pas transmis le lien de {jeu} en 5 minutes. », exe: « Windows n’a pas démarré {jeu} en 5 minutes. ») |
| A9 | cancelled | « Player X n’attend plus {jeu}. » |
| A10 | already | « {jeu} tourne déjà. Passe dessus avec Alt+Tab, ou relance-le quand même. » |
| A11 | click on a pending game | « {jeu} est déjà en cours de lancement. » |
| A12 | resent | « Lien renvoyé : {jeu} semblait déjà tourner. » |
| A13 | untracked | « {jeu} envoyé à Steam. Détection disponible sous Windows seulement. » |
| A14 | steamUpdating | « Steam indique une mise à jour de {jeu}. » |
| A15 | demo | « Mode démo : {jeu} serait lancé. Rien n’est lancé sur ton PC. » → « Mode démo : partie simulée de {jeu}. » → « Mode démo : partie simulée terminée. » |

`relay` is not announced. A repeated text gets a trailing no-break space so it is read again.

### 7.4 Elsewhere, and what was removed

- Update card: `HOLD_SUB.launch` = « En pause pendant le lancement » (`update-reactor.md` §6.10). Setting: §8.
- Removed: the toasts « Lancement de X… », « Mode démo : X serait lancé » and « Impossible de lancer X : Failed to open: … », with every English Electron or Windows prefix. No launch toast remains.

## 8. Window behaviour and the setting

`Settings.launchWindow: 'stay' | 'minimize'`, default `'stay'`, read by main (it acts even when the renderer is throttled) and sanitised in `settings.ts` like `friendAlerts`. **Paramètres › Interface**, a `SettingRow` after « Effets de transparence » and before « Alertes d'amis ».

| Item | French |
|---|---|
| Label | « Quand un jeu démarre » |
| `Segmented` | « Rester ouvert » (default), « Se réduire » |
| Caption, stay | « Player X reste ouvert derrière le jeu, sans jamais passer devant » |
| Caption, minimise | « Se réduit quand le jeu est détecté et revient quand tu le quittes » |
| Caption, minimise without restore | « Se réduit quand le jeu est détecté » |
| Caption, demo | « Sans effet en mode démo : rien n’est lancé » |
| Not Windows | « Disponible sur Windows » (control `aria-disabled`) |

**Never, for a launch** (grep-checked): `focus()`, `show()`, `restore()`, `moveTop()`, `flashFrame()`, `setAlwaysOnTop()`, `setProgressBar()` (the taskbar progress belongs to the updater), `hide()` (there is no tray icon) or a Windows notification.

`windowAction(setting, ctx)` is a pure function in `launches.ts`:

| Setting | Event | Condition | Action |
|---|---|---|---|
| stay | any | — | none |
| minimise | `running`, and (`W` seen or 10 s after `detectedAt`), game still seen | Player X unfocused and not minimised | `minimize()`, `minimizedBy = launchId`, remember `wasMaximized` |
| minimise | as above | Player X focused (you chose to look at it) or already minimised | none |
| minimise | `ended` or `early-exit` (never `relay`) | still minimised by this launch, no other Player X game running | after 1000 ms: `showInactive()` |
| minimise | `ended` | another Player X game running | hand `minimizedBy` to that launch |
| any | `restore` event not caused by us | — | clear `minimizedBy` (no auto-restore later) |
| any | demo, untracked, resent, already, suspend | — | none; `suspend` clears `minimizedBy` |

If `showInactive()` activates the window or loses the maximised state (§14 item 10), set `RESTORE_ON_EXIT = false`: minimise-only, with the caption « Se réduit quand le jeu est détecté ». If minimising knocks out an exclusive-fullscreen game, the setting does not ship.

## 9. Timings and constants

| Constant | Value | Where |
|---|---|---|
| `GAVE_UP_MS` / `EARLY_MS` / `RELAY_GRACE_MS` | 300 000 / 30 000 / 60 000 | `launches.ts` |
| `MISS_SPAN_MS` / `WATCH_AFTER_RUNNING_MS` | 4 000 (over ≥ 2 valid samples) / 90 000 | `launches.ts` |
| `CONFIRM_REARM_MS` | 10 000 (re-nominate only on a new PID or after this) | `launches.ts` |
| `MINIMIZE_FALLBACK_MS` / `RESTORE_DELAY_MS` / `RESTORE_ON_EXIT` | 10 000 / 1 000 / `true` (§8) | `launches.ts` |
| `SNAPSHOT_MAX_AGE_MS` / `BASELINE_WATCH_MAX_AGE_MS` | 90 000 / 10 000 | `launches.ts` |
| `CADENCE` | pending 1000 (AC) / 2500 (battery); running 5000 / 10000 | `launches.ts` |
| `BUDGET` | `p95CpuMs` 60, `wsBytes` 90e6, `hardP95CpuMs` 150 | `launches.ts` |
| `DEMO` | `{ handoff: 250, waitingAt: 4000, running: 7000, ended: 30000 }` (ms after the click) | `launches.ts` |
| Watcher | sample timeout 3 s (10 s for the first); 3 failures → down, off for 10 min; stop = end stdin, `kill()` after 1 s | `launchWatch.ts` |
| Nudges | 20 s and 45 s after the hand-off, skipped once detected | `playtime.ts` |
| `STALLED_MS` / `RELAIS_MS` / `SLOW_MS` / `LABEL_MIN_MS` / `COUNTER_FROM_MS` | 5 000 / 15 000 / 90 000 / 600 / 3 000 | `launch/phase.ts` |
| Card active times | running 4 s; failed, early-exit 10 s; already, gave-up 8 s; untracked, resent 6 s | `launch/phase.ts` |
| `CARD_CAP_MS` / `STAGE_REPEAT_MS` | 600 000 / 600 000 | `launch/phase.ts` |

## 10. CPU budget

The watcher is one shared `powershell.exe` (`BelowNormal`, names and app ids as JSON on stdin, one blocking `[Console]::In.ReadLine()` per sample). It reads only `ProcessName`, `Id` and `MainWindowHandle`, never `.Path`, `.MainModule`, `.StartTime`, `Add-Type`, `-EncodedCommand` or `ReadLineAsync` (it stalls on PS 5.1). It lives only while a launch is pending or in relay, a running record is younger than 90 s, or Player X minimised itself for a game. Estimates, to be measured on the owner's PC (§14):

| Situation | AC | Battery | CPU per sample (PS 5.1, ~300 processes) | Average load |
|---|---|---|---|---|
| Watcher start (if not alive) | — | — | 0.3–1 s CPU, 2–3 s wall when cold | one-off |
| Pending (≤ 300 s, typically 5–60 s) | 1 s | 2.5 s | 10–40 ms | 1–4 % of one core (AC), ≤ 1.6 % (battery) |
| Running, first 90 s, or while Player X minimised itself | 5 s | 10 s | 10–40 ms | ≤ 0.8 % |
| Anything else | killed | killed | 0 | 0 |

- RAM ≈ 45–60 MB working set while alive (typically 1–2 min per launch; hours only with « Se réduire »). Path polls per launch: 1 at confirmation and at most 1 at exit, no more than today's 2 nudges. The 60 s poll is unchanged.
- Over budget (p95 of the last 30 `Δcpu` > 60 ms, or working set > 90 MB): keep watching pending records, kill the watcher once none is. p95 > 150 ms: downgrade everything to `poll` at once. Dev builds log `[launch] watcher p95 Xms ws YMB`.
- Expected « En jeu » latency: 1–3 s after the process appears. Exit, when watched: about 6–15 s.

## 11. Code map

| File | Role |
|---|---|
| `src/main/services/tracking.ts` | leaf: `GENERIC_EXE`, `normPath`, `usableDir`, `parseProcLines` (`name\tid\tpath`), `matchGames`, `coalesce` |
| `src/main/services/playtime.ts` | `PS_COMMAND` gains `Id`; `runningProcesses()` returns `null` on any error (no conclusion, `lastPoll` untouched); `pollNow = coalesce(poll)`; `isRunning`, `runningSince`, `matchedNames`, `snapshotPids`, `storeWasRunning`, `exeNamesFor`, `onPlaytimeChange` |
| `src/main/services/games.ts` | `launchTarget(game)` and `handoff(target)` (throws `LaunchError`: `no-handler`, `exe-missing`, `other`); `launch()` removed |
| `src/main/services/launchWatchParse.ts`, `launchWatch.ts` | leaf `SCRIPT`, `tickLine`, `parseSample`, `isValid`, `newMatches`, `p95`; `createWatcher()` |
| `src/main/services/launches.ts` | `createLaunches(deps)` (`start`, `cancel`, `list` = live records plus terminal ones from the last 15 min, `reset`, `suspend`, `shutdown`), `reduce()`, `windowAction()` |
| `src/main/launchSim.ts` | dev only, `PX_LAUNCH_SIM=ok\|slow\|fail\|nohandler\|stall\|early\|relay\|already\|poll\|gaveup\|exe-missing`, `PX_LAUNCH_SIM_FAST=1` (timers ÷ 10); excluded by `!out/main/launchSim-*.js` |
| `src/renderer/src/launch/` | `store.ts`, `phase.ts`, `copy.ts`, `flip.ts`, `keyframes.ts`, `sequence.ts`, `LaunchStage`, `LaunchDock`, `usePlayState`, `PlayLabel` |
| `update/run.ts`, `update/useCardPhase.ts` | `Run` moved out of `stage.ts` with `settle('fade')`; `useWindowActive` exported; the `'launch'` hold |

IPC: `games:launch` (invoke, new signature `(id, opts)`), `launch:cancel`, `launch:list` (invoke), `launch:status` (event), `games:changed` (unchanged, also sent when a record leaves pending: it replaces the old refetch).

## 12. Accessibility

- **One voice.** A single always-mounted polite live region in `LaunchDock`, written only on phase changes (§7.3). The counter is `aria-hidden`. No launch toasts, so nothing is announced twice.
- **Focus never moves.** The stage is `aria-hidden` and never focusable, the card is never auto-focused, and controls keep focus through every label change (`aria-disabled` plus a guard). If the card unmounts while it holds focus, focus returns to the source control if it is still in the DOM. **Esc** in the card runs × with `stopPropagation`, so it never closes an open sheet; during the stage it skips the stage with the fade; elsewhere it does nothing.
- **Not by colour alone.** Every state has a kicker plus a shape (filament, live dot, clock, ring). Buttons change label as well as colour. Forced colours: the filament gets `forced-color-adjust: none; background: CanvasText`.
- **Contrast.** Small text is `--text-2` on `--surface-3` (≈ 6.8:1), never `--text-3` (4.40:1). `--accent-text` on `--accent-soft` and `--live-text` on `--live-soft` over `--bg-1` are ≥ 7:1. The stage text sits over an 82–92 % `--bg-0` shade.
- **Reduced motion.** No stage, glide, ping, sheen or `TextSwap` motion; every WAAPI goes through `anim()`. **Vestibular:** full-window motion ≤ 1.0 s, veil alpha .55, no camera zoom, poster scale ≤ 1.

## 13. Automatic checks

`npm run typecheck`, `npm run test:update`, `npm run test:launch` (`tracking`, `launchWatchParse`, `launches`, `launch/copy`, `launch/phase`, `launch/flip`), `npm run build`. Each grep must return nothing:

```sh
grep -rn "app EA" src
grep -rn "Préparation du jeu" src
grep -rn "ReadLineAsync\|MainModule\|Add-Type\|EncodedCommand" src/main
grep -rnE "\.(focus|restore|show|moveTop|flashFrame|setAlwaysOnTop|setProgressBar|hide)\(" src/main/services/launch*.ts
grep -rn "\.animate(" src/renderer/src/launch
grep -rnE "brand-|7c3aed|violet" src/renderer/src/launch
grep -rnE "transition:[^;]*(box-shadow|filter|background)" src/renderer/src/launch
grep -rn "launchingId" src/renderer
```

## 14. Owner checklist (Windows, `npm run dev`)

Dev builds log `[launch] …` lines. Pass criteria in brackets.

- [ ] 1. **The EA game from the screenshot** [the EA relais line shows before or with the EA window; the stage ends with a soft fade, never a snap; « En jeu » ≤ 3 s after the game window appears].
- [ ] 2. **Steam game, Steam open, then Steam closed** [« semblait fermé » only when it was closed]. **Steam game with a pending update** [the C6 hint appears; if `Updating` doesn't exist, report it and the hint is turned off].
- [ ] 3. **Epic `silent=true`** and **a plain-exe game**.
- [ ] 4. **Anti-cheat titles** (BF6, EAC, BattlEye) [detected; no anti-cheat warning; the game keeps working].
- [ ] 5. **Steam-bought EA game** (bootstrapper chain) [no « Jeu fermé », `relay` then `running`].
- [ ] 6. **Uninstalled EA game** [stays waiting → « Jeu non détecté », never cyan].
- [ ] 7. **Protocol missing** (VM, or a renamed key) [`failed:no-handler` in French, or « Windows te demande peut-être… »].
- [ ] 8. **Watcher on Windows PowerShell 5.1** [ticks at 1 Hz; p95 CPU per sample ≤ 60 ms and working set ≤ 90 MB from the dev log and Task Manager; on battery it switches to 2.5 s / 10 s].
- [ ] 9. **Kill `powershell.exe` mid-launch** [falls back to poll, no false exit]. **PowerShell blocked by policy** [C3f copy].
- [ ] 10. **« Se réduire »** [minimise only after the game window appears or after 10 s, never while Player X is focused; `showInactive()` restores **without activation** (note the foreground window before and after) and **keeps a maximised window maximised**; exclusive-fullscreen and borderless games are not knocked out]. If the restore fails: `RESTORE_ON_EXIT = false`, the fallback caption, and drop « et revient quand tu le quittes » from the 0.7.0 release note. If minimising breaks a fullscreen game: remove the setting and its release-note item.
- [ ] 11. **Ten launches with a foreground-window log** [Player X never takes the foreground].
- [ ] 12. **Sleep during `waiting`** [no card after waking; « En jeu » about 5 s after resume if the game runs].
- [ ] 13. **Second screen** [no animation on Player X during waiting and play; Task Manager GPU ≈ 0 for Player X].

## 15. Out of scope

- Restyling, skipping or detecting the EA app's (or any store's) own windows; reading store log files.
- A splash or overlay window, always-on-top, a tray icon, `hide()`, closing Player X on launch.
- Any progress bar, percentage, ETA or « démarre en ~N s d’habitude ».
- A post-session summary (« Session terminée · 1 h 32 »): planned as a follow-up.
- « Revenir au jeu » (`AppActivate`), killing games, an « Arrêter » button, automatic retries, « Vérifier les fichiers » (`steam://validate`), « Voir dans Steam » and other store deep links.
- Muting friend alerts or slowing friend polling during play.
- Changing what « Lancements » counts (still links sent from Player X), or moving playtime authority to the watcher.
- `tasklist`, WMI events, `wmic`, a bundled `fastlist` or a native module.
- A View Transition, canvas effects or a brand gradient for the launch; `data-ingame` motion pausing.
- A three-option window setting, and `restore()`-based return.
