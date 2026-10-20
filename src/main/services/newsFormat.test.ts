// Tests de la lecture des annonces Steam (npm run test:news) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { cleanRawNews, decodeEntities, excerptOf, isPatchPost, parseNewsContents, safeUrl, toNewsPost } from './newsFormat.ts'

const textOf = (spans: { text: string }[]): string => spans.map((s) => s.text).join('')

test('ancien format : « [ MAPS ] » en intertitre, crochets inconnus gardés, listes imbriquées', () => {
  const blocks = parseNewsContents('[ MAPS ]\n[list]\n[*]Vertigo\n[list][*]Fixed a bug where players could see through walls[/list]\n[*][PC] Ancient: fixed lighting\n[/list]')
  assert.deepEqual(blocks[0], { type: 'heading', level: 3, spans: [{ text: 'MAPS' }] })
  assert.equal(blocks[1].type, 'list')
  if (blocks[1].type !== 'list') return
  assert.equal(blocks[1].ordered, false)
  assert.deepEqual(
    blocks[1].items.map((it) => [textOf(it.spans), it.depth]),
    [
      ['Vertigo', 0],
      ['Fixed a bug where players could see through walls', 1],
      ['[PC] Ancient: fixed lighting', 0]
    ]
  )
  // Un crochet suivi de texte reste du texte.
  assert.deepEqual(parseNewsContents('[PC] Fixed lighting\n[ not a title ] here'), [{ type: 'paragraph', spans: [{ text: '[PC] Fixed lighting\n[ not a title ] here' }] }])
})

test("nouvel éditeur Steam : [p], titres, images, liens, gras", () => {
  const src =
    '[p][img src="{STEAM_CLAN_IMAGE}/45130000/abc123.png"][/img][/p]\n[h2]Patch Notes[/h2][p]Hello [b]soldiers[/b], read the [url="https://www.ea.com/games/battlefield"]full notes[/url].[/p][olist][*][p]First[/p][/*][*][p]Second[/p][/*][/olist][hr][/hr][p]Bye[/p]'
  const blocks = parseNewsContents(src)
  assert.deepEqual(blocks[0], { type: 'image', src: 'https://clan.akamai.steamstatic.com/images/45130000/abc123.png' })
  assert.deepEqual(blocks[1], { type: 'heading', level: 2, spans: [{ text: 'Patch Notes' }] })
  assert.deepEqual(blocks[2], {
    type: 'paragraph',
    spans: [{ text: 'Hello ' }, { text: 'soldiers', bold: true }, { text: ', read the ' }, { text: 'full notes', href: 'https://www.ea.com/games/battlefield' }, { text: '.' }]
  })
  assert.deepEqual(blocks[3], {
    type: 'list',
    ordered: true,
    items: [
      { spans: [{ text: 'First' }], depth: 0 },
      { spans: [{ text: 'Second' }], depth: 0 }
    ]
  })
  assert.deepEqual(blocks[4], { type: 'rule' })
  assert.deepEqual(blocks[5], { type: 'paragraph', spans: [{ text: 'Bye' }] })
  assert.equal(blocks.length, 6)
})

test('paragraphes séparés par une ligne vide, retours à la ligne gardés', () => {
  const blocks = parseNewsContents('Line one\nline two\n\n\n  Next paragraph  ')
  assert.deepEqual(blocks, [
    { type: 'paragraph', spans: [{ text: 'Line one\nline two' }] },
    { type: 'paragraph', spans: [{ text: 'Next paragraph' }] }
  ])
})

test('entités et HTML : décodés en texte, jamais réinterprétés', () => {
  const blocks = parseNewsContents('Tom &amp; Jerry &#39;quoted&#39; &lt;b&gt;not bold&lt;/b&gt;<br>next<i>x</i>')
  assert.deepEqual(blocks, [{ type: 'paragraph', spans: [{ text: "Tom & Jerry 'quoted' <b>not bold</b>\nnextx" }] }])
  assert.equal(decodeEntities('&#x1F3AE; &unknown; &#0;'), '🎮 &unknown; ')
})

test('liens : https seulement, steam://openurl ramené à son adresse', () => {
  assert.equal(safeUrl('javascript:alert(1)'), undefined)
  assert.equal(safeUrl('http://example.com'), undefined)
  assert.equal(safeUrl('steam://openurl/https://store.steampowered.com/app/730'), 'https://store.steampowered.com/app/730')
  assert.equal(safeUrl('"https://a.b/c"'), 'https://a.b/c')
  assert.equal(safeUrl('https://a.b/c d'), undefined)
  const blocks = parseNewsContents('[url=javascript:alert(1)]click[/url] and [url]https://x.example/p[/url]')
  assert.deepEqual(blocks, [{ type: 'paragraph', spans: [{ text: 'click and ' }, { text: 'https://x.example/p', href: 'https://x.example/p' }] }])
})

test('vidéos YouTube en lien, images non https ignorées, contenu brut non lu', () => {
  const blocks = parseNewsContents('[previewyoutube=dQw4w9WgXcQ;full][/previewyoutube][previewyoutube="bad id!"][/previewyoutube][img]http://insecure.example/a.png[/img][noparse][b]raw[/b][/noparse]')
  assert.deepEqual(blocks, [
    { type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { type: 'paragraph', spans: [{ text: '[b]raw[/b]' }] }
  ])
})

test('tableau : une ligne par paragraphe, en-têtes en gras', () => {
  const blocks = parseNewsContents('[table][tr][th]Weapon[/th][th]Change[/th][/tr][tr][td]M4A1[/td][td]-5% recoil[/td][/tr][/table]')
  assert.deepEqual(blocks, [
    { type: 'paragraph', spans: [{ text: 'Weapon', bold: true }, { text: ' · ' }, { text: 'Change', bold: true }] },
    { type: 'paragraph', spans: [{ text: 'M4A1 · -5% recoil' }] }
  ])
})

test('balises mal fermées et majuscules : le texte reste lisible', () => {
  const blocks = parseNewsContents('[B]bold [I]both[/B] plain[/I] [H3]Title[/h3]')
  assert.equal(blocks[0].type, 'paragraph')
  if (blocks[0].type !== 'paragraph') return
  assert.deepEqual(blocks[0].spans, [
    { text: 'bold ', bold: true },
    { text: 'both', bold: true, italic: true },
    { text: ' plain' }
  ])
  assert.deepEqual(blocks[1], { type: 'heading', level: 3, spans: [{ text: 'Title' }] })
})

test('annonce très longue : coupée sans planter', () => {
  const blocks = parseNewsContents(`[list]${'[*]Fixed something important in the game\n'.repeat(5000)}[/list]${'[p]More text here[/p]'.repeat(3000)}`)
  const size = blocks.reduce((n, b) => n + (b.type === 'list' ? b.items.length * 40 : b.type === 'paragraph' ? 15 : 0), 0)
  assert.ok(blocks.length <= 600)
  assert.ok(size <= 200_000)
})

test('notes de patch : marque Steam ou titre de mise à jour', () => {
  assert.equal(isPatchPost('Counter-Strike 2 Update', ['patchnotes']), true)
  assert.equal(isPatchPost('Battlefield 6 Update 1.1.2.0', []), true)
  assert.equal(isPatchPost('Patch Notes - Season 1', []), true)
  assert.equal(isPatchPost('Hotfixes are live', []), true)
  assert.equal(isPatchPost('Mise à jour 1.3', []), true)
  assert.equal(isPatchPost('Notes de version de la saison 2', []), true)
  assert.equal(isPatchPost('v1.04 is out', []), false)
  assert.equal(isPatchPost('Version 1.04 is out', []), true)
  assert.equal(isPatchPost('Season 2 Roadmap', []), false)
  assert.equal(isPatchPost('Community Update: what is next', []), false)
  assert.equal(isPatchPost('Dispatches from the dev team', []), false)
})

test('extrait : paragraphes et points, sans les titres, coupé à un mot', () => {
  const blocks = parseNewsContents(`[h1]Big title[/h1][p]${'word '.repeat(80)}[/p]`)
  const excerpt = excerptOf(blocks, 50)
  assert.ok(excerpt.endsWith('…'))
  assert.ok(!excerpt.includes('Big title'))
  assert.ok(excerpt.length <= 51)
  assert.equal(excerptOf(parseNewsContents('[h2]Only a title[/h2]')), 'Only a title')
  assert.equal(excerptOf(parseNewsContents('[list][*]One[*]Two[/list]')), 'One Two')
})

test('annonce brute : champs vérifiés, date en millisecondes', () => {
  const ok = cleanRawNews({
    gid: '5124356789012345678',
    title: ' Update 1.2 &amp; more ',
    url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5124356789012345678',
    author: 'DICE',
    contents: '[p]Hi[/p]',
    date: 1760000000,
    feedname: 'steam_community_announcements',
    tags: ['patchnotes', 3]
  })
  assert.deepEqual(ok, {
    gid: '5124356789012345678',
    title: 'Update 1.2 & more',
    url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5124356789012345678',
    author: 'DICE',
    contents: '[p]Hi[/p]',
    date: 1_760_000_000_000,
    tags: ['patchnotes']
  })
  assert.equal(cleanRawNews({ ...ok, gid: 'abc', date: 1 }), null)
  assert.equal(cleanRawNews({ gid: '1', title: 'x', url: 'http://insecure', date: 1 }), null)
  assert.equal(cleanRawNews(null), null)
  const post = toNewsPost({ ...ok!, contents: '[img]{STEAM_CLAN_IMAGE}/1/a.jpg[/img][p]Body text[/p]' })
  assert.equal(post.patch, true)
  assert.equal(post.image, 'https://clan.akamai.steamstatic.com/images/1/a.jpg')
  assert.equal(post.excerpt, 'Body text')
  assert.equal(post.id, '5124356789012345678')
})
