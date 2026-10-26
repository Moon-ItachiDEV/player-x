# Site de Player X (landing)

Site statique, sans build obligatoire, prêt pour Netlify.

- `public/` : ce qui est publié (index.html, assets/v2/ : CSS, JS, polices woff2, captures AVIF/WebP).
- `src/` : sources du CSS. `public/assets/v2/css/site.css` = `src/fonts.css` + `src/tokens-app.css` + `src/v2.css` mis bout à bout : à refaire après une modification
  (`cat src/fonts.css src/tokens-app.css src/v2.css > public/assets/v2/css/site.css`), puis passer à `assets/v3/` pour casser le cache d'un an.
- `version.mjs` : lancé par Netlify au déploiement, écrit la version de la dernière release GitHub dans `public/index.html` (garde la valeur écrite si GitHub ne répond pas).
- `../netlify.toml` (à la racine du dépôt, pour que Netlify le trouve sans réglage) : base `site`, publie `public/`, cache d'un an sur `/assets/*`, CSP sans tiers, `/telecharger` → dernière release GitHub.

Netlify : nouveau site depuis ce dépôt, rien à régler (le `netlify.toml` de la racine donne la base `site` et le dossier publié). Pour mettre la version à jour à chaque release, ajouter un « build hook » Netlify appelé après la publication.

Captures : celles de Breezydev (Accueil, Bibliothèque, Stats BF6, Trophées, Actus, À propos, Paramètres › Overlay). Une fonction sans capture n'est pas présentée sur le site.
