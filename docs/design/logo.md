# Logo de Player X — « La croix »

Choisi par Breezydev le 30 octobre 2026, après une exploration à trois directions (canvas Design « Player X — refonte du
logo »), avec la même méthode que la refonte du logo de Waxseal. Arrivé dans la 0.9.7-beta.7 sur une tuile claire.
Depuis la 0.9.7-beta.9, la croix est **sans tuile** : retour de Breezydev le 31/10, la tuile blanche et son liseré gris
faisaient un « cadre blanc » dans sa barre des tâches claire ; entre une tuile sombre et la croix seule, il a choisi la
croix seule (« c'est plus propre »).

## L'idée
La croix directionnelle d'une manette, tournée de 45°, devient le X de Player X : un seul signe qui dit « jeu » et le nom.
Elle est seule, en relief, et remplit sa case comme les icônes de Windows 11 : matière braise (dégradé
`#FF8A80 → #FB4F7A → #E0207E`), tranche magenta en bas (`#D9306F → #8A0A4E` en grand, `#A30B58` en petit), arête claire
en haut, quatre flèches en verre et un moyeu creusé. En grand, un filet braise fin marque le haut des bras (pour les fonds
blancs) et une ombre de contact douce la pose (dans la référence de marque seulement).

Le logo « Player X » écrit « Player » en Sora 800 (la police de l'appli, en contours) et met la même croix à la place du X.
Dans l'appli, il est composé de deux images : les lettres (`px-logo-lettres.svg`) et l'icône elle-même, posée à la place
du X (`BrandWordmark` dans `components/ui/Brand.tsx`).

## Fichiers (`resources/brand/`)
| Fichier | Usage |
| --- | --- |
| `player-x-icone.svg` | Icône de référence, grille macOS (croix de 100 à 924, ombre de contact douce). |
| `player-x-icone-windows.svg` | Icône Windows de 40 à 256 px : croix de 40 à 984, sans ombre extérieure. |
| `player-x-icone-32.svg` | Version simplifiée pour 24 à 40 px, calée au pixel : croix de 20 px sur 24, flèches en verre, moyeu de 2 × 2 px. |
| `player-x-icone-16.svg` | Version simplifiée pour 16 à 22 px, calée au pixel : croix de 13 px sur 16, moyeu d'un pixel, sans flèches. |
| `player-x-logo.svg` | Logo « Player X » sur fond sombre. |
| `player-x-logo-clair.svg`, `-verre.svg` | Logo sur fond clair ; tout en verre, pour un fond coloré. |
| `player-x-logo-petit.svg` | Logo simplifié sous 30 px de haut (croix pleine, sans flèches) ; ses proportions servent à poser la croix dans le logo de l'appli. |

`px-mark.png` et `player-x-wordmark-source.png` sont les anciens logos (PX violet et cyan), gardés pour mémoire.

## Quelle version pour quelle taille
- **16 et 20 px** (zone de notification, `tray.png`, `tray@1.25x.png`, cadres 16/20 du `.ico`) : `player-x-icone-16.svg`.
- **24 à 40 px** (barre des tâches, `tray@1.5x.png`, `tray@2x.png`, cadres 24/32/40 du `.ico`, croix seule de la barre du haut en fenêtre étroite) : `player-x-icone-32.svg`.
- **48 px et plus** (`.ico` 48 à 256, `icon.png`, `px-icon.png`, bienvenue, Quoi de neuf, À propos, installeur, fenêtre de mise à jour) : `player-x-icone-windows.svg`.
- **Dans le logo** : la croix reste pleine (`player-x-icone-16.svg`) jusqu'à 34 px, les flèches moucheteraient le mot ; au-delà, la croix complète.

## Règles
- Pas de tuile autour de la croix : ni blanche (cadre pâle sur une barre claire), ni sombre.
- Ne jamais mettre la croix en blanc sur du braise : en petit, ça se lit comme un bouton « fermer ».
- Ne pas recolorer la croix ; les autres couleurs de l'appli (cyan « en jeu », lavande, or) restent hors du logo.
- Barre du haut : le logo seul (sa croix est l'icône, jamais deux croix côte à côte). Sous 1180 px de large, la croix seule
  (`.tb-brand-compact`, 24 px). L'animation de retour d'une mise à jour pose l'icône sur la première croix visible de la
  barre, à l'échelle de la croix (attribut `data-fill`) et non de son cadre.
- Connexion et première connexion : le logo seul (34 et 26 px de haut).
- Risque connu : à 16 px dans la zone de notification, sans place pour les flèches, la croix rose est plus proche d'une
  croix d'erreur de Windows ; le moyeu et la tranche l'en distinguent. Piste écartée le 31/10 : la tuile sombre.

## Comment les fichiers ont été produits
Les SVG ont été dessinés à la main (formes, dégradés, masques et flous `feGaussianBlur`, sans texte ni image), puis rendus
par Chromium (le moteur de l'appli) aux tailles exactes. Le `.ico` regroupe un rendu par taille (pas une seule image
réduite). L'icône des deux exécutables sur mesure (`installer/rsrc_windows_amd64.syso` et
`installer/cmd/update/rsrc_windows_amd64.syso`) est remplacée image par image dans leur section `.rsrc`, sans toucher au
manifeste ni aux informations de version. Chaque version a été jugée posée dans une vraie capture de la barre des tâches
de Breezydev (Windows clair, 100 %), puis sur une barre sombre et dans la zone de notification.
