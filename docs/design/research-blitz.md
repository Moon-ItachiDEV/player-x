Blitz.gg UI research report (inspiration for Plateforme Gaming). No logos or trademarks are to be reused.

**Limits of this research:** blitz.gg refused direct HTML/CSS downloads (curl got a 403 from the proxy). WebFetch returned page text only, with no stylesheets, so I could not pull any exact CSS values. Several Blitz subpages (brand-assets, account, pro) also failed to load. The hex colors, fonts and app layout details marked **[approx]** come from my prior knowledge of the Blitz app (2022–2025) and are not confirmed by fetched sources. Everything marked **[verified]** comes from a page I fetched.

## 1. Current state of blitz.gg (Oct 2026)
- [verified] The homepage is now a League-only beta landing page: "The League tool that does it all." It says the app uses computer vision with "no typing" and "no ads". The CTA is "Download Free for Windows". The 4-step "How It Works" covers starting a game, Champion Select detection, and runes, builds and team stats shown automatically. The navigation has only "Tier List" and "Get the App".
- [verified] The per-game pages (/lol, /valorant, /cs2, /fortnite) share one template:
  - Top bar with the game name and a "Download for Windows" button.
  - Social-proof numbers: "14M+ Players" and "8M+ Matches Analyzed".
  - Headline "Unleash Your Winning Potential with Blitz" and the CTA "Download Blitz for Free".
  - A feature catalogue where each feature gets a short name plus a one-line benefit. Valorant examples: "Profile Page – Track valuable metrics over time…", "Agent Select Overlay – See players' ranks and statistics from their last 5 competitive matches", "Post Match Insights Overlay – Automatically view and benchmark key stats as soon as your match ends".
- [verified] An older homepage is still mirrored at ads.blitz.gg:
  - Top bar with logo, Search, "Sign In", "Download", an "All Games" dropdown and a region selector ("NA").
  - A "Supported Games" carousel with a "1/5" pager. Unavailable games use a desaturated image (`Fortnite_Inactive.png`) and a "Coming Soon" label.
  - 4 feature blocks with screenshots: Performance Analysis, Auto Pre-Game Setup, In-Game Overlays, See Player Profiles.
  - A Pro waitlist email capture, a Discord block ("200k+ Blitz users on Discord", "Out of 3M+ total Blitz users"), and the footer line "Made with Lots of Love and Tilt in Los Angeles".

## 2. Layout and navigation of the desktop app
- [approx] Frameless Electron window with a custom title bar. The layout is:
  - A narrow left icon rail of about 64–72px. The bolt logo sits at the top, then one tile per game (each with its own colored game icon). The active game gets a vertical pill indicator and a brighter tile. Settings, the user avatar and an "upgrade to Premium" button sit at the bottom.
  - A top bar with global search (players, champions/agents), a region selector and window controls.
  - Inside a game, secondary navigation (tabs or a sub-list) for Profile, Tier list / Stats, Builds or Guides, Overlays settings and Leaderboard.
  - In the free tier, an ad column on the right. This is the most hated element in user reviews.
- [verified] The web version covers username search, stats and tier lists. The desktop app adds overlays, auto-import of runes and items, and personalized insights (support.blitz.gg "Web vs App").

## 3. Color palette [approx — not taken from CSS]
- App background: near-black blue-gray, around `#0E1015` to `#111318`.
- Cards: around `#17191E` to `#1C1F26`. Raised elements and hover: around `#23262E`. Borders: hairlines at `rgba(255,255,255,0.06–0.08)`, with almost no visible shadows.
- Text: primary around `#F2F3F5`, secondary around `#A0A4AD`, muted around `#61656E`.
- Brand accent: red/coral (bolt logo), around `#FF5859`. It is used sparingly: CTAs, active states, logo.
- Semantic colors (the main idea): win/positive is turquoise/cyan, around `#30D9D4`; loss/negative is red, around `#FF5859`; Premium is gold/amber, around `#FFC34F`. Rank and tier colors (S+/S/A/B/C, Iron…Challenger) are the only other strong hues.
- Principle: the interface stays almost monochrome, and color appears only where it means something (win/loss, tier, rank, status).

## 4. Typography [approx]
- One clean neo-grotesk sans in the style of Inter, with no display or "gamer" font in the interface.
- Big, bold numbers (KDA, win rate, LP) set in tabular figures, paired with small, muted labels that are often uppercase and slightly letter-spaced.
- Three or four sizes per screen at most. Numbers carry the hierarchy, not decoration.

## 5. Cards and components
- [approx] Match-history row:
  - A horizontal card with a thin colored stripe or tint on the left (turquoise for a win, red for a loss).
  - Champion/agent portrait, then KDA large with the ratio below, then CS, gold, items as small square icons, and teammate mini-avatars.
  - Clicking it opens an expanded breakdown.
- [approx] Rank card: rank emblem, tier and LP, W/L, and a thin win-rate progress bar.
- [approx] Tier list: a dense table with rank number, role icon, portrait, name, a colored tier letter badge, then win/pick/ban percentages. Filter chips (role, rank, region, patch) sit above.
- [verified] Tier list data rows look like "ADC Nilah 54.6%", under a "Patch 14.24" filter header with the note "Changing any of the filters… will automatically cause the page content… to update". In other words, filters apply instantly, with no Apply button.
- [verified] Blitz open-sourced `theblitzapp/react-skeleton`, "Full fledged flexible skeleton loader for styled-components". Skeleton loaders are part of their house style, and their front end used styled-components.

## 6. Profiles, stats, game pages
- [verified] Profile contents (Valorant): current rank, K/D overall and per agent, headshot %, most effective agent, win % per map, rounds won per side, trend over the last 20 matches, and Act-over-Act comparison (Sportskeeda).
- [verified] Profile contents (mobile, LoL): KDA, win rate, LP gains/losses, past-match stats, most-used champions and most-played roles (App Store listing).
- [verified] Profiles are presented as "track metrics over time". Post-match screens "benchmark" your stats against reference values. Leaderboards answer "see how you stack up against the best players from around the world".
- [approx] Profile header: the game's splash art as a heavily darkened, blurred backdrop with a gradient into the page background. On top sit the avatar with a level badge, Name#Tag, the rank emblem and an "Update" button. Tabs below: Overview, Matches, Champions/Agents.
- [verified] Overlays follow a minimalism rule. WeCoach (FR): "l'overlay in-game affiche exactement ce dont vous avez besoin sans surcharger votre écran", and the interface is "épurée". The Valorant Combat Overlay shows only Combat Score, Headshot % and Kills.

## 7. Account linking and user profile
- [verified] The Blitz account is created by email at first launch, and the user can choose to skip registration (cellphones.com.vn guide).
- [verified] Game accounts are linked automatically: when you launch League or Valorant, Blitz detects the logged-in client account, with no manual ID entry (cellphones.com.vn, esports.net). The new beta goes further and reads names through computer vision, "no typing".
- [verified] Empty/error state: a "This profile is private" screen telling the user to play a game to make the profile available. There was no option to make stats public (esports.net).
- [verified] The mobile app pairs with the PC app. Both must be logged in at the same time, and drafting happens from the phone (App Store).
- [approx] Settings > Accounts lists the linked game accounts, each with game icon, name#tag and region tag, plus link/unlink actions. Premium status shows as a gold badge or label near the avatar.
- [verified] Premium page: "Get more from Blitz with Premium", "Pick your Plan", Basic Free vs Premium "from $4.99/month". Perks listed: "Ad-free experience", "Masters+ Builds", "Customizable CS Overlay", "Support Item Overlay", "Support Item Postmatch Report".

## 8. Onboarding
- [verified] The flow is:
  1. Download and run as administrator.
  2. Sign up by email, or skip.
  3. Pick a game from a grid of supported games.
  4. Optionally set the language via the gear icon.
  5. Launch the game, and detection happens automatically.
- [verified] Marketing explains the flow with a numbered "How It Works" sequence of 4 steps.
- [verified] Weakness: a Trustpilot reviewer said there "weren't very many instructions". A short guided first run would avoid that.

## 9. Empty states and micro-interactions
- [verified] "Coming Soon" games use desaturated art. The profile has a "This profile is private" state with an action. Content loads behind skeleton loaders. Filters update instantly.
- [approx] Hover lifts a card's surface by one shade and brightens its border instead of adding glow. Tooltips on stat icons explain the metric. Win-rate bars fill smoothly. The active rail item uses a sliding pill indicator.

## 10. What makes it feel premium (and what hurts it)
- **Helps:**
  - Things happen automatically, so the app feels like magic (auto-detection, auto-import, "no typing").
  - Data is dense but tidy: a strict grid, tabular numbers, muted labels next to bright values.
  - The near-monochrome dark base keeps color for meaning only.
  - Game art serves as a darkened atmosphere behind content, not as decoration everywhere.
  - Overlays show only what is needed.
  - Social-proof numbers appear on marketing pages.
- **Hurts** ([verified] Trustpilot, 2.3/5 on the page read):
  - Intrusive ads, including "autoplay videos with audio on".
  - Crashes and heavy memory use ("8GB of RAM after an hour or two").
  - Confusing account and payment flows.
- Blitz's own 2026 beta now markets "no ads". Lesson for us: stay ad-free, light and stable.

## 11. Directly applicable to Plateforme Gaming
- **Palette:** tone the neon down to accents only. Keep violet for brand and active states, cyan for "online/in game/positive", amber for "away", red for errors and disconnected. Base colors: `#0E1015` / `#17191E` / `#23262E`, hairline borders `rgba(255,255,255,.07)`.
- **Rail:** add a sliding active pill. Put the avatar at the bottom with a status dot and a popover (profile, accounts, sign out).
- **Top bar:** global search (Ctrl+K) covering games and friends.
- **Profile page:** header with a blurred, darkened backdrop from the last played game's art, plus avatar, display name and linked-account chips. Stat tiles in tabular numbers: games owned, playtime, most played, last session. Then tabs.
- **Accounts page:** one card per provider (Steam, Discord, PSN, Epic, EA) showing a provider icon, Connected / Not connected / Error status, account name, last sync time, a Connect/Disconnect button and a privacy note. The empty state explains the benefit and has one primary action. Detect and link automatically where possible, for example by reading local Steam/Epic installs.
- **First run:** 3 skippable steps: Welcome, Connect accounts, Library detected (with a count).
- **Loading and empty states:** skeleton loaders for the cover grid and friends panel. Uninstalled or unavailable games show desaturated covers with a label. Filter chips apply instantly.

## Sources
- https://blitz.gg
- https://blitz.gg/lol
- https://blitz.gg/lol/tierlist
- https://blitz.gg/valorant
- https://blitz.gg/cs2
- https://blitz.gg/fortnite
- https://blitz.gg/premium
- https://blitz.gg/download
- https://ads.blitz.gg/ (mirror of the older homepage, with image filenames)
- https://support.blitz.gg/hc/en-us/articles/4415407336857-An-In-Depth-Guide-to-the-Blitz-gg-Application
- https://support.blitz.gg/hc/en-us/articles/4415407357465-Web-vs-App-What-s-the-Difference
- https://github.com/theblitzapp/react-skeleton (org listing: https://github.com/theblitzapp)
- https://github.com/theblitzapp/full_stack_take_home
- https://medium.com/blitz-press/blitz-launches-combat-overlay-to-help-players-improve-in-valorant-ecbdd8bd14d7
- https://theblitzapp.medium.com
- https://apps.apple.com/ca/app/blitz/id1591484739
- https://cellphones.com.vn/sforum/blitz-gg-la-gi
- https://www.esports.net/news/valorant/unprivate-valorant-profile-blitz/
- https://sportskeeda.com/valorant/how-track-stats-valorant-without-logging
- https://wecoach.gg/fr/blog/article/best-valorant-trackers-in-2026
- https://www.dexerto.com/valorant/best-valorant-stat-trackers-to-use-in-2023-2090718
- https://www.trustpilot.com/review/blitz.gg?page=3
- https://hub.procomps.gg/2022/08/league-of-legends-apps-which-one-is-the-best-fit-for-you/
- https://www.counterwatch.gg/blog/counterwatch-vs-blitz-for-marvel-rivals-what-happened-and-wh-f69a118a
- https://www.google.com/ads/publisher/stories/blitz/
- https://alternativeto.net/software/blitz-esports/about/