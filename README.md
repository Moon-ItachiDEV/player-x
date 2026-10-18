# Plateforme Gaming (prototype)

Launcher de bureau qui regroupe tes jeux **Steam, Epic Games et EA** et montre **quels amis sont en ligne** (Steam, PlayStation, serveur Discord).

![Bibliothèque en mode démo](docs/demo.png)

## Lancer le prototype

Prérequis : [Node.js 22+](https://nodejs.org) sous Windows (le scan de jeux vise Windows ; macOS/Linux ne détectent que Steam).

```bash
npm install
npm run dev
```

Sur l’écran d’accueil, **Essayer en mode démo** remplit l’interface avec des jeux et amis fictifs, sans aucune configuration.

Pour un installeur Windows : `npm run dist` (sortie dans `dist/`).

## Ce qui marche

| Fonction | Comment |
|---|---|
| Jeux Steam | Lit `libraryfolders.vdf` et les `appmanifest_*.acf` de toutes tes bibliothèques. Jaquettes depuis le CDN Steam. |
| Jeux Epic | Lit les manifestes `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item`. |
| Jeux EA (expérimental) | Cherche `__Installer\installerdata.xml` dans `Program Files\EA Games` et `Origin Games`. |
| Lancer un jeu | Passe par le client officiel (`steam://`, `com.epicgames.launcher://`, `origin2://`), qui gère DRM et mises à jour. |
| Login Steam | OpenID Steam dans ton navigateur, signature vérifiée auprès de Steam. |
| Login Discord | OAuth2 (`identify`) dans ton navigateur. |
| Amis Steam | Steam Web API (clé gratuite, liste d’amis publique requise). |
| Amis PlayStation | Non officiel, via [`psn-api`](https://github.com/achievements-app/psn-api) et ton jeton NPSSO. Peut casser sans prévenir. |
| Discord | Discord ne donne pas la liste d’amis aux applis tierces. On affiche à la place les membres en ligne d’un serveur dont le **widget** est activé. |
| Favoris, dernière session | Stockés en local. |

## Configuration

Tout se règle dans **Paramètres** de l’appli (ou dans un fichier `.env`, voir `.env.example`) :

- **Clé Steam Web API** : https://steamcommunity.com/dev/apikey
- **Discord** : crée une appli sur https://discord.com/developers/applications, copie Client ID et Client Secret, et ajoute la redirection `http://127.0.0.1:47823/discord/callback` dans OAuth2.
- **Serveur Discord** : ID du serveur (clic droit > Copier l’identifiant, en mode développeur) avec le widget activé.
- **PlayStation** : connecte-toi sur playstation.com puis ouvre https://ca.account.sony.com/api/v1/ssocookie et copie la valeur `npsso`.

## Choix techniques

- **Electron + React + Vite + TypeScript** plutôt que Next.js : un launcher doit lire le disque et lancer des programmes, ce qu’une appli web ne peut pas faire.
- **Base de données** : SQLite locale via `sql.js` (WebAssembly, rien à compiler sous Windows), dans le dossier de données de l’appli. Pas de serveur pour l’instant : il deviendra utile pour des comptes partagés entre appareils ou des fonctions sociales.
- **Secrets** (clés, jetons, comptes) chiffrés avec `safeStorage` (DPAPI sous Windows).

```
src/
  main/        processus Electron : base SQLite, scan des jeux, logins, amis
    services/  games.ts, auth.ts, friends.ts, settings.ts, demo.ts
  preload/     pont sécurisé main ↔ interface
  renderer/    interface React
  shared/      types communs
```
