// Tests de la recherche globale (npm run test:search) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore TS5097
import { countGames, score, searchAll, type SearchEntry } from './searchIndex.ts'

const entries: SearchEntry[] = [
  { id: 'game:a', kind: 'game', label: 'Counter-Strike 2' },
  { id: 'game:b', kind: 'game', label: 'Hollow Knight' },
  { id: 'game:c', kind: 'game', label: 'Pokémon™ Légendes' },
  { id: 'friend:a', kind: 'friend', label: 'Jason' },
  { id: 'member:a', kind: 'member', label: 'Kowalski' },
  { id: 'page:a', kind: 'page', label: 'Paramètres › Comptes', keywords: ['steam', 'discord'] },
  { id: 'page:b', kind: 'page', label: 'Stats de jeu' }
]

test('recherche : début, début de mot, contenu, mot-clé, rien', () => {
  assert.equal(score(entries[0], 'count'), 0)
  assert.equal(score(entries[0], 'strike'), 1)
  assert.equal(score(entries[0], 'terstr'), 2)
  assert.equal(score(entries[5], 'steam'), 3)
  assert.equal(score(entries[1], 'zelda'), -1)
  assert.equal(score(entries[1], '   '), -1)
})

test('recherche : accents, ™ et majuscules ne comptent pas', () => {
  assert.equal(score(entries[2], 'pokemon leg'), 0)
  assert.equal(score(entries[5], 'COMPTES'), 1)
})

test('recherche : groupes dans l’ordre Jeux, Amis, Membres, Aller à ; les plus proches en tête', () => {
  const g = searchAll(entries, 'ste')
  assert.deepEqual(
    searchAll(entries, 'st').map((x) => x.title),
    ['Jeux', 'Aller à']
  )
  assert.deepEqual(
    g.map((x) => x.title),
    ['Aller à']
  )
  // « Counter-Strike » et « Stats de jeu » ne correspondent pas ; « Paramètres › Comptes » par mot-clé (steam).
  assert.deepEqual(
    searchAll(entries, 'st')[1].items.map((e) => e.id),
    ['page:b']
  )
  assert.deepEqual(
    g[0].items.map((e) => e.id),
    ['page:a']
  )
  assert.deepEqual(
    searchAll(entries, 'ja').map((x) => x.kind),
    ['friend']
  )
})

test('recherche : une ou deux lettres ne trouvent que les débuts de mot', () => {
  assert.equal(score(entries[6], 'ta'), -1)
  assert.equal(score(entries[6], 'tat'), 2)
  assert.equal(score(entries[3], 'j'), 0)
  assert.equal(score(entries[3], 's'), -1)
  assert.equal(score(entries[0], 's'), 1)
  assert.equal(score(entries[5], 's'), -1)
})

test('recherche : au plus 5 jeux montrés, mais le compte total reste juste', () => {
  const many: SearchEntry[] = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, kind: 'game', label: `Jeu ${i}` }))
  assert.equal(searchAll(many, 'jeu')[0].items.length, 5)
  assert.equal(countGames(many, 'jeu'), 8)
})
