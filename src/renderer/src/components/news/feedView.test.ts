// Tests de la présentation du relevé des actus (npm run test:news) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NewsFeedItem } from '@shared/types'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { bucketOf, feedGames, filterFeed, groupFeed, HOME_MAX, homeFeed } from './feedView.ts'

// Dates locales : les tests ne dépendent pas du fuseau horaire de la machine.
const NOW = new Date(2026, 9, 21, 0, 30).getTime()
const H = 3600_000
const D = 24 * H

let n = 0
const item = (date: number, patch = true, gameId = 'steam:730', gameName = 'Counter-Strike 2'): NewsFeedItem => ({
  id: String(++n),
  gameId,
  gameName,
  title: `Annonce ${n}`,
  url: `https://store.steampowered.com/news/app/730/view/${n}`,
  date,
  patch,
  isNew: false
})

test('groupe par jour du calendrier local', () => {
  assert.equal(bucketOf(new Date(2026, 9, 20, 23, 50).getTime(), NOW), 'yesterday')
  assert.equal(bucketOf(new Date(2026, 9, 21, 0, 5).getTime(), NOW), 'today')
  assert.equal(bucketOf(new Date(2026, 9, 20, 0, 0).getTime(), NOW), 'yesterday')
  assert.equal(bucketOf(new Date(2026, 9, 19, 23, 59).getTime(), NOW), 'week')
  assert.equal(bucketOf(NOW - 6 * D, NOW), 'week')
  assert.equal(bucketOf(NOW - 20 * D, NOW), 'month')
  assert.equal(bucketOf(NOW - 45 * D, NOW), 'older')
  assert.equal(bucketOf(NOW + 2 * H, NOW), 'today')
})

test('rangée de l\'accueil : patchs de moins de 60 jours, 10 au plus, ordre gardé', () => {
  const list = [item(NOW - H), item(NOW - 2 * H, false), item(NOW - 59 * D), item(NOW - 61 * D)]
  assert.deepEqual(
    homeFeed(list, NOW).map((i) => i.id),
    [list[0].id, list[2].id]
  )
  const many = Array.from({ length: 14 }, (_, i) => item(NOW - i * H))
  const home = homeFeed(many, NOW)
  assert.equal(home.length, HOME_MAX)
  assert.deepEqual(
    home.map((i) => i.id),
    many.slice(0, HOME_MAX).map((i) => i.id)
  )
  assert.deepEqual(homeFeed([], NOW), [])
})

test('groupes dans l\'ordre, sans groupe vide, annonces dans l\'ordre', () => {
  const a = item(NOW - 10 * 60_000)
  const b = item(NOW - 20 * 60_000)
  const c = item(NOW - 3 * D)
  const d = item(NOW - 50 * D)
  const groups = groupFeed([a, b, c, d], NOW)
  assert.deepEqual(
    groups.map((g) => g.bucket),
    ['today', 'week', 'older']
  )
  assert.deepEqual(
    groups[0].items.map((i) => i.id),
    [a.id, b.id]
  )
  assert.deepEqual(groupFeed([], NOW), [])
})

test('filtres : patchs seulement, un jeu', () => {
  const a = item(NOW - H, true, 'steam:730')
  const b = item(NOW - 2 * H, false, 'steam:730')
  const c = item(NOW - 3 * H, true, 'steam:570', 'Dota 2')
  assert.deepEqual(
    filterFeed([a, b, c], { patchesOnly: true, gameId: null }).map((i) => i.id),
    [a.id, c.id]
  )
  assert.deepEqual(
    filterFeed([a, b, c], { patchesOnly: false, gameId: 'steam:730' }).map((i) => i.id),
    [a.id, b.id]
  )
  assert.deepEqual(
    filterFeed([a, b, c], { patchesOnly: true, gameId: 'steam:570' }).map((i) => i.id),
    [c.id]
  )
  assert.equal(filterFeed([a, b, c], { patchesOnly: false, gameId: null }).length, 3)
})

test('jeux du menu « Jeu » : par nom (ordre français), avec leur nombre d\'annonces', () => {
  const list = [
    item(NOW, true, 'steam:1245620', 'ELDEN RING'),
    item(NOW, true, 'steam:730', 'Counter-Strike 2'),
    item(NOW, false, 'steam:1245620', 'ELDEN RING'),
    item(NOW, true, 'steam:1086940', "Baldur's Gate 3"),
    item(NOW, true, 'steam:9', 'éclipse')
  ]
  assert.deepEqual(feedGames(list), [
    { id: 'steam:1086940', name: "Baldur's Gate 3", count: 1 },
    { id: 'steam:730', name: 'Counter-Strike 2', count: 1 },
    { id: 'steam:9', name: 'éclipse', count: 1 },
    { id: 'steam:1245620', name: 'ELDEN RING', count: 2 }
  ])
})
