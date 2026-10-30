# Logo de Player X — « La croix »

Choisi par Breezydev le 30 octobre 2026, après une exploration à trois directions (canvas Design « Player X — refonte du
logo »), avec la même méthode que la refonte du logo de Waxseal. Arrive dans la 0.9.7-beta.7.

## L'idée
La croix directionnelle d'une manette, tournée de 45°, devient le X de Player X : un seul signe qui dit « jeu » et le nom.
Elle est en matière braise (dégradé `#FF8A80 → #FB4F7A → #E0207E`, tranche magenta), avec quatre flèches en verre et un
centre creusé, posée sur une tuile claire au liseré rosé. Langage des icônes iOS 27 / macOS 27 : tuile à coins continus,
matière douce, parties en verre.

Le logo « Player X » écrit « Player » en Sora 800 (la police de l'appli, en contours) et met la même croix, en verre
braise, à la place du X.

## Fichiers (`resources/brand/`)
| Fichier | Usage |
| --- | --- |
| `player-x-icone.svg` | Icône de référence, mode clair, grille macOS (tuile de 100 à 924, ombre douce). |
| `player-x-icone-sombre.svg`, `-teinte.svg`, `-verre.svg` | Modes d'apparence : tuile sombre ; monochrome (gris seulement) ; verre translucide. |
| `player-x-icone-windows.svg` | Icône Windows de 40 à 256 px : tuile agrandie (40 → 984), sans ombre extérieure. |
| `player-x-icone-32.svg` | Version simplifiée pour 24 à 40 px, calée au pixel. |
| `player-x-icone-16.svg` | Version simplifiée pour 16 à 20 px, calée au pixel, sans creux central. |
| `player-x-logo.svg` | Logo « Player X » sur fond sombre. |
| `player-x-logo-clair.svg`, `-verre.svg` | Logo sur fond clair ; tout en verre, pour un fond coloré. |
| `player-x-logo-petit.svg` | Logo simplifié sous 30 px de haut (croix pleine, sans flèches). |

`px-mark.png` et `player-x-wordmark-source.png` sont les anciens logos (PX violet et cyan), gardés pour mémoire.

## Quelle version pour quelle taille
- **16 et 20 px** (zone de notification, `tray.png`, `tray@1.25x.png`, cadre 16/20 du `.ico`) : `player-x-icone-16.svg`.
- **24 à 40 px** (barre des tâches, `tray@1.5x.png`, `tray@2x.png`, cadres 24/32/40 du `.ico`, barre du haut de l'appli) : `player-x-icone-32.svg`.
- **48 px et plus** (`.ico` 48 à 256, `icon.png`, `px-icon.png`, écran de bienvenue, Quoi de neuf, À propos) : `player-x-icone-windows.svg`.
- Logo : `player-x-logo-petit.svg` jusqu'à 30 px de haut (barre du haut à 23 px, première connexion), `player-x-logo.svg` au-dessus (écran de connexion à 30 px et plus).

## Règles
- Ne jamais mettre la croix en blanc sur une tuile braise : en petit, ça se lit comme un bouton « fermer ».
- Ne pas recolorer la croix ni la tuile ; les autres couleurs de l'appli (cyan « en jeu », lavande, or) restent hors du logo.
- Dans l'appli, l'icône et le logo vont ensemble dans la barre du haut ; l'icône a alors `alt=""` (le nom n'est pas lu deux fois).
- Sous 1180 px de large, la barre du haut cache le logo et garde l'icône.

## Comment les fichiers ont été produits
Les SVG ont été dessinés à la main (formes, dégradés, masques et flous `feGaussianBlur`, sans texte ni image), puis rendus
par Chromium (le moteur de l'appli) aux tailles exactes. Le `.ico` regroupe un rendu par taille (pas une seule image
réduite). L'icône des deux exécutables sur mesure (`installer/rsrc_windows_amd64.syso` et
`installer/cmd/update/rsrc_windows_amd64.syso`) a été remplacée image par image dans leur section `.rsrc`, sans toucher au
manifeste ni aux informations de version.
