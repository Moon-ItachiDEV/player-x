// Tests de la géométrie du vol de la jaquette (npm run test:launch) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { belowBar, clipBox, flipFrom, ratioMismatch, usableSource, visibleShare } from './flip.ts'

const VP = { width: 1440, height: 900 }

test('FLIP : la jaquette posée sur sa source, même largeur, centrée en hauteur', () => {
  const dst = { left: 600, top: 300, width: 168, height: 252 }
  // Jaquette de la bibliothèque, 2:3 aussi : elle se pose exactement dessus.
  const lib = { left: 100, top: 500, width: 84, height: 126 }
  const f = flipFrom(lib, dst)
  assert.equal(f.s, 0.5)
  assert.equal(f.dx, -500)
  assert.equal(f.dy, 200)
  // Avec transform-origin 0 0 : coin haut gauche et taille de la source.
  assert.equal(dst.left + f.dx, lib.left)
  assert.equal(dst.top + f.dy, lib.top)
  assert.equal(dst.width * f.s, lib.width)
  assert.equal(dst.height * f.s, lib.height)
  // Tuile carrée du rail : même largeur, centrée verticalement.
  const rail = { left: 11, top: 200, width: 42, height: 42 }
  const g = flipFrom(rail, dst)
  const h = dst.height * g.s
  assert.equal(dst.top + g.dy + h / 2, rail.top + rail.height / 2)
})

test('proportions : le carré du rail apparaît en fondu, une jaquette 2:3 non', () => {
  const dst = { left: 0, top: 0, width: 168, height: 252 }
  assert.equal(ratioMismatch({ left: 0, top: 0, width: 42, height: 42 }, dst), true)
  assert.equal(ratioMismatch({ left: 0, top: 0, width: 84, height: 126 }, dst), false)
  assert.equal(ratioMismatch({ left: 0, top: 0, width: 96, height: 128 }, dst), false) // fiche, 3:4 (11 %)
})

test('source : visible, assez large, de proportions de jaquette', () => {
  assert.equal(usableSource({ left: 100, top: 100, width: 84, height: 126 }, VP), true)
  assert.equal(usableSource({ left: 11, top: 200, width: 42, height: 42 }, VP), true)
  assert.equal(usableSource({ left: 100, top: 100, width: 23, height: 34 }, VP), false) // moins de 24 px
  assert.equal(usableSource({ left: 100, top: -200, width: 84, height: 126 }, VP), false) // au-dessus de la fenêtre
  assert.equal(usableSource({ left: 100, top: 900, width: 84, height: 126 }, VP), false) // en dessous
  assert.equal(usableSource({ left: 1440, top: 100, width: 84, height: 126 }, VP), false) // à droite
  assert.equal(usableSource({ left: 100, top: 100, width: 320, height: 180 }, VP), false) // vignette paysage
  assert.equal(usableSource({ left: 100, top: 100, width: 84, height: 0 }, VP), false)
  assert.equal(usableSource(null, VP), false)
})

test('source : à moitié sous la barre du haut ou la barre d’outils collante, elle ne vole pas', () => {
  // Contenu sous la barre du haut (48 px), barre d'outils de la bibliothèque collée jusqu'à 109 px.
  const content = { left: 304, top: 48, width: 976, height: 592 }
  const clip = clipBox(content, { left: 304, top: 109, width: 976, height: 531 })
  assert.deepEqual(clip, { left: 304, top: 109, width: 976, height: 531 })
  const cover = { left: 336, top: -15, width: 168, height: 251 }
  assert.equal(usableSource(cover, VP), true) // dans la fenêtre…
  assert.equal(usableSource(cover, VP, clip), false) // … mais plus de la moitié cachée
  assert.ok(Math.abs(visibleShare(cover, clip) - 127 / 251) < 1e-9)
  // Entièrement visible, ou à peine rognée : elle vole.
  assert.equal(usableSource({ left: 336, top: 200, width: 168, height: 251 }, VP, clip), true)
  assert.equal(usableSource({ left: 336, top: 60, width: 168, height: 251 }, VP, clip), true)
  // Hors de la zone : rien.
  assert.equal(visibleShare({ left: 0, top: 0, width: 40, height: 40 }, clip), 0)
  assert.deepEqual(clipBox({ left: 0, top: 0, width: 10, height: 10 }, { left: 20, top: 20, width: 5, height: 5 }).width, 0)
})

test('sous la barre du haut : le contenu défile derrière la barre en verre, seule la partie dessous compte', () => {
  // Le contenu prend toute la hauteur (0 → 900) ; la barre du haut s'arrête à 48 px.
  const content = { left: 312, top: 0, width: 1118, height: 900 }
  assert.deepEqual(belowBar(content, 48), { left: 312, top: 48, width: 1118, height: 852 })
  // Entièrement sous la barre : rien ne dépasse.
  assert.deepEqual(belowBar({ left: 336, top: 300, width: 168, height: 251 }, 48), { left: 336, top: 300, width: 168, height: 251 })
  // À moitié dessous : rognée en haut.
  assert.deepEqual(belowBar({ left: 336, top: 10, width: 168, height: 100 }, 48), { left: 336, top: 48, width: 168, height: 62 })
  // Entièrement derrière la barre : hauteur 0, jamais négative.
  assert.deepEqual(belowBar({ left: 336, top: 0, width: 168, height: 40 }, 48), { left: 336, top: 48, width: 168, height: 0 })
  // Une jaquette aux deux tiers derrière la barre ne vole pas ; juste dessous, elle vole.
  const clip = belowBar(content, 48)
  assert.equal(usableSource({ left: 336, top: -60, width: 168, height: 251 }, VP), true) // dans la fenêtre…
  assert.equal(usableSource({ left: 336, top: -60, width: 168, height: 251 }, VP, clip), false) // … mais cachée sous la barre
  assert.equal(usableSource({ left: 336, top: 52, width: 168, height: 251 }, VP, clip), true)
})
