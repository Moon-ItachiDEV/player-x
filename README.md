# Player X (prototype)

Launcher de bureau qui regroupe tes jeux **Steam, Epic Games et EA**, compte ton **temps de jeu**, te prévient quand **tes amis se connectent** (Steam, PlayStation, serveur Discord) et suit ta **progression Battlefield 6**.

![Bibliothèque](docs/screenshots/bibliotheque.png)

> Les captures sont faites en mode démo : jeux, amis et joueurs fictifs, visuels de remplacement.

## Installer

- **Le plus simple :** télécharge `Player-X-Setup-<version>.exe` depuis les [Releases](https://github.com/Moon-ItachiDEV/player-x/releases/latest) et suis l’assistant. L’installeur n’est pas signé, donc Windows SmartScreen peut afficher « Windows a protégé votre ordinateur » : clique sur **Informations complémentaires** puis **Exécuter quand même**.
- **Depuis le code** (Node.js 22+ sous Windows ; le scan de jeux vise Windows, macOS et Linux ne détectent que Steam) :

```bash
npm install
npm run dev
```

Sur l’écran d’accueil, **Essayer le mode démo** remplit l’interface avec des jeux et des amis fictifs, sans aucune configuration.

Pour fabriquer l’installeur Windows : `npm run dist` (sortie dans `dist/`). Depuis Linux, il faut `wine64` et `wine32:i386`.

## Temps de jeu

![Fiche d'un jeu en cours](docs/screenshots/fiche-en-jeu.png)

Toutes les minutes, Player X regarde quels programmes tournent et les rattache au dossier d'installation de tes jeux : le temps compte aussi pour un jeu lancé hors du launcher, tant que Player X est ouvert (même réduit). Pour les jeux Steam, Player X reprend le compteur de Steam (tout ton historique) dès que ta clé Steam Web API est renseignée et que les détails de jeu de ton profil sont publics. Le jeu qui tourne porte une pastille cyan **En jeu**, et la bibliothèque se trie par **Plus joués**.

## Alertes d'amis

![Alertes d'amis](docs/screenshots/alertes-amis.png)

Quand un ami Steam ou PlayStation se connecte ou lance un jeu, une carte apparaît en haut à droite de Player X. Si la fenêtre est en arrière-plan, c'est une notification Windows (Windows les met de côté pendant un jeu en plein écran). Les membres d'un serveur Discord ne déclenchent pas d'alerte : ce ne sont pas des amis. Règle-les dans **Paramètres › Interface** : tout, seulement les jeux lancés, ou aucune, avec un bouton **Tester**.

## Stats de jeu : Battlefield 6

![Stats Battlefield 6](docs/screenshots/stats-bf6.png)

Cherche ton pseudo EA, Steam, PlayStation ou Xbox : la page montre ratio K/D, kills par minute, victoires, précision, temps de jeu, classe préférée, puis le détail par arme, véhicule, classe, mode et carte. Ajoute des **rivaux** pour comparer vos stats dans un classement entre amis.

![Détail par arme](docs/screenshots/stats-bf6-armes.png)

**Progression** : Player X garde un relevé de tes stats par jour (à chaque visite de la page, et en arrière-plan si le dernier date de plus de 20 heures) et trace ta courbe de K/D, d'éliminations par minute ou de victoires, sur 7 jours, 30 jours ou depuis le début, avec tes éliminations, tes parties et ton temps de jeu sur la période. Les relevés restent sur ton PC.

![Progression Battlefield 6](docs/screenshots/progression-bf6.png)

EA ne propose pas d’API publique pour Battlefield 6. Les chiffres viennent de [gametools.network](https://gametools.network), un service communautaire non officiel, sans clé : il peut être lent ou indisponible, et la recherche est limitée à environ une requête toutes les 30 secondes. Les stats sont gardées en cache 10 minutes, et la dernière lecture reste affichée hors ligne. Les visuels du jeu viennent de la page Steam de Battlefield 6.

## Profil

![Profil](docs/screenshots/profil.png)

Ton temps de jeu total, tes jeux les plus joués, tes jeux par plateforme et tes derniers lancements depuis Player X.

## Mises à jour

Player X vérifie les [GitHub Releases](https://github.com/Moon-ItachiDEV/player-x/releases) au démarrage puis toutes les 6 heures. Seule la version installée se met à jour, pas `npm run dev`.

1. **Téléchargement** en arrière-plan, avec la progression de 0 à 100 % dans un bandeau en bas de l’écran.

   ![Téléchargement de la mise à jour](docs/screenshots/maj-telechargement.png)

2. **Redémarrage automatique** au bout de 10 secondes. **Plus tard** annule : la mise à jour s’installe alors à la fermeture de Player X. Le compte à rebours ne tourne que si la fenêtre de Player X est au premier plan, pour ne jamais te couper en pleine partie.

   ![Mise à jour prête](docs/screenshots/maj-prete.png)

3. **Quoi de neuf** s’ouvre au premier lancement de la nouvelle version, avec les notes de `docs/release-notes/<version>.md`.

   ![Quoi de neuf](docs/screenshots/nouveautes.png)

**Les versions 0.3.0 et plus anciennes n’ont pas de mise à jour automatique** : installe une version 0.4 à la main une fois, les suivantes arriveront toutes seules. L’animation et le redémarrage automatique arrivent avec la 0.4.2 : ils s’affichent pour les mises à jour faites depuis cette version.

Pour publier une version :

1. Monte la version : `npm version 0.5.0 --no-git-tag-version` (met à jour `package.json` et `package-lock.json`).
2. Écris les notes dans `docs/release-notes/<version>.md` : elles servent à la fois pour la release GitHub et pour la fenêtre « Quoi de neuf ».
3. Commit et pousse sur `main`.
4. Lance l’action [`release.yml`](.github/workflows/release.yml) depuis l’onglet **Actions › Release › Run workflow** (elle crée le tag `v<version>`), ou pousse le tag toi-même : `git tag v0.5.0 && git push --tags`.

L’action construit l’installeur sous Windows et publie la release avec `Player-X-Setup-<version>.exe`, son `.blockmap` et `latest.yml` (le fichier que lit l’appli). Un tag poussé à la main doit correspondre à `version`, sinon l’action s’arrête.

## Ce qui marche

| Fonction | Comment |
|---|---|
| Jeux Steam | Lit `libraryfolders.vdf` et les `appmanifest_*.acf` de toutes tes bibliothèques (registre + disques C à H). |
| Jeux Epic | Lit les manifestes `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item`. |
| Jeux EA | Dossier d’installation de l’EA app, registre `EA Games` / `Electronic Arts`, entrées de désinstallation et `__Installer\installerdata.xml`. |
| Jaquettes | Steam : CDN Steam. EA et Epic : recherche du même jeu dans le catalogue Steam, mise en cache 7 jours. Sinon, une jaquette générée. |
| Lancer un jeu | Passe par le client officiel (`steam://`, `com.epicgames.launcher://`, `origin2://`), sinon lance l’exécutable trouvé. |
| Login Steam | OpenID Steam dans ton navigateur, signature vérifiée auprès de Steam. |
| Login Discord | OAuth2 (`identify`) dans ton navigateur, une fois l’application développeur renseignée. |
| Amis Steam | Steam Web API (clé gratuite, liste d’amis publique requise). |
| Amis PlayStation | Non officiel, via [`psn-api`](https://github.com/achievements-app/psn-api) et ton jeton NPSSO. Peut casser sans prévenir. |
| Discord | Discord ne donne pas la liste d’amis aux applis tierces. On affiche à la place les membres en ligne d’un serveur dont le **widget** est activé. |
| Temps de jeu | Processus en cours rattachés au dossier d’installation (Windows, PowerShell `Get-Process`), compteur Steam via `IPlayerService/GetOwnedGames`. |
| Alertes d’amis | Différence entre deux lectures de la liste d’amis ; carte dans l’appli ou notification Windows. |
| Stats Battlefield 6 | Non officiel, via [gametools.network](https://gametools.network). Recherche multi-plateforme, rivaux suivis, cache local, relevé quotidien pour la progression. |
| Profil | Jeux par plateforme, jeux les plus lancés et derniers lancements depuis Player X. |
| Mises à jour | `electron-updater` et GitHub Releases : progression, redémarrage après 10 s, fenêtre « Quoi de neuf ». |
| Favoris, historique | Stockés en local. |

## Configuration

Tout se règle dans **Paramètres** de l’appli (ou dans un fichier `.env`, voir `.env.example`) :

- **Clé Steam Web API** : https://steamcommunity.com/dev/apikey
- **Discord** : crée une appli sur https://discord.com/developers/applications, copie Client ID et Client Secret, et ajoute la redirection `http://127.0.0.1:47823/discord/callback` dans OAuth2.
- **Serveur Discord** : dans les paramètres du serveur, active « Activer le widget du serveur » et enregistre, puis copie l’« Identifiant du serveur » affiché en dessous (le lien « JSON API » marche aussi).
- **PlayStation** : connecte-toi sur playstation.com puis ouvre https://ca.account.sony.com/api/v1/ssocookie et copie la valeur `npsso`.
- **Battlefield 6** : rien à configurer, cherche ton pseudo dans **Stats de jeu**.

## Design

Direction « Nuit Néon » : fond graphite, violet comme seule couleur de marque, cyan réservé à « en jeu ». Titres en Sora, interface en Inter, logo PX et nom en Michroma. Les effets riches (survol, lueurs, animations) se coupent dans **Paramètres** et respectent « réduire les animations » du système. Inspirée de Blitz.gg, GOG Galaxy, Steam, Discord et de concepts Dribbble. La spec complète, la critique et les recherches sont dans [`docs/design/`](docs/design/).

## Choix techniques

- **Electron + React + Vite + TypeScript** plutôt que Next.js : un launcher doit lire le disque et lancer des programmes, ce qu’une appli web ne peut pas faire.
- **Base de données** : SQLite locale via `sql.js` (WebAssembly, rien à compiler sous Windows), dans le dossier de données de l’appli. Pas de serveur pour l’instant : il deviendra utile pour des comptes partagés entre appareils ou des fonctions sociales.
- **Secrets** (clés, jetons, comptes) chiffrés avec `safeStorage` (DPAPI sous Windows).
- **Réseau** : toutes les requêtes externes (Steam, PSN, Discord, gametools) passent par le processus principal, l’interface n’appelle jamais internet directement.
- **Styles** : CSS simple avec des variables (`styles/tokens.css`), sans bibliothèque d’interface. Polices embarquées, aucune requête vers Google Fonts.

```
src/
  main/          processus Electron : base SQLite, scan des jeux, logins, amis, stats
    services/    games.ts, artwork.ts, auth.ts, friends.ts, alerts.ts, playtime.ts, stats.ts, settings.ts, demo.ts, updater.ts
  preload/       pont sécurisé main ↔ interface
  renderer/src/
    components/  library/, friends/, stats/, settings/, setup/, ui/, GameSheet, Profile, Login, Rail, TopBar,
                 UpdateNotice (bandeau de mise à jour), WhatsNew (fenêtre « Quoi de neuf »), FriendAlerts (alertes d’amis)
    styles/      tokens.css, base.css, shell.css
  shared/        types et fonctions de texte communs
docs/
  release-notes/ notes de chaque version (release GitHub + « Quoi de neuf »)
  screenshots/   captures du README
  design/        spec et recherches de design
resources/       icône de l’appli et logos PX
```
