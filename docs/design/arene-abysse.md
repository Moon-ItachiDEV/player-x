# Player X: « Arène · Abysse » (0.7.0, updated 0.7.4)

**Status:** shipped in 0.7.0. It replaces the « Nuit Néon » direction of `spec.md` for layout, colour and type. `motion-premium.md` (effect tiers, reduced motion) and `update-reactor.md` (update animation) still apply. 0.7.4 makes it bluer and lighter, puts the content under a glass top bar and runs the Home art edge to edge under that bar.

**Chosen by the owner on 2026-10-20:** structure **C · Arène** (favourites rail, sidebar with navigation and friends, tabs in the top bar, game sheet as a side panel) and style **Abysse** (night blue, yellow for the main action, cyan for live).

**Data rule (unchanged):** show only what the app really knows. No store, prices, wishlist, downloads, tournaments, chat, « Join » or notification centre. Demo mode uses fictional games, friends and players.

---

## 1. Layout

```
┌──────┬────────────────┬──────────────────────────────────────────────┐
│ rail │ sidebar        │ top bar, glass: tabs or page title · search · (150px kept free for the Windows buttons)
│ 64px │ 248px          ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ logo │ greeting/acct  │                                              │
│ favs │ navigation     │ content (scrolls, also under the top bar)    │
│  +   │ friends        │                                              │
│      │ settings, demo │                                              │
└──────┴────────────────┴──────────────────────────────────────────────┘
```

- Grid: `var(--rail-w) var(--side-w) minmax(0, 1fr)`; top bar `--topbar-h` 48px. Under 1180px the sidebar is 220px. Minimum window 1024 × 640.
- **Content under the glass top bar (0.7.4):** `.content` and `.backdrop` span grid rows 1 to 3; `.content` has `padding-top: var(--topbar-h)` and `scroll-padding-top: calc(var(--topbar-h) + 12px)`, so the page starts under the bar at rest and scrolls behind it. The bar is at `--z-topbar` (15), with `--glass-bar` and `--glass-blur`. The scrollbar track starts under the bar. `.page` exposes `--page-top` and `--page-x` (26/28px, 20/20 under 1200px) for anything that bleeds out of the page padding.
- **Window:** `backgroundColor` `#0a182b`; on Windows `titleBarOverlay` is transparent (`#00000000`, symbols `#d6e3f3`), so the glass bar runs under the native buttons. Fallback if a Windows build draws it badly: an opaque `#142743`.
- **Rail** (`FavRail.tsx`, `favrail-*`): logo, favourite games (click launches, right click opens the sheet, a cyan ring and dot when in game), `+` opens the favourites picker.
- **Sidebar** (`Sidebar.tsx`, `friends/SideFriends.tsx`): account menu, navigation (Accueil, Bibliothèque, Stats de jeu, Trophées, Actus des jeux, Profil), friends grouped as in game (by game), online, away; « Hors ligne » and « Serveur Discord » fold. « Actus des jeux » shows only with the game news setting (Paramètres › Bibliothèque); its blue count is the number of games with « Nouveau patch ». Discord members get an eye-off button on hover or focus (« Masquer »), and the Discord fold ends with « N bots masqués · Gérer », which opens Paramètres › Comptes › Membres masqués. Paramètres and the demo badge sit at the bottom.
- **Top bar** (`TopBar.tsx`, `TopTabs.tsx`): a page renders its tabs into the bar with `<TopTabs>` (a portal into `.tb-slot`), or its title with `<TopTitle>`. Tabs are full height with a 2px yellow bar under the selected one. Under 1080px a tab shows its `short` label; under 1279px the search collapses to a magnifier and opens on focus, on Ctrl K or while it holds a query. From 1280px the tabs keep their full width and the search shrinks first, down to 120px (its Ctrl K hint goes under 230px); the tabs only scroll if even that is not enough.
- **Game sheet** (`GameSheet.tsx`): a 480px panel from the right. Its scrim leaves the rail, the sidebar and the top bar visible.
- **Update card** (`UpdateNotice.tsx`): bottom left of the content, `left: calc(var(--nav-w) + 20px)`.
- **Launch card** (`launch/LaunchDock.tsx`): same corner and size, stacked above the update card (§6).

## 2. Colour roles

All values are tokens in `src/renderer/src/styles/tokens.css`. Do not hard-code colours in components.

| Role | Tokens | Used for |
|---|---|---|
| Backgrounds | `--bg-0` `#0a182b` (window, fields, login), `--bg-1` `#10233b` (content), `--bg-2` `#162c48` (sidebar, panels, opaque top bar), `--bg-rail` `#0d1e35`, `--page-bg` (content backdrop: two blue halos over a `#13284a` → `--bg-1` → `#0c1c31` gradient) | page layers, darkest first |
| Glass | `--glass-bar` (top bar, stuck toolbar), `--glass` (hero band), `--glass-blur` (`blur(18px) saturate(140%)`), `--glass-line` (edge), `--glass-hi` (1px top highlight) | see §4 |
| Ink | `--ink` `#08152a` | every dark scrim over game art, as `color-mix(in srgb, var(--ink) N%, transparent)` |
| Avatar cuts | `--cut-card`, `--cut-hover` | the ring around stacked avatars must equal the opaque surface under it |
| Surfaces | `--surface-1/2/3`, `--card-bg`, `--btn2-bg`, `--btn2-line`, `--btn2-bg-hover` (secondary buttons) | cards, hover, popovers, toasts |
| Lines | `--line-1/2/3` | borders and separators, bluish |
| Text | `--text-1` to `--text-4` (`--text-4` = disabled only) | |
| **Action, yellow** | `--accent`, `--accent-solid` + `--on-accent` (dark text), `--accent-soft`, `--accent-line`, `--glow-accent` | **Jouer**, primary buttons, focus ring, selected tab bar, toggles, chart line, favourites, a launch on its way (sending, waiting) |
| **Live, cyan** | `--live`, `--live-soft`, `--live-text`, `--live-line`, `--st-ingame` | « En jeu » badges, in-game friends, running game, live captions, a launch once the game is confirmed running |
| Presence | `--st-online` green, `--st-away` amber, `--st-offline` grey | always paired with a shape |
| Semantic | `--info` (informational banners, patch and news counts), `--warning`, `--danger`, `--success` | |
| Stores | `--store-steam/epic/ea`, `--pf-discord/psn` | monogram tags only, never logos |
| **Brand** | `--brand-violet`, `--brand-cyan` | the PX logo and the update animation (card reactor, jump, return, À propos progress bar). Nowhere else, and never in the launch. |

Rules:
- Yellow is the one action colour on a screen: one filled yellow button per area. Text on yellow is always `--on-accent`.
- Cyan means « happening now ». A static decoration never uses it, and it never goes into a glow. It also rings, in the Home hero band, the friends who are on that game right now.
- A pending launch is yellow: your action travelling (the click, the hand-off, the wait). It turns cyan only once the process check confirms the game runs, never on a guess or a timer. In demo, cyan shows only where « Démo » is written.
- No brand violet → cyan gradient anywhere in the launch (`launch-*`).
- Glows behind art are blue (`rgb(47 124 246 / …)`), not violet.

## 3. Type

- **Titles:** Barlow Condensed, uppercase. Page title 800 26/30 (0.02em); card and section titles 700 17/22 (0.03em); heroes 800 34 to 64px.
- **Interface:** Barlow 400 to 800. Numbers use `.num` (tabular figures).
- **Wordmark:** Michroma, for « PLAYER X » only.
- **Mono:** `--font-mono` for paths, ids and update fingerprints.
- Fonts are bundled with `@fontsource`; the app never calls Google Fonts.

## 4. Shapes and depth

- Radii: `--r-xs` 3, `--r-sm` 5, `--r-md` 8 (buttons, inputs, banners), `--r-lg` 12 (cards), `--r-xl` 14 (dialogs). Pills only for badges and chips.
- Cards: `--card-bg` with a `--glass-line` border; the hero cards add a scanline tint over the art.
- Shadows: `--sh-1` to `--sh-3`, `--sh-card` (navy `rgba(2, 8, 20, …)`, and `--sh-card` starts with the `--glass-hi` inset highlight); glows only on hover or focus, and on the primary button.
- **Glass (0.7.4):** a real blur only on three surfaces: the top bar, the Home hero figures band and the stuck library toolbar. Every other panel only looks like glass, without a blur: `--glass-line` edge, `--glass-hi` top highlight, navy shadow (`.card-surface`, `.rc`, the Stats cards).
- **No blur:** `html.no-blur` (Paramètres › Interface › Effets de transparence off, or Windows asking for less transparency through `prefers-reduced-transparency`) removes every `backdrop-filter` and gives the glass surfaces solid colours (`--bg-2`).

## 5. Screens

| Screen | Top bar | Notes |
|---|---|---|
| Accueil | title | hero = running game, else last played, else a favourite. Its art runs edge to edge under the top bar (`.hh-bleed`, see §7) behind ink scrims. KPI band: playtime, launches (only if > 0), last play, then on the right the last patch (opens the reader) and friends online with avatars. « À reprendre » row (card footer only when someone plays), then « Mises à jour de tes jeux » |
| Bibliothèque | tabs Tous, Favoris, Non installés | toolbar dropdowns (`PickMenu`, `picker-*`): Store, Trier par, Taille; it sticks right under the top bar and gets its glass background only once stuck |
| Stats de jeu | tabs Vue d'ensemble, Progression, Arsenal, Cartes et modes, Classement (badge = your rank) | without a linked account: title « Stats de jeu » and the search; tab kept in `pg.stats.tab` |
| Trophées | title | Steam achievements: totals, latest, rarest, game by game (0.7.3) |
| Actus des jeux | tabs Patchs, Toutes les actus | « Jeu » filter, posts grouped by day, Tout marquer comme lu, Actualiser; a post opens in the game sheet's reader; a post without an image shows the game's art |
| Profil | title | hero card with banner, avatar with a cyan ring |
| Paramètres | tabs Comptes, Bibliothèque, Interface, Avancé, À propos | « action requise » alert icon on Comptes when an account needs setup |
| Connexion, premier lancement | none (full screen) | Steam is the yellow action; the setup selection ring and checks are yellow |

## 6. Launch

Spec: `launch-sequence.md` (« Séquence Mise à feu »).

- **Stage** (Full tier only, ≤ 1.0 s): a veil over the content area only, starting under the top bar, at `--z-launch` (75: above dialogs, under toasts). The rail, the sidebar and the top bar stay visible, and clicks go through.
- **Card**: 480 × 76 in the update card's corner, above it when both show. Its action is a secondary button, never a yellow fill.
- **Buttons**: yellow « Lancement… », then a soft yellow « En attente… », then cyan « En jeu » (`.is-sending`, `.is-waiting`, `.is-live`), same width in every state.

## 7. Gotchas

- Setup already owns `.fav` and `.pick`: the shell uses `favrail-*` and the dropdowns use `picker-*`.
- The update return flies the logo into `.favrail-logo .brand-mark` (`update/stage.ts`, `update/stage.css`). Renaming that class breaks the landing of the animation.
- `TopTabs` ids are `${idBase}-tab-${id}` and the panel is `${idBase}-panel`; a page that uses tabs must give its panel that id and `role="tabpanel"`.
- **Content top ≠ top bar bottom (0.7.4).** The content box starts at the top of the window, under the glass bar. Anything that measures « what is visible in the content » uses `barBottom()` and the pure `belowBar(box, barBottom)` (`launch/flip.ts`): the launch veil and its clip (`launch/sequence.ts`), `onScreen` and `visibleCards` (`motion.ts`), the library toolbar's IntersectionObserver (`rootMargin` of minus the content's `padding-top`).
- **Sticky inside `.content` uses `top: 0`, not `top: var(--topbar-h)`.** A sticky offset is measured from the scroller's padding box, which already starts under the bar; adding the bar height leaves a 48px gap.
- **Home hero bleed.** `.hh` has no `overflow: hidden` (it would clip the bleed) and no box of its own. `.hh-bleed` reaches back with `--hh-top` and `--page-x`, and `.home > :not(.hh):not(.sr-only) { position: relative }` keeps the next rows painting over its 120px tail (`.sr-only` stays out of the flow). The old `hh-drift` loop is gone: animated under two blurred surfaces it kept the GPU busy at rest (≈ 24 % CPU for the GPU process against 0.6 % without it); a scroll-driven parallax (`data-fx='on'` only) replaces it.
- **Dates and names.** `lastPlayed` is merged at read time (Player X launch, session seen by Player X, Steam) and is never written back to `games.last_played`. A Discord member's identity is their normalised display name: masking follows the name.
- **New CSS class names:** one global stylesheet set. Grep every `.css` (`achievements.css` included) before adding one; `styles/tokens.test.ts` (d) guards the names added in 0.7.4, (b) refuses the pre-0.7.4 colours outside `tokens.css`, (c) checks that every `var(--x)` is declared.
