# Player X: redesign brief for screen implementers

You implement ONE screen of the Player X desktop launcher, a redesign of the "Plateforme Gaming" prototype. Repo: `/home/claude/plateforme-gaming` (Electron 44 + electron-vite + React 19 + TypeScript, plain CSS, no UI library).

## Read first
1. Design spec: `docs/design/spec.md`. Read only the sections for your screen, plus 2, 4.1, 5 and 6.
2. Critique: `docs/design/critique.md`. Its amendments override the spec.
3. Already-built foundation. Read these and reuse them; do NOT edit them:
   - `src/renderer/src/contracts.ts`: the exact props your component receives. You must export a component with the documented name and props.
   - `src/renderer/src/styles/tokens.css`: the color, spacing and motion tokens. Use the variables, never raw hex, except where these rules allow it.
   - `src/renderer/src/styles/base.css`: shared classes for buttons, inputs, chips, menus, dialogs, toasts and other common pieces (full list below).
   - `src/renderer/src/components/ui/`:
     - `Icon.tsx`: `<Icon name=... size filled/>`
     - `StoreTag.tsx`: `<StoreTag kind long size/>`, plus `KIND_LABEL` and `STORE_LONG`
     - `Cover.tsx`: `<Cover game variant='portrait'|'landscape'|'letter'|'banner'/>`, with an image fallback to a generated gradient and fade-in. Give each Cover `key={game.id}`.
     - `Avatar.tsx`: `<Avatar name url size status/>`. The status shape is built in. Set the CSS var `--cut` on a parent to the background color behind the avatar.
     - `Overlay.tsx`: `Menu`, `Dialog`, `Segmented`, `Switch`, `useEscape`, `useDismiss`
     - `Toasts.tsx`: `useToast()`, `errorMessage(e)`
     - `Brand.tsx`: `<BrandMark height/>` (the PX logo image) and `<BrandWordmark size/>` (the text "PLAYER X")
   - `src/shared/text.ts`: `cleanName`, `norm` (use it to match a friend's game to a library game: `norm(friend.game) === norm(game.name)`), `hue`, `timeAgo` (returns lowercase "il y a 2 h"), `formatDate`, `capitalize`, `plural`
   - `src/shared/types.ts`: the `Game`, `Friend`, `Account`, `Settings`, `ScanReport` and `FriendsResult` types
   - `window.launcher`: the IPC API, typed by `LauncherApi` in types.ts. Most screens only use props. Settings and Login may call `window.launcher` for small things such as `openExternal`.
   - `src/renderer/src/App.tsx`: how your component is mounted. Do not edit it.

**Shared classes in base.css:**
- Buttons: `.btn` with `.btn-primary`, `.btn-secondary`, `.btn-ghost` or `.btn-danger`; sizes `.btn-sm`, `.btn-lg` and `.btn-block`; `.btn-play` (the JOUER button, add `.is-launching` while launching); `.icon-btn` and `.icon-btn-sm`; `.link-btn` and `.link-btn.muted`
- Forms and filters: `.input`, `.chip` (with `.active`, `.chip-count` and `.chip-dot`), `.seg`, `.switch`
- Pills: `.pill` with `.pill-success`, `.pill-muted`, `.pill-warning`, `.pill-danger`, `.pill-live` or `.pill-outline-warning`
- Store tags: `.store-tag` and `.tint-<kind>` (the StoreTag component uses these)
- Surfaces and text: `.card-surface`, `.overline`, `.caption`, `.display-l`, `.num` (tabular numbers)
- Loading: `.skel` (shimmer), `.spinner` and `.spinner.lg`, `.spin`
- Menus: `.menu`, `.menu-item` (add `.accent` for the accent color), `.menu-sep`
- Dialogs: `.dialog-scrim`, `.dialog`, `.dialog-actions`
- Empty states: `.empty-state`, `.empty-icon`, `.empty-actions`
- Text: `kbd`, `code`, `.brand-wordmark`

Shell layout CSS lives in `styles/shell.css`. Its `.page` class gives the standard page padding.

## Product decisions (they override the spec)
- The app is now called **Player X**. Its brand colors are violet `#7C3AED` → cyan `#22D3EE`, from the PX logo. tokens.css already encodes this: `--accent`, `--accent-solid`, `--brand-gradient` and `--live`. Use the tokens, not the spec's `#8B6CFF`.
- All user-facing copy is **French** and uses "tu". Never write "Plateforme Gaming"; write "Player X".
- `lastPlayed` is the last play (since 0.7.4): the most recent of a launch through Player X, a session Player X saw running, and Steam's `rtime_last_played`, with `lastPlayedSource` saying which one (`src/shared/played.ts`). It is merged at read time and never written back. `launches` only counts launches made through Player X. Use these wordings:
  - "DERNIÈRE PARTIE", with the source as caption ("lancé depuis Player X", "vu en jeu par Player X", "selon Steam")
  - "Lancé …" only when the source is a Player X launch, "Joué …" otherwise; badges in sentence form: `capitalize(timeAgo(ts))`, e.g. "Il y a 2 h"
  - never "Jamais" next to a playtime; with no date, hide the field or show "—"
  - a "Lancements" figure only when it is above 0
- Do not build Steam logo-image URLs. Titles are always text (Sora).
- Show no fake data: no playtime, achievements or ranks. Hide anything that is unknown.
- **Out of scope** (do not build): onboarding, command palette, library list view, recent games in the rail, the 72px collapsed friends mode, the SecretField "Tester" button, right-click menus, friend hover cards. A static or slowly drifting login mosaic is fine.
- Friends panel modes are open or hidden only. The top-bar button toggles them.
- Discord data is the online members of one server, not friends. Label it "Serveur Discord".
- Login offers only: "Continuer avec Steam", "Continuer sans compte", and "Essayer le mode démo". There is no Discord button.
- Settings has no global Enregistrer button:
  - Switches and segmented controls save instantly.
  - Text and secret fields show a small "Enregistrer" button only while dirty. Enter also saves.

## Engineering rules
- **Edit only the files you own** (listed in your task). Create your own CSS file next to your component, import it from the component, and prefix your class names with your screen (for example `.lib-`, `.sheet-`, `.fr-`, `.rail-`, `.tb-`, `.acc-`, `.prof-`, `.set-`, `.login-`) to avoid collisions.
- If you need a helper, define it inside your own files. If a shared primitive is missing, build it locally in your files.
- Keep components readable: small subcomponents in the same file are fine. Use the existing code style: 2 spaces, single quotes, no semicolons, short French comments only where useful.
- Persist per-PC UI conveniences (collapsed sections, sort) in localStorage under a `pg.` key, wrapped in try/catch.
- Accessibility:
  - Every icon-only button has a French `aria-label` and `title`.
  - Focus is visible through the global `:focus-visible`.
  - Status is never shown by color alone.
- Respect the motion rules in spec section 5: transform and opacity only, 420ms maximum.
- **Verify:** run `cd /home/claude/plateforme-gaming && npx tsc --noEmit -p tsconfig.json`. Other screens are being written in parallel, so ignore errors in files you don't own. Your own files must have zero errors. Do NOT run `electron-vite build`, `npm install`, electron or git, and do not touch `out/`.
- When done, reply with: the files you created, the props you used, and anything you could not do or that another screen should know about. Keep it to 15 lines or fewer.
