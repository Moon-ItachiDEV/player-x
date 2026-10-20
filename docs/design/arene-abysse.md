# Player X: « Arène · Abysse » (0.7.0)

**Status:** shipped in 0.7.0. It replaces the « Nuit Néon » direction of `spec.md` for layout, colour and type. `motion-premium.md` (effect tiers, reduced motion) and `update-reactor.md` (update animation) still apply.

**Chosen by the owner on 2026-10-20:** structure **C · Arène** (favourites rail, sidebar with navigation and friends, tabs in the top bar, game sheet as a side panel) and style **Abysse** (night blue, yellow for the main action, cyan for live).

**Data rule (unchanged):** show only what the app really knows. No store, prices, wishlist, downloads, tournaments, chat, « Join » or notification centre. Demo mode uses fictional games, friends and players.

---

## 1. Layout

```
┌──────┬────────────────┬──────────────────────────────────────────────┐
│ rail │ sidebar        │ top bar: tabs or page title · search · (150px kept free for the Windows buttons)
│ 64px │ 248px          ├──────────────────────────────────────────────┤
│ logo │ greeting/acct  │                                              │
│ favs │ navigation     │ content (scrolls)                            │
│  +   │ friends        │                                              │
│      │ settings, demo │                                              │
└──────┴────────────────┴──────────────────────────────────────────────┘
```

- Grid: `var(--rail-w) var(--side-w) minmax(0, 1fr)`; top bar `--topbar-h` 48px. Under 1180px the sidebar is 220px. Minimum window 1024 × 640.
- **Rail** (`FavRail.tsx`, `favrail-*`): logo, favourite games (click launches, right click opens the sheet, a cyan ring and dot when in game), `+` opens the favourites picker.
- **Sidebar** (`Sidebar.tsx`, `friends/SideFriends.tsx`): account menu, navigation (Accueil, Bibliothèque, Stats de jeu, Profil), friends grouped as in game (by game), online, away; « Hors ligne » and « Serveur Discord » fold. Paramètres and the demo badge sit at the bottom.
- **Top bar** (`TopBar.tsx`, `TopTabs.tsx`): a page renders its tabs into the bar with `<TopTabs>` (a portal into `.tb-slot`), or its title with `<TopTitle>`. Tabs are full height with a 2px yellow bar under the selected one. Under 1080px a tab shows its `short` label; under 1279px the search collapses to a magnifier and opens on focus, on Ctrl K or while it holds a query.
- **Game sheet** (`GameSheet.tsx`): a 480px panel from the right. Its scrim leaves the rail, the sidebar and the top bar visible.
- **Update card** (`UpdateNotice.tsx`): bottom left of the content, `left: calc(var(--nav-w) + 20px)`.

## 2. Colour roles

All values are tokens in `src/renderer/src/styles/tokens.css`. Do not hard-code colours in components.

| Role | Tokens | Used for |
|---|---|---|
| Backgrounds | `--bg-0` (fields, login), `--bg-1` (content), `--bg-2` (sidebar, top bar, panels), `--bg-rail` | page layers, darkest first |
| Surfaces | `--surface-1/2/3`, `--card-bg`, `--glass` (always with a blur) | cards, hover, popovers, toasts |
| Lines | `--line-1/2/3` | borders and separators, bluish |
| Text | `--text-1` to `--text-4` (`--text-4` = disabled only) | |
| **Action, yellow** | `--accent`, `--accent-solid` + `--on-accent` (dark text), `--accent-soft`, `--accent-line`, `--glow-accent` | **Jouer**, primary buttons, focus ring, selected tab bar, toggles, chart line, favourites |
| **Live, cyan** | `--live`, `--live-soft`, `--live-text`, `--st-ingame` | « En jeu » badges, in-game friends, running game, live captions |
| Presence | `--st-online` green, `--st-away` amber, `--st-offline` grey | always paired with a shape |
| Semantic | `--info` (informational banners), `--warning`, `--danger`, `--success` | |
| Stores | `--store-steam/epic/ea`, `--pf-discord/psn` | monogram tags only, never logos |
| **Brand** | `--brand-violet`, `--brand-cyan` | the PX logo and the update animation (card reactor, jump, return, À propos progress bar). Nowhere else. |

Rules:
- Yellow is the one action colour on a screen: one filled yellow button per area. Text on yellow is always `--on-accent`.
- Cyan means « happening now ». A static decoration never uses it.
- Glows behind art are blue (`rgb(47 124 246 / …)`), not violet.

## 3. Type

- **Titles:** Barlow Condensed, uppercase. Page title 800 26/30 (0.02em); card and section titles 700 17/22 (0.03em); heroes 800 34 to 64px.
- **Interface:** Barlow 400 to 800. Numbers use `.num` (tabular figures).
- **Wordmark:** Michroma, for « PLAYER X » only.
- **Mono:** `--font-mono` for paths, ids and update fingerprints.
- Fonts are bundled with `@fontsource`; the app never calls Google Fonts.

## 4. Shapes and depth

- Radii: `--r-xs` 3, `--r-sm` 5, `--r-md` 8 (buttons, inputs, banners), `--r-lg` 12 (cards), `--r-xl` 14 (dialogs). Pills only for badges and chips.
- Cards: `--card-bg` with a `--line-1` border; the hero cards add a scanline tint over the art.
- Shadows: `--sh-1` to `--sh-3`, `--sh-card`; glows only on hover or focus, and on the primary button.

## 5. Screens

| Screen | Top bar | Notes |
|---|---|---|
| Accueil | title | hero = running game, else last played, else a favourite; KPI band (playtime, launches, last launch, friends in game); « À reprendre » row |
| Bibliothèque | tabs Tous, Favoris | toolbar dropdowns (`PickMenu`, `picker-*`): Store, Trier par, Taille; it gets a background only once stuck |
| Stats de jeu | tabs Vue d'ensemble, Progression, Arsenal, Cartes et modes, Classement (badge = your rank) | without a linked account: title « Stats de jeu » and the search; tab kept in `pg.stats.tab` |
| Profil | title | hero card with banner, avatar with a cyan ring |
| Paramètres | tabs Comptes, Bibliothèque, Interface, Avancé, À propos | « action requise » alert icon on Comptes when an account needs setup |
| Connexion, premier lancement | none (full screen) | Steam is the yellow action; the setup selection ring and checks are yellow |

## 6. Gotchas

- Setup already owns `.fav` and `.pick`: the shell uses `favrail-*` and the dropdowns use `picker-*`.
- The update return flies the logo into `.favrail-logo .brand-mark` (`update/stage.ts`, `update/stage.css`). Renaming that class breaks the landing of the animation.
- `TopTabs` ids are `${idBase}-tab-${id}` and the panel is `${idBase}-panel`; a page that uses tabs must give its panel that id and `role="tabpanel"`.
