**Research report: game launcher and gaming platform UI inspiration (Dribbble, Behance, case studies), October 2026**

**How this was researched.** I could not open any Dribbble or Behance page. WebFetch returned empty content or "error while fetching", Figma Community refused on robots.txt, and curl through the proxy got a 403 for dribbble.com, cdn.dribbble.com, behance.net and blitz.gg. So I checked each shot's title, author and URL against search results, but I never saw the images. Visual notes on individual shots come from their titles and tags, plus general knowledge of the genre, and are marked "(inferred)". The detailed patterns come from pages I could read: two Steam-redesign case studies, the theme source of the open-source Heroic Games Launcher (Electron + React), and published Steam and Discord color tokens. These are marked "(verified)".

---

### 1. Notable shots (12 main + extras)

Years are estimated from Dribbble shot IDs.

| # | Title | Author | URL | Notes |
|---|---|---|---|---|
| 1 | Steam Redesign Pt. 1 | not shown in search result | https://dribbble.com/shots/24375038-Steam-Redesign-Pt-1 | ~2024; desktop client redesign |
| 2 | Elden Ring Custom Launcher Concept | TheKoswog | https://dribbble.com/shots/25887272-Elden-Ring-Custom-Launcher-Concept | ~2025; single-game, cinematic key-art launcher (inferred) |
| 3 | Futuristic UI with a Dark Aesthetic and Glassmorphism Elegance | Brendon Dsouza | https://dribbble.com/shots/25879265-Futuristic-UI-with-a-Dark-Aesthetic-and-Glassmorphism-Elegance | ~2025; dark + glass |
| 4 | Esports App – Dark UI for Gamers | not shown | https://dribbble.com/shots/25774450--Esports-App-Dark-UI-for-Gamers | ~2025; data-heavy esports style (inferred) |
| 5 | Glassmorphism Dashboard – UI Design | Leon Abramovic | https://dribbble.com/shots/25345989-Glassmorphism-Dashboard-UI-Design | ~2025; frosted panels |
| 6 | Gaming Profile UI/UX Design | Cosmiq Designer | https://dribbble.com/shots/23169892-Gaming-Profile-UI-UX-Design | ~2023–24; player profile / stats |
| 7 | Minecraft Launcher Concept | docy | https://dribbble.com/shots/22562936-Minecraft-Launcher-Concept | ~2023 |
| 8 | Epic Games Concept | Amir baqeri | https://dribbble.com/shots/20312860-Epic-Games-Concept | ~2023 |
| 9 | Xbox App Redesign UI | Gabriel Mchedlidze | https://dribbble.com/shots/20186260-Xbox-App-Redesign-UI | ~2022–23 |
| 10 | Game Launcher Sidebar | Moein Rabti | https://dribbble.com/shots/18019661-Game-Launcher-Sidebar | ~2022; sidebar/rail navigation study |
| 11 | Steam UI Redesign with Fluent Design Elements | Yiğit Yetkin | https://www.behance.net/gallery/162943237/Steam-UI-Redesign-with-Fluent-Design-Elements | Fluent = acrylic/Mica blur, layered translucency (inferred from title) |
| 12 | Steam Redesign: Library & friends list | Christian Gusukuma | https://www.behance.net/gallery/54558477/Steam-Redesign-Library-friends-list | Older, but directly about library + friends panel |

**Extras, same topic:**
- Epic Games Launcher App Redesign, Robert Design: https://dribbble.com/shots/17208266-Epic-Games-Launcher-App-Redesign
- Riot Games Game Launcher UI/UX Design: https://dribbble.com/shots/9369993-Riot-Games-Game-Launcher-UI-UX-Design
- Infinity, a game launcher concept, D Prem Kumar: https://dribbble.com/shots/13444594-Infinity-A-game-launcher-concept
- Steam Library Redesign, UI/UX focus, Laura Eddy: https://dribbble.com/shots/4130374-Steam-Library-Redesign-UI-UX-focus
- Steam Desktop App Redesign Concept, Jacen Lin: https://www.behance.net/gallery/91262641/Steam-Desktop-App-Redesign-Concept
- Concept Epic Games (Application UI/UX), Andrey Artamonov: https://www.behance.net/gallery/100775105/Concept-Epic-Games-(Application-UIUX-)
- Battle.net Redesign Concept, Lisa Martinovska: https://www.behance.net/gallery/69252633/Battlenet-Redesign-Concept
- ULT, Gaming Platform UI UX Web App: https://www.behance.net/gallery/127980731/ULT-Gaming-Platform-UI-UX-Web-App

**Tag pages for browsing by hand:**
- https://dribbble.com/tags/game-launcher
- https://dribbble.com/search/game-launcher
- https://dribbble.com/tags/gaming-dashboard
- https://dribbble.com/tags/gaming-profile
- https://dribbble.com/tags/friends_list
- https://www.behance.net/search/projects/game%20launcher

**Case studies I could read (verified content):**
- Maximilian Lock, "Redesigning the Steam Desktop Client": https://www.maximilianlock.co.uk/post/steam-redesign
- Parrot9, "How to redesign Steam for maximum exploration": https://blog.parrot9.com/steam-case-study/

---

### 2. Recurring patterns

**Navigation**
- **Collapsible sidebar (verified, Lock).** A persistent, collapsible sidebar replaces top tabs and puts the most-used sections first. In user tests, people asked for explicit labels, so an icon-only rail should show labels on hover or when expanded.
- **Always-visible filter sidebar (verified, Lock, after GOG Galaxy).** Filters like Installed / Favourites / per-store stay on screen, with subtle hover states.
- **Search (inferred).** Search lives in a top bar and is often a wide field or a Ctrl+K command palette. Lock's tests led to a wider search input (verified).

**Home and hero**
- **Modular cards (verified, Lock).** The home screen is built from dashboard cards that adapt to behavior, plus quick-access shortcuts and a "Free this week" style carousel.
- **Media-first game page (verified, Parrot9).** Trailer or key art takes center stage. Expandable details sit under the Play button: playtime chart, first played, sessions, average completion time.
- **Hero treatment (inferred, genre-wide).** Full-bleed key art, a dark gradient scrim from the bottom and left, the game's logo image in place of a text title, and a large primary CTA beside secondary icon buttons.
  - Steam's CDN serves `library_hero.jpg` and `logo.png` per appid, alongside the `library_600x900` art we already use.

**Game cards**
- **Shape (inferred).** 2:3 portrait covers with 8–16px radius, or sharp/chamfered corners in esports styles.
- **Hover (inferred).** Lift and a slight scale-up, a glow tinted with the cover's dominant color, and a Play overlay that appears on hover.
- **Badges (verified, Lock).** Proposed status badges on thumbnails: cloud-sync and trial. For us this means a store badge, installed state and a favorite marker.
- **Recent-game cards (verified, Parrot9).** They show total playtime, the last two weeks of play and achievement progress.

**Glass and blur**
- Translucent panels over blurred key art, the Fluent acrylic/Mica idea.
- Typical values: `backdrop-filter: blur(20–30px) saturate(140%)`, white at 4–8% fill, and a 1px border at white 8–12%.
- Heroic's theme CSS has no backdrop-filter, so glass is a stylistic choice, not a requirement (verified).

**Gradients**
- **Tinted panels (inferred).** Accent-to-accent gradients (violet to cyan, magenta to orange) used on CTAs and active states. "Ambient" backgrounds are tinted from the selected game's art.
- **Heroic's gradients (verified).** A card title scrim `linear-gradient(180deg, rgba(0,0,0,.42) 1.8%, <title color> 45%)` and a horizontal body gradient from the nav edge.

**Friends list**
- **Grouping.** In game / Online / Away / Offline (we already have this). Status dot on the avatar.
  - Discord's verified status colors: online #23A55A, away #F0B232, do-not-disturb #F23F43, offline #80848E.
- **"Friends who play" (verified, Parrot9).** Shown on game pages, plus a friends activity feed you can filter to friends only or to hide minor updates.
- **Richer in-game rows (inferred).** Small cover thumbnail, game name, elapsed time, and Join/Invite/Message on hover. The panel collapses to an avatar-only column.

**Profile and account (verified, Parrot9 unless noted)**
- Level shown as a progress ring next to the username.
- Avatar is a rounded square, so custom frames still fit.
- The user picks a profile background image.
- Showcases: favorite game, rarest achievement, collector.
- Recent activity with total and two-week playtime plus a chart.
- Achievements sortable by rarest or most recent.
- Users can show or hide profile sections.
- GOG Galaxy 2.0's pitch, "all your games and friends in one place", is exactly our multi-account angle. GOG's multi-account setup confused newcomers (verified, Lock), so linked accounts need to be very clear.

**Typography**
- Steam uses Motiva Sans throughout with a monospace for labels (verified).
- Heroic bundles Rubik and Cabin via @fontsource (verified).
- Esports/HUD styles use condensed uppercase display fonts; cinematic styles use geometric sans display fonts (inferred).

**Reference palettes (verified)**
- **Steam:** #1B2838 bg, #171A21 deep, #0E141B darkest, #16202D surface, #C7D5E0 text, #8F98A0 soft text, #66C0F4 accent.
- **Discord:** #1E1F22, #2B2D31, #313338, #383A40, text #F2F3F5, subtext #949BA4.
- **Heroic "Classic":** #13172A body, #151F3D bg, accent #E0AB40, primary #07C5EF, text #EAE8E5 / #B1B1B1, success #12E195.
- **Heroic "High Contrast":** #121212 bg, #00DDFF accent, #FF0090 primary.

---

### 3. Three visual directions

**A. "Aurora Glass" (layered translucency, evolved from our current style)**
- **Sources:** shots 3, 5, 11, 1, and Fluent-style Steam redesigns.
- **Idea:** The selected game's art, heavily blurred, becomes the ambient background of the whole window. Frosted panels float on top: rail, friends panel, filter bar.
- **Palette:**
  - bg #0B0F1A, base surface #121829
  - glass fill rgba(255,255,255,0.06), glass border rgba(255,255,255,0.10)
  - text #F5F7FA / #9AA4B2
  - accent gradient #8B5CF6 to #22D3EE, kept from our current identity
  - success #23A55A, warning #F0B232, danger #F23F43
- **Type:** "Plus Jakarta Sans" or "Sora" for display (600–700); "Inter" for UI text. Bundle them locally with @fontsource.
- **Hero:** Full-bleed `library_hero` art with the game logo on top. PLAY is a gradient pill with a soft outer glow. Playtime and last-played sit in glass chips.
- **Cards:** 2:3, 14px radius. On hover: lift 4px, scale 1.03, colored shadow from the cover's dominant color, Play overlay.
- **Friends:** A glass panel. Avatars carry a status ring. In-game rows show a mini cover and elapsed time.
- **Accounts:** Profile header uses the last-played hero as banner, with a level ring and a row of linked-account chips.
- **Risk:** Blur is expensive on the GPU. Use it only on big static layers and offer a "reduce transparency" toggle.

**B. "Tactical HUD" (esports companion style, like blitz.gg)**
- **Sources:** shots 4, 6, the Riot launcher shot, the ULT web app.
- **Idea:** Dense and data-first, with angular shapes. Stats are visible everywhere: hours, sessions, last played, friends in game.
- **Palette:**
  - bg #0A0B0E; surfaces #14161B / #1C1F26
  - hairline borders #2A2E37
  - text #E8EAED / #8B919C
  - one hot accent: #FF3B5C (coral-red) or #C6FF3D (acid lime)
  - info #3DA5FF
- **Type:**
  - display: "Rajdhani" or "Barlow Condensed", uppercase with letter-spacing
  - body: "Inter"
  - numbers and stats: "JetBrains Mono" with tabular numerals
- **Hero:** A split layout. Key art on one side; on the other a stat block (total hours, two-week hours, sessions) and a squared PLAY button with a chamfered corner (`clip-path`).
- **Cards:** 4px radius or chamfered corners. A thin accent bar shows the store. Playtime chip at the bottom.
- **Friends:** Compact two-line rows with a status bar on the left edge (no dots) and "in game: X · 42 min". Sorting puts in-game friends first.
- **Accounts:** A profile "dossier": level badge, stat tiles, a 14-day playtime bar chart, linked platforms as status rows (Connected / Expired / Not linked).
- **Risk:** Cold and noisy if overdone. It needs strict spacing and a single accent color.

**C. "Cinematic Console" (big-picture, content-first)**
- **Sources:** shots 2, 9, 7, Parrot9's media-first game page, PS5/Xbox-style redesigns.
- **Idea:** Very little interface around the game art. Choosing a game crossfades the whole background to its hero art. Shelves scroll horizontally. Text is large.
- **Palette:**
  - bg #07080C
  - scrim linear-gradient(0deg, #07080C 0%, rgba(7,8,12,0.6) 40%, transparent 70%)
  - text #EDEDED / #A1A1AA
  - accent: warm gold #E8B44C or ice #7DD3FC
  - focus ring 2px white plus a 6px outer glow
- **Type:** "Outfit" or "Space Grotesk" for display (very large, 48–72px hero); "Inter" body.
- **Hero:** Covers about 70% of the window and shows the logo image, not text. PLAY is solid white with dark text. Below it, an expandable details row: playtime chart, first played, friends who play.
- **Cards:** Rows of covers. The focused card grows (1.08 scale) and shows its title under the cover. Works with keyboard and controller (arrow keys plus Enter).
- **Friends:** Hidden in a slide-over drawer, with an avatar stack plus "3 in game" in the top bar. Opens on hover or key press.
- **Accounts:** A full-screen profile in a console style. Big avatar, level ring, showcase shelf ("Most played", "Recently played"), and a background image you choose.
- **Risk:** Less information on screen. Search and filters must stay one keystroke away (Ctrl+K).

---

### 4. Cross-direction recommendations for Plateforme Gaming
- **Settings to Connections.** Replace the raw API-key fields with one card per service:
  - status pill (Connected / Not connected / Error) and "Test connection" button
  - key field masked inside an "Advanced" section
  - last-sync time
  - neutral icons or text labels instead of brand logos, to stay clear of trademarks
- **Login.** A split card: an animated mosaic of library covers on one side, provider buttons on the other (Steam OpenID, Discord OAuth), plus a "continue offline" link.
- **Rail.** Labels on hover or expand, as Lock's testers asked. Account avatars sit at the bottom with a status dot.
- **Motion.** 150–250ms ease-out. Background crossfade about 400ms. Skeleton shimmer while covers load. Respect `prefers-reduced-motion`.
- **Generated covers (non-Steam games).** Make the gradient match the chosen direction: glass tint for A, flat surface plus accent bar for B, dark scrim plus big title for C.

---

### Sources
- Dribbble shots and Behance projects: the URLs in section 1.
- https://www.maximilianlock.co.uk/post/steam-redesign
- https://blog.parrot9.com/steam-case-study/
- https://raw.githubusercontent.com/Heroic-Games-Launcher/HeroicGamesLauncher/main/src/frontend/themes.scss
- https://raw.githubusercontent.com/Heroic-Games-Launcher/HeroicGamesLauncher/main/src/frontend/App.css
- https://colorswall.com/it/palette/264149 (Discord window palette)
- https://www.webdesignhot.com/design.md/steam/diff/corsair/ (Steam tokens)
- https://cdprojekt.com/en/media/news/gog-galaxy-2-0-all-your-games-and-friends-in-one-place/