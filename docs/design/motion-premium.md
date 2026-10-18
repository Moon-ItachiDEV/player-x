# Player X: premium motion and hover pass

**Status:** implementation spec for one pass by 4 parallel implementers (packages A to D).
**Request (FR):** « une interface plus premium avec des hover effects qui jouent sur les pochettes de jeux, une meilleure interface utilisateur plus poussée ».
**Base:** `docs/design/spec.md` ("Nuit Néon"). This document **replaces** the motion limits in spec.md §5 and §6 where §10 says so. Every other brand rule still applies: violet is the only accent, cyan only means "en jeu", no fake data, French copy, no logos.

Research behind the choices: tvOS focus (lift, light, almost unnoticeable parallax, no bounce), PS5/Xbox (the background shows the hovered game's art), Steam 2023 (the art's own colour glows around the focused capsule), Steam hero/logo parallax, Linear-style spotlight borders, Chromium View Transitions.

---

## 1. Principles

1. **The art is the light source.** Each effect comes from the game's own art: the glow uses the cover, the backdrop uses the hero art, the glare is light falling on the cover. The chrome stays graphite and violet.
2. **One rich thing at a time.** Only the hovered or focused card or tile carries tilt, glare, glow and the ring. Idle cards render nothing extra.
3. **Physical, not bouncy.** Ease out quickly, settle slowly, never overshoot. No springs on big surfaces. `--ease-pop` stays for the favourite star only.
4. **Respond fast, drift slowly.** A response to a hover, press or open takes 340ms or less. Only ambient things (backdrop crossfade, carousel, drift) are slow.
5. **Everything degrades cleanly.** With "Effets visuels" off you get today's polished UI. With reduced motion, nothing moves.

---

## 2. Global switches (who sets what)

| Switch | Set by | Values | Meaning |
|---|---|---|---|
| `html.reduce-motion` | App.tsx (exists) | class | "Réduire les animations" is on. |
| `html.no-blur` | App.tsx (exists) | class | "Effets de transparence" is off. |
| `html[data-fx]` | **App.tsx (C)** | `on` / `off` | `on` = `ui.visualFx && !ui.reduceMotion && !systemReducedMotion`. **This is the only gate for rich effects**, in CSS (`:root[data-fx='on'] …`) and in JS (`fxOn()`). |
| `html[data-window]` | **Ambient.tsx (D)** | `active` / `idle` | `idle` when the window is blurred or hidden. Pauses every `.fx-loop` animation. Player X often sits on a second screen while a game runs, so the GPU must stay quiet. |
| `html.vt-active`, `.vt-open`, `.vt-close`, `.vt-close-new`, `.vt-reorder`, `.vt-from-cover`, `.vt-from-art` | **motion.ts (C)** | classes | Present only while a view transition runs. |

### 2.1 New setting "Effets visuels"

- `UiPrefs.visualFx: boolean`, **default `true`**, stored in `pg.ui` like the other preferences. An old stored object has no key; it merges with `DEFAULT_UI`, which already works.
- Shown in Paramètres › Interface between "Réduire les animations" and "Effets de transparence" (package D).

| Tier | When | What you get |
|---|---|---|
| **Full** | `data-fx='on'` | Everything in this document. |
| **Sober** | "Effets visuels" off, motion allowed | Today's design: card lift 4px, cover zoom 1.04, play reveal, landscape shelf tiles, sheet slide, rail slide, button press. View-transition morph and grid reorder **stay on**: they are cheap and help you follow what happened. |
| **Reduced** | "Réduire les animations" or Windows "Animation effects" off | Sober tier, plus the existing global rule (transitions and animations at 0.01ms). View transitions are skipped, so state changes are instant. No autoplay. |

"Effets visuels" off removes: tilt, glare, spotlight and focus-sweep rings, card ambient glow, the cover's inner parallax, the card entrance stagger, backdrop art, the hero drift, the hero's pointer and scroll parallax, the hero text stagger, carousel autoplay, the shelf expand mode, the sheet header parallax, the JOUER shine, the magnetic buttons, the rail pill stretch, and the friends hover ring.

**Rule for every package:** declare each infinite animation, autoplay or scroll-driven animation (`animation-timeline`) **only** under `:root[data-fx='on']`. A scroll-driven animation ignores the global `0.01ms` reduce rule, so it must not exist in the other tiers.

---

## 3. Shared contract

### 3.0 Phase 0 (first 10 minutes, before anything else)

- **C** creates `src/renderer/src/motion.ts` **verbatim** from §3.1 and adds `visualFx` to `UiPrefs` in `contracts.ts` (§7.1).
- **D** creates the stub `src/renderer/src/components/Ambient.tsx`:
  ```tsx
  import './ambient.css'
  export function Ambient(): React.JSX.Element {
    return <div className="backdrop" aria-hidden="true" />
  }
  ```
  D also creates an empty `components/ambient.css`.
- Everyone else may import these at once. If `npm run typecheck` fails **only** because one of them is missing, wait and run it again. **Never create or edit a file you do not own.**

### 3.1 `src/renderer/src/motion.ts` (owner C, copy verbatim, French comments kept)

```ts
// Mouvement : réglage « Effets visuels », lissage du pointeur, fond aux couleurs du jeu, transitions de vue.
// API figée par docs/design/motion-premium.md §3 : ne pas la changer sans prévenir les autres lots.
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

const REDUCED = '(prefers-reduced-motion: reduce)'

/** « Réduire les animations » ou réglage d'accessibilité de Windows. */
export function motionReduced(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || matchMedia(REDUCED).matches
}

/** Effets riches permis (<html data-fx="on">, posé par App.tsx). À lire au moment de l'événement, jamais au montage. */
export function fxOn(): boolean {
  return document.documentElement.dataset.fx === 'on'
}

/** Suit le réglage d'accessibilité de Windows. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia(REDUCED).matches)
  useEffect(() => {
    const mq = matchMedia(REDUCED)
    const onChange = (): void => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// ---------- lissage ----------

export interface Follower {
  set(x: number, y: number): void
  release(): void
  cancel(): void
}

/** Suit une cible avec un lissage exponentiel (indépendant des Hz de l'écran). Une seule boucle rAF, arrêtée une fois posée. */
export function follow(
  apply: (x: number, y: number) => void,
  { rate = 0.18, restX = 0, restY = 0, epsilon = 0.001 }: { rate?: number; restX?: number; restY?: number; epsilon?: number } = {}
): Follower {
  let x = restX
  let y = restY
  let tx = restX
  let ty = restY
  let raf = 0
  let last = 0
  const tick = (now: number): void => {
    const dt = last ? Math.min(64, now - last) : 16.7
    last = now
    const k = 1 - Math.pow(1 - rate, dt / 16.7)
    x += (tx - x) * k
    y += (ty - y) * k
    const settled = Math.abs(tx - x) < epsilon && Math.abs(ty - y) < epsilon
    if (settled) {
      x = tx
      y = ty
    }
    apply(x, y)
    if (settled) {
      raf = 0
      last = 0
    } else raf = requestAnimationFrame(tick)
  }
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  return {
    set(nx, ny) {
      tx = nx
      ty = ny
      kick()
    },
    release() {
      tx = restX
      ty = restY
      kick()
    },
    cancel() {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
    }
  }
}

// ---------- fond aux couleurs du jeu (Ambient.tsx l'affiche) ----------

export interface ArtState {
  /** Image de fond de la page (jeu à la une). */
  base: string | null
  /** Jeu survolé ou focalisé au clavier. */
  focus: string | null
}
const art: ArtState = { base: null, focus: null }
const artListeners = new Set<(s: ArtState) => void>()
const emitArt = (): void => artListeners.forEach((l) => l({ ...art }))

export function setArtFocus(url: string | null | undefined): void {
  const next = url || null
  if (next === art.focus) return
  art.focus = next
  emitArt()
}

export function setArtBase(url: string | null | undefined): void {
  const next = url || null
  if (next === art.base) return
  art.base = next
  emitArt()
}

export function subscribeArt(listener: (s: ArtState) => void): () => void {
  artListeners.add(listener)
  listener({ ...art })
  return () => {
    artListeners.delete(listener)
  }
}

// ---------- source du morphing jaquette → fiche ----------

export type MorphKind = 'cover' | 'art'
export interface MorphSource {
  el: HTMLElement
  gameId: string
  kind: MorphKind
  at: number
}
let morph: MorphSource | null = null
let opened: MorphSource | null = null

const onScreen = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false
  const r = el.getBoundingClientRect()
  return r.width > 24 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
}

/** À appeler juste avant onOpen(game) : l'élément (jaquette 2:3 ou visuel paysage) qui deviendra l'en-tête de la fiche. */
export function setMorphSource(el: HTMLElement | null, gameId: string, kind: MorphKind): void {
  morph = el ? { el, gameId, kind, at: performance.now() } : null
}

/** App.tsx : source valable pour ce jeu (posée il y a moins d'1 s, encore à l'écran), sinon null. */
export function takeMorphSource(gameId: string): MorphSource | null {
  const m = morph
  morph = null
  if (!m || m.gameId !== gameId || performance.now() - m.at > 1000 || !onScreen(m.el)) return null
  opened = m
  return m
}

/** App.tsx, à la fermeture : l'élément d'origine s'il est toujours visible. */
export function closeTarget(gameId: string): MorphSource | null {
  const m = opened
  opened = null
  return m && m.gameId === gameId && onScreen(m.el) ? m : null
}

// ---------- transitions de vue ----------

export type VtKind = 'open' | 'close' | 'reorder'
const MAX_NAMED = 48
const MORPH_NAME: Record<MorphKind, string> = { cover: 'px-cover', art: 'px-art' }
let running = false

/** Jaquettes entièrement visibles sous la barre d'outils collante (48 au plus). */
function visibleCards(): HTMLElement[] {
  const content = document.querySelector('.content')
  const grid = document.querySelector('.lib-grid')
  if (!content || !grid) return []
  const view = content.getBoundingClientRect()
  const top = Math.max(view.top, document.querySelector('.lib-toolbar')?.getBoundingClientRect().bottom ?? view.top)
  const out: HTMLElement[] = []
  for (const el of grid.querySelectorAll<HTMLElement>(':scope > .lib-card')) {
    const r = el.getBoundingClientRect()
    if (r.top > view.bottom || out.length >= MAX_NAMED) break
    if (r.top >= top && r.bottom <= view.bottom && r.left >= view.left && r.right <= view.right) out.push(el)
  }
  return out
}

function nameCards(els: Iterable<HTMLElement>, on: boolean): void {
  for (const el of els) {
    el.style.viewTransitionName = on ? 'match-element' : ''
    el.style.viewTransitionClass = on ? 'px-card' : ''
  }
}

/**
 * Applique `update` (des setState) dans une transition de vue.
 * Sans support, animations réduites, transition en cours, rien à animer : `update` tout de suite.
 */
export function withViewTransition(update: () => void, { kind, source = null }: { kind: VtKind; source?: MorphSource | null }): void {
  const root = document.documentElement
  const skip =
    typeof document.startViewTransition !== 'function' ||
    motionReduced() ||
    running ||
    document.hidden ||
    (kind !== 'reorder' && !source) ||
    (kind === 'open' && !!document.querySelector('.sheet-root'))
  if (skip) return update()

  const cards = new Set<HTMLElement>()
  if (kind === 'reorder') {
    visibleCards().forEach((el) => cards.add(el))
    if (!cards.size) return update()
    nameCards(cards, true)
  } else if (kind === 'open' && source) {
    source.el.style.viewTransitionName = MORPH_NAME[source.kind]
  }

  const classes = ['vt-active', `vt-${kind}`, ...(source ? [`vt-from-${source.kind}`] : [])]
  root.classList.add(...classes)
  running = true
  const t = document.startViewTransition({
    types: [kind],
    update: () => {
      if (kind === 'reorder') {
        nameCards(cards, false)
        flushSync(update)
        const after = visibleCards()
        after.forEach((el) => cards.add(el))
        nameCards(after, true)
      } else if (kind === 'open') {
        if (source) source.el.style.viewTransitionName = ''
        flushSync(update)
      } else {
        flushSync(update)
        root.classList.add('vt-close-new')
        if (source) source.el.style.viewTransitionName = MORPH_NAME[source.kind]
      }
    }
  })
  t.ready.catch(() => {})
  t.finished
    .catch(() => {})
    .finally(() => {
      root.classList.remove(...classes, 'vt-close-new')
      nameCards(cards, false)
      if (source) source.el.style.viewTransitionName = ''
      running = false
    })
}
```

Notes on motion.ts:
- `document.startViewTransition({ update, types })` and `style.viewTransitionName` / `viewTransitionClass` are typed in the TS 7 DOM lib in this repo. No `@ts-expect-error` is needed.
- Use `flushSync` plus `document.startViewTransition`, **not** React 19.3's `<ViewTransition>`. The sheet and the grid don't update through `startTransition`, and we need exact control over which element is named.

### 3.2 New tokens (owner D, in `tokens.css` under `/* Mouvement */`)

```css
--ease-glide: cubic-bezier(0.22, 1, 0.36, 1); /* entrée de survol, morphing, glissements */
--ease-drift: cubic-bezier(0.37, 0, 0.63, 1); /* boucles d'ambiance (sinus) */
--d-in: 220ms; /* réponse au survol */
--d-out: 320ms; /* retour au repos */
--d-5: 700ms; /* fondus d'ambiance (fond, carrousel) */
```
The existing `--ease-out` (0.2, 0.8, 0.2, 1), `--ease-in`, `--ease-in-out` and `--d-1..4` are kept. A, B and C reference the new tokens without fallbacks: the CSS is checked after the merge.

### 3.3 Cross-package markup contract

| Contract | Producer | Consumer |
|---|---|---|
| `setArtFocus(game.heroUrl \|\| game.coverUrl)` on pointerenter and on keyboard focus; `setArtFocus(null)` on leave and blur, **only if this element set it** | A (cards), B (shelf tiles), D (profile tiles, optional) | D (Ambient backdrop) |
| `setArtBase(url)` for the displayed slide; `setArtBase(null)` on unmount | B (Hero) | D |
| `setMorphSource(el, game.id, 'cover' \| 'art')` right before `onOpen(game)` | A (`.lib-card-box`, cover), B (shelf `.shelf-tile-clip`, art; hero active art img, art), D (profile box, optional) | C (App.tsx → `takeMorphSource`) |
| `data-magnetic` attribute on the JOUER button | B (hero), C (sheet) | D (delegated listener in Ambient.tsx) |
| Class `fx-loop` on every element whose infinite animation runs on it or its `::before`/`::after` | A, B, D | D (base.css pauses them when `data-window='idle'`) |
| `.vt-active` flattens tilt and hides glare and ring | C sets it | A honours it |
| Named scroll timeline `--px-content` on `.content`, `timeline-scope` on `.shell` | D (shell.css) | B (hero), D (top bar) |
| `.lib-card` stays the direct child of `.lib-grid`; `.lib-toolbar` keeps its class | A, C | C (`visibleCards()`) |

**Pitfall for every package:** an `overflow: hidden` element is a scroll container. `scroll(nearest)` inside it binds to that element and never moves. Always use the **named** timelines (`--px-content`, `--px-sheet`), or `overflow: clip` on the wrapper.

---

## 4. Package A: library grid cards

**Owns:** `components/library/GameCard.tsx`, `components/library/library.css`, new `components/library/useTilt.ts`, and `components/ui/Cover.tsx` + `ui/cover.css` (additive optional props only; most likely untouched).
**Keep exports:** `openedByCard`, `usePop`, `FavStar`, `cardMeta`, `GameCardSkeleton` (GameSheet and Hero import them).

### 4.1 DOM

```tsx
<article ref={card} className={`lib-card ${entering ? 'is-entering' : ''} ${launching ? 'is-launching' : ''} ${fav ? 'is-fav' : ''}`} …existing handlers… onFocus={onFocus} onBlur={onBlur}>
  <div ref={media} className="lib-card-media">
    <div className="lib-card-glow" aria-hidden="true" style={{ background: generatedBackground(game.name) }}>
      {game.coverUrl && !glowFailed && <img src={game.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setGlowFailed(true)} />}
    </div>
    <div ref={box} className="lib-card-box">
      <Cover key={game.id} game={game} />
      <StoreTag kind={game.store} size={22} className="lib-card-tag" />
      <div className="lib-card-overlay" aria-hidden="true" />
      <div className="lib-card-glare" aria-hidden="true" />
      <div className="lib-card-ring fx-loop" aria-hidden="true" />
      <button className="lib-card-play" tabIndex={-1} aria-label={`Jouer à ${name}`} …>
        {launching ? <><span className="spinner" />Lancement…</> : <><Icon name="play" size={14} />Jouer</>}
      </button>
      <button className="lib-card-fav" …unchanged… />
    </div>
  </div>
  <div className="lib-card-text">…unchanged…</div>
</article>
```

- `const [entering] = useState(() => !document.documentElement.classList.contains('vt-active'))`. The class never toggles, so the entrance never replays. A card mounted during a reorder transition skips the entrance, because the view transition animates it.
- Opening: inside the existing `CLICK_DELAY` timer and in the Space branch of `onKeyDown`, call `setMorphSource(box.current, game.id, 'cover')` right before `onOpen(game)`.
- Keyboard: `onFocus` → if `e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')`, call `setArtFocus(art)` and set a ref `focusArt = true`. `onBlur` → if `focusArt`, call `setArtFocus(null)`. Here `art = game.heroUrl || game.coverUrl`.
- `useTilt(media, card, art)` (§4.3).

### 4.2 Values

| Effect | Element | Rest | Active | Timing |
|---|---|---|---|---|
| Media wrapper | `.lib-card-media` | `position: relative; perspective: 900px` (this also makes the stacking context for the z −1 glow and shadow). The box keeps `aspect-ratio: 2 / 3` in flow. | n/a | n/a |
| Tilt | `.lib-card-box` `transform` | `rotateX(0) rotateY(0)` | `rotateX(calc((0.5 - var(--py)) * 9deg)) rotateY(calc((var(--px) - 0.5) * 12deg))`, so ±4.5° vertical and ±6° horizontal | **Not CSS-transitioned.** Driven by the rAF follower (rate 0.16) |
| Lift | `.lib-card-box` `translate` + `scale` | `0 0` / `1` | Full: `0 -6px` / `1.05`; Sober: `0 -4px` / `1` | in `var(--d-in) var(--ease-glide)`, out `var(--d-out) var(--ease-out)` |
| Shadow | `.lib-card-media::before` (z -1, `inset: 0`, r `--r-md`, `box-shadow: 0 26px 44px -16px rgb(0 0 0 / .8)`) | `opacity: 0` | `opacity: 1`, with the same `translate`/`scale` as the box | same as lift. **The box's own box-shadow is not transitioned any more.** |
| Inner art parallax | `.lib-card-box .cover` | `scale: 1` | Full: `scale: 1.08; translate: calc((0.5 - var(--px)) * 10px) calc((0.5 - var(--py)) * 10px)`; Sober: `scale: 1.04` | `scale 400ms var(--ease-out)`; translate follows the vars, not transitioned |
| Glare | `.lib-card-glare`: `inset: -50%`, z 2, `background: radial-gradient(circle, rgb(255 255 255 / .5) 0%, rgb(255 255 255 / .16) 20%, transparent 42%)`, `mix-blend-mode: soft-light`, `translate: calc((var(--px) - .5) * 50%) calc((var(--py) - .5) * 50%)` | `opacity: 0` | `opacity: 1` (Full only) | `opacity var(--d-in)` in, `var(--d-out)` out |
| Spotlight ring | `.lib-card-ring`: `inset: 0`, z 4, `border-radius: inherit`, `padding: 1.5px`, `mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude`, `background: radial-gradient(200px circle at calc(var(--px) * 100%) calc(var(--py) * 100%), rgb(196 181 253 / .95), rgb(124 58 237 / .6) 38%, rgb(255 255 255 / .06) 70%)` | `opacity: 0` | `opacity: 1` (Full, `[data-tilt]`) | 260ms `--ease-out` |
| Ambient glow | `.lib-card-glow`: `position: absolute; inset: 8% 6% -5%; z-index: -1; border-radius: var(--r-lg); overflow: hidden; filter: blur(26px) saturate(1.5)`; img `width/height: 100%; object-fit: cover` | `display: none; opacity: 0; scale: .9` | `display: block; opacity: .6; scale: 1.04; translate: 0 8px` (Full, `[data-tilt]` or `:focus-visible`) | `opacity, scale, translate 360ms var(--ease-out), display 360ms allow-discrete`, plus `@starting-style { opacity: 0; scale: .9 }` |
| Raise | `.lib-card` | `position: relative; z-index: auto` | `z-index: 1` on `:hover`, `:focus-visible` and `[data-tilt]` | instant |
| Overlay | `.lib-card-overlay` | `opacity: 0` | `opacity: 1`; gradient becomes `linear-gradient(0deg, color-mix(in srgb, var(--bg-0) 92%, transparent), transparent 58%)` | `var(--d-2) var(--ease-out)` |
| Play pill | `.lib-card-play`: `left/right/bottom: 10px; height: 34px; border-radius: 9px; display: flex; gap: 6px; centred; font: 700 12.5px/1 var(--font-ui); letter-spacing: .06em; text-transform: uppercase; background: var(--accent-solid); color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / .18), 0 6px 16px -6px rgb(124 58 237 / .7)` (static) | `opacity: 0; translate: 0 10px; pointer-events: none` | `opacity: 1; translate: 0 0; pointer-events: auto`, delay 40ms; hover `background: var(--accent-solid-hover)` | `opacity 180ms var(--ease-out), translate 260ms var(--ease-glide), background-color var(--d-1)` |
| Focus sweep | `.lib-card:focus-visible .lib-card-ring` | n/a | `opacity: 1; background: conic-gradient(from var(--ring-angle), rgb(155 108 255 / .3), #c4b5fd 18%, rgb(155 108 255 / .3) 36%, rgb(155 108 255 / .3))`; Full: `animation: lib-ring-spin 4s linear infinite` | `@property --ring-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg }`, `@keyframes lib-ring-spin { to { --ring-angle: 360deg } }` |
| Static focus | `.lib-card:focus-visible .lib-card-box` | n/a | `box-shadow: var(--focus)`, lift and scale as on hover, **no tilt** | as lift |
| Entrance | `:root[data-fx='on'] .lib-card.is-entering` | n/a | `animation: lib-card-in 420ms var(--ease-glide) both; animation-delay: calc(min(sibling-index() - 1, 12) * 22ms)`; `@keyframes lib-card-in { from { opacity: 0; translate: 0 10px } }` | once per mount |
| VT flatten | `.vt-active .lib-card-box` | n/a | `transform: none !important`; `.vt-active :is(.lib-card-glare, .lib-card-ring) { opacity: 0 !important; transition: none }` | n/a |

- `.lib-card { --px: .5; --py: .5 }` sets the defaults.
- Selectors: the sober tier uses `.lib-card:is(:hover, :focus-visible)`, the full tier uses `:root[data-fx='on'] .lib-card[data-tilt]` and `:root[data-fx='on'] .lib-card:focus-visible`. The full-tier selectors are more specific, so they win.
- Fav button and store tag are unchanged (fav uses z 3, the tag z 2).
- **Do not** add `will-change` to cards. The 3D transform already promotes the hovered box, and `will-change` would pin its raster scale, which blurs text at 1.05.
- **Do not** add `content-visibility` to `.lib-card`: its paint containment clips the glow, lift and focus ring at the card's edge (§8).
- Delete the dead rules from `library.css` (B renames its classes): everything from `/* ---------- héros ---------- */` up to, but not including, `/* ---------- étoile favorite ---------- */`, and everything from `/* ---------- « Joués récemment » ---------- */` up to, but not including, `/* ---------- barre d'outils collante ---------- */`. **Keep** `.lib-star` and `.lib-pop`. Leave `.lib`, the toolbar, the grid, skeletons and empty states alone, apart from the card rules.

### 4.3 `useTilt.ts`

```ts
import { useEffect, useRef, type RefObject } from 'react'
import { follow, fxOn, setArtFocus } from '../../motion'

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Inclinaison + reflet de la jaquette survolée. Écrit --px/--py (0..1) sur `host`, jamais sur :root. */
export function useTilt(target: RefObject<HTMLElement | null>, host: RefObject<HTMLElement | null>, art: string | undefined): void {
  const artRef = useRef(art)
  artRef.current = art
  useEffect(() => {
    const el = target.current
    const card = host.current
    if (!el || !card) return
    let rect: DOMRect | null = null
    let tilting = false
    let hovered = false
    const f = follow(
      (x, y) => {
        card.style.setProperty('--px', x.toFixed(4))
        card.style.setProperty('--py', y.toFixed(4))
      },
      { rate: 0.16, restX: 0.5, restY: 0.5 }
    )
    const stale = (): void => {
      rect = null
    }
    const move = (e: PointerEvent): void => {
      if (!tilting) return
      rect ??= el.getBoundingClientRect()
      f.set(clamp01((e.clientX - rect.left) / rect.width), clamp01((e.clientY - rect.top) / rect.height))
    }
    const enter = (e: PointerEvent): void => {
      hovered = true
      setArtFocus(artRef.current)
      if (e.pointerType !== 'mouse' || !fxOn()) return
      tilting = true
      rect = el.getBoundingClientRect()
      card.dataset.tilt = ''
      window.addEventListener('scroll', stale, { capture: true, passive: true })
      move(e)
    }
    const leave = (): void => {
      if (hovered) setArtFocus(null)
      hovered = false
      if (!tilting) return
      tilting = false
      delete card.dataset.tilt
      window.removeEventListener('scroll', stale, true)
      f.release()
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      leave()
      f.cancel()
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [target, host])
}
```

- Listeners go on `.lib-card-media`, whose rect is not transformed. The tilted box inside is a descendant, so its lifted edge still counts as "inside".
- One layout read per enter, plus one after a scroll. The pointermove path never reads layout.

---

## 5. Package B: hero, carousel and shelf

**Owns:** `components/library/Hero.tsx`, `components/library/RecentShelf.tsx`, `components/library/Library.tsx`, new `components/library/hero.css` (imported by Hero.tsx), new `components/library/shelf.css` (imported by RecentShelf.tsx), `components/ui/Icon.tsx` (additive: `pause: 'M9 5v14M15 5v14'`).
**Rename** every class: `lib-hero-*` → `hero-*`, `lib-glass-btn` → `hero-glass-btn`, `lib-shelf-*` / `lib-tile-*` → `shelf-*`, `lib-section-head` / `lib-section-title` → `shelf-head` / `shelf-title`. Copy the needed base rules from today's library.css into the new files under the new names. A deletes the old rules, so the merge order doesn't matter. `FavStar` keeps its `.lib-star` / `.lib-pop` classes (A's file).

### 5.1 Library.tsx

- Replace `pickHero` usage with `pickFeatured(games): Game[]` (at most 5):
  ```ts
  const first = pickHero(games)            // unchanged logic
  if (!first) return []
  const rest = games.filter((g) => g.id !== first.id && !!g.heroUrl)
  const favs = rest.filter((g) => g.favorite).sort((a, b) => byRecent(a, b) || byName(a, b))
  const played = rest.filter((g) => !g.favorite && g.lastPlayed).sort(byRecent)
  return [first, ...favs, ...played].slice(0, 5)
  ```
- `recent` (shelf) still excludes only `featured[0]`.
- `<Hero games={featured} friends={friends} launchingId={launchingId} onLaunch={onLaunch} onOpen={onOpen} onFavorite={onFavorite} />`, with **no `key`**. The Hero keeps its slide by id.
- `HeroSkeleton` follows the new full-bleed geometry.

### 5.2 Hero: full-bleed art that bleeds into the page

```tsx
<section ref={root} className={`hero ${n > 1 ? 'is-carousel' : ''} ${paused ? 'is-paused' : ''} ${offscreen ? 'is-offscreen' : ''} ${poster ? 'has-poster' : ''}`}
  aria-roledescription={n > 1 ? 'carrousel' : undefined} aria-label={n > 1 ? 'Jeux à la une' : `${kicker} : ${name}`}>
  <div className="hero-stage" aria-hidden="true">
    {outgoing && <HeroArt key={outgoing.id} game={outgoing} state="out" />}
    <HeroArt key={game.id} game={game} state="in" ref={artRef} />   {/* img.hero-art-img fx-loop inside */}
  </div>
  <div className="hero-scrim" aria-hidden="true" />
  {poster && <img className="hero-poster" … />}
  <div className="hero-body" key={game.id} role={n > 1 ? 'group' : undefined} aria-roledescription={n > 1 ? 'diapositive' : undefined}
       aria-label={n > 1 ? `${i + 1} sur ${n} : ${name}` : undefined}>
    kicker · title · meta · actions (JOUER gets data-magnetic; glass star; glass « Détails »)
  </div>
  {n > 1 && <HeroDots … />}
  {players.length > 0 && <FriendsChip players={players} />}
</section>
```

- The existing image fallback order (heroUrl → blurred cover + sharp poster → generated gradient) moves into `HeroArt`, with the per-URL `failed`/`loaded` sets lifted into Hero.
- Kicker: slide 0 keeps `lastPlayed ? 'Reprendre' : 'À la une'`. Other slides use `favorite ? 'Favori' : 'Joué récemment'`. These are true facts only.
- "Détails": `setMorphSource(artRef.current /* the active .hero-art-img */, game.id, 'art')`, then `onOpen(game)`. Do this last, and treat it as optional. During a view transition the art escapes the hero's `overflow: clip`. If its first frame visibly overhangs the rail (the stage is 18px wider than the hero), drop this call; the sheet then just slides in.
- Backdrop: `useEffect(() => setArtBase(resolvedArtUrl(game)), [game.id, …])` and `useEffect(() => () => setArtBase(null), [])`. `resolvedArtUrl` is the URL actually shown (hero, else cover, else null).

| Element | Values |
|---|---|
| `.hero` | `position: relative; height: var(--hero-h); --hero-h: clamp(320px, 46vh, 480px); margin: -24px calc(var(--lib-pad-x) * -1) -16px; overflow: clip; isolation: isolate; flex-shrink: 0`. At ≤1200px, `margin-top: -20px`. No radius and no inset ring. |
| `.hero-stage` | `position: absolute; inset: -12px -18px 0; mask-image: linear-gradient(180deg, #000 0%, #000 50%, transparent 100%); translate: calc(var(--hx, 0) * -14px) calc(var(--hy, 0) * -8px)` |
| `.hero-art` (slide layer) | `position: absolute; inset: 0; transition: opacity var(--d-5) var(--ease-in-out)`. `.is-out { opacity: 0 }`. `.is-in` uses `@starting-style { opacity: 0 }`. Full: `.is-in { animation: hero-art-in 1100ms var(--ease-glide) both }`, `@keyframes hero-art-in { from { scale: 1.06 } }` |
| `.hero-art-img` (drift) | `object-fit: cover; object-position: 50% 25%`. Full: `animation: hero-drift 26s var(--ease-drift) infinite alternate`, `@keyframes hero-drift { from { scale: 1.04 } to { scale: 1.1; translate: -1.2% -0.8% } }`. Class `fx-loop`. |
| Scroll parallax | Full: `.hero-stage { animation: hero-scroll linear both; animation-timeline: --px-content; animation-range: 0 460px }`, `@keyframes hero-scroll { to { transform: translateY(140px) } }`. This uses `transform`; the pointer parallax uses `translate`, so they don't fight. |
| `.hero-scrim` | `linear-gradient(90deg, color-mix(in srgb, var(--bg-1) 88%, transparent) 0%, color-mix(in srgb, var(--bg-1) 55%, transparent) 34%, transparent 66%)`. No bottom gradient: the mask does that job. |
| `.hero-body` | `position: absolute; left: var(--lib-pad-x); bottom: 40px; max-width: 560px; z-index: 3; translate: calc(var(--hx, 0) * 5px) calc(var(--hy, 0) * 3px)`. In `.is-carousel`, `bottom: 60px`. Full text entrance: `.hero-body > * { animation: hero-text-in 420ms var(--ease-glide) both }` with delays 0/60/120/180ms on children 1 to 4, `@keyframes hero-text-in { from { opacity: 0; translate: 0 10px } }`. |
| `.hero-poster` (cover-only games) | As today, right `calc(var(--lib-pad-x) + 8px)`, plus `translate: calc(var(--hx, 0) * -8px) calc(var(--hy, 0) * -5px)` |
| `.hero-glass-btn`, title, meta, FriendsChip | Today's values, renamed. FriendsChip sits at `right: var(--lib-pad-x); bottom: 40px`. |

**Pointer parallax (JS, in Hero):** `follow(apply, { rate: 0.08 })` writes `--hx`/`--hy` (−1..1) on `.hero`. On `pointerenter`, if `e.pointerType === 'mouse' && fxOn()`, read the rect. On `pointermove`, `f.set(((x - r.left) / r.width) * 2 - 1, ((y - r.top) / r.height) * 2 - 1)`. On `pointerleave`, `f.release()`. A capture `scroll` listener marks the rect stale. Cancel everything on unmount.

### 5.3 Carousel (only when `games.length >= 2`)

- State: `currentId` (not an index), so a refreshed `featured` order never jumps. `i = max(0, games.findIndex((g) => g.id === currentId))`. Also `outgoing: Game | null`, removed 750ms after a change, and `paused`.
- `go(id)`: `setOutgoing(game); setCurrentId(id)`.
- **Autoplay is driven by CSS.** The active dot's fill runs `hero-progress 7000ms linear forwards` (Full only). Its `onAnimationEnd` calls `if (fxOn() && !paused) go(next.id)`. Re-key the fill (`key={game.id}`) to restart it. It pauses through `animation-play-state: paused` on `.hero:hover`, `.hero:focus-within`, `.hero.is-paused`, `.hero.is-offscreen` and `:root[data-window='idle']` (fill has `fx-loop`). Since autoplay only advances on `animationend`, all those pauses stop it too, and there's no timer to clean up.
- `is-offscreen`: an IntersectionObserver with `root: hero.closest('.content')` and threshold 0.35.
- Preload the 5 featured hero images once on mount (`new Image().src = url`).

| Dots | Values |
|---|---|
| Container | `role="group" aria-label="Choisir un jeu à la une"`, `position: absolute; left: var(--lib-pad-x); bottom: 26px; display: flex; gap: 8px; align-items: center; z-index: 3` |
| Dot | `<button className="hero-dot" aria-label={`Afficher ${name}`} aria-current={active ? 'true' : undefined}>`, hit area 20×20, visual 6×6 r3 `rgb(255 255 255 / .35)`, hover `.6`. Active: width 24px, track `rgb(255 255 255 / .22)`, fill `var(--accent)` with `transform-origin: left`, `@keyframes hero-progress { from { scale: 0 1 } }`. Width transition 260ms `--ease-glide`. In the sober and reduced tiers the active fill is static and full. |
| Pause | Icon button 24×24 after the dots: `aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}`, `aria-pressed={paused}`, icons `pause` / `play`. Hidden when `data-fx='off'`, since there's no autoplay then. |
| Keys | ←/→ on a focused dot moves to the previous/next slide and focuses its dot. Any manual pick sets `paused = true`. |
| A11y | The outgoing art is `aria-hidden` (the stage already is). The body is re-keyed, so screen readers read the new slide only when the user changes it (no `aria-live`). |

### 5.4 Shelf: portrait tiles that open into landscape art

The **Full tier** has portrait tiles that expand into landscape hero art on hover or focus. The **sober and reduced tiers** keep today's 264×148.5 landscape tiles. Same DOM, CSS decides.

```tsx
<div className={`shelf-tile ${launching ? 'is-launching' : ''}`} onPointerEnter={hoverIn} onPointerLeave={hoverOut} onFocus={focusIn} onBlur={focusOut}>
  <div ref={clip} className="shelf-tile-clip" aria-hidden="true">
    <div className="shelf-tile-hero"><Cover key={`h-${game.id}`} game={game} variant="landscape" showTitle={false} /></div>
    <div className="shelf-tile-cover"><Cover key={`c-${game.id}`} game={game} variant="portrait" /></div>
    <span className="shelf-tile-scrim" />
    <span className="shelf-tile-text"><span className="shelf-tile-name">{name}</span><span className="shelf-tile-meta">{meta}</span></span>
  </div>
  <button className="shelf-tile-open" aria-label={`${name}, ${meta}`} title={name} onClick={() => { setMorphSource(clip.current, game.id, 'art'); onOpen(game) }} />
  <button className="shelf-tile-play" …unchanged… />
</div>
```
`hoverIn`/`focusIn` call `setArtFocus(game.heroUrl || game.coverUrl)` and set a ref. `hoverOut`/`focusOut` call `setArtFocus(null)` only if that ref is set.

| Element | Sober (base CSS) | Full (`:root[data-fx='on'] …`) |
|---|---|---|
| `.shelf-track` | `display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory`, plus today's padding, fade masks and hidden scrollbar | `gap: 12px; scroll-snap-type: x proximity; contain: layout style` |
| `.shelf-tile` | `flex: 0 0 264px; height: 148.5px; border-radius: 12px; position: relative; scroll-snap-align: start` | `flex-basis: 124px; height: 186px; transition: flex-basis 280ms var(--ease-out)`. On `:hover` / `:focus-within`: `flex-basis: 330px; transition: flex-basis 340ms var(--ease-glide) 90ms` (90ms hover intent) |
| `.shelf-tile-clip` | `position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: var(--surface-1)` | same |
| `.shelf-tile-hero` | `position: absolute; inset: 0` | `inset: 0 auto 0 0; width: 330px` (fixed: the clip grows, the art never rescales); `opacity: 0`; active `opacity: 1`, `240ms var(--ease-out) 60ms` |
| `.shelf-tile-cover` | `display: none` | `display: block; position: absolute; inset: 0 auto 0 0; width: 124px`; active `opacity: 0`, `200ms var(--ease-out) 100ms` |
| `.shelf-tile-text` | visible (today) | `opacity: 0; translate: 0 6px`; active `opacity: 1; translate: 0`, `260ms var(--ease-glide) 160ms` |
| `.shelf-tile-play` | today's reveal | active reveal delay 180ms |
| Hover lift | `translate: 0 -2px`, ring `--line-3` (today) | no lift, ring `--line-3` |
| Focus | `.shelf-tile:has(.shelf-tile-open:focus-visible) .shelf-tile-clip { box-shadow: var(--focus) }` | same, and it expands |

- The cursor stays stable: a tile grows to the right from its left edge, so the cursor is still on it. Moving right, the next tile slides left under the cursor by exactly the collapse amount and stays under it. Checked for gap 12 and widths 124/330.
- **Exception to spec.md §6, granted here:** `flex-basis` is animated on at most 8 shelf tiles inside a layout-contained track. That's two tiles changing at once and about 1ms of layout per frame. No other package animates layout.
- Arrows and "Tout voir" behave as today (renamed classes).

---

## 6. Package C: game sheet, view transitions, App wiring

**Owns:** `App.tsx`, `contracts.ts`, new `motion.ts` (§3.1), new `styles/transitions.css` (imported by App.tsx), `components/GameSheet.tsx`, `components/gamesheet.css`, `components/library/LibraryToolbar.tsx`.

### 6.1 contracts.ts
Add to `UiPrefs`: `/** « Effets visuels » : relief des jaquettes, reflets, fond aux couleurs du jeu, parallaxe. */ visualFx: boolean`. Nothing else changes.

### 6.2 App.tsx (exact changes)

1. Imports: `import { Ambient } from './components/Ambient'`, `import { closeTarget, takeMorphSource, useSystemReducedMotion, withViewTransition } from './motion'`, `import './styles/transitions.css'`, plus the type `Game`.
2. `DEFAULT_UI` gains `visualFx: true`.
3. In `App()`: `const systemReduced = useSystemReducedMotion()`. In the existing `useEffect`, add `root.dataset.fx = ui.visualFx && !ui.reduceMotion && !systemReduced ? 'on' : 'off'` and use the deps `[ui, systemReduced]`.
4. In `Shell()`:
   ```ts
   const openSheet = useCallback((g: Game) => {
     withViewTransition(() => setOpenGameId(g.id), { kind: 'open', source: takeMorphSource(g.id) })
   }, [])
   const closeSheet = useCallback(() => {
     withViewTransition(() => setOpenGameId(null), { kind: 'close', source: openGameId ? closeTarget(openGameId) : null })
   }, [openGameId])
   ```
   Pass `onOpen={openSheet}` to Library, `onOpenGame={openSheet}` to Profile and `onClose={closeSheet}` to GameSheet. (The existing `openGame` memo keeps its name.)
5. Render `<Ambient />` as the element right before `<main className="content" key={view}>`.

### 6.3 GameSheet: poster, parallax, morph targets

- **Poster:** inside `header.sheet-art`, after the Cover: `<div className="sheet-poster"><Cover key={`p-${game.id}`} game={game} variant="portrait" showTitle={false} /></div>`.
  - Values: `position: absolute; left: 28px; bottom: 20px; width: 88px; aspect-ratio: 2 / 3; border-radius: var(--r-md); overflow: hidden; z-index: 2; box-shadow: var(--sh-2), 0 0 0 1px var(--line-2)`.
  - `.sheet-heading` moves to `left: calc(28px + 88px + 18px); bottom: 22px`. The header stays 260px tall.
- **Morph state:** `const [morph] = useState(() => document.documentElement.classList.contains('vt-open'))` in `Sheet`, then add `is-morph` to `.sheet-root` for this open. The class stays put; if it toggled off, the CSS slide animation would replay.
  - CSS: `.sheet-root.is-morph .sheet-panel, .sheet-root.is-morph .sheet-scrim { animation: none }`, placed **before** the `.is-closing` rules so closing still wins.
- **Close morph:** in the existing close `useEffect`, use `setTimeout(() => setLast(null), document.documentElement.classList.contains('vt-close') ? 0 : CLOSE_MS)`.
- **JOUER:** add `data-magnetic` to `.sheet-play`.
- **Scroll parallax (Full):** `.sheet-panel { scroll-timeline: --px-sheet y }`. Don't use `scroll(nearest)`, because `.sheet-art` is `overflow: hidden`.
  ```css
  :root[data-fx='on'] .sheet-art .cover { animation: sheet-art-parallax linear both; animation-timeline: --px-sheet; animation-range: 0 260px; }
  @keyframes sheet-art-parallax { to { translate: 0 104px; scale: 1.06; } }
  :root[data-fx='on'] :is(.sheet-heading, .sheet-poster) { animation: sheet-head-out linear both; animation-timeline: --px-sheet; animation-range: 60px 230px; }
  @keyframes sheet-head-out { to { opacity: 0; translate: 0 -12px; } }
  ```
  The art moves at about 0.6× the scroll speed (104px over 260px). The title and poster fade before the sticky action row covers them.
- **Morph target names**, in gamesheet.css:
  ```css
  .vt-open .sheet-panel, .vt-close .sheet-panel { view-transition-name: px-sheet; }
  .vt-open.vt-from-cover .sheet-poster, .vt-close.vt-from-cover .sheet-poster { view-transition-name: px-cover; }
  .vt-open.vt-from-art .sheet-art, .vt-close.vt-from-art .sheet-art { view-transition-name: px-art; }
  .vt-close-new .sheet-root { display: none; }
  ```

### 6.4 LibraryToolbar: grid reorder

- Chip: `onClick={() => c.id !== chip && withViewTransition(() => onChip(c.id), { kind: 'reorder' })}`.
- Sort `pick(s)`: call `close()` and `btn.current?.focus()` first, then `if (s !== sort) withViewTransition(() => onSort(s), { kind: 'reorder' })`. React flushes the menu close at the end of the click event, before the old snapshot.
- Search typing, "Effacer" and "Tout voir" do **not** use view transitions.

### 6.5 `styles/transitions.css`

```css
/* Transitions de vue (motion.ts). Toutes ≤ 340 ms : la page ne reçoit pas les clics pendant ce temps. */
::view-transition-group(root) { animation-duration: 220ms; animation-timing-function: var(--ease-out); }

/* Jaquette → affiche, visuel → en-tête */
::view-transition-group(px-cover), ::view-transition-group(px-art) { animation-duration: 340ms; animation-timing-function: var(--ease-glide); }
::view-transition-old(px-cover), ::view-transition-new(px-cover),
::view-transition-old(px-art), ::view-transition-new(px-art) { height: 100%; object-fit: cover; animation-duration: 340ms; }

/* Tiroir */
::view-transition-new(px-sheet):only-child { animation: px-sheet-in 300ms var(--ease-glide) both; }
::view-transition-old(px-sheet):only-child { animation: px-sheet-out 200ms var(--ease-in) both; }
@keyframes px-sheet-in { from { opacity: 0; translate: 32px 0; } }
@keyframes px-sheet-out { to { opacity: 0; translate: 32px 0; } }
.vt-close::view-transition-group(px-cover), .vt-close::view-transition-group(px-art) { animation-duration: 300ms; }

/* Grille : tri et filtres */
::view-transition-group(*.px-card) { animation-duration: 300ms; animation-timing-function: var(--ease-glide); }
::view-transition-old(*.px-card):only-child { animation: px-card-out 180ms var(--ease-in) both; }
::view-transition-new(*.px-card):only-child { animation: px-card-in 260ms var(--ease-glide) 60ms both; }
@keyframes px-card-out { to { opacity: 0; scale: 0.94; } }
@keyframes px-card-in { from { opacity: 0; scale: 0.94; } }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

How the open transition plays out:
- The old root is the page with a hole where the card was. The new root is the page plus the scrim. They crossfade in 220ms, so the scrim fades in.
- The panel slides in as its own group.
- The cover flies from the card to the poster: portrait to portrait, so nothing stretches. Shelf and hero art fly landscape to landscape into the header, with `object-fit: cover`.
- Every group is drawn above everything else for 340ms, which is why only fully visible elements are named (`visibleCards`, `onScreen`).

---

## 7. Package D: global polish and the ambient backdrop

**Owns:** `styles/tokens.css`, `styles/base.css`, `styles/shell.css`, `components/Rail.tsx`, `components/TopBar.tsx`, `components/chrome.css`, `components/friends/FriendsPanel.tsx`, `components/friends/friends.css`, `components/settings/SettingsView.tsx`, new `components/Ambient.tsx`, new `components/ambient.css`, plus `components/Profile.tsx` and `components/profile.css` (optional items only).

### 7.1 Ambient.tsx: the backdrop and global behaviours

**DOM:**
```tsx
<div className="backdrop" aria-hidden="true">
  <canvas ref={a} className="bd-layer" width={128} height={72} />
  <canvas ref={b} className="bd-layer" width={128} height={72} />
  <div className="bd-shade" />
</div>
```

**shell.css:**
```css
.shell { timeline-scope: --px-content; }
.shell > .backdrop {
  grid-row: 2; grid-column: 2; position: relative; z-index: 0; min-width: 0; overflow: hidden; contain: strict; pointer-events: none;
  background: radial-gradient(900px 480px at 15% -8%, rgba(124, 58, 237, 0.08), transparent 60%), var(--bg-1); /* moved from .content */
}
.shell > .content { position: relative; z-index: 1; background: transparent; scroll-timeline: --px-content y; }
```

**ambient.css:**
- `.bd-layer`: `position: absolute; inset: -4%; width: 108%; height: 108%; opacity: 0; transition: opacity var(--d-5) var(--ease-in-out)`. `.bd-layer.is-front { opacity: .8 }`. `:root:not([data-fx='on']) .bd-layer { display: none }`.
- `.bd-shade`: `position: absolute; inset: 0; background: linear-gradient(180deg, rgb(14 16 24 / .6) 0%, rgb(14 16 24 / .72) 40%, var(--bg-1) 88%), radial-gradient(120% 90% at 50% 0%, transparent 40%, rgb(11 13 20 / .55) 100%)`.

**Why a canvas and not `filter: blur(40px)`:** a GPU blur over the whole content area is costly during the crossfade and on every frame where something scrolls above it. Drawing once into a 128×72 canvas with `ctx.filter` and letting CSS scale it up gives the same soft result, so the crossfade animates only opacity. Drawing a cross-origin image into a canvas is allowed; only reading pixels back would need CORS, and we never read back.

**Paint routine:**
```ts
function paint(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const s = Math.max((W + 12) / img.naturalWidth, (H + 12) / img.naturalHeight)
  const w = img.naturalWidth * s, h = img.naturalHeight * s
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'blur(3px) saturate(1.5) brightness(0.4)'
  ctx.drawImage(img, (W - w) / 2, (H - h) * 0.25, w, h) // même cadrage que le héros (50 % 25 %)
}
```

**Subscription** (inside `useEffect`, cleaned up on unmount):
- Inputs: `subscribeArt(({ base, focus }) => …)`. The target is `focus ?? base`.
- Delay before showing: **160ms** when `focus` is set (the pointer settles). **400ms** when `focus` drops to null and the current image came from a focus (no flash between cards). **0ms** for a base-only change.
- `show(url)`:
  - Bump a token.
  - If `!url || !fxOn()`, remove `is-front` from both layers and stop.
  - Otherwise: `const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode()`. On error, keep the current image.
  - If the token is stale, stop. Otherwise paint the back canvas, give it `is-front`, take it off the front one, and swap.
  - Skip if `url` is already shown.

**Contrast budget:** in the worst case (pure white art) the composite comes out at about `#2a2a2a`. `--text-2` gets 5.7:1 on it and `--text-3` gets about 4.5:1. **Do not raise** the canvas brightness (0.4), the layer opacity (0.8) or the top shade alpha (0.6).

**Window idle:**
- `const set = () => { root.dataset.window = document.hasFocus() && document.visibilityState === 'visible' ? 'active' : 'idle' }` on `focus`, `blur` and `visibilitychange`, and once at mount.
- base.css: `:root[data-window='idle'] .fx-loop, :root[data-window='idle'] .fx-loop::before, :root[data-window='idle'] .fx-loop::after { animation-play-state: paused !important; }`. Write the three selectors out: `:is()` can't contain pseudo-elements.

**Magnetic buttons (`[data-magnetic]`):**
- One delegated `pointerover` listener on `document`. When `e.pointerType === 'mouse' && fxOn()` and `closest('[data-magnetic]')` is an enabled button that isn't already attached:
  - Read its rect once.
  - Create `follow((x, y) => { el.style.translate = x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : '' }, { rate: 0.2, epsilon: 0.05 })`.
  - On the element's `pointermove`: offset from centre × 0.22, clamped to ±6px horizontally and ±4px vertically, passed to `f.set`.
  - On `pointerleave`: `f.release()`, then remove the listeners.
- The button's own `scale` (press) composes with the inline `translate`.

### 7.2 Buttons (base.css)

| Effect | Values |
|---|---|
| Press | `.btn` and `.icon-btn`: drop `transform` from the transition list and use the individual property. `transition: …, scale 160ms var(--ease-glide)`; `:active:not(:disabled) { scale: .96; transition-duration: 70ms; transition-timing-function: var(--ease-out) }` |
| Primary | Keep the hover glow (`--glow-accent` stays limited to primary buttons). Add `background-image: linear-gradient(180deg, rgb(255 255 255 / .08), transparent 55%)` (static). |
| JOUER shine (Full) | `.btn-play { position: relative; overflow: hidden; isolation: isolate }`, `.btn-play > * { position: relative; z-index: 1 }`. `.btn-play::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 30%, rgb(255 255 255 / .26) 50%, transparent 70%); translate: -130% 0; pointer-events: none }`. `:root[data-fx='on'] .btn-play:hover:not(:disabled)::after { translate: 130% 0; transition: translate 750ms var(--ease-in-out) }`. At rest there's no transition, so it sweeps once per hover and resets invisibly. No shine while `.is-launching`. |
| Magnetic | See 7.1. Applies only where B and C put `data-magnetic` (the two JOUER buttons). |

### 7.3 Rail: the active pill slides

- In Rail.tsx, beside the 3px indicator, render `<span className={`rail-pill ${animate ? 'animate' : ''}`} style={{ transform: `translateY(${pillY}px)` }} aria-hidden="true" />`. Here `pillY = btn.offsetTop`, computed in the existing `place()`.
- Remove the `.rail-btn[aria-current='page']` background; the pill replaces it. `.rail-btn { position: relative; z-index: 1 }`.
- `.rail-pill`: `position: absolute; top: 0; left: 50%; width: 44px; height: 44px; margin-left: -22px; border-radius: 12px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-1)`. `.animate { transition: transform 340ms var(--ease-glide) }`. Give the indicator the same 340ms duration.
- Stretch (Full): when `view` changes after the first placement, add `is-moving` to the indicator for 340ms (state plus a cleared timeout). `:root[data-fx='on'] .rail-indicator.is-moving { animation: rail-stretch 340ms var(--ease-glide) }`, `@keyframes rail-stretch { 40% { scale: 1 1.8 } }`. The inline `transform` and the `scale` property compose.
- Icons: `.rail-btn svg { transition: scale 160ms var(--ease-glide) }`, `.rail-btn:hover svg { scale: 1.08 }`.

### 7.4 Top bar

- `.tb-search:focus-within .tb-search-icon { color: var(--accent) }` (transition `color var(--d-1)`).
- Scroll hairline (Full): `.topbar { position: relative }`. `.topbar::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, var(--accent-line) 35%, var(--accent-line) 65%, transparent); opacity: 0; pointer-events: none }`. `:root[data-fx='on'] .topbar::after { animation: tb-line linear both; animation-timeline: --px-content; animation-range: 0 64px }`, `@keyframes tb-line { to { opacity: 1 } }`. This works because of `timeline-scope` on `.shell`.
- Friends button: `.tb-stack .avatar { transition: translate 200ms var(--ease-glide) }`. On `.tb-friends:hover`, `nth-child(2)` gets `translate: 2px 0` and `nth-child(3)` gets `translate: 4px 0`.

### 7.5 Friends panel

- Row hover: keep the background. Add `.fr-av { transition: scale 200ms var(--ease-glide) }` and `.fr-row:hover .fr-av { scale: 1.06 }`.
- In-game ring on hover (Full): `.fr-row.st-in-game:hover .fr-av::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 1.5px solid var(--st-ingame); pointer-events: none; animation: fr-breathe 1.8s var(--ease-drift) infinite alternate }`, `@keyframes fr-breathe { from { opacity: .25; scale: .96 } to { opacity: .8; scale: 1.04 } }`. Add `fx-loop` to `.fr-av` on in-game rows. Cyan, because this means "en jeu". It only runs while hovered.
- Pulse when a friend switches to "en jeu" (exists): `animation-iteration-count: 2`, and the `useInGamePulse` clear timeout goes from 1300ms to 2500ms. It keeps animating `transform`/`opacity` only.

### 7.6 Settings: "Effets visuels" (SettingsView.tsx › InterfaceSection)

```tsx
<SettingRow
  label="Effets visuels"
  value={ui.reduceMotion || systemReduced
    ? 'En pause · les animations sont réduites'
    : ui.visualFx
      ? 'Activés · jaquettes en relief, reflets, fond aux couleurs du jeu survolé'
      : 'Désactivés · interface sobre, moins de calcul graphique'}
>
  <Switch checked={ui.visualFx} onChange={(visualFx) => onUiChange({ visualFx })} label="Effets visuels" />
</SettingRow>
```
Place it between "Réduire les animations" and "Effets de transparence". You may replace the local `useSystemReducedMotion` with the one from `motion.ts`.

### 7.7 Optional (only after 7.1 to 7.6)

- In Profile.tsx `GameTile`: give `.prof-gt-box` a ref. Call `setMorphSource(box, game.id, 'cover')` before `onOpen`. Call `setArtFocus(game.heroUrl || game.coverUrl)` / `null` on the tile's pointerenter/leave, guarded like the cards.
- Profile tiles get no tilt in this pass.

---

## 8. Performance budget

**Rules (all packages):**
1. Only `transform`, `translate`, `scale`, `rotate` and `opacity` animate. The named exceptions are the shelf `flex-basis` (≤ 8 tiles), the hero dot width (tiny), the ring gradient on **one** card (pointer position or `--ring-angle`), and the existing collapse rules. **Never** animate `filter`, `box-shadow`, `backdrop-filter`, a blur radius, `width` or `height` anywhere else. Shadows fade through a pseudo-element's opacity.
2. **One rich card at a time.** Tilt, glare, glow and ring exist only under `[data-tilt]` or `:focus-visible`, so at most two cards (hover plus keyboard). Idle cards have `display: none` glows and `opacity: 0` overlays, and no listeners other than the three pointer listeners per card.
3. Pointer handlers read layout at most once per enter. Pointer vars are written on the element (`.lib-card`, `.hero`, the button), **never on `:root`**. Every rAF loop is a `follow()` that stops once it settles.
4. Blur budget: at most one CSS-blurred element changes at a time (the card glow, `blur(26px)`, about 1.1× the card). The backdrop has **no** CSS filter (pre-blurred 128×72 canvases). The existing static blurs (hero poster mode, toolbar, toasts, glass buttons) stay as they are.
5. `will-change` is allowed only on the two `.bd-layer` canvases (`will-change: opacity`). Nowhere else.
6. Infinite and scroll-driven animations exist only under `:root[data-fx='on']`. Every infinite one carries `fx-loop`, so it pauses when the window is idle. Hover-only loops (friends ring) end when the hover ends.
7. View transitions: at most 48 named cards plus 3 morph names, at most 340ms each. Never start one while another is running; the update just applies.
8. **No `content-visibility` on cards.** Its paint containment clips the glow, lift and focus ring. Revisit only if a library over 400 games scrolls badly, and test `overflow-clip-margin` first.
9. New network images: none in the grid (the glow reuses the cached cover URL and loads lazily on the first hover). The shelf adds at most 8 portrait covers. The hero preloads at most 5 hero images.

**How to verify** (after the merge, on Windows with `npm run dev`, DevTools with Ctrl+Shift+I):

| Check | Tool | Pass |
|---|---|---|
| Hover sweep across 15 cards in about 3s, CPU throttled 4× | Performance panel | p95 frame ≤ 20ms; no "Layout" during card hover; scripting ≤ 2ms per frame |
| Only the hovered card repaints | Rendering › Paint flashing | Green flashes only on the active card; nothing on neighbours or the backdrop (except one flash per backdrop swap) |
| Layer count | Layers panel / Rendering › Layer borders | Card hover adds ≤ 3 layers; backdrop has 2 canvas layers; no per-card layers at idle |
| Shelf expansion | Performance | Layout ≤ 1.5ms per frame, only inside `.shelf-track` |
| Reorder | Animations panel | ≤ 48 `px-card` groups; finishes in ≤ 360ms |
| Idle | Unfocus the window, Rendering › Frame rendering stats | Frames stop (no hero drift, no ring sweep, no carousel progress) |
| Reduced motion | Windows Settings › Accessibility › Animation effects off | `data-fx="off"`; opening the sheet is instant; no view transition; landscape shelf tiles |

**Static self-checks before handing in:**
- `grep -nE "transition:[^;]*(box-shadow|filter)" <your css>` → nothing on card, tile, hero or backdrop rules.
- `grep -n "will-change" -r src/renderer/src` → only `ambient.css`.
- `grep -n "documentElement.style.setProperty('--p\|documentElement.style.setProperty('--h" -r src` → nothing.
- Every `animation-timeline` and every `infinite` sits inside a `:root[data-fx='on']` rule.

---

## 9. Accessibility

- **Each hover effect has a keyboard equivalent:**
  - Card `:focus-visible`: lift, scale 1.05, glow, static `--focus` ring plus the sweep, play pill and star shown, backdrop tint. No tilt.
  - Shelf tile: expands on `:focus-within`, with a `--focus` ring on the clip.
  - Hero: autoplay pauses while focus is inside; dots and the pause button are real buttons with French labels.
- **Nothing is conveyed only by motion:**
  - Kickers ("Reprendre", "Favori", "Joué récemment", "À la une") are text.
  - The play pill reads "JOUER".
  - "En jeu" stays shape plus cyan plus text; the ring and pulse only add to it.
  - The carousel position is in each slide's label ("2 sur 5 : Hades").
  - Shelf meta that only appears when a tile expands is also in the tile's `aria-label` and in the game sheet.
- **Moving content (WCAG 2.2.2):** the carousel moves for more than 5s, so it has a visible pause button. It also pauses on hover, on focus, when off screen and when the window is idle. Autoplay never runs in the reduced tier.
- **Reduced motion:** the OS setting and the in-app toggle both force `data-fx='off'`, skip view transitions and keep the global 0.01ms rule. Smooth scrolling is already disabled there.
- **Contrast** over the backdrop: see the budget in 7.1. Hero text keeps the left scrim. The sheet heading keeps its `text-shadow`.
- Tab order and roles don't change. The tilt, glare, ring and glow layers are `aria-hidden`. Never set `tabIndex` on the decorative layers.

---

## 10. What this pass changes in spec.md §5 and §6

| spec.md rule | New rule |
|---|---|
| §6 "Cards and panels never glow" | The **single** hovered or focused card shows an ambient glow made from its own art. Panels still never glow. `--glow-accent` stays limited to primary buttons. |
| §6 "No springy motion on big surfaces, no parallax" | Parallax is allowed on the hero (pointer and scroll) and on the sheet header (scroll) only, in the Full tier. Springs and overshoot are still banned. |
| §6 "Don't animate the width or height of grid items" | Exception: shelf tiles (`flex-basis`, ≤ 8 items). The grid still never animates layout. |
| §5 "No interaction animation lasts longer than 420ms" | Still true for responses (≤ 340ms in this pass). Ambient exceptions: backdrop and carousel crossfades (700ms), hero art settle (1100ms), JOUER shine (750ms), drift and ring loops. |
| §5 "Animate only transform and opacity" | Same, with the exceptions listed in §8 rule 1. |
| §5 grid entrance "20ms per card, max 240ms" | 22ms per card, capped at the 13th card (264ms), Full tier only. |
| §5 "Card hover lift translateY(-4px)" / "cover zoom 1.04" | Sober tier: unchanged. Full tier: −6px, scale 1.05, inner art scale 1.08. |
| §6 "No ads, upsell blocks, autoplay video or sound" | Unchanged. The carousel autoplays still images only, and can be paused. |

---

## 11. Testing notes for implementers

- **Verify with `npm run typecheck` only** (TS 7, `tsc --noEmit`). Don't launch Electron in the cloud sandbox.
- The sandbox **cannot load Steam images**. `Cover` falls back to the generated gradients, which is expected. The card glow falls back to the same gradient (the `style` background on `.lib-card-glow`). The backdrop keeps showing nothing when `decode()` fails; it doesn't need a gradient fallback.
- Screenshots are taken later with **generated placeholder art**. The CSP allows `data:` and `https:` images (not `blob:`), so placeholders must be `data:` or https URLs. Canvas drawing works with either.
- Chromium: Electron 44 ships about Chromium 152 (38 shipped 140, about +2 per major). Confirm with `process.versions.chrome` in DevTools. The newest feature used here is `sibling-index()` (Chromium 138). `match-element` needs 137, view-transition types and classes need 125, scroll-driven animations need 115, `@starting-style` and `allow-discrete` need 117. Scoped `element.startViewTransition()` (147) is **not** used.
- Before handing in, each package lists in its report:
  - the files changed;
  - any contract item from §3.3 it couldn't honour;
  - the results of the §8 static self-checks.
- Merge order doesn't matter as long as Phase 0 is done. A missing import from another package is a wait, not a reason to stub it yourself.

---

## 12. Out of scope

- Trailer or microtrailer previews on hover, and any game music or UI sounds.
- Dominant-colour extraction (`getImageData`, a CORS proxy or a `protocol.handle` scheme). The glow and backdrop use the art itself.
- A Steam logo layer over the hero or sheet header (`Game` has no `logoUrl`; it would need `artwork.ts` and shared-types changes).
- Holographic foil for favourites, custom cursors, per-game theming of the chrome.
- Dimming the sibling covers (rejected: it repaints N cards per frame).
- Migrating to React `<ViewTransition>`, and view transitions between Bibliothèque, Profil and Paramètres.
- Tilt on Profile tiles, Login mosaic changes, gamepad focus navigation, the command palette.
- `content-visibility` on the grid (see §8 rule 8).
