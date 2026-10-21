// Tests du relevé des actus et de la page Actus des jeux (npm run test:news) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { RawNews } from './newsFormat'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { buildFeed, entryFrom, FEED_MAX, needsRefresh, NEW_MS, nextSeen, patchFlags, type IndexEntry, type NewsIndex } from './newsFeed.ts'
// @ts-ignore TS5097
import { cleanRawNews, isPatchPost } from './newsFormat.ts'
// @ts-ignore TS5097
import { SIM_AUTHOR, SIM_POSTS, simNews } from './newsSimData.ts'

const NOW = new Date(2026, 9, 21, 22, 0).getTime()
const H = 3600_000
const D = 24 * H

const raw = (gid: string, title: string, date: number, tags: string[] = []): RawNews => ({
  gid,
  title,
  url: `https://store.steampowered.com/news/app/1/view/${gid}`,
  contents: '',
  date,
  tags
})

const entry = (items: [string, string, number, boolean][], at = NOW - H): IndexEntry => ({
  at,
  latest: Math.max(0, ...items.map((i) => i[2])),
  items: items.map(([id, title, date, patch]) => ({ id, title, url: `https://store.steampowered.com/news/app/1/view/${id}`, date, patch }))
})

test('entryFrom : 5 annonces gardées, dernier patch cherché dans toutes, aucune annonce', () => {
  const list = [
    raw('1', 'Community Spotlight', NOW - 1 * D),
    raw('2', 'Roadmap', NOW - 2 * D),
    raw('3', 'Dev blog', NOW - 3 * D),
    raw('4', 'Event', NOW - 4 * D),
    raw('5', 'Screenshots', NOW - 5 * D),
    raw('6', 'Update 1.2.3', NOW - 6 * D)
  ]
  const e = entryFrom(list, NOW)
  assert.equal(e.at, NOW)
  assert.equal(e.latest, NOW - D)
  assert.deepEqual(
    e.items?.map((i) => i.id),
    ['1', '2', '3', '4', '5']
  )
  assert.ok(e.items?.every((i) => !i.patch))
  assert.deepEqual(e.patch, { id: '6', title: 'Update 1.2.3', date: NOW - 6 * D })
  assert.deepEqual(entryFrom([], NOW), { at: NOW, latest: 0, items: [] })
  assert.equal(entryFrom([raw('9', 'Release notes', NOW, ['patchnotes'])], NOW).items?.[0].patch, true)
})

test('needsRefresh : jamais relevé, relevé de la 0.7.2 sans annonces, trop vieux', () => {
  assert.equal(needsRefresh(undefined, NOW, 6 * H), true)
  // Relevé écrit par la 0.7.2 : pas de liste d'annonces, redemandé une fois même s'il est récent.
  assert.equal(needsRefresh({ at: NOW - 60_000, latest: NOW - D, patch: { id: '1', title: 'Patch', date: NOW - D } }, NOW, 6 * H), true)
  assert.equal(needsRefresh(entry([], NOW - 5 * H), NOW, 6 * H), false)
  assert.equal(needsRefresh(entry([], NOW - 7 * H), NOW, 6 * H), true)
  // « Actualiser » : tout ce qui a plus d'une minute.
  assert.equal(needsRefresh(entry([], NOW - 2 * 60_000), NOW, 60_000), true)
})

test('nextSeen : tout, jusqu’à une annonce, jamais en arrière, valeur douteuse ignorée', () => {
  assert.equal(nextSeen(0, NOW - H), NOW - H)
  assert.equal(nextSeen(NOW, NOW - H), NOW)
  assert.equal(nextSeen(0, NOW - H, NOW - 3 * H), NOW - 3 * H)
  assert.equal(nextSeen(NOW - 2 * H, NOW - H, NOW - 3 * H), NOW - 2 * H)
  // Une date plus récente que la dernière annonce connue ne va pas plus loin qu'elle.
  assert.equal(nextSeen(0, NOW - H, NOW), NOW - H)
  for (const bad of ['x', NaN, -1, 0, Infinity, null]) assert.equal(nextSeen(5, NOW, bad), 5, String(bad))
})

test('patchFlags : dernier patch toujours, badge seulement s’il a moins de 7 jours et n’a pas été vu', () => {
  const e: IndexEntry = { at: NOW, latest: NOW - 2 * D, patch: { id: 'p', title: 'Patch 1.2', date: NOW - 2 * D } }
  const last = { id: 'p', title: 'Patch 1.2', at: NOW - 2 * D }
  assert.deepEqual(patchFlags(e, 0, NOW), { newPatch: last, lastPatch: last })
  assert.deepEqual(patchFlags(e, NOW - 2 * D, NOW), { lastPatch: last })
  assert.deepEqual(patchFlags(e, 0, NOW - 2 * D + NEW_MS + 1), { lastPatch: last })
  assert.deepEqual(patchFlags({ at: NOW, latest: NOW, items: [] }, 0, NOW), {})
  assert.deepEqual(patchFlags(undefined, 0, NOW), {})
})

test('buildFeed : un appid partagé n’est compté qu’une fois, pour le jeu joué le plus récemment', () => {
  const index: NewsIndex = {
    '2807960': entry([['b1', 'Battlefield 6 Update 1.1.2.0', NOW - 2 * H, true]]),
    '730': entry([
      ['c1', 'Counter-Strike 2 Update', NOW - 3 * H, true],
      ['c2', 'Counter-Strike 2 Update', NOW - 9 * D, true]
    ]),
    // Relevé de la 0.7.2 : rien à montrer tant qu'il n'est pas refait.
    '570': { at: NOW, latest: NOW - H, patch: { id: 'd1', title: 'Patch', date: NOW - H } }
  }
  const games = [
    { id: 'ea:bf6', name: 'Battlefield™ 6', appId: '2807960', lastPlayed: NOW - D },
    { id: 'steam:2807960', name: 'Battlefield™ 6', appId: '2807960', lastPlayed: NOW - 3 * D },
    { id: 'steam:730', name: 'Counter-Strike 2', appId: '730' },
    { id: 'steam:570', name: 'Dota 2', appId: '570', lastPlayed: NOW }
  ]
  const feed = buildFeed(index, games, { 'steam:730': NOW - 5 * H }, NOW)
  assert.deepEqual(
    feed.map((i) => [i.id, i.gameId, i.gameName, i.isNew]),
    [
      ['b1', 'ea:bf6', 'Battlefield 6', true],
      ['c1', 'steam:730', 'Counter-Strike 2', true],
      // Plus de 7 jours : plus « Nouveau », même jamais vu.
      ['c2', 'steam:730', 'Counter-Strike 2', false]
    ]
  )
  // Vu jusqu'à cette annonce : plus « Nouveau ».
  assert.equal(buildFeed(index, games, { 'steam:730': NOW - 3 * H }, NOW)[1].isNew, false)
})

test('buildFeed : les plus récentes d’abord puis par nom, 200 au plus, doublons retirés', () => {
  const index: NewsIndex = {
    '1': entry([
      ['x', 'B news', NOW - H, false],
      ['x', 'B news (doublon)', NOW - H, false]
    ]),
    '2': entry([['y', 'A news', NOW - H, false]])
  }
  const feed = buildFeed(
    index,
    [
      { id: 'steam:1', name: 'Bravo', appId: '1' },
      { id: 'steam:2', name: 'alpha', appId: '2' }
    ],
    {},
    NOW
  )
  assert.deepEqual(
    feed.map((i) => i.gameName),
    ['alpha', 'Bravo']
  )
  const big: NewsIndex = {}
  const many = Array.from({ length: 60 }, (_, g) => {
    big[String(g + 1)] = entry(Array.from({ length: 5 }, (_, k) => [`${g}-${k}`, 'News', NOW - (g * 5 + k) * H, false] as [string, string, number, boolean]))
    return { id: `steam:${g + 1}`, name: `Jeu ${g}`, appId: String(g + 1) }
  })
  const capped = buildFeed(big, many, {}, NOW)
  assert.equal(capped.length, FEED_MAX)
  assert.ok(capped.every((it, i) => i === 0 || capped[i - 1].date >= it.date))
})

test('simulateur : chaque titre est reconnu comme prévu, annonces au format de Steam, signées « Simulation Player X »', () => {
  for (const p of SIM_POSTS) assert.equal(isPatchPost(p.title, p.tags), p.patch, p.title)
  // Aucune image : la page de l'annonce montre l'image du jeu.
  assert.ok(SIM_POSTS.every((p) => !/\[img|STEAM_CLAN/i.test(p.contents)))
  const t0 = NOW
  const cs2 = simNews('730', t0)
  assert.equal(cs2.length, 2)
  const clean = cs2.map(cleanRawNews)
  assert.ok(clean.every((n) => n && n.author === SIM_AUTHOR && n.date < t0))
  assert.ok(clean[0]!.date > clean[1]!.date)
  assert.deepEqual(simNews('900001', t0), [])
  // 12 annonces, 8 patchs de moins de 60 jours (rangée de l'accueil), 5 de moins de 7 jours.
  const all = SIM_POSTS.map((p) => ({ ...p, date: t0 - p.hours * H }))
  assert.equal(all.length, 12)
  assert.equal(all.filter((p) => p.patch && t0 - p.date < 60 * D).length, 8)
  assert.equal(all.filter((p) => p.patch && t0 - p.date < NEW_MS).length, 5)
})
