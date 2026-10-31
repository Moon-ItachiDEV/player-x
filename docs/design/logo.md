# Logo de Player X — « La console »

Choisi par Breezydev le 31 octobre 2026, après plusieurs concours d'agents (canvas Design « Redesign Player X logo ») :
retour à l'identité de la première icône (la manette en verre de la 0.9.0), sur un nouvel objet, en une seule teinte.
Arrive dans la 0.9.7-beta.9, à la place de « La croix » (0.9.7-beta.7).

## L'identité
- **Une tuile pleine** à coins continus (squircle de 0 à 1024), en **une seule teinte** travaillée ton sur ton, comme les
  icônes d'Apple de 2026 (référence de Breezydev : l'icône Podcasts) : rose braise clair en haut à gauche, plus profond en
  bas à droite, avec des cercles concentriques plus clairs de la même couleur. Pas de deuxième couleur.
- **Un objet en verre blanc**, teinté de rose, au premier plan : une console portable (deux coques, gâchettes en verre,
  deux sticks, grilles de haut-parleur, petits boutons, voyant), avec l'écran au centre qui montre un Play et une barre de
  progression.
- **La signature P-Play et X** : le P (son creux est un triangle Play) à la place de la croix directionnelle, le X à la
  place des boutons, en rose braise profond.

Teinte : rose braise, tirée de l'accent de l'interface (`--accent` `#FF5C86`, dégradé de marque `#FF8A80 → #E0207E`).

## Fichiers (`resources/brand/`)
| Fichier | Usage |
| --- | --- |
| `player-x-icone.svg` | Icône de référence, 48 px et plus (et `player-x-icone-windows.svg`, identique, pour le `.ico`). |
| `player-x-icone-32.svg` | Version simplifiée pour 24 à 40 px : tuile, console, P et X, sans reflets fins. |
| `player-x-icone-16.svg` | Version calée au pixel pour 16 à 22 px. |

Le nom « Player X » n'est plus un dessin : c'est du texte en Sora 700 (`BrandWordmark`, `--font-brand`), posé à côté de
l'icône. `px-mark.png` et `player-x-wordmark-source.png` sont les anciens logos (PX violet et cyan), gardés pour mémoire.

## Quelle version pour quelle taille
- **16 à 22 px** (zone de notification `tray.png`, `tray@1.25x.png`, cadres 16 et 20 du `.ico`) : `player-x-icone-16.svg`.
- **24 à 40 px** (barre des tâches, `tray@1.5x.png`, `tray@2x.png`, cadres 24, 32 et 40 du `.ico`, icône de la barre du haut) :
  `player-x-icone-32.svg`.
- **48 px et plus** (`.ico` 48 à 256, `icon.png`, `px-icon.png`, bienvenue, Quoi de neuf, À propos, installeur, fenêtre de mise
  à jour) : `player-x-icone.svg`.
`BrandMark` (`components/ui/Brand.tsx`) choisit tout seul la version selon la hauteur demandée.

## Règles
- Une seule teinte : ne pas ajouter de cyan, d'or ou de lavande dans le logo (elles restent des couleurs d'interface).
- Pas de tuile blanche ou très claire (« cadre blanc » dans une barre des tâches claire).
- Barre du haut : l'icône puis « Player X » ; sous 1180 px de large, l'icône seule. L'animation de retour d'une mise à jour
  pose l'icône sur `.tb-brand .brand-mark` (la tuile remplit son cadre).
- Animations liées au logo : l'écran de la console porte la progression (barre), le P et le X s'allument pendant
  l'installation, l'écran clignote doucement pendant une mise à jour, et s'éteint comme un vieux tube quand Player X se
  ferme pour redémarrer, puis se rallume au retour. Avec « Réduire les animations », il ne reste que des fondus.

## Comment les fichiers ont été produits
SVG dessinés à la main (formes, dégradés, masques, flous `feGaussianBlur`, sans texte ni image), puis rendus par Chromium
(le moteur de l'appli) aux tailles exactes. Le `.ico` regroupe un rendu par taille (pas une image réduite) : 128 px et moins
en DIB 32 bits, 256 px en PNG. L'icône des deux exécutables sur mesure (`installer/rsrc_windows_amd64.syso` et
`installer/cmd/update/rsrc_windows_amd64.syso`) est remplacée image par image par `scripts/syso-icons.py`, sans toucher
au manifeste ni aux informations de version.
