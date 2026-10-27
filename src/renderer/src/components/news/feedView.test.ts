// Tests de la présentation du relevé des actus (npm run test:news) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NewsFeedItem } from '@shared/types'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { feedGames, filterFeed, groupByGame, heroNameSize, HOME_MAX, homeFeed, listGroups, ofGame, shortTitle } from './feedView.ts'

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
  // Onglet « Patchs » : chaque jeu compte ses patchs seulement, et reste dans le menu avec 0 s'il n'en a pas.
  const patches = filterFeed(list, { patchesOnly: true, gameId: null })
  assert.deepEqual(
    feedGames(list, patches).map((g) => [g.name, g.count]),
    [
      ["Baldur's Gate 3", 1],
      ['Counter-Strike 2', 1],
      ['éclipse', 1],
      ['ELDEN RING', 1]
    ]
  )
  const onlyNews = [item(NOW, false, 'steam:1145360', 'Hades'), ...list]
  const hades = feedGames(onlyNews, filterFeed(onlyNews, { patchesOnly: true, gameId: null })).find((g) => g.name === 'Hades')
  assert.deepEqual(hades, { id: 'steam:1145360', name: 'Hades', count: 0 })
})

test('« Tes jeux » : un groupe par jeu, le plus récent d\'abord, ses annonces dessous, ses non lues comptées', () => {
  const cs1 = { ...item(NOW - 3 * H, true, 'steam:730'), isNew: true }
  const elden = item(NOW - 20 * H, true, 'steam:1245620', 'ELDEN RING')
  const cs2 = item(NOW - 6 * D, true, 'steam:730')
  const dota = { ...item(NOW - 5 * D, false, 'steam:570', 'Dota 2'), isNew: true }
  const groups = groupByGame([cs1, elden, dota, cs2])
  assert.deepEqual(
    groups.map((g) => [g.gameId, g.items.map((i) => i.id), g.latest, g.unread]),
    [
      ['steam:730', [cs1.id, cs2.id], cs1.date, 1],
      ['steam:1245620', [elden.id], elden.date, 0],
      ['steam:570', [dota.id], dota.date, 1]
    ]
  )
  // Relevé dans le désordre (ne devrait pas arriver) : l'ordre reste celui des dates.
  assert.deepEqual(
    groupByGame([cs2, dota, elden, cs1]).map((g) => g.gameId),
    ['steam:730', 'steam:1245620', 'steam:570']
  )
  assert.deepEqual(groupByGame([cs2, cs1])[0].items.map((i) => i.id), [cs1.id, cs2.id])
  assert.deepEqual(groupByGame([]), [])
})

test('liste sous l\'écran du haut : l\'annonce à la une n\'y est pas reprise, « Voir les N » la compte quand même', () => {
  const cs1 = item(NOW - 3 * H, true, 'steam:730')
  const elden = item(NOW - 20 * H, true, 'steam:1245620', 'ELDEN RING')
  const cs2 = item(NOW - 6 * D, true, 'steam:730')
  const fc = item(NOW - 9 * D, true, 'steam:1091500', 'Cyberpunk 2077')
  // Counter-Strike 2 passe derrière ELDEN RING : sa plus récente annonce restante a 6 jours.
  assert.deepEqual(
    listGroups([cs1, elden, cs2, fc]).map((g) => [g.gameId, g.items.map((i) => i.id), g.total]),
    [
      ['steam:1245620', [elden.id], 1],
      ['steam:730', [cs2.id], 2],
      ['steam:1091500', [fc.id], 1]
    ]
  )
  // Un jeu qui n'avait que l'annonce à la une disparaît de la liste.
  assert.deepEqual(listGroups([cs1]), [])
  assert.deepEqual(listGroups([]), [])
})

test('titre sans le nom du jeu (déjà écrit au-dessus) ; le titre entier quand le doute est permis', () => {
  const cases: [string, string, string][] = [
    ['Counter-Strike 2 Update', 'Counter-Strike 2', 'Update'],
    ['Counter-Strike 2 Release Notes', 'Counter-Strike 2', 'Release Notes'],
    ['EA SPORTS FC™ 27 | Title Update v1.1 Pitch Notes', 'EA SPORTS FC™ 27', 'Title Update v1.1 Pitch Notes'],
    ['EA SPORTS FC™ 27 | Title Update v1.1 Pitch Notes', 'EA SPORTS FC 27', 'Title Update v1.1 Pitch Notes'],
    ['Age of Empires IV – Update 17.0 Preview', 'Age of Empires IV: Anniversary Edition', 'Update 17.0 Preview'],
    ['Stardew Valley 1.6.16 Patch Notes', 'Stardew Valley', '1.6.16 Patch Notes'],
    ['Dota 2 7.40b', 'Dota 2', '7.40b'],
    ['counter-strike 2: hotfix', 'Counter-Strike 2', 'Hotfix'],
    ["Baldur’s Gate 3 – Hotfix #31", "Baldur's Gate 3", 'Hotfix #31'],
    ['TopSpin 2K25 Patch 6.0', 'TopSpin 2K25', 'Patch 6.0'],
    // Le nom n'est pas au début, ou continue, ou c'est une suite : le titre reste entier.
    ['Patch Notes Ver. 1.16.2', 'ELDEN RING', 'Patch Notes Ver. 1.16.2'],
    ['Civilization VII Update 1.2', 'Civilization VI', 'Civilization VII Update 1.2'],
    ['Hades II is out now', 'Hades', 'Hades II is out now'],
    ['Hades 2 Early Access', 'Hades', 'Hades 2 Early Access'],
    ['Hades: II days left', 'Hades', 'II days left'],
    ['Counter-Strike 2', 'Counter-Strike 2', 'Counter-Strike 2'],
    ['Counter-Strike 2 —', 'Counter-Strike 2', 'Counter-Strike 2 —'],
    ['Valheim', '', 'Valheim'],
    // Une phrase qui commence par le nom, un autre jeu au nom voisin, une suite en chiffre : le titre reste entier.
    ['Valheim is coming to consoles', 'Valheim', 'Valheim is coming to consoles'],
    ['Portal 2 is 15 years old', 'Portal 2', 'Portal 2 is 15 years old'],
    ['Hades 2 is out now', 'Hades', 'Hades 2 is out now'],
    ['Hadestown Update', 'Hades', 'Hadestown Update'],
    ["Valheim's Ashlands update", 'Valheim', "Valheim's Ashlands update"],
    ['Path of Exile 2 Patch 0.3.1', 'Path of Exile', 'Path of Exile 2 Patch 0.3.1'],
    ['TopSpin Patch 6.0', 'TopSpin 2K25', 'TopSpin Patch 6.0'],
    // Séparateur, marque déposée, nom avec deux-points : le nom s'en va.
    ['Cyberpunk 2077: Update 2.31', 'Cyberpunk 2077', 'Update 2.31'],
    ['Battlefield™ 6 Season 1 Update', 'Battlefield 6', 'Season 1 Update'],
    ['DRAGON BALL: Sparking! ZERO Update Ver.1.4', 'DRAGON BALL: Sparking! ZERO', 'Update Ver.1.4'],
    ['Warframe: 1999 Hotfix 38.0.5', 'Warframe', '1999 Hotfix 38.0.5']
  ]
  for (const [title, game, expected] of cases) assert.equal(shortTitle(title, game), expected, `${title} (${game})`)
})

test('« de » ou « d\' » devant le nom du jeu (noms lus par les lecteurs d\'écran)', () => {
  assert.equal(ofGame('Counter-Strike 2'), 'de Counter-Strike 2')
  assert.equal(ofGame('ELDEN RING'), "d'ELDEN RING")
  assert.equal(ofGame('Age of Empires IV'), "d'Age of Empires IV")
  assert.equal(ofGame('Hades'), 'de Hades')
  assert.equal(ofGame('Yakuza 0'), 'de Yakuza 0')
  assert.equal(ofGame('Écho'), "d'Écho")
})

test('taille du nom à la une : plus petite au-delà de 24 caractères (édition retirée)', () => {
  assert.equal(heroNameSize('EA SPORTS FC™ 27'), 'l')
  assert.equal(heroNameSize("Baldur's Gate 3"), 'l')
  assert.equal(heroNameSize('Counter-Strike 2 Deluxe Edition'), 'l')
  assert.equal(heroNameSize('DRAGON BALL: Sparking! ZERO'), 'm')
  assert.equal(heroNameSize('Age of Empires IV: Anniversary Edition'), 'm')
})
