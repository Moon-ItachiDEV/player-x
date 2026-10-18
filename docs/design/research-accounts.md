## Account and profile UX research for "Plateforme Gaming"

Sources I could read: Discord, Medal, EA, Riot, Epic, GOG Galaxy, Playnite, Overwolf developer guidelines, Android settings guidelines, the Electron docs and RFC 8252. Dribbble is blocked by the network proxy, so I couldn't open any shot. The Dribbble links at the end are for browsing only, and I can't vouch for what they show. Blitz's site describes a desktop app that detects your game for you, but the app's account screens aren't documented anywhere public. The Blitz-like points below are my inference from its marketing page, not something I observed.

### 1. Main principles
1. **The app should be useful before anyone signs in.** The Steam/Epic/EA library comes from scanning the PC, so it doesn't need an account. Signing in should only add friends and presence. Overwolf's login guidelines recommend a "Guest Mode", and Blitz sells "it detects your game automatically". Offer "Continuer sans compte" (continue without account) on the login card.
2. **Sign in through the system browser, never inside the app.** The app opens Steam OpenID or Discord OAuth in the user's normal browser, and the browser sends the result back to the app. RFC 8252 requires this for desktop apps (§5, §8.12): use a local `127.0.0.1` address (§7.3) or a custom link scheme (§7.1), plus PKCE (§6). Medal, GOG and Riot all show a "You're all set" page in the browser. The app needs a waiting screen while this happens (see section 2).
3. **Say what data you collect before connecting.** Discord shows a box listing the data before you confirm, and GOG Galaxy shows "which features will work" before Connect. Each platform card should list what it is used for.
4. **One central place for linked accounts**, with the same card layout for every platform. Discord, Medal and EA each have a "Connections" or "Connected Accounts" tab.
5. **Each account controls its own visibility.** Discord has a "Display on profile" switch per account, and it is off by default for accounts tied to a real name (Facebook, Spotify). Medal also has a switch to show Steam on your profile.
6. **Keep settings to two levels, and put developer items behind a clearly named switch.** Discord's pattern is Settings > Advanced > Developer Mode. Jakob Nielsen's progressive-disclosure advice: stop at two levels, and name what is hidden ("Clés API", not "Plus d'options").
7. **Switches apply instantly. Text fields check what was typed and offer a Test button.**

### 2. Sign-in and first-run screens

**Login card.** Move from the centered card to a split layout: about 40% left panel for the form, about 60% for game art. This is the Riot Client style. League's old animated login screens were popular enough that Riot says it wants to bring them back.
- **Right side:** a blurred, slowly panning image of the user's last-played cover (they already have Steam `library_600x900` art). Use the generated gradient if there's no art.
- **Left side, top to bottom:**
  - logo and a one-line value statement
  - full-width buttons "Continuer avec Steam" and "Continuer avec Discord", using a neutral icon or monogram plus the platform name (no logos)
  - a divider, then a secondary button "Continuer sans compte (bibliothèque locale)"
  - small text: what is read (SteamID only, since Steam OpenID returns nothing else) and a link to privacy information
- **Recent accounts:** show remembered accounts as avatar buttons above the provider buttons ("Reprendre en tant que …"), like Battle.net and Discord's account switcher. Discord allows up to 5.
- **Waiting screen:** "Ouverture de votre navigateur…" with a spinner, a Cancel button, and "Le navigateur ne s'est pas ouvert ? Copier le lien". When it succeeds, show a toast with the avatar ("Connecté en tant que X").
- **QR code (later):** Riot and Steam both put "sign in with QR code" next to the sign-in button. It isn't needed now, but it is the current norm for these apps.
- Keep sign-in and sign-up clearly separate, with few fields and no password confirmation (Overwolf).

**First-run setup.** 3–4 steps with progress dots, and every step can be skipped. This follows the Playnite first-start wizard and Overwolf's first-time-use guidelines (short, can be dismissed, can be revisited).
1. **Welcome:** the value in one sentence.
2. **Launcher detection:** an automatic scan shown as rows, for example "Steam ✓ 42 jeux · Epic ✓ 8 · EA — non trouvé [Choisir un dossier]".
3. **Friends (optional):** platform cards with Connect buttons (section 3).
4. **Done:** the app opens on the Library with a toast "54 jeux importés". Tell the user everything can be changed later in Settings > Comptes, as Playnite does.

### 3. Connect-accounts card (Settings > Comptes connectés, reused in setup)
Lay the cards out in a grid. Each card contains:
- **Header:** a monogram tile in the platform's color, the platform name, and a status pill: `Connecté` (green), `Non connecté` (gray), `Action requise` (amber, for an expired token or a private profile), `Erreur` (red).
- **When connected:**
  - the platform avatar and display name, with "connecté le 12 oct."
  - a "Données utilisées" (data used) list with checks: Bibliothèque (library) / Amis & présence (friends and presence) / Temps de jeu (playtime)
  - a switch "Afficher sur mon profil" (show on my profile)
  - a ⋯ menu with "Actualiser" (refresh; Discord has a manual Refresh) and "Déconnecter" (disconnect)
- **Disconnect confirmation:** red styling and plain consequences: "Vos amis Steam n'apparaîtront plus. Les données récupérées seront supprimées de cet appareil." Removing a Discord connection permanently deletes the collected data.
- **When not connected:** one sentence on the benefit, plus a main "Connecter" button.
- **Steam warning:** what the API returns depends on the user's Steam privacy settings. Steam's game-details category also controls whether someone shows as "in-game" and which game. When the friends call fails, the card should say: "Votre profil Steam / liste d'amis doit être Public ou Amis — [Ouvrir les paramètres de confidentialité Steam]".
- **PSN:** it uses an NPSSO token that has to be treated like a password (psn-api README). Show it as an "Avancé / expérimental" connection with a warning, not as a normal button.
- **Discord:** the widget only works if the server owner has enabled it. Show a short helper with a "Tester" button.
- **One account per platform** (Medal's rule). Plan for the error "Ce compte est déjà lié à un autre profil", which Medal and EA both have help articles for.

### 4. Profile page
- **Banner:** if a Discord account is linked, use its `banner` or `accent_color` (the `identify` scope gives `avatar`, `banner`, `accent_color`, `global_name`). Otherwise use a blurred cover of the most-played game. PS5 and League let users pick a cover or banner.
- **Avatar:** placed half over the bottom-left of the banner, with a presence ring. Next to it, the display name and a row of small badges for linked platforms (only those with "Afficher sur mon profil" on). Put an "Modifier le profil" (edit profile) button top-right that opens a side drawer, not a new page.
- **Stats strip (4 tiles):**
  - Jeux possédés (games owned): `GetOwnedGames` plus the local scan
  - Heures sur 2 semaines (hours in the last 2 weeks): `GetRecentlyPlayedGames`
  - Niveau Steam (Steam level): `GetSteamLevel`
  - Trophées PSN (PSN trophies): `getUserTrophyProfileSummary`
- **"Joué récemment" (recently played):** a horizontal row of 2:3 covers with hours and last-played date.
- **"Vitrine" (showcase):** a favorite game in a large tile. This copies Steam's showcase idea, which Steam locks behind levels; ours can be free.
- **Linked accounts block and "Amis en ligne" (friends online)** in the sidebar.
- **Loading and empty states:** skeleton placeholders while loading. Overwolf's empty-state guidance: say why something is empty and give the next action. Example: "Aucune donnée Steam — connectez votre compte".
- **Mini-profile on hover** in the friends panel: banner strip, avatar, current game. This is like Discord's popout and Steam's mini-profile.

### 5. Account area in the left icon rail
Replace the several account avatars with **one avatar at the bottom of the rail**, carrying a status dot and small platform badges. Clicking it opens a menu, like Discord's avatar menu:
- the user's name and avatar
- a status choice: En ligne / Absent / Invisible
- "Voir le profil" (view profile)
- "Comptes connectés" (connected accounts)
- "Changer de compte" (switch account)
- "Se déconnecter" (sign out)

Keyboard navigation should reach the whole app. Battle.net 2.0 made this a headline feature, along with a friends panel that stays open on the right. Their layout already does the friends panel.

### 6. Settings organization
Use a sub-navigation on the left with group headings, in Discord's style (User Settings / App Settings / Advanced). Put a "Rechercher un paramètre" (search settings) field at the top (setproduct, Android).

**COMPTE (account)**
- **Profil:** avatar, banner, bio
- **Comptes connectés:** the cards from section 3
- **Confidentialité:** a status presence switch, "Apparaître hors ligne" (appear offline), and what friends can see

**APPLICATION**
- **Apparence:** accent color, interface density, reduce animations
- **Bibliothèque & lanceurs:** detected launcher paths, "Rescanner", hidden games
- **Comportement:**
  - "Lancer au démarrage de Windows" (start with Windows)
  - "Réduire dans la zone de notification" (minimize to tray)
  - what closing the window does
- **Notifications:** a friend comes online, a game is ready
- **Langue** (language)

**AVANCÉ (advanced)**
- a "Mode développeur" (developer mode) switch. Turning it on reveals a **"Clés API & intégrations"** page with the Steam Web API key, the Discord server ID (widget) and the PSN NPSSO
- "Journaux" (logs), "Réinitialiser l'application" (reset the app; red, with confirmation)

**À PROPOS (about)**
- version, "Rechercher des mises à jour" (check for updates), licenses

**Rules for controls and wording (Android guidelines, UXtweak):**
- A switch is for on/off settings that take effect immediately: no Save button, show a brief "Enregistré" toast.
- Use checkboxes only inside forms that are submitted.
- Under each item, the secondary text should show the **current value** ("Steam · 42 jeux · scanné il y a 3 min"), not a description of the setting.
- Don't use generic verbs (Gérer, Modifier, Définir) in labels.
- Don't repeat the section title in item labels.
- If a group has 15 or more items, split it into sub-pages.
- Don't put the version number or account management on the general settings page.
- Choose defaults that are cautious and low-risk.

**API key field (inside Advanced):**
- After saving, show the key masked as `••••••••a4f2`, with a show/hide eye button, a "Coller" (paste) button and a **"Tester"** button.
- The Test button shows the result inline: ✓ "Clé valide — 37 amis trouvés" or ✗ "Clé refusée (403)".
- Add a "Où obtenir cette clé ?" link (where to get this key) and "Supprimer" (delete) in red, kept apart from the copy button.
- Never put the full key in logs or URLs (saasui.design patterns).
- Add a note under the field: "Chiffrée sur cet appareil" (encrypted on this device). Store it with Electron `safeStorage`, which uses DPAPI on Windows; prefer the async API. DPAPI protects the key from other Windows users but not from other apps running in the same user session.
- For a public release, the Steam key belongs on a server, not on the user's machine.

### 7. Visual notes for the dark navy and neon theme
Material's dark-theme guidance. These figures are from memory, because the page needs JavaScript and I couldn't read it:
- Avoid pure black.
- Show depth with lighter surfaces as layers rise, not shadows.
- Text opacity: about 87% for main text, 60% for secondary, 38% for disabled.
- Use softer, less saturated accent colors on dark backgrounds.
- Keep contrast at least 4.5:1.

Use neon only for the main action, focus and selection; a lot of glow makes everything compete. Define status colors once as named tokens (In game / Online / Away / Offline) and pair each with a shape or icon, so status doesn't rely on color alone.

### Sources
- Discord Connections: https://support.discord.com/hc/articles/8063233404823
- Discord, "Display on Profile" default feedback: https://support.discord.com/hc/ja/community/posts/360037371852-On-Connections-the-Display-on-Profile-option-ideally-shouldn-t-be-on-by-default
- Discord Account Switcher: https://support.discord.com/hc/en-us/articles/4412732047127-Discord-Account-Switcher-FAQ
- Discord Developer Mode path: https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID
- Discord user object fields: https://docs.discord.com/developers/resources/user
- Medal sign-up: https://support.medal.tv/support/solutions/articles/48001147502-making-an-account-with-medal
- Medal, connect Steam: https://support.medal.tv/support/solutions/articles/48001159644-how-to-connect-your-steam-account-to-medal
- Medal, connect Riot: https://support.medal.tv/support/solutions/articles/48001194797-how-to-connect-your-riot-account-to-medal
- EA connected accounts: https://help.ea.com/en/help/pc/link-ea-and-steam/
- Riot account page: https://support.riotgames.com/en-us/riot/account/managing-your-riot-account
- Riot QR login: https://support.riotgames.com/riot/account/logging-into-the-riot-client-with-a-qr-code
- Riot social sign-in: https://support.riotgames.com/en-us/riot/account/social-sign-in-faq
- Riot League Identity: https://www.ginx.tv/en/riot-reveals-new-league-identity-customization-system-for-league-of-legends
- Riot login screens: https://riftfeed.gg/more/league-of-legends-riot-wants-to-bring-back-iconic-login-screens
- Epic account creation: https://www.epicgames.com/help/c-1/a202300000018101?lang=en-US
- Steam QR login: https://windowscentral.com/gaming/pc-gaming/valve-revamps-steam-mobile-app-with-qr-code-logins-and-more-cool-stuff
- Battle.net 2.0 redesign: https://www.pcgamer.com/uk/battlenet-just-got-a-total-makeover
- Ubisoft Connect redesign: https://news.ubisoft.com/en-us/article/45npDyJWSNathaIDK3gvLp/the-next-evolution-of-ubisoft-connect-is-here
- GOG Galaxy integrations: https://www.howtogeek.com/664490/how-to-consolidate-your-pc-games-with-gog-galaxy/
- Playnite first start: https://api.playnite.link/docs/manual/gettingStarted/firstStart.html
- Overwolf login guidelines: https://dev.overwolf.com/ow-electron/guides/product-guidelines/onboarding/user-login-experience/
- Overwolf first-time use: https://dev.overwolf.com/ow-electron/guides/product-guidelines/onboarding/ftue/
- Overwolf empty states: https://dev.overwolf.com/ow-native/guides/product-guidelines/informing-users/empty-states/
- Overwolf desktop screens: https://dev.overwolf.com/ow-electron/guides/product-guidelines/app-screen-behavior/desktop-scrreens/
- Blitz homepage (auto-detection pitch): https://blitz.gg
- Steam IPlayerService API: https://partner.steamgames.com/doc/webapi/IPlayerService
- Steam privacy settings article: https://www.gamingonlinux.com/2018/04/steam-revamps-profile-privacy-settings-steam-spy-no-longer-able-to-operate
- Steam profile elements: https://www.slashgear.com/1531940/ways-to-customize-your-steam-profile
- PS5 profile editing: https://digistatement.com/how-to-add-a-custom-cover-image-to-your-ps5-profile/
- psn-api README: https://cdn.jsdelivr.net/npm/psn-api@2.18.0/README.md
- RFC 8252: https://datatracker.ietf.org/doc/html/rfc8252
- Electron deep links: https://www.electronjs.org/ru/docs/latest/tutorial/launch-app-from-url-in-another-app
- Electron safeStorage: https://www.electronjs.org/docs/api/safe-storage
- Jakob Nielsen, progressive disclosure: https://jakobnielsenphd.substack.com/p/progressive-disclosure
- Android settings guidelines: https://developer.android.com/design/ui/mobile/guides/patterns/settings
- setproduct, settings UI: https://setproduct.com/blog/settings-ui-design
- UXtweak, checkbox vs switch: https://blog.uxtweak.com/checkbox-vs-toggle-switch/
- saasui.design, API key patterns: https://www.saasui.design/blog/saas-api-keys-tokens-ux-patterns
- Material dark theme: https://m2.material.io/design/color/dark-theme

**Dribbble (not viewed; for browsing only):**
- https://dribbble.com/search/gamer-profile
- https://dribbble.com/tags/game%20profile
- https://dribbble.com/shots/5921167-Gamer-s-Profile-UI
- https://dribbble.com/shots/6966807-User-Profile-Gaming-App
- https://dribbble.com/shots/24734911-Account-Profile-Page-Dark-mode
- https://dribbble.com/shots/6838935-Profile-Settings-Dark-Mode
- https://dribbble.com/shots/5096102-Game-Launcher
- https://dribbble.com/shots/20280888-Simple-Login-view-for-Game-Planet
- https://dribbble.com/tags/desktop-login
- https://dribbble.com/tags/connect%20account
- https://dribbble.com/search/settings-page
- https://dribbble.com/tags/dark_settings
- https://dribbble.com/tags/gaming-dashboard