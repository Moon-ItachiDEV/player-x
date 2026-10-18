1. Scope: P1 is about three passes of work. Move these to P2: the Profile page, Onboarding, the login mosaic animation (keep a static grid), the rail recent games, the 72px collapsed friends mode and the SecretField "Tester" button. Onboarding step 2 can't really work anyway, because only Steam can be connected from there: Discord needs a developer app and PSN needs an NPSSO token, and both are only entered in Avancé.
2. Every `<img>` (cover, hero, logo, avatar) needs an `onError` fallback to the generated cover or the initial, and its skeleton must stop on error. The spec only covers "no URL". `artwork.ts` emits legacy `LEGACY_CDN` URLs that return 404 for Steam games released from 2024 on, and every image fails when the PC is offline.
3. Art is not Steam-only. `artwork.ts` matches Epic/EA games to Steam appids by name, so they often have a cover and hero. The renderer must not build CDN URLs from `storeId`: the hero logo built from `storeId` is wrong for Epic/EA and returns 404 for new Steam games. Resolve an optional `logoUrl` in the main-process artwork cache, or use the text title in P1.
4. `lastPlayed` and `launches` only count launches made through Plateforme Gaming (`recordLaunch`). Rename "Joué il y a" / "DERNIÈRE SESSION" to "Lancé il y a" / "DERNIER LANCEMENT". Also define the hero when no game has `lastPlayed`, which is every fresh install: first favorite with a `heroUrl`, else first game with a `heroUrl`, else hide the hero. "Same logic as today" doesn't cover this case.
5. Login: remove "Continuer avec Discord". Discord needs a client ID and secret that can only be entered after login, so on a first run it is always a disabled button. Login should be Steam, "Continuer sans compte" and the demo link.
6. The waiting-state "Annuler" must call a new `cancelLogin` IPC that closes the 127.0.0.1:47823 callback server. Otherwise the server stays bound until the `auth.ts` timeout and the next login attempt fails with EADDRINUSE.
7. Fix contrast:
   - `--text-3` `#7A8099` is 4.48:1 on `--surface-1` and 4.14:1 on `--surface-2`, where it is used for card captions, kbd and monograms. Change it to `#8A90A8` (5.5:1 and 5.1:1).
   - White on `--accent-solid-hover` `#7A5CF6` is 4.48:1. Use `#6A4BEA` (5.5:1).
   - White on danger hover `#E5485B` is 3.88:1. Use `#C93446` (5.2:1).
   - The game sheet "ID" footer uses `--text-4` (2.3:1), which contradicts "disabled only". Use `--text-3`.
8. Two search fields do the same job in P1: the top-bar trigger only focuses the toolbar's "Filtrer…" input. Make the top-bar field a real input bound to the library filter (it switches to Bibliothèque), drop the toolbar filter input, and have Ctrl+F and Ctrl+K both focus it.
9. Friends panel state is underspecified: three modes, auto-collapse below 1200px, a top-bar toggle, a Settings segmented control, and no defined way out of "Masqué". Use one stored mode in `pg.ui`. The top-bar button always opens the panel from hidden or collapsed. Auto-collapse applies only when no preference is stored.
10. Discord data is not friends. The widget returns online members of one server, and `friends.ts` marks any activity (Spotify, custom status…) as `in-game`. Label the filter "Serveur Discord", group a Discord member under EN JEU only when their activity matches a library game (otherwise "En ligne · {activité}"), and say "membres en ligne", not "amis".
11. Settings removes the global "Enregistrer" but only defines save behavior for SecretField. Plain fields ("Client ID", "ID du serveur (widget)") need the same rule: a dirty-state save button plus Enter or blur to save.
12. Friend-to-game matching: move `norm()` from `artwork.ts` to `src/shared` and reuse it. It removes ™®©, edition suffixes, accents and punctuation; the spec's trim plus ™/® removal will miss Steam `gameextrainfo` and Epic/EA name variants.
13. The generated cover is only specified at 2:3. Add three variants:
    - 16:9 with the title, for the shelf tile, the hero and the sheet header;
    - letter only, for the 40px rail tile and the 18px friend-group mini cover;
    - gradient only, for the profile banner.
    Test every screen with a library that is 100% Epic/EA without art and has 0 launches.
14. Title bar:
    - Pad the top bar with `env(titlebar-area-x)` / `env(titlebar-area-width)` instead of a hard-coded 144px, so it survives Windows display scaling.
    - Guard `titleBarOverlay` with `process.platform === 'win32'`.
    - Remove the top bar from the `backdrop-filter` list in 1C. Nothing scrolls under it, and 3.4 already makes it solid `--bg-0`.
15. Fonts:
    - Bundle `@fontsource-variable/inter` and `@fontsource-variable/sora` in dev and in the packaged build, and delete the Google Fonts `<link>`. With one path, dev and the .exe render the same.
    - Set CSP to `font-src 'self' data:` and remove googleapis from `style-src`.
    - Inject the version with a Vite `define` rather than importing `package.json` into the renderer.