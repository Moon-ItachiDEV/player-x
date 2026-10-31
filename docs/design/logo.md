# Logo de Player X — « La croix »

Choisi par Breezydev le 30 octobre 2026, après une exploration à trois directions (canvas Design « Player X — refonte du
logo »), avec la même méthode que la refonte du logo de Waxseal. Arrivé dans la 0.9.7-beta.7 sur une tuile claire ;
depuis la 0.9.7-beta.9, sur une **tuile sombre** (retour de Breezydev le 31/10 : la tuile blanche et son liseré gris
faisaient un « cadre blanc » dans la barre des tâches claire).

## L'idée
La croix directionnelle d'une manette, tournée de 45°, devient le X de Player X : un seul signe qui dit « jeu » et le nom.
Elle est en matière braise (dégradé `#FF8A80 → #FB4F7A → #E0207E`, tranche magenta `#A30B58`), avec quatre flèches en
verre et un moyeu creusé. Elle est posée sur une tuile prune sombre qui va jusqu'au bord (`#35283F → #201829 → #150F1A`,
sans bord gris), avec un liseré clair seulement en haut (blanc à 17–18 %) pour rester visible sur une barre sombre, et une
lueur braise douce sous la croix en grand. La tuile est dans le monde de l'appli (fond `#0c0a11`, barre `#131019`).

Le logo « Player X » écrit « Player » en Sora 800 (la police de l'appli, en contours) et met la même croix, en verre
braise, à la place du X. Il n'a pas changé avec la tuile sombre.

## Fichiers (`resources/brand/`)
| Fichier | Usage |
| --- | --- |
| `player-x-icone.svg` | Icône de référence, grille macOS (tuile de 100 à 924, ombre douce). |
| `player-x-icone-windows.svg` | Icône Windows de 40 à 256 px : tuile de 40 à 984, sans ombre extérieure. |
| `player-x-icone-32.svg` | Version simplifiée pour 24 à 40 px, calée au pixel : croix de 18 px sur 24, arête claire, moyeu, sans flèches. |
| `player-x-icone-16.svg` | Version simplifiée pour 16 à 20 px, calée au pixel : croix de 12 px sur 16. |
| `player-x-logo.svg` | Logo « Player X » sur fond sombre. |
| `player-x-logo-clair.svg`, `-verre.svg` | Logo sur fond clair ; tout en verre, pour un fond coloré. |
| `player-x-logo-petit.svg` | Logo simplifié sous 30 px de haut (croix pleine, sans flèches). |

`px-mark.png` et `player-x-wordmark-source.png` sont les anciens logos (PX violet et cyan), gardés pour mémoire. Les modes
macOS de la beta.7 (tuile claire, sombre, teinté, verre) ont été retirés : Player X est une appli Windows.

## Quelle version pour quelle taille
- **16 et 20 px** (zone de notification, `tray.png`, `tray@1.25x.png`, cadres 16/20 du `.ico`) : `player-x-icone-16.svg`.
- **24 à 40 px** (barre des tâches, `tray@1.5x.png`, `tray@2x.png`, cadres 24/32/40 du `.ico`, barre du haut de l'appli) : `player-x-icone-32.svg`.
- **48 px et plus** (`.ico` 48 à 256, `icon.png`, `px-icon.png`, écran de bienvenue, Quoi de neuf, À propos) : `player-x-icone-windows.svg`.
- Logo : `player-x-logo-petit.svg` jusqu'à 30 px de haut (barre du haut à 23 px, première connexion), `player-x-logo.svg` au-dessus (écran de connexion à 30 px et plus).

## Règles
- Jamais de tuile blanche ni de bord gris autour de la croix : sur une barre des tâches claire, ça fait un cadre pâle.
- Ne jamais mettre la croix en blanc sur une tuile braise : en petit, ça se lit comme un bouton « fermer ».
- Ne pas recolorer la croix ni la tuile ; les autres couleurs de l'appli (cyan « en jeu », lavande, or) restent hors du logo.
- Dans l'appli, l'icône et le logo vont ensemble dans la barre du haut ; l'icône a alors `alt=""` (le nom n'est pas lu deux fois).
- Sous 1180 px de large, la barre du haut cache le logo et garde l'icône.
- Piste écartée le 31/10 : la croix seule, sans tuile. En 16 px dans la zone de notification, sans place pour les
  flèches, elle se lisait trop comme une croix d'erreur de Windows.

## Comment les fichiers ont été produits
Les SVG ont été dessinés à la main (formes, dégradés, masques et flous `feGaussianBlur`, sans texte ni image), puis rendus
par Chromium (le moteur de l'appli) aux tailles exactes. Le `.ico` regroupe un rendu par taille (pas une seule image
réduite). L'icône des deux exécutables sur mesure (`installer/rsrc_windows_amd64.syso` et
`installer/cmd/update/rsrc_windows_amd64.syso`) est remplacée image par image dans leur section `.rsrc`, sans toucher au
manifeste ni aux informations de version. Chaque version a été jugée posée dans une vraie capture de la barre des tâches
de Breezydev (Windows clair, 100 %), puis sur une barre sombre et dans la zone de notification.
