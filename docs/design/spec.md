# Plateforme Gaming: redesign spec v1

**Who this is for:** one developer working in one pass, using React 19, plain CSS (`src/renderer/src/styles.css`, which can be split into several plain `.css` files) and no UI library.

**Copy rules:** every piece of text the user sees is in French. Use "tu", which matches the existing copy.

**Priorities:** **P1** ships in this pass. **P2** is done only if there is time.

**Data rule:** show only data the app really has.
- `Game`: name, store, coverUrl, heroUrl, lastPlayed, launches, favorite, installDir
- `Friend`: status, game, device, platform
- `Account`
- `ScanReport`

The app has no playtime, achievements, elapsed in-game time or ranks. Never show placeholders like "0 h" for them.

---

## 1. Visual directions

### 1A. "Aurora Glass" (layered translucency)
- **Idea:** the selected game's art, heavily blurred, becomes the ambient background of the whole window. Frosted panels float over it (rail, friends, toolbar). The violet-to-cyan gradient is used for CTAs.
- **Palette:**
  - bg `#0B0F1A`, base surface `#121829`
  - glass fill `rgba(255,255,255,0.06)`, glass border `rgba(255,255,255,0.10)`
  - text `#F5F7FA` / `#9AA4B2`
  - accent gradient `#8B5CF6` to `#22D3EE`
  - success `#23A55A`, warning `#F0B232`, danger `#F23F43`
- **Fonts (Google):** Sora 600/700 for display, Inter 400–600 for the interface.
- **Inspired by:** Dribbble "Futuristic UI with a Dark Aesthetic and Glassmorphism Elegance" (Brendon Dsouza), Dribbble "Glassmorphism Dashboard" (Leon Abramovic), Behance "Steam UI Redesign with Fluent Design Elements" (Yiğit Yetkin).

### 1B. "Tactical HUD" (esports companion)
- **Idea:** dense and data-first, with angular shapes. Clipped corners via `clip-path`, condensed uppercase headings, one hot accent, mono numbers everywhere. Closest in spirit to blitz.gg's stats screens.
- **Palette:**
  - bg `#0A0B0E`, surfaces `#14161B` / `#1C1F26`
  - border `#2A2E37`
  - text `#E8EAED` / `#8B919C`
  - accent `#FF3B5C`, info `#3DA5FF`
- **Fonts (Google):** Barlow Condensed 600/700 (uppercase display), Inter (interface), JetBrains Mono (numbers).
- **Inspired by:** blitz.gg (win/loss semantic colors, dense tables, tabular numbers), Dribbble "Esports App – Dark UI for Gamers", "Gaming Profile UI/UX Design" (Cosmiq Designer), "Riot Games Game Launcher UI/UX Design".

### 1C. "Nuit Néon" (disciplined neon), RECOMMENDED
- **Idea:** Blitz's near-monochrome discipline combined with our existing violet identity.
  - Graphite-navy layers, separated by hairlines rather than shadows.
  - Violet is the only brand accent.
  - Cyan is reserved for "live / en jeu".
  - Game art appears only as darkened backdrops (hero, game sheet, profile banner).
  - Numbers are big and tabular, labels are small and muted.
  - Glass is limited to 4 small surfaces.
- **Palette:** `#0B0D14` / `#0E1018` / `#161924` / `#1C2030`, lines `rgba(255,255,255,.06–.16)`, text `#F2F3F8` / `#A3A8BD` / `#7A8099`, accent `#8B6CFF` (button fill `#6E4FF0`), live `#2DD4E8`.
- **Fonts (Google):** Sora 600/700 (titles only), Inter 400/500/600/700 (everything else, with `tabular-nums` for numbers).
- **Inspired by:**
  - blitz.gg: restraint, color only where it means something, art as an atmosphere, skeleton loaders, filters that apply instantly.
  - Steam library and friends list: shelves, friends grouped by game.
  - GOG Galaxy 2.0: one card per connection.
  - Discord: status shapes, avatar account menu.
  - Maximilian Lock's Steam case study: rail labels on hover.

### Why Nuit Néon
- **Continuity.** The owner already has violet/cyan neon. This keeps the identity and removes the "everything glows" look.
- **Premium the Blitz way.** Polish comes from restraint, a strict grid, hairlines and big numbers, not from effects.
- **It fits our data.** We have counts, launch counts and last-played dates. A HUD would look empty, and Aurora's heavy blur would hurt readability over random key art.
- **Cheap on the GPU.** `backdrop-filter` is limited to the top bar, the sticky toolbar, toasts and hero chips, which matters for low-end PCs running the .exe.
- **Borrowed from the others:**
  - From Cinematic Console: the hero image fades in when it loads.
  - From the HUD: tabular stat tiles.

---

## 2. Design tokens

Replace the current `:root` with this block.

```css
:root {
  /* Backgrounds (darkest → lightest) */
  --bg-0: #0B0D14;            /* window, top bar, sunken inputs, login */
  --bg-1: #0E1018;            /* main content */
  --bg-2: #11131C;            /* rail + friends panel */
  /* Surfaces */
  --surface-1: #161924;       /* cards, tiles, panels */
  --surface-2: #1C2030;       /* hover, raised, secondary buttons, active segment */
  --surface-3: #252A3C;       /* pressed, popovers, tooltips, toasts */
  --scrim: rgba(6, 7, 12, 0.60);
  /* Lines (hairlines, no visible shadows on flat UI) */
  --line-1: rgba(255, 255, 255, 0.06);
  --line-2: rgba(255, 255, 255, 0.10);
  --line-3: rgba(255, 255, 255, 0.16);
  /* Text */
  --text-1: #F2F3F8;          /* primary, ~15:1 on bg-1 */
  --text-2: #A3A8BD;          /* secondary, ~7.9:1 */
  --text-3: #7A8099;          /* muted labels, ~4.8:1 (min 12px) */
  --text-4: #4A4F63;          /* disabled only */
  /* Brand */
  --accent: #8B6CFF;          /* text, icons, indicators, focus ring */
  --accent-solid: #6E4FF0;    /* filled buttons: white text 5.2:1 */
  --accent-solid-hover: #7A5CF6;
  --accent-soft: rgba(139, 108, 255, 0.14);
  --accent-line: rgba(139, 108, 255, 0.45);
  --accent-text: #C4B5FF;     /* text on accent-soft */
  --brand-gradient: linear-gradient(135deg, #8B6CFF 0%, #5B7CFF 55%, #2DD4E8 100%); /* logo + progress fills only */
  /* Secondary accent = "live" */
  --live: #2DD4E8;
  --live-soft: rgba(45, 212, 232, 0.12);
  /* Presence (always paired with a shape, see 4.6) */
  --st-ingame: #2DD4E8;
  --st-online: #3BD67F;
  --st-away: #F5B544;
  --st-offline: #5C6178;
  /* Semantic */
  --success: #3BD67F;  --success-soft: rgba(59, 214, 127, 0.12);
  --warning: #F5B544;  --warning-soft: rgba(245, 181, 68, 0.12);
  --danger:  #FF5468;  --danger-soft:  rgba(255, 84, 104, 0.12);  --danger-text: #FF8593;
  --info:    #5AA9FF;
  --favorite: #F5B544;
  /* Stores / platforms: tints and monograms only, never logos */
  --store-steam: #66C0F4;
  --store-epic: #E4E6EE;
  --store-ea: #FF4D5E;
  --pf-discord: #7983F5;
  --pf-psn: #4A8CFF;
  /* Radii */
  --r-xs: 4px; --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 18px; --r-pill: 999px;
  /* Elevation */
  --sh-1: 0 1px 2px rgba(0, 0, 0, 0.40);
  --sh-2: 0 8px 24px rgba(0, 0, 0, 0.45);
  --sh-3: 0 24px 56px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--line-2);
  --sh-card-hover: 0 16px 32px -8px rgba(0, 0, 0, 0.65);
  --glow-accent: 0 0 0 1px rgba(139, 108, 255, 0.55), 0 8px 28px -4px rgba(139, 108, 255, 0.55); /* primary CTA hover only */
  --focus: 0 0 0 2px var(--bg-1), 0 0 0 4px var(--accent);
  /* Spacing (4-based) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
  --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
  /* Type */
  --font-display: 'Sora', 'Inter', system-ui, sans-serif;
  --font-ui: 'Inter', system-ui, 'Segoe UI', sans-serif;
  /* Motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1); /* favorite star only */
  --d-1: 120ms; --d-2: 180ms; --d-3: 260ms; --d-4: 420ms;
  /* Layout */
  --rail-w: 72px; --topbar-h: 48px; --friends-w: 288px; --friends-w-collapsed: 72px;
  --sheet-w: 560px; --cover-min: 164px; /* S 136 / M 164 / L 200 */
  /* Z-index */
  --z-sticky: 10; --z-rail: 20; --z-scrim: 40; --z-sheet: 50; --z-popover: 60;
  --z-modal: 70; --z-toast: 80; --z-tooltip: 90;
}
body { background: var(--bg-0); color: var(--text-1); font: 400 14px/20px var(--font-ui); -webkit-font-smoothing: antialiased; }
.num { font-variant-numeric: tabular-nums; }
```

**Store and platform tint recipe:** text = store color; background = `color-mix(in srgb, var(--store-x) 16%, transparent)`. Electron 44 Chromium supports `color-mix`.

**Monograms:**

| Store / platform | Monogram |
|---|---|
| Steam | `S` |
| Epic | `E` |
| EA | `EA` |
| Discord | `D` |
| PlayStation | `PS` |

### Typography

| Token | Family | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| display-xl | Sora | 40/44 (32/36 when window < 1280px) | 700 | -0.02em | hero title |
| display-l | Sora | 28/34 | 700 | -0.015em | page titles, profile name, login headline, game sheet title |
| title | Inter | 16/22 | 600 | -0.005em | section headings |
| body | Inter | 14/20 | 400 | 0 | default |
| body-strong | Inter | 14/20 | 600 | 0 | names, buttons |
| small | Inter | 13/18 | 500 | 0 | chips, menu items |
| caption | Inter | 12/16 | 500 | 0 | sub-lines, meta |
| overline | Inter | 11/14 | 600 | +0.08em, UPPERCASE | kickers, stat labels, section labels |
| stat | Inter | 30/34 | 700 | -0.02em, tabular | profile stat tiles |
| stat-s | Inter | 18/24 | 600 | tabular | game sheet stat tiles |
| play | Inter | 15/1 | 700 | +0.06em, UPPERCASE | "JOUER" |

**Rules:**
- Sora only for page titles and the hero title.
- Uppercase only for overlines and the PLAY button.
- Drop Rajdhani.

**Font loading:**
- Development: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap` (the CSP already allows it).
- Packaged .exe: bundle the same Google families offline with `@fontsource-variable/inter` and `@fontsource-variable/sora` imported in `main.tsx`, and set CSP `font-src 'self' data:`.

---

## 3. Layout

### 3.1 Window (P1)
In `src/main/index.ts`, hide the native title bar and keep the native Windows controls:

```ts
titleBarStyle: 'hidden',
titleBarOverlay: { color: '#0B0D14', symbolColor: '#A3A8BD', height: 48 },
backgroundColor: '#0B0D14',
```

- The top bar is the drag region (`-webkit-app-region: drag`).
- Every interactive child gets `-webkit-app-region: no-drag`.
- Reserve 144px on the right for the min/max/close buttons (3 × 46px).
- The login screen needs a transparent 48px drag strip at the top.

### 3.2 Shell grid

```
+------+-----------------------------------------------------------+
| logo | [Q Rechercher un jeu, un ami…  Ctrl K]     (o)(o)(o) 3 en jeu |  _ [] X  |  48px top bar
+------+--------------------------------------------+--------------+
| Bibl.|  content (scrolls)                         | Amis  288px  |
| Profil|   hero / Joués récemment / toolbar / grid |              |
| ---- |                                            |              |
| rec. |                                            |              |
|  ... |                                            |              |
| DÉMO |                                            |              |
| Param|                                            |              |
| (@)  |                                            |              |
+------+--------------------------------------------+--------------+
```

```css
.shell { display: grid; height: 100%;
  grid-template-columns: var(--rail-w) minmax(0, 1fr) var(--friends-w);
  grid-template-rows: var(--topbar-h) minmax(0, 1fr);
  transition: grid-template-columns 240ms var(--ease-in-out); }
.shell.friends-collapsed { grid-template-columns: var(--rail-w) minmax(0,1fr) var(--friends-w-collapsed); }
.shell.friends-hidden    { grid-template-columns: var(--rail-w) minmax(0,1fr) 0px; }
.rail    { grid-row: 1 / 3; grid-column: 1; }
.topbar  { grid-row: 1; grid-column: 2 / 4; }
.content { grid-row: 2; grid-column: 2; overflow-y: auto;
  background: radial-gradient(900px 480px at 15% -8%, rgba(139,108,255,0.07), transparent 60%), var(--bg-1); }
.friends { grid-row: 2; grid-column: 3; min-height: 0; overflow: hidden; }
```

**Responsive:**
- Below a 1200px window width, the friends panel starts collapsed, unless the user explicitly opened it.
- Below 1200px, content padding drops from `24px 32px 48px` to `20px 24px 40px`.
- The minimum window stays 1024×640.

### 3.3 Left rail (72px, P1)
- **Container:** bg `--bg-2`, `border-right: 1px solid var(--line-1)`, flex column, items centered, gap 4px, padding-bottom 12px.
- **Logo cell:** 48px tall, aligned with the top bar, also a drag region. The tile is 32×32, r10, `--brand-gradient`, "PG" in Sora 700 13px white, shadow `0 4px 14px rgba(139,108,255,.35)`. No other glow.
- **Navigation buttons:** 44×44, r12, icon 22px with stroke 1.75. Items: **Bibliothèque** (grid icon) and **Profil** (user icon).
  - Inactive: icon `--text-3`.
  - Hover: bg `--surface-1`, icon `--text-1`.
  - Active: bg `--surface-2`, icon `--text-1`.
- **Active indicator:** one absolutely positioned element, 3×20px, r `0 3px 3px 0`, bg `--accent`, at the rail's left edge. It moves between items with `transform: translateY()` over 220ms `--ease-out`.
- **Labels:** a tooltip on the right, 12px offset, 400ms delay. Same text as the navigation item.
- **Divider:** 24×1px `--line-2`, 8px vertical margin.
- **Recent games (P1):** up to 4 tiles of 40×40, r10.
  - Image: the cover with `object-fit: cover; object-position: top`. Fallback: the generated gradient plus the first letter.
  - Hover: 2px `--line-3` outline and tooltip "{nom} · Joué il y a 2 h".
  - Click opens the game sheet.
- **Spacer:** `flex: 1`.
- **"DÉMO" pill** (demo mode only): 44×18, r-pill, `1px solid rgba(245,181,68,.5)`, text `--warning`, Inter 700 9.5px, +0.08em. Tooltip "Mode démo actif : jeux et amis fictifs".
- **Paramètres** navigation button (gear icon).
- **Account avatar:** a 40px circle, 8px top margin.
  - Image: the primary account avatar, in priority Steam, then Discord, then PSN. Fallback: the initial on `--surface-3`.
  - Status badge: 12px, bottom-right, with a 2.5px `--bg-2` border. Green when at least one account is connected, gray (hollow) when the user is a guest.
  - Click opens the account menu (4.7).

### 3.4 Top bar (48px, P1)
- **Container:** bg `--bg-0`, `border-bottom: 1px solid var(--line-1)`, flex, items centered, gap 16, padding `0 144px 0 24px`.
- **Search trigger:**
  - Button 360px wide (it can shrink to 220px), h32, r10, bg `--surface-1`, border `--line-1`.
  - Content: search icon 16 `--text-3`, text "Rechercher un jeu, un ami…" (13px, `--text-3`), and a right-aligned `<kbd>Ctrl K</kbd>`.
  - Kbd style: Inter 600 10.5px `--text-3`, bg `--surface-2`, border `--line-2`, r5, padding 2px 6px.
  - Hover: border `--line-2`, text `--text-2`.
  - P1 behavior: switch to Bibliothèque and focus the filter field. P2: open the command palette (4.11).
- **Spacer.**
- **Friends summary button:**
  - h32, r-pill, padding `0 10px 0 6px`, hover bg `--surface-1`.
  - Content: a stack of up to 3 avatars of 22px. In-game friends come first, otherwise online friends. Overlap -6px, 2px `--bg-0` ring.
  - Text, Inter 600 12.5px `--text-2`: "3 en jeu", with the number in `--live`. If nobody is in game: "5 en ligne". If nobody is online: "Amis".
  - Click toggles the friends panel between open and collapsed. Tooltip "Afficher les amis" / "Réduire les amis".

### 3.5 Views
- **Main views:** `library` (default), `profile`, `settings`.
- **Overlay layers:** game sheet (drawer), dialogs, account menu, command palette (P2).
- **Outside the shell:** login and onboarding.
- **View change:** opacity 0→1 and translateY 4px→0, 160ms.

---

## 4. Screens and components

### 4.1 Base components (P1)

**Buttons** (Inter 600 13.5px, gap 8, icon 16, r10)

| Size | Height | Padding |
|---|---|---|
| sm | 30px | `0 12px` |
| md | 36px | `0 14px` |
| lg | 44px | `0 18px`, r12 |
| xl (Play) | 52px | `0 28px 0 22px`, r12 |

- **primary:** bg `--accent-solid`, white text, `box-shadow: inset 0 1px 0 rgba(255,255,255,.18)`. Hover: `--accent-solid-hover` plus `--glow-accent`. Active: `scale(.97)`.
- **secondary:** bg `--surface-2`, border `1px solid var(--line-2)`, text `--text-1`. Hover: `--surface-3`.
- **ghost:** transparent, text `--text-2`. Hover: bg `--surface-1`, text `--text-1`.
- **danger:** bg `--danger-soft`, text `--danger-text`, border `rgba(255,84,104,.3)`. Hover: bg `#E5485B`, white text.
- **icon-btn:** 36×36 (sm 30×30), r10, ghost style. Always has a French `aria-label` and a tooltip.
- **Play (xl):** label "JOUER" with a filled triangle icon of 18px.
  - Launching state: label "LANCEMENT…", a 16px spinner, `disabled`, bg `--accent-solid` at 70% opacity.
- **Focus:** every focusable element gets `:focus-visible { box-shadow: var(--focus); outline: none }`.

**Inputs**
- Size: h36 (key fields 38), r10.
- Colors: bg `--bg-0`, border `1px solid var(--line-2)`, text 13.5px `--text-1`, placeholder `--text-3`.
- Focus: border `--accent`, plus `0 0 0 3px rgba(139,108,255,.25)`.

**Chips** (filters)
- h30, padding `0 12px`, r-pill, border `--line-2`, transparent, Inter 500 13px `--text-2`.
- Count: `.num` 12px `--text-3`, 6px left margin.
- Hover: bg `--surface-1`, text `--text-1`.
- Active: bg `--accent-soft`, border `--accent-line`, text `--text-1`, count `--accent-text`.
- Store chips: a 6px dot in the store color before the label.

**Segmented control**
- Container: bg `--bg-0`, border `--line-1`, r10, padding 3px.
- Items: h28, r8, padding `0 12px`, 13px `--text-2`.
- Active item: bg `--surface-2`, `--text-1`, `--sh-1`.

**Switch**
- Track: 34×20, r-pill, `--surface-3`. On: `--accent-solid`.
- Knob: 16px white circle, 160ms. Applies instantly; there is no Save button.

**Store tag** (replaces `Badge.tsx`)
- Square: 20×20, r6, Inter 700 9.5px monogram, using the tint recipe.
- Long pill variant: h20, padding `0 8px`, r-pill, 11px 600 text label ("Steam", "Epic", "EA", "Discord", "PSN").

**Status pill**
- h22, padding `0 8px`, r-pill, 11.5px 600, with a 6px dot.

| Label | Text color | Background |
|---|---|---|
| "Connecté" | `--success` | `--success-soft` |
| "Non connecté" | `--text-3` | `--surface-2` |
| "À configurer" / "Action requise" | `--warning` | `--warning-soft` |
| "Erreur" | `--danger-text` | `--danger-soft` |

**Tooltip**
- bg `--surface-3`, 12px 500 `--text-1`, padding 6px 8px, r6, `--sh-2`.
- 400ms delay, 120ms fade.

**Menu / popover**
- bg `--surface-1`, border `--line-2`, r14, `--sh-3`, padding 8.
- Items: h36, padding `0 10px`, r8, gap 10, icon 16 `--text-3`, label 13.5px. Hover: `--surface-2`.

**Dialog**
- Size: 420px wide, r16, bg `--surface-1`, border `--line-2`, `--sh-3`, padding 24.
- Content: title Inter 600 17px, body 13.5px `--text-2`, footer buttons right-aligned with gap 8.
- Scrim: `--scrim`, no blur.
- Esc closes, focus is trapped inside.

**Icons**
- One `Icon.tsx` component with inline SVGs: 24 viewBox, `stroke="currentColor"`, stroke-width 1.75, round caps and joins.
- Needed: grid, user, settings, search, play, star, info, more-horizontal, refresh, folder, copy, clipboard, eye, eye-off, check, check-circle, x, alert-triangle, alert-circle, chevron-right, chevron-down, users, list, link, log-in, panel-right, panel-left, external-link, gamepad.

### 4.2 Login (P1)

**Layout:** full window, `grid-template-columns: 460px 1fr`, bg `--bg-0`.

**Left panel** (bg `--bg-1`, `border-right: 1px solid var(--line-1)`, padding `56px 48px 32px`, flex column)
1. **Brand row:** a 40px logo tile, then the wordmark "PLATEFORME GAMING" (Sora 700 15px, +0.12em, `--text-1`, no gradient text).
2. **Form block,** vertically centered with `margin-block: auto`:
   - **Headline (display-l):** "Tous tes jeux, tous tes amis," on line 1 and "au même endroit." on line 2, in `--text-2`.
   - **Subtitle** (body, `--text-2`, max-width 340, margin `12px 0 32px`): "Steam, Epic Games et l'EA app réunis. Vois qui est en ligne et lance la partie en un clic."
   - **Provider buttons:** full width, h48, r12, bg `--surface-1`, border `--line-2`, padding `0 16px`, gap 12.
     - Content: a 28px monogram tile in the store tint, a body-strong label, and a right chevron 16px `--text-3`.
     - Hover: bg `--surface-2`, border `--line-3`, the chevron moves `translateX(2px)`.
     - Labels: "Continuer avec Steam" and "Continuer avec Discord".
     - When Discord is not configured, its button is disabled (opacity .5) with the caption "Discord se configure après l'entrée, dans Paramètres › Avancé."
   - **Divider:** hairlines with "ou" (caption, `--text-3`) in the middle, 20px vertical margin.
   - **Secondary button:** lg, full width, "Continuer sans compte", with the caption below "Ta bibliothèque locale fonctionne sans connexion."
   - **Link button** (`--text-3`, hover `--text-1`): "Essayer le mode démo".
   - **Inline error,** if login fails: danger-soft box, r10, padding 10px 12px, 12.5px, with the cleaned error message.
3. **Bottom caption** (`margin-top: auto`, 12/16 `--text-3`): "Steam ne transmet que ton identifiant public. Tes comptes et tes clés restent sur ce PC."

**Right panel: cover mosaic**
- **Covers:** call `getGames()` on the login screen (the scan is local). Use covers that have a `coverUrl`. If there are fewer than 16, pad with untitled generated gradient tiles.
- **Arrangement:** 4 columns, 180px wide, gap 16, covers r10. The whole grid is rotated `-6deg` and scaled 1.15.
- **Motion:** each column scrolls in a seamless loop (duplicate its list, animate translateY 0→-50%). Alternate the direction per column, with durations of 80s, 95s, 88s and 110s, linear.
- **Overlays:**
  - `linear-gradient(90deg, var(--bg-1) 0%, rgba(14,16,24,.7) 25%, rgba(14,16,24,.2) 60%, rgba(14,16,24,.5) 100%)`
  - plus `radial-gradient(60% 60% at 70% 40%, rgba(139,108,255,.18), transparent 70%)`.
- **Bottom-right chip** (when games were found): glass pill (`rgba(14,16,24,.6)`, `backdrop-filter: blur(12px)`, border `--line-2`, padding 8px 14px), reading "**42** jeux détectés sur ce PC".
- **Reduced motion:** the mosaic is static.

**Waiting state** (after clicking Steam or Discord)
- The form block crossfades (180ms) into:
  - a 36px spinner (2.5px ring, a 90° `--accent` arc, rotating over 900ms);
  - Inter 600 18px: "Termine la connexion dans ton navigateur";
  - body `--text-2`: "Une page de connexion vient de s'ouvrir. Reviens ici une fois connecté.";
  - a secondary button "Annuler", which only returns to the form.
- **On success:** a toast with the avatar, "Connecté en tant que {nom}", then onboarding if it is the first run.

### 4.3 Onboarding (P1, shown once)
- **When:** after the first entry. Stored with `localStorage['pg.onboarding.done']='1'`, wrapped in try/catch.
- **Layout:** same split screen. The right-hand mosaic stays; the left panel content changes.
- **Panel header:** overline "ÉTAPE 1 SUR 3", 3 dots (8px; the active one is a 20px-wide `--accent` pill; the others are `--surface-3`), and "Passer" as a link at the top right.

**Step 1, "Bibliothèque détectée"**
- Headline: "On a trouvé 54 jeux", or "Aucun jeu trouvé pour l'instant".
- One row per `ScanReport` entry: h52, `--surface-1`, r12, padding `0 14px`.
  - Content: monogram 28, store name in 600 ("Steam" / "Epic Games" / "EA app"), and on the right either "42 jeux" (`.num`) with a `--success` check, or "Non trouvé" in `--text-3` with a `--warning` icon.
  - Clicking a row expands its `checked` folders (12px `--text-3`, `word-break: break-all`).
- Button: primary lg "Continuer".

**Step 2, "Retrouve tes amis"**
- 3 compact connection rows (Steam, Discord, PlayStation): monogram, name, status pill, and a "Connecter" sm button.
- Caption: "Tu pourras le faire plus tard dans Paramètres › Comptes."
- Button: "Continuer".

**Step 3, "Tout est prêt"**
- 3 summary lines: "54 jeux", "2 comptes connectés", "7 amis en ligne".
- Button: primary lg "Ouvrir ma bibliothèque".
- Then a toast: "54 jeux importés".

### 4.4 Library (P1 unless marked)
- **Container:** padding `24px 32px 48px`, flex column, gap 32px.

**Hero ("featured")**
- **Which game:** the most recently played (same logic as today).
- **Box:** `position: relative; height: clamp(260px, 36vh, 380px); border-radius: 18px; overflow: hidden; background: var(--surface-1)`. A `::after` inset ring `inset 0 0 0 1px var(--line-1)` sits above the image.
- **Image:**
  - `heroUrl` with `object-fit: cover; object-position: 50% 25%`. Fade in on load: opacity 0→1 over 420ms and scale 1.03→1 over 700ms.
  - No hero but a cover: the cover as background with `filter: blur(32px) saturate(1.3) brightness(.7); transform: scale(1.25)`, plus the sharp cover shown at the right (200px wide, 2:3, r12, `--sh-2`, right 40px, vertically centered).
  - Neither: the generated gradient.
- **Scrims:** `linear-gradient(90deg, rgba(11,13,20,.92) 0%, rgba(11,13,20,.70) 38%, rgba(11,13,20,0) 72%)` and `linear-gradient(0deg, rgba(11,13,20,.85) 0%, transparent 45%)`.
- **Body,** absolutely positioned at left 40, bottom 36, max-width 560:
  - **Kicker** (overline, `--accent`): "REPRENDRE" if the game has `lastPlayed`, otherwise "À LA UNE".
  - **Title:**
    - Steam games: the logo image `https://cdn.cloudflare.steamstatic.com/steam/apps/{storeId}/logo.png` (the `LEGACY_CDN` already used in `artwork.ts`), with `max-height: 96px; max-width: 380px; object-fit: contain; object-position: left bottom; filter: drop-shadow(0 4px 16px rgba(0,0,0,.6))`.
    - If the logo fails to load, or for other stores: display-xl text, clamped to 2 lines.
  - **Meta row** (margin `12px 0 20px`, 13px `--text-2`, items separated by 3px `--text-3` dots): long store tag · "Joué il y a 2 h" · "12 lancements". A game never played shows "Jamais lancé depuis Plateforme Gaming".
  - **Actions:** the Play xl button, then two 52×52 r12 glass icon buttons (bg `rgba(255,255,255,.08)`, border `--line-2`, `backdrop-filter: blur(12px)`, hover `rgba(255,255,255,.14)`):
    - Star: "Ajouter aux favoris" / "Retirer des favoris". Filled `--favorite` when on.
    - Info: "Détails", which opens the game sheet.
- **Friends chip,** bottom-right (right 32, bottom 36), only when friends with `status==='in-game'` play this game (case-insensitive name match): a glass pill with 24px avatars and "2 amis y jouent". Pass `friends` to `Library` for this.

**Shelf "Joués récemment"**
- **When:** at least 2 games with `lastPlayed`, not counting the hero game. Up to 8, sorted by `lastPlayed` descending.
- **Header:** title "Joués récemment", plus a ghost sm "Tout voir" on the right that sets the sort to "Récents" and scrolls to the grid.
- **Track:** `display: grid; grid-auto-flow: column; grid-auto-columns: 264px; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory`, scrollbar hidden, and `mask-image: linear-gradient(90deg, #000 calc(100% - 48px), transparent)` when the row overflows.
- **Tile:** 264×148 (16:9), r12, bg `--surface-1`, `--line-1` ring.
  - Image: `heroUrl` with object-fit cover, otherwise the generated gradient.
  - Scrim: `linear-gradient(0deg, rgba(11,13,20,.9), transparent 60%)`.
  - Text at bottom-left 12px: name (600 14px, ellipsis) and caption "Il y a 3 j · Steam" in `--text-2`.
  - Hover: image scale 1.05 over 300ms, tile translateY(-2px), ring `--line-3`, and a 40px `--accent-solid` play circle appears at bottom-right 12px (opacity and scale .9→1, 180ms).
  - The play circle launches the game; clicking anywhere else opens the game sheet.
- **P2:** 32px `--surface-3` arrow buttons at the row ends on hover.

**Toolbar** (sticky)
- **Container:** `position: sticky; top: 0; z-index: var(--z-sticky); margin: 0 -32px; padding: 12px 32px; background: rgba(14,16,24,.82); backdrop-filter: blur(14px) saturate(140%)`.
- **Hairline:** add `.is-stuck` (`border-bottom: 1px solid var(--line-1)`) with a 1px sentinel and an IntersectionObserver.
- **Row** (flex, wraps, gap 10/16), left to right:
  - h2 "Bibliothèque" (Inter 600 16) and the count `.num` `--text-3` "54".
  - Chips: "Tous", "Favoris" (12px star icon in `--favorite`), "Steam", "Epic", "EA". Hide a store chip when its count is 0.
  - Spacer.
  - Filter input, 220px wide, with a search icon and placeholder "Filtrer…". Ctrl+F focuses it.
  - Sort button "Trier : Récents" with a chevron. It opens a menu with "Récents", "Nom (A–Z)" and "Plus lancés"; the active item has a check.
  - P2: a segmented view toggle with grid and list icons, tooltips "Grille" and "Liste".
  - Icon button "Relancer le scan" (refresh icon, spins while scanning).
- **Behavior:**
  - Filters apply instantly, with no Apply button.
  - Filter, sort, view and cover size persist in `localStorage['pg.library']`.
  - At narrow widths, the filter and sort controls wrap to a second row.

**Grid**
```css
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--cover-min), 1fr)); gap: 24px 16px; }
```
- **Card:** an `article` with `tabIndex=0`, transparent, flex column, gap 10.
- **Cover box:** `aspect-ratio: 2/3; border-radius: 10px; overflow: hidden; background: var(--surface-1); box-shadow: var(--sh-1); transition: transform 180ms var(--ease-out), box-shadow 180ms`. A `::after` ring uses `inset 0 0 0 1px var(--line-1)`.
- **Image:** fills the box with `object-fit: cover`, `transition: transform 300ms var(--ease-out)`, and fades in from opacity 0 over 240ms on load.
- **Store tag:** top 8, left 8, 22×22, r6, bg `rgba(11,13,20,.78)`, no blur, monogram in the store color.
- **Favorite button:** top 6, right 6, 30×30, r8, bg `rgba(11,13,20,.6)`, star 16px.
  - Hidden unless the game is a favorite (then it is always visible, filled `--favorite`) or the card is hovered or focused (then it shows an outline star in `--text-1`).
  - Clicking toggles the favorite and plays the pop animation.
- **Hover overlay:** `linear-gradient(0deg, rgba(11,13,20,.85), rgba(11,13,20,0) 55%)`, opacity 0→1. A 48px `--accent-solid` play circle sits at bottom center (bottom 14) with a white triangle of 18px; hovering it adds `--glow-accent`.
- **Card hover and `:focus-visible`:** cover translateY(-4px), `--sh-card-hover`, ring `--line-3`, image scale 1.04. Focus also adds `--focus`.
- **Text below the cover:**
  - Title: Inter 600 13.5/18 `--text-1`, one line with ellipsis.
  - Meta: caption `--text-3`, "Steam · Il y a 2 j" or "Epic · Jamais lancé".
  - P2: append " · 2 amis en jeu" in `--live`.
- **Interactions:**
  - Click opens the game sheet.
  - Double-click or Enter launches the game.
  - P2: right-click menu with "Jouer", "Détails", "Ajouter aux favoris", "Ouvrir le dossier d'installation".
- **Launching state:** the overlay stays visible, the play circle shows a spinner, and the caption reads "Lancement…". It lasts until the launch promise resolves plus 1.5s.

**Generated cover** (no art)
- **Background:** `radial-gradient(120% 70% at 100% 0%, hsl(H 60% 45% / .35), transparent 60%), linear-gradient(165deg, hsl(H 42% 26%) 0%, hsl(H+35 48% 11%) 100%)`, where H comes from the existing `hue(name)` function. These are tamer values than today's 70% saturation.
- **Highlight:** `inset 0 1px 0 rgba(255,255,255,.08)`.
- **Title:** Sora 700 17/20, `rgba(255,255,255,.92)`, bottom-left with 14px padding, clamped to 4 lines, `text-wrap: balance`.

**List view (P2)**
- **Columns:** `48px minmax(200px,1fr) 110px 150px 110px 44px 96px`, for: thumbnail, "Nom", "Plateforme", "Dernière session", "Lancements", favorite, action.
- **Header:** h36, overline `--text-3`, sticky under the toolbar. Clicking a column sorts by it and shows a chevron.
- **Rows:** h56, r10, hover `--surface-1`.
  - Thumbnail: 40×40, r8, cover with `object-position: top`.
  - Numbers: `.num`, right-aligned.
  - "Jouer" button: sm primary, visible on row hover or focus.

**Empty states**
- **No games and not scanning:** a centered block, max-width 480, margin 48 auto.
  - Icon: a 64px circle (`--surface-1`, border `--line-1`) with a 28px gamepad icon in `--text-2`.
  - Title: Inter 600 18 "Aucun jeu détecté".
  - Text (`--text-2`): "On cherche les jeux installés via Steam, Epic Games et l'EA app sur ce PC."
  - Actions: primary "Relancer le scan"; secondary "Voir les dossiers examinés", which expands a restyled `ScanDetails`; link "Essayer le mode démo".
  - The hero is hidden.
- **Filter with no match:** "Aucun jeu ne correspond à « {texte} »." plus a ghost "Effacer les filtres".
- **No favorites:** "Aucun favori pour l'instant." with the caption "Survole une jaquette et clique sur l'étoile pour l'épingler ici."

**Skeletons**
```css
.skel { position: relative; overflow: hidden; background: var(--surface-1); }
.skel::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.045), transparent);
  animation: shimmer 1.4s var(--ease-in-out) infinite; }
@keyframes shimmer { to { transform: translateX(100%); } }
```
- **Scanning with 0 games:**
  - Hero skeleton: same box, with 3 bars at bottom-left (120×10, 320×28, 180×12, r6).
  - 12 cover skeletons: 2:3, r10, plus a bar at 80% width × 12px and a bar at 45% width × 10px, gap 8.
- **Scanning with games already shown:** keep the content, spin the refresh icon, and at the end show the toast "Bibliothèque à jour · 54 jeux".
- **Covers while loading:** the image sits above its skeleton background and fades in.

### 4.5 Game sheet (drawer, P1)
- **Opens from:** a card, a shelf tile, a rail recent tile, or the hero's "Détails" button.
- **Panel:** `position: fixed; top: var(--topbar-h); right: 0; bottom: 0; width: min(var(--sheet-w), calc(100vw - 72px)); background: var(--bg-1); border-left: 1px solid var(--line-2); box-shadow: -24px 0 56px rgba(0,0,0,.5); overflow-y: auto; z-index: var(--z-sheet)`.
- **Scrim:** fixed, from the top bar down, `rgba(6,7,12,.55)`. Clicking it closes the sheet.
- **Behavior:** Esc closes, focus is trapped, and focus returns to the element that opened the sheet.
- **Header art:** 260px tall.
  - Image: `heroUrl` with object-fit cover. Fallback: the blurred cover plus the sharp cover, as in the hero.
  - Gradient: `linear-gradient(0deg, var(--bg-1) 0%, rgba(14,16,24,.4) 50%, rgba(14,16,24,.1) 100%)`.
  - Close button at top-right 16: 36×36, r10, bg `rgba(11,13,20,.6)`, border `--line-2`, x icon, aria-label "Fermer".
  - Bottom-left 28: the Steam logo image or display-l title, and the long store tag below it.
- **Action row:** padding `0 28px`, margin-top 20, sticky at top 0 with bg `--bg-1` (hairline when stuck).
  - Play xl, min-width 200.
  - Secondary 52×52 icon buttons:
    - favorite;
    - folder, "Ouvrir le dossier d'installation" (disabled when there is no `installDir`);
    - ⋯ menu with "Copier le chemin" and, P2, "Ouvrir dans Steam" (needs IPC because `shell:open` only allows `https://`).
- **Stat tiles:** margin `24px 28px`, a 3-column grid, gap 12. Each tile: `--surface-1`, border `--line-1`, r12, padding 14px 16px, overline label, stat-s value, caption `--text-3` below.
  - "DERNIÈRE SESSION": "Il y a 2 h", caption = full date from `Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })` (for example "17 oct. 2026, 21:14"). Never played: "Jamais".
  - "LANCEMENTS": "12", caption "depuis Plateforme Gaming".
  - "PLATEFORME": "Steam", caption "App 570" (the `storeId`).
- **Section "Amis sur ce jeu"** (Inter 600 15, margin-top 28): friend rows (same component as 4.6) for friends in game on this title. Empty: caption `--text-3` "Aucun ami n'y joue en ce moment."
- **Section "Installation":**
  - Path box: bg `--bg-0`, border `--line-1`, r10, padding 10px 12px, 12.5px `--text-2`, one line. Use a middle ellipsis computed in JS so the end of the path stays visible.
  - Buttons: secondary sm "Ouvrir le dossier" and "Copier" (toast "Chemin copié").
  - No `installDir`: "Dossier inconnu : c'est le lanceur {Steam} qui gère l'installation."
- **Footer caption** (`--text-4`): "ID : steam:570".

### 4.6 Friends panel (P1)
- **Container:** bg `--bg-2`, `border-left: 1px solid var(--line-1)`, flex column.
- **Header:** h56, padding `0 16px`.
  - "Amis" (Inter 600 15).
  - Count pill: h20, `--success-soft` bg, `--success` text, 11.5px 600 `.num`, a 6px dot, "7 en ligne".
  - On the right: icon-btn sm "Actualiser" (spins while loading) and icon-btn "Réduire" (panel-right icon).
- **Platform filter:** a segmented control, margin `0 16px 12px`, with "Tous", "Steam", "PSN", "Discord". Only platforms that are connected or have results appear; the control is hidden when only one platform is present.
- **Errors:** one card per platform, margin `0 12px 8px`.
  - Style: bg `rgba(245,181,68,.08)`, border `1px solid rgba(245,181,68,.22)`, r10, padding 10px 12px, 12.5/17 `--text-2`.
  - Content: the platform name in bold `--text-1`, then the message, then link "Corriger", which goes to Paramètres › Comptes.
- **List:** `flex: 1; overflow-y: auto; padding: 4px 8px 16px`.
- **Section headers:** full-width buttons, h32, padding `0 8px`.
  - Content: a 12px chevron (rotates -90° when collapsed, 180ms), the overline label, and the count `.num` `--text-3`.
  - Labels: "EN JEU", "EN LIGNE", "ABSENT", "HORS LIGNE".
  - Every section can collapse. "HORS LIGNE" is collapsed by default. The state persists in `localStorage['pg.friends.collapsed']`.
- **In-game grouping:** inside "EN JEU", friends are grouped by game title. Sub-header h28, padding `0 8px`:
  - an 18×18 r4 mini cover (the library cover if a game name matches, otherwise the hue gradient);
  - the game name (12px 600 `--text-2`, ellipsis);
  - the count `--text-3`.
- **Row:** h48, padding `0 8px`, r10, gap 10, hover `--surface-1`.
  - **Avatar:** 32px circle, `--surface-3` fallback with the initial in Inter 600 13 `--text-2`.
  - **Status badge:** 12px at bottom-right, with a 2.5px `--bg-2` border acting as a cut-out. Each status has its own shape, not only its own color:

    | Status | Shape |
    |---|---|
    | En jeu | filled `--st-ingame`, plus a 2px avatar ring: `box-shadow: 0 0 0 2px var(--bg-2), 0 0 0 4px var(--st-ingame)` |
    | En ligne | filled `--st-online` |
    | Absent | `--st-away` crescent: `-webkit-mask: radial-gradient(circle at 25% 25%, transparent 3px, #000 3.5px)` |
    | Hors ligne | hollow ring, `inset 0 0 0 2.5px var(--st-offline)`; the avatar gets `filter: grayscale(1); opacity: .55` |

  - **Name:** 13.5/18 600 `--text-1`, ellipsis. Offline: 500 `--text-3`.
  - **Sub-line,** 12/16 `--text-3`:
    - in game: "En jeu", plus " · PS5" when `device` is set (the game name is already in the sub-header);
    - online: "En ligne", plus " · {device}";
    - away: "Absent";
    - offline: "Hors ligne".
  - **Right side:** an 18×18 r5 platform monogram, `--text-3` on `--surface-2`, switching to the platform tint on row hover.
- **Hover card (P2):** appears after 350ms, positioned to the left of the panel (`right: calc(var(--friends-w) + 8px)`).
  - Box: 260px wide, r14, `--surface-1`, border `--line-2`, `--sh-3`.
  - Content: a 64px banner (blurred game cover, or `--brand-gradient` at 40%), a 56px avatar overlapping it by -28px, the name in Inter 600 16, a platform and status caption, and "Joue à {jeu}" with a mini cover.
  - Actions: "Voir le profil" (for Steam: `https://steamcommunity.com/profiles/{id}`), and "Afficher le jeu" when the game is in the library.
- **Empty states:**
  - **No account and not in demo mode:** centered, padding 32px 20px.
    - A 56px `--surface-1` circle with a users icon.
    - Title: Inter 600 14 "Personne ici pour l'instant".
    - Text (`--text-2`): "Connecte Steam, PlayStation ou un serveur Discord pour voir qui est en ligne."
    - Button: secondary sm "Connecter un compte", which opens Paramètres › Comptes.
  - **Everyone offline:** caption `--text-3` "Tous tes amis sont hors ligne." above the collapsed offline section.
  - **First load:** 6 skeleton rows (a 32px circle, plus bars at 60%×11 and 40%×9).
- **Collapsed mode (72px):**
  - The header becomes the expand button (panel-left icon) with the online count below it.
  - Only avatars show: 36px, centered, gap 8, in-game first, then online, then away, each with its status badge.
  - A 24px hairline separates in-game friends from the rest. Offline friends are hidden.
  - Tooltip: "{nom} · En jeu · Elden Ring".

### 4.7 Account menu (rail avatar popover, P1)
- **Box:** `position: fixed; left: calc(var(--rail-w) + 8px); bottom: 12px; width: 288px`, using the menu/popover style.
- **Animation:** opens from the bottom-left (transform-origin bottom left). Outside click or Esc closes it.
- **Header** (padding 10):
  - a 40px avatar, the name (Inter 600 14), and a caption `--text-3`: "Compte principal : Steam";
  - for a guest: "Invité · aucun compte connecté".
- **Account rows** (h36, not clickable):
  - each row: monogram 20, account name 13px, and a mini "Connecté" pill on the right;
  - a missing platform shows instead "Connecter PlayStation" in `--accent`, linking to Paramètres › Comptes.
- **Separator,** then menu items:
  - "Voir mon profil" (user icon)
  - "Comptes connectés" (link icon)
  - "Paramètres" (gear icon)
  - for a guest: "Se connecter" (log-in icon, `--accent`)
- **No presence picker** (En ligne / Absent / Invisible): the app cannot set presence on Steam, PSN or Discord.

### 4.8 Profile page (view `profile`, P1)
- **Container:** padding `24px 32px 48px`, max-width 1200.

**Banner**
- Box: h200, r18, overflow hidden.
- Image: the `heroUrl` of the most-launched game (fallback: the last played game), with `filter: blur(28px) saturate(1.25) brightness(.55); transform: scale(1.2)`.
- Overlay: `linear-gradient(115deg, rgba(110,79,240,.45) 0%, rgba(45,212,232,.12) 55%, transparent 100%)`, plus a bottom fade.
- No image: `--brand-gradient` at 35% opacity over `--surface-1`.

**Identity row** (margin-top -48px, padding `0 32px`, flex, aligned to the bottom, gap 20)
- **Avatar:** 104px circle, `border: 4px solid var(--bg-1)`, `--surface-3` fallback with the initial in Sora 700 36. Status badge 20px.
- **Name:** display-l.
- **Linked accounts row** (gap 8): chips h26, padding `0 10px 0 4px`, r-pill, `--surface-1`, border `--line-1`, each with a monogram circle of 18 and the account name (12.5px 500 `--text-2`).
- **Right side:** secondary button "Gérer les comptes", which opens Paramètres › Comptes.

**Stat tiles** (margin-top 28, `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`, gap 12)
- Each tile: `--surface-1`, border `--line-1`, r14, padding 18px 20px, min-height 112, overline label, stat value (`.num`), caption footer.
- "JEUX":
  - value: total number of games;
  - footer: a stacked bar (h6, r3, 2px gaps) with one segment per store, width proportional to its count, in store colors;
  - legend below: "Steam 42 · Epic 8 · EA 4".
- "LANCEMENTS": the sum of `launches`, caption "depuis Plateforme Gaming".
- "DERNIÈRE SESSION": the game name in Inter 600 18 with ellipsis, caption "Il y a 2 h".
- "FAVORIS": the count, plus a stack of 3 mini covers (20×30, r4, overlapping). With none: "Aucun favori".

**Two columns** (`grid-template-columns: minmax(0,1fr) 320px`, gap 24, margin-top 32; one column when content is narrower than 1100px)
- **Left column:**
  - **Card "Les plus lancés"** (`--surface-1`, r14, border `--line-1`, padding 20), caption "Top 5". Rows h52, gap 12:
    - the rank (600 13px `--text-3` `.num`);
    - a 36×36 r8 thumbnail;
    - the name in 600 13.5, with a bar below (h4, r2, track `--surface-3`, fill `--accent`, width = launches / max);
    - on the right, the count "12" in `.num` 600 with the caption "lancements".
    - Empty: "Lance un jeu depuis Plateforme Gaming pour voir tes statistiques ici."
  - **"Joués récemment":** up to 6 covers in a row (2:3, 120px wide, gap 12), each with a caption showing the time.
  - **"Favoris":** a grid of size-S `GameCard`s (`--cover-min: 136px`).
- **Right column:**
  - **Card "Comptes connectés":** rows for Steam, Discord and PlayStation, each with a 28px monogram, the platform name, a status pill, and the account name as a caption. Footer link "Gérer".
  - **Card "Amis":** 3 counters, each a value in Inter 700 20 `.num` with a caption:
    - "en jeu", in `--live`
    - "en ligne", in `--st-online`
    - "hors ligne", in `--text-3`
    - plus a ghost button "Voir la liste" that opens the friends panel.

### 4.9 Settings (P1)
- **Layout:** `grid-template-columns: 220px minmax(0, 760px)`, gap 40, padding `32px 32px 64px`.
- **The global "Enregistrer" button is removed.** Each control saves itself.
- **Side navigation** (sticky at top 24):
  - Title "Paramètres" in display-l, margin-bottom 20.
  - Group headings: overline `--text-3`, margin `20px 0 6px`, padding `0 12px`.
  - Items: h34, padding `0 12px`, r8, 13.5px 500 `--text-2`, a 16px icon. Hover `--surface-1`; active `--surface-2` with `--text-1`.
  - Structure:
    - **COMPTE:** "Comptes"
    - **APPLICATION:** "Bibliothèque", "Interface"
    - **AVANCÉ:** "Avancé"
- **Page header:** Sora 600 22, plus a description in 13px `--text-2` (max-width 560, margin `4px 0 24px`).
- **Setting row:** `grid-template-columns: 1fr auto`, gap 24, padding `16px 0`, `border-bottom: 1px solid var(--line-1)`.
  - Label: 14px 500.
  - Secondary line: 12.5px `--text-2`, showing the **current value**, not a description.
  - The control sits on the right.

**Comptes**
- Title "Comptes connectés". Description: "Connecte tes comptes pour voir tes amis et ce à quoi ils jouent. Ta bibliothèque fonctionne sans compte."
- Grid: `repeat(auto-fill, minmax(320px, 1fr))`, gap 16.
- **ConnectionCard:** `--surface-1`, border `--line-1`, r14, padding 20, flex column, gap 16, min-height 200.
  - **Header:** a 40px r10 monogram tile (Inter 700 14) and the name (Inter 600 15). PSN gets an "Expérimental" tag (amber outline pill, 10.5px 600). The status pill sits on the right.
  - **Body when connected:**
    - a 32px avatar, the name in 600 14, and the caption "ID {id}" in `--text-3`;
    - overline "UTILISÉ POUR", then chips (h22, r6, `--surface-2`, 11.5px `--text-2`):
      - Steam: "Amis", "Présence en jeu"
      - Discord: "Membres en ligne d'un serveur"
      - PSN: "Amis", "Présence", "Console".
  - **Body when not connected:** one benefit sentence in 13.5px `--text-2`.
  - **Body when action is required or on error:** an amber or red soft alert with the message and a fix button.
  - **Footer** (`margin-top: auto`, space-between):
    - left: a caption in `--text-3`;
    - right: primary "Connecter", or a ghost danger "Déconnecter".
- **Status logic:**

| Platform | Condition | Pill and copy |
|---|---|---|
| Steam | no account | "Non connecté" · "Affiche tes amis Steam et ce à quoi ils jouent." · [Connecter Steam] |
| Steam | account, no `steamApiKey` | "Action requise" · "Ajoute ta clé Steam Web API pour afficher tes amis." · [Ajouter la clé] → Avancé |
| Steam | account, `errors.steam` | "Erreur" · {message} · link "Ouvrir mes réglages de confidentialité Steam" → `https://steamcommunity.com/my/edit/settings` |
| Steam | account, OK | "Connecté" |
| Discord | no client ID or secret | "À configurer" · "Discord demande une application développeur. Renseigne-la dans Avancé." · [Configurer] |
| Discord | account, no `discordGuildId` | "Action requise" · "Indique un serveur dont le widget est activé." · [Configurer] |
| Discord | `errors.discord` / OK / no account | "Erreur" / "Connecté" / "Non connecté" · [Connecter Discord] |
| PSN | no account, no `psnNpsso` | "À configurer" · "Colle ton jeton NPSSO dans Avancé." · [Configurer] |
| PSN | no account, NPSSO present | "Non connecté" · "Affiche tes amis PlayStation via une API non officielle." · [Connecter] |
| PSN | `errors.psn` / OK | "Erreur" / "Connecté" |

- **Disconnect dialog:**
  - Title: "Déconnecter Steam ?"
  - Body: "Tes amis Steam n'apparaîtront plus dans Plateforme Gaming. Tu pourras te reconnecter à tout moment."
  - Buttons: [Annuler] (ghost) and [Déconnecter] (danger, hover style used as solid).
  - Then the toast "Steam déconnecté".

**Bibliothèque**
- Description: "Les jeux sont détectés automatiquement sur ce PC."
- **Launcher card** (`--surface-1`, r14, rows separated by `--line-1`, padding 14px 20px). One row per store:
  - a 32px monogram;
  - the name: "Steam", "Epic Games" or "EA app";
  - a caption: "42 jeux trouvés", "Non trouvé sur ce PC", or the error in `--danger-text`;
  - a ghost sm "Détails" that expands the `checked` folders.
- Below: secondary "Relancer le scan" (while running: "Scan en cours…" with a spinner), plus the caption "Dernier scan : il y a 3 min". Keep the timestamp in renderer state when `loadGames` finishes.
- P2: a setting row "Afficher les jeux de" with a switch per store (needs a new `hiddenStores` setting).

**Interface** (all apply instantly, stored in `localStorage['pg.ui']`, no toast)
- "Panneau d'amis": segmented [Ouvert | Réduit | Masqué].
- "Taille des jaquettes": [Petite | Moyenne | Grande], mapped to `--cover-min` 136 / 164 / 200.
- "Vue de la bibliothèque": [Grille | Liste] (P2, together with the list view).
- "Réduire les animations": switch, secondary text "Suit aussi le réglage d'accessibilité de Windows."
- "Effets de transparence": switch, secondary text "Désactive le flou derrière les barres et les notifications." Off adds `.no-blur` to the root, which removes `backdrop-filter` and uses solid colors.

**Avancé**
- **Info banner** (bg `--accent-soft`, border `--accent-line`, r12, padding 12px 14px, info icon): "Ces réglages servent aux connexions qui demandent une clé ou une application développeur. Ils restent sur ce PC."
- **Block "Clés API & intégrations":** one card per service (`--surface-1`, r14, padding 20, gap 16).
  - **Steam:** SecretField "Clé Steam Web API". Help: "Gratuite sur steamcommunity.com/dev/apikey. Ta liste d'amis Steam doit être publique." Link "Où obtenir cette clé ?".
  - **Discord:**
    - Field "Client ID", SecretField "Client Secret", Field "ID du serveur (widget)".
    - Help: "Ajoute cette redirection à ton application :" followed by `http://127.0.0.1:47823/discord/callback` and a "Copier" button.
    - Second help line: "Le widget doit être activé : Paramètres du serveur › Widget."
  - **PlayStation** ("Expérimental" tag):
    - SecretField "Jeton NPSSO".
    - Danger-soft note: "Ce jeton donne accès à ton compte PlayStation : garde-le comme un mot de passe. API non officielle, elle peut cesser de fonctionner."
    - Link "Obtenir mon jeton".
- **SecretField:**
  - Label: 13px 600, margin-bottom 6.
  - Input: h38, flex 1, `type="password"`. Two 28px icon buttons inside it: eye ("Afficher" / "Masquer") and clipboard ("Coller", using `navigator.clipboard.readText()`).
  - Buttons outside, on the right:
    - primary sm "Enregistrer", shown only when the field has unsaved changes (Enter also saves);
    - secondary sm "Tester".
  - Caption below, showing the current value: "Enregistrée · se termine par a4f2" or "Non renseignée".
  - **Saving:** toast "Clé enregistrée". Never show the full key in a toast or a log.
  - **Testing:** save first, then call `getFriends()`. The result shows inline, under the field:
    - success (green check): "Clé valide · 37 amis Steam trouvés";
    - failure (red): "Échec : {errors.steam}";
    - while running, the button shows "Test…" with a spinner.
  - P2: ghost danger "Effacer", with the undo toast "Clé effacée · Annuler".
- **Block "Mode démo":** setting row "Mode démo", secondary text "Remplace tes jeux et amis par des données fictives pour tester l'interface.", with a switch that saves instantly.
- **Block "Diagnostic":** "Dossiers examinés au dernier scan", expandable (restyled `ScanDetails`).
- **Block "À propos":**
  - "Plateforme Gaming · version 0.1.0 (prototype)". Import the version from `package.json`.
  - Caption: "L'application n'a pas de serveur : tes données restent sur ce PC et ne sont échangées qu'avec Steam, Discord et PlayStation."

### 4.10 Toasts (P1)
- **Stack:** `position: fixed; bottom: 20px; right: calc(var(--friends-w) + 20px)`. Use the collapsed width when the panel is collapsed, and 20px when it is hidden. Flex column-reverse, gap 8, `--z-toast`. At most 3 visible; the oldest is dropped first.
- **Toast box:** min-width 280, max-width 420, padding `12px 14px 12px 12px`, r12, bg `rgba(37,42,60,.96)` with `backdrop-filter: blur(12px)` (solid `--surface-3` under `.no-blur`), border `--line-2`, `--sh-2`.
- **Toast layout:** `grid-template-columns: 20px 1fr auto`, gap 10, items centered.
  - Icon 18px:
    - success: check-circle `--success`
    - error: alert-circle `--danger`
    - info: info `--accent`
    - loading: 16px spinner
    - account: 20px avatar
  - Message: 13.5/18 `--text-1`.
  - Optional action: link button `--accent` 600 ("Annuler", "Voir").
  - Close: a 24px x button, visible on hover.
- **Timing:**
  - success and info: 3.5s
  - error: 6s
  - loading: stays until replaced
  - hovering pauses the timer
- **API:** `notify(message, { kind?: 'success'|'error'|'info'|'loading', id?, action? })`. A toast with the same `id` replaces the previous one, for example the loading toast "Termine la connexion dans ton navigateur…" becomes the success toast "Connecté en tant que {nom}".
- **Copy:**
  - "Lancement de {jeu}…"
  - "Mode démo : {jeu} serait lancé"
  - "Impossible de lancer {jeu} : {raison}"
  - "Connecté en tant que {nom}"
  - "Steam déconnecté"
  - "Bibliothèque à jour · 54 jeux"
  - "Clé enregistrée"
  - "Chemin copié"
- Keep the existing regex that strips "Error invoking remote method".
- No toast for favorites or interface preferences; the change on screen is the feedback.

### 4.11 Command palette (P2)
- **Opening:** Ctrl+K anywhere, or the top-bar search trigger.
- **Box:** fixed, top 14vh, centered, width `min(640px, 100vw - 96px)`, `--surface-1`, border `--line-2`, r16, `--sh-3`. Scrim `rgba(6,7,12,.5)`.
- **Input row:** h56, padding `0 18px`.
  - Content: an 18px search icon, a borderless 16px input, and the kbd "Échap".
  - Placeholder: "Rechercher un jeu, un ami, une action…"
- **Results:** max-height 420, padding 8.
  - Group labels (overline): "JEUX", "AMIS", "ACTIONS".
  - Items: h44, r10, gap 12.
    - A 28px thumbnail (cover r6, avatar circle, or icon tile).
    - The label at 14px: matched characters in `--text-1` 600, the rest in `--text-2`.
    - A hint in `--text-3` on the right, for example "Entrée pour jouer".
    - Active item: `--surface-2`.
  - Actions: "Relancer le scan", "Ouvrir les paramètres", "Comptes connectés", "Activer le mode démo" / "Désactiver le mode démo", "Afficher les amis".
- **Keys:**
  - ↑/↓ move the selection.
  - Enter runs the item; on a game it launches.
  - Shift+Enter on a game opens its sheet.
  - Esc closes.
- **Ranking:** prefix matches first, then word-start matches, then substring matches. Recently played games get a boost.

### 4.12 Keyboard (P1)
- Ctrl+F focuses the library filter.
- Ctrl+K opens the palette (P2; until then it focuses the filter).
- Esc closes the topmost layer.
- Enter on a focused card launches the game.
- Tab reaches everything, with a visible focus ring.
- P2: arrow keys move through the grid (roving tabindex).

---

## 5. Motion

| Interaction | What moves | Duration | Easing |
|---|---|---|---|
| Hover on buttons, chips, rows | background, color, border-color | 120ms | `--ease-out` |
| Button press | `scale(.97)` | 80ms in / 120ms out | `--ease-out` |
| Card hover lift | `translateY(-4px)`, shadow | 180ms | `--ease-out` |
| Cover zoom on hover | image `scale(1.04)` | 300ms | `--ease-out` |
| Play overlay appears | opacity, `scale(.9→1)` | 180ms | `--ease-out` |
| Rail active pill | `translateY` | 220ms | `--ease-out` |
| View change | opacity, `translateY(4px→0)` | 160ms | `--ease-out` |
| Game sheet open / close | `translateX(32px→0)` + opacity; scrim opacity | 260ms open (scrim 200ms) / 180ms close | `--ease-out` / `--ease-in` |
| Menu, popover | opacity, `translateY(4px)`, `scale(.98→1)` | 140ms | `--ease-out` |
| Tooltip | opacity | 120ms after a 400ms delay | `--ease-out` |
| Dialog | opacity, `scale(.96→1)` | 180ms | `--ease-out` |
| Friends panel open / collapse | `grid-template-columns` | 240ms | `--ease-in-out` |
| Section collapse | `grid-template-rows: 1fr→0fr`, chevron rotation | 200ms | `--ease-in-out` |
| Favorite star | `scale 1→1.3→1`, fill color | 280ms | `--ease-pop` |
| Toast in / out | `translateY(12px→0)` + opacity / opacity + `translateX(8px)` | 220ms / 160ms | `--ease-out` |
| Image load | opacity 0→1 (hero also `scale 1.03→1` over 700ms) | 240ms (hero 420ms) | `--ease-out` |
| Skeleton shimmer | `translateX` | 1400ms loop | `--ease-in-out` |
| Spinner | rotation | 900ms loop | linear |
| Friend switches to "en jeu" | one ring pulse on the avatar (`box-shadow` 0→8px, opacity 1→0), once | 1200ms | `--ease-out` |
| Login mosaic | `translateY` loop | 80–110s per column | linear |

**Rules:**
- Animate only `transform` and `opacity`. The two exceptions are the panel collapse and the section collapse.
- No interaction animation lasts longer than 420ms.
- The grid entrance stagger is optional and only on the first load: 20ms per card, at most 240ms in total.
- `@media (prefers-reduced-motion: reduce)` and the `.reduce-motion` class (from "Réduire les animations") both:
  - set transform transitions to 0.01ms;
  - keep opacity fades at 120ms or less;
  - stop the mosaic, the shimmer (static `--surface-1`) and the pulse.

---

## 6. What NOT to do
- **No logos or trademarks.** That covers Steam, Epic, EA, PlayStation, Discord and Blitz, and Blitz's bolt and coral red. Use monogram tiles plus plain text names only.
- **No glow everywhere.** `--glow-accent` appears only on the primary button's hover. Cards and panels never glow.
- **No `backdrop-filter`** on scrolling lists, cards or friend rows. Only the top bar, the sticky toolbar, toasts and hero chips use it.
- **One accent per component.** The violet-to-cyan gradient is for the logo, progress fills and the profile banner tint only. Never use it on text or big surfaces.
- **No fake data.** No playtime, achievements, ranks, in-game timers or "0 h". If a value is unknown, the element isn't rendered.
- **Never show status by color alone.** Always add the shape and a text label.
- **No pure black `#000` backgrounds and no pure white `#FFF` body text.** No text over art without a scrim; keep 4.5:1 contrast.
- **No uppercase or condensed "gamer" fonts everywhere.** Uppercase only for overlines and "JOUER". Use Sora for big titles and Inter for the rest.
- **No confirmation dialog before launching a game.** No modal for things a toast or inline message can handle.
- **No ads, upsell blocks, autoplay video or sound.**
- **No raw API key fields on the main settings pages.** Keys live in Avancé. Never show a full key in a toast, a log or a URL.
- **Don't animate the width or height of grid items.** No springy motion on big surfaces, no parallax.
- **Don't rely on network-only fonts in the packaged .exe.**
- **Don't hide search** more than one keystroke away, and don't remove focus rings.

---

## 7. Implementation notes

**Files:**
- `styles.css`: new tokens and component styles. It can be split into `tokens.css`, `base.css` and `components.css`.
- `App.tsx`:
  - the shell grid, `TopBar`, the `profile` view;
  - `openGameId` state for the game sheet;
  - a toast array instead of a single string;
  - UI preferences and the onboarding flag.
- New components:
  - `TopBar.tsx`, `Rail` (rewrite of `Sidebar.tsx`), `AccountMenu.tsx`
  - `Hero.tsx`, `RecentShelf.tsx`, `LibraryToolbar.tsx`, `GameCard.tsx`, `Cover.tsx`
  - `GameSheet.tsx`, `FriendsPanel.tsx` (with `FriendRow` and `StatusBadge`), `Profile.tsx`
  - `SettingsView.tsx` (with `ConnectionCard`, `SecretField`, `Switch`, `Segmented`)
  - `Login.tsx` + `Onboarding.tsx`, `Toasts.tsx`, `Skeleton.tsx`, `Dialog.tsx`, `Menu.tsx`, `Icon.tsx`
  - `StoreTag.tsx`, which replaces `Badge.tsx`
  - `CommandPalette.tsx` (P2)
- `src/main/index.ts`: `titleBarOverlay` (section 3.1).

**New IPC (small):**
- `openGameFolder(id)`: the main process looks up `installDir` from the game id and calls `shell.openPath`. Never accept a raw path from the renderer.
- P2: `openInStore(id)` for `steam://` and the other store URL schemes, because `shell:open` only allows `https://`.

**localStorage** (always inside try/catch, per-device conveniences only):

| Key | Contents |
|---|---|
| `pg.ui` | friends panel mode, cover size, view, reduce motion, transparency |
| `pg.library` | filter and sort |
| `pg.friends.collapsed` | collapsed sections |
| `pg.onboarding.done` | onboarding flag |

**Profile stats:** all derived from `games` with no new API: count per store, sum of `launches`, maximum `lastPlayed`, number of favorites, top 5 by `launches`.

**Friend-to-game matching:** case-insensitive comparison of `friend.game` with `game.name`, trimmed and with ™ and ® removed.

**Contrast checked against the tokens:**
- `--text-3` on `--bg-1`: about 4.8:1.
- White on `--accent-solid`: about 5.2:1.
- Every icon-only button has a French `aria-label`.