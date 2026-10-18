Research findings: launcher UI patterns for Plateforme Gaming

## Main takeaways
- **GOG Galaxy 2.0 is the closest analog, and it has a new competitor.** In 2025 the Xbox PC app added a unified library (Steam, Battle.net, GOG and others). On 2026-10-14 Epic announced a launcher preview that also lets you "connect PC libraries" and has grid/list views plus collections. Merging stores is now the standard, so the polish has to come from how presence, stats and account linking are shown.
- **Steam's friends list and Discord's Active Now panel are the best models for presence.** Group people by the game they are playing, show one short status line, and use shapes as well as colors so statuses are readable without color.

## 1. Library: grid, list and density
- **Offer three views, like Playnite** ([desktop mode docs](https://api.playnite.link/docs/manual/gettingStarted/playniteDesktopMode.html)):
  - **Details:** a compact vertical list with a details and media panel on the right.
  - **Grid:** covers only. Hovering a cover shows an info button that opens a small details panel, so covers stay clean.
  - **List:** a sortable table. Right-click a column header to choose which columns show.
  - **Shortcuts:** Ctrl+F focuses search, Ctrl+G toggles the filter panel, Enter launches or installs the selected game.
- **Choose what each card or row shows, like GOG Galaxy (Atlas update)** ([wccftech](https://wccftech.com/gog-galaxy-2-0-atlas-update-goes-live-adding-global-search-and-other-features/amp/), [techraptor](https://techraptor.net/content/gog-galaxy-2-0-four-new-features)):
  - Grid cards can show or hide title, rating and status.
  - List columns include source, genres, critic rating and release year. They can be reordered by drag and turned on or off.
  - You sort by whatever data is displayed.
- **Cover size slider.** Steam lets you scale the tall covers between larger and more per row ([PC Gamer](https://pcgamer.com/new-steam-design-2019)).
- **Sort by playtime and achievement %.** A reviewer praised GOG for this because Steam's own list view can't do it ([PCWorld hands-on](https://www.pcworld.com/article/3406764/gog-galaxy-20-game-launcher-hands-on.html)). We get both numbers from Steam's API.
- **Grid/list toggle and live search.** Epic's preview has both, plus a top bar you can fill with favorite games ([Epic news, 2026-10-14](https://store.epicgames.com/news/epic-games-launcher-preview?lang=es-ES)). Our version: a favorites strip pinned under the hero.

## 2. Filtering, saved views and the sidebar
- **Fixed views first, then pinned filters.** GOG's left pane starts with Recent, All games and Installed. Any filter you build (platform, genre, rating, tags, installed) can be pinned to the sidebar as a "bookmark", reordered by drag, and keeps its own view settings ([maketecheasier](https://maketecheasier.com/manage-all-games-with-gog-galaxy2), [indie-hive](https://indie-hive.com/gog-galaxy-2-closed-beta/)).
  - For us: keep the chips (All, Favorites, Steam, Epic, EA), add an "Installed / Ready to play" chip, and add "+ Save view" to pin a filter to the left rail.
- **Dynamic collections.** Steam saves a filter as a collection that updates itself. Collections can also be added to the home page as horizontal shelves, reordered by dragging the shelf header, and deleted from it ([Steam library update page](https://store.steampowered.com/libraryupdate/?l=italian), [PCWorld](https://www.pcworld.com/article/397986/steams-long-awaited-library-overhaul-launches-sept-17-salvation-for-your-massive-game-collection.html)).
- **"Find games to play together."** Right-click a friend to filter the library to games you both own, with the Multiplayer tag added ([GamingOnLinux](https://gamingonlinux.com/2022/09/steam-beta-lets-you-create-a-collection-filtered-by-games-you-and-friends-own)). We can do this for Steam friends using the owned-games endpoint, which only works when the friend's profile is public.
- **Global search.** GOG opens it with Ctrl+F. It finds both games and friends and can launch a game straight from the dropdown, keyboard only ([techraptor](https://techraptor.net/content/gog-galaxy-2-0-four-new-features)). Our version: a Ctrl+K command palette.

## 3. Home page and "recently played" shelves
- **Steam's home page layout:**
  - A large "Recent games" shelf at the top, covering about two weeks and about ten games.
  - Then "What's new" (updates and events), then "Recent friend activity".
  - Then any collections the user added as shelves.
  - Each recent tile has a green button to resume play.
  - Sources: [PCWorld](https://www.pcworld.com/article/397986/steams-long-awaited-library-overhaul-launches-sept-17-salvation-for-your-massive-game-collection.html), [Steam](https://store.steampowered.com/libraryupdate/?l=italian).
- **Xbox "Jump back in":**
  - A row of up to nine recently played games on that device.
  - Clicking a tile opens the game's page. Launching directly is in the right-click menu.
  - The sidebar shows a "Most Recent" list.
  - Sources: [Thurrott](https://www.thurrott.com/?p=302249), [Xbox Wire 2025](https://news.xbox.com/en-us/2025/09/15/access-gaming-library-xbox-on-windows-pc-and-handheld/).
- **For us:** keep the hero for the last played game, then add a "Continue" row of the next 4 to 8 recent games, each with a hover play button and "2 h 14 this week". Then "Friends are playing" (games that online friends are in right now, with stacked avatars), then the full grid.

## 4. Game detail view and the play button
- **Steam game page:**
  - Large header art with the logo on top.
  - A play bar with the green PLAY button. "Last played" sits right of the button and stays visible; if the game was never played, nothing is shown ([Steam discussion](https://steamcommunity.com/app/221910/discussions/0/1697167355227750595)).
  - Below: friends playing this game (highlighted), friend activity, DLC, achievements, screenshots.
  - Sources: [PC Gamer](https://pcgamer.com/new-steam-design-2019), [PCWorld](https://www.pcworld.com/article/397986/steams-long-awaited-library-overhaul-launches-sept-17-salvation-for-your-massive-game-collection.html).
- **Post-game summary (Steam):** after you close a game, its page leads with session length, achievements unlocked and screenshots. It is a page, not a pop-up. We can do this cheaply: track the process and show "Session: 1 h 32" on the hero when the user comes back.
- **GOG game view:**
  - A Play/Install button with an options button next to it ("Manage installation", uninstall, Edit).
  - Shows play history, achievements, critic scores, a short overview and your rank among friends who play.
  - Edit lets you change the cover, background, icon and title.
  - Sources: [maketecheasier](https://maketecheasier.com/manage-all-games-with-gog-galaxy2), [Game Informer](https://www.gameinformer.com/2019/07/03/gog-galaxy-20-states-its-case-to-be-your-one-pc-library-to-rule-them-all), [PCWorld 2022](https://www.pcworld.com/article/605372/gog-galaxy-2-0-is-a-must-have-app-to-organize-all-your-pc-games.html).
- **Epic's game page** shows status, activity, details and play controls ([Epic](https://store.epicgames.com/news/epic-games-launcher-preview?lang=es-ES)).
- **Play button states to design:**
  - Play
  - Launching (spinner, disabled)
  - Running (a "Playing · 00:42" timer, plus a Stop/Focus option)
  - Install (opens the store's own client)
  - Not installed or unavailable
  - Add a split button: the main action plus a menu with "Open in Steam/Epic/EA", "Open folder" and "Properties".
- **Our detail stat row:** Last played · Playtime · Achievements x/y with a thin progress bar · Store badge. Steam provides all four; Epic and EA only have what we track locally.

## 5. Friends list and presence
- **Steam friends list structure** ([official chat update page](https://steamcommunity.com/updates/chatupdate)):
  - **Sections:** Favorites (pinned at the top, filled by drag and drop, with an optional compact mode), then In-game, Online, Offline, plus custom categories.
  - **Grouped by game:** in-game friends are grouped under the game they're playing.
  - **Collapse state:** built-in sections remember whether they are open or collapsed.
  - **Offline sorting:** by name or by last online time.
  - **Display options:** a compact friends list option and a "show nicknames" option.
- **Steam party grouping** ([Steamworks doc](https://partner.steamgames.com/doc/features/enhancedrichpresence)):
  - Friends in the same party or match are joined by a connecting line under the game, with a member count so you can see if there is room.
  - The rich-presence status is one line under the name, cut with an ellipsis if too long.
- **Discord Active Now** ([Drexel guide](https://support.cci.drexel.edu/getting-connected/discord/discord-friends-list/), [Discord support](https://support.discord.com/hc/hi-in/articles/7931156448919-Activity-Status-Recent-Activity)): a right-hand column of cards for friends playing right now, each showing the game and how long they've been playing.
- **Discord rich-presence card fields** ([best practices](https://docs.discord.com/developers/rich-presence/best-practices)):
  - Details (main line) and state (second line).
  - Large art with a tooltip, plus a small badge image with a tooltip.
  - Elapsed time and party size ("2 of 4").
  - Rules: one line per field, don't repeat information, put secondary details in tooltips.
- **Status colors and shapes.** Discord uses green for online, yellow for idle, red for do-not-disturb, purple for streaming, and grey for invisible ([Discord](https://support.discord.com/hc/en-us/articles/211374998-What-do-those-colored-dots-next-to-my-avatar-mean)). Offline has no dot; the name and avatar turn grey instead. Its colorblind mode adds shapes: solid dot, clock hands, bar, hollow circle ([PCGamesN](https://www.pcgamesn.com/destiny-2/discord-colorblind-mode)).
- **For us:**
  - **Groups:** a Favorites group, then In game grouped by title with a small cover icon and count, then Online, Away, Offline (collapsed by default, sorted by last seen).
  - **Each row:** avatar with a status ring, name, one secondary line ("In Elden Ring · 1 h 20" or "Online on PS5"), and a platform badge (Steam/PSN/Discord) in the avatar corner.
  - **Hover card:** a larger avatar, the game cover, "Find games to play together", and "Open profile".
  - **What each source gives (from my knowledge of the APIs, not checked this session):**
    - Steam GetPlayerSummaries gives a status (offline, online, busy, away, snooze, looking to trade, looking to play), the game name, and when the user last logged off. It does not give rich-presence text.
    - psn-api presence gives availability, platform (PS4/PS5) and the game title with an icon.
    - The Discord widget gives status (online, idle, dnd) and a game name, but no elapsed time.
    - So the in-game timer would have to be computed locally from when we first saw the friend in that game.

## 6. Account linking and integrations
- **GOG flow** ([How-To Geek](https://www.howtogeek.com/664490/how-to-consolidate-your-pc-games-with-gog-galaxy/), [maketecheasier](https://maketecheasier.com/manage-all-games-with-gog-galaxy2), [TechCentral](https://www.techcentral.ie/?p=133321)):
  1. Settings, then "Add games & friends", then "Connect platforms" opens a list of platforms, each with a Connect button.
  2. Connect opens a briefing screen listing which game and friend features work for that platform, with a second Connect.
  3. The platform's own login screen follows, unchanged.
  4. A connected row shows "Disconnect" in the same spot, plus per-platform options (for example "Quit when closing").
  5. A footer reads "Importing…" while the library syncs. A search field finds community integrations.
  6. Disconnecting deletes that platform's imported data in one click ([CD Projekt](https://cdprojekt.com/en/media/news/gog-galaxy-2-0-all-your-games-and-friends-in-one-place/), [PCGamesN](https://www.pcgamesn.com/gog-galaxy-20-beta)).
- **Xbox's lighter approach:** stores appear automatically once a game from them is installed. Settings > Library & Extensions has an on/off toggle per store that hides its games ([Xbox Wire](https://news.xbox.com/en-us/2025/09/15/access-gaming-library-xbox-on-windows-pc-and-handheld/)).
- **Discord controls** ([Discord support](https://support.discord.com/hc/hi-in/articles/7931156448919-Activity-Status-Recent-Activity)): one global "Share my activity" toggle, a sharing-per-connection toggle, a per-game detection list, and "Clear game history".
- **For us:** replace the Settings page's raw API-key fields with an "Accounts & integrations" page made of cards (Steam, Epic, EA, PlayStation, Discord). Each card has:
  - A status pill (Not connected / Connected as {name} / Error, re-auth).
  - What it brings, as icons: Games · Friends · Playtime · Achievements.
  - Last sync time and a "Sync now" button.
  - A "Show in library" toggle and Disconnect.
  - The advanced API key goes behind an expandable "Advanced" section.
  - First-run onboarding uses the same cards as a step after login.

## 7. Profile and stats
- **GOG "Recent" view** ([indie-hive](https://indie-hive.com/gog-galaxy-2-closed-beta/)):
  - Time played, achievements earned and newly added games.
  - Per day, week or month, either as a summary or compared with the previous period.
  - Friend leaderboards with titles such as "master collector", "completionist" and "most time played" ([TweakTown](https://www.tweaktown.com/news/66394/gog-releases-galaxy-2-open-beta-new-features/index.html)).
- **Steam Replay / Year in Review** ([Yahoo/PC Gamer](https://tech.yahoo.com/general/articles/steams-2023-review-breaks-down-200040642.html)):
  - Top games, comparison with the median user, and the share of new versus older games.
  - Achievements, a per-game timeline of when you played, and a genre radar chart.
  - A shareable image card.
- **Playnite add-ons show what users expect** ([Mythic theme README](https://github.com/darklinkpower/Mythic)): achievements (SuccessStory), playtime statistics (GameActivity), HowLongToBeat data, screenshots, and Steam player counts.
- **Our profile page:**
  - A header with the avatar and linked-account badges.
  - Four stat tiles: total playtime, games owned (split by store), achievements unlocked, most-played game.
  - A "This week" bar chart of playtime per day.
  - A top-5 most-played list with horizontal bars.
  - Recent achievements with icons.
  - Later: a yearly recap card.
  - Steam fields to use: `playtime_forever`, `playtime_2weeks`, `rtime_last_played` and the achievements endpoint per game. Epic and EA need local session tracking.

## 8. Visual and interaction details
- **Rounded, slightly animated styling.** Mythic, the Epic-inspired Playnite theme, rounds windows, borders, buttons and controls and adds small animations ([GitHub](https://github.com/darklinkpower/Mythic)).
- **Covers carry their store.** GOG reveals the title and store on hover ([PCWorld 2022](https://www.pcworld.com/article/605372/gog-galaxy-2-0-is-a-must-have-app-to-organize-all-your-pc-games.html)). Our version: a small store glyph in the cover corner, always visible.
- **Plan for missing artwork.** The Xbox unified library shows missing or generic logos for some Steam games ([PCWorld](https://www.pcworld.com/article/2910751/windows-xbox-app-update-now-pulls-in-your-steam-and-other-pc-games.html)). Our generated gradient fallback should include the title set in large type.
- **Empty and loading states.** Steam fixed its friend-activity shelf disappearing when empty, so empty shelves should show a placeholder instead ([Steam](https://store.steampowered.com/libraryupdate/?l=italian)). Use skeleton covers during import.
- **Dribbble and blitz.gg:** this pass did not cover them in depth. The blitz.gg page shows its patterns: live stat overlays, a post-match summary that compares your stats, and a profile that tracks stats over time ([blitz.gg/cs2](https://blitz.gg/cs2)).

## Sources

**GOG Galaxy 2.0**
- https://www.gameinformer.com/2019/07/03/gog-galaxy-20-states-its-case-to-be-your-one-pc-library-to-rule-them-all
- https://www.pcgamesn.com/gog-galaxy-20-beta
- https://indie-hive.com/gog-galaxy-2-closed-beta/
- https://techraptor.net/content/gog-galaxy-2-0-four-new-features
- https://wccftech.com/gog-galaxy-2-0-atlas-update-goes-live-adding-global-search-and-other-features/amp/
- https://cdprojekt.com/en/media/news/gog-galaxy-2-0-all-your-games-and-friends-in-one-place/
- https://www.howtogeek.com/664490/how-to-consolidate-your-pc-games-with-gog-galaxy/
- https://maketecheasier.com/manage-all-games-with-gog-galaxy2
- https://www.engadget.com/2019-07-30-gog-galaxy-2-0-beta-hands-on.html
- https://www.pcworld.com/article/605372/gog-galaxy-2-0-is-a-must-have-app-to-organize-all-your-pc-games.html
- https://www.pcworld.com/article/3406764/gog-galaxy-20-game-launcher-hands-on.html
- https://www.techcentral.ie/?p=133321
- https://www.tweaktown.com/news/66394/gog-releases-galaxy-2-open-beta-new-features/index.html

**Playnite**
- https://api.playnite.link/docs/manual/gettingStarted/playniteDesktopMode.html
- https://github.com/darklinkpower/Mythic

**Steam**
- https://store.steampowered.com/libraryupdate/?l=italian
- https://pcgamer.com/new-steam-design-2019
- https://www.pcworld.com/article/397986/steams-long-awaited-library-overhaul-launches-sept-17-salvation-for-your-massive-game-collection.html
- https://steamcommunity.com/updates/chatupdate
- https://partner.steamgames.com/doc/features/enhancedrichpresence
- https://gamingonlinux.com/2022/09/steam-beta-lets-you-create-a-collection-filtered-by-games-you-and-friends-own
- https://steamcommunity.com/app/221910/discussions/0/1697167355227750595
- https://tech.yahoo.com/general/articles/steams-2023-review-breaks-down-200040642.html

**Epic**
- https://store.epicgames.com/news/epic-games-launcher-preview?lang=es-ES

**Xbox**
- https://news.xbox.com/en-us/2025/09/15/access-gaming-library-xbox-on-windows-pc-and-handheld/
- https://news.xbox.com/en-us/2023/03/15/march-updates-xbox-app-on-pc/
- https://www.thurrott.com/?p=302249
- https://www.pcworld.com/article/2910751/windows-xbox-app-update-now-pulls-in-your-steam-and-other-pc-games.html

**Discord**
- https://docs.discord.com/developers/rich-presence/best-practices
- https://support.discord.com/hc/hi-in/articles/7931156448919-Activity-Status-Recent-Activity
- https://support.discord.com/hc/en-us/articles/211374998-What-do-those-colored-dots-next-to-my-avatar-mean
- https://www.pcgamesn.com/destiny-2/discord-colorblind-mode
- https://support.cci.drexel.edu/getting-connected/discord/discord-friends-list/

**Blitz**
- https://blitz.gg/cs2