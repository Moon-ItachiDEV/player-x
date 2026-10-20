// Tests de la géométrie du vol de la jaquette (npm run test:launch) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { flipFrom, ratioMismatch, usableSource } from './flip.ts'

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
