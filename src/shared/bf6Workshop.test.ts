// Tests de l'atelier des loadouts (npm run test:armory) : Mes armes, brouillon, modèles.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore TS5097
import { BUILD_TEMPLATES, cleanDraft, cleanMyWeapons, forgetWeapon, knownCategory, learnWeapon, myWeaponKey, suggestParts, templateWeapons } from './bf6Workshop.ts'
// @ts-ignore TS5097
import { loadoutPoints } from './bf6Loadouts.ts'

test('clé d’arme : casse, espaces et tirets ignorés', () => {
  assert.equal(myWeaponKey('Z84M'), myWeaponKey(' z84 m '))
  assert.equal(myWeaponKey('MK 24'), myWeaponKey('mk-24'))
  assert.equal(myWeaponKey('  '), '')
})

test('apprendre une arme : accessoires fusionnés, points mis à jour, plus récent en tête', () => {
  let list = learnWeapon([], { weapon: 'Z84M', cat: 'lmg', parts: { barrel: { name: 'Cryo', pts: 20 }, ammo: { name: 'FMJ', pts: 5 } } }, 1)
  list = learnWeapon(list, { weapon: 'z84m', parts: { barrel: { name: 'Heavy Ext.', pts: 10 }, ammo: { name: 'fmj' } } }, 2)
  assert.equal(list.length, 1)
  const w = list[0]
  assert.equal(w.name, 'z84m')
  assert.equal(w.cat, 'lmg')
  assert.deepEqual(w.parts.barrel, [
    { name: 'Heavy Ext.', pts: 10 },
    { name: 'Cryo', pts: 20 }
  ])
  // Sans points notés, on garde ceux déjà retenus.
  assert.deepEqual(w.parts.ammo, [{ name: 'fmj', pts: 5 }])
  assert.equal(w.updatedAt, 2)
})

test('une arme de l’Armurerie n’est pas apprise ; oublier une arme', () => {
  const list = learnWeapon([], { weapon: 'M433', armoryId: 'm433', parts: { barrel: { name: 'x', pts: 5 } } }, 1)
  assert.deepEqual(list, [])
  const two = learnWeapon(learnWeapon([], { weapon: 'A', parts: {} }, 1), { weapon: 'B', parts: {} }, 2)
  assert.deepEqual(
    forgetWeapon(two, myWeaponKey('A')).map((w) => w.name),
    ['B']
  )
})

test('relecture de Mes armes : entrées invalides écartées, doublons fusionnés', () => {
  const list = cleanMyWeapons([
    { name: 'MK 24', cat: 'assault-rifle', parts: { barrel: [{ name: 'Short', pts: 15 }, { name: 'short', pts: 1 }, { name: '' }, { name: 'X', pts: 200 }] }, updatedAt: 3 },
    { name: 'mk24', parts: {}, updatedAt: 9 },
    { name: '' },
    'x'
  ])
  assert.equal(list.length, 1)
  assert.deepEqual(list[0].parts.barrel, [{ name: 'Short', pts: 15 }, { name: 'X' }])
})

test('brouillon : nettoyé, vide = rien, identifiant gardé', () => {
  assert.equal(cleanDraft({ loadout: { parts: {} }, savedAt: 1 }), null)
  assert.equal(cleanDraft(null), null)
  const d = cleanDraft({
    id: 'l1',
    savedAt: 5,
    loadout: { name: ' Rush ', cls: 'recon', cat: 'sniper', weapon: 'M2010 ESR', parts: { optic: { name: '8X', pts: 30 }, bogus: { name: 'x' } }, notes: ' toits ' }
  })
  assert.deepEqual(d, {
    id: 'l1',
    savedAt: 5,
    loadout: { name: 'Rush', cls: 'recon', cat: 'sniper', weapon: 'M2010 ESR', parts: { optic: { name: '8X', pts: 30 } }, notes: 'toits' }
  })
  assert.equal(cleanDraft({ id: '../x', loadout: { name: 'a', parts: {} } })?.id, undefined)
})

test('modèles : chaque build fait 100 points, identifiants uniques', () => {
  const ids = new Set(BUILD_TEMPLATES.map((t) => t.id))
  assert.equal(ids.size, BUILD_TEMPLATES.length)
  for (const t of BUILD_TEMPLATES) {
    const p = loadoutPoints(t.loadout)
    assert.equal(p.total, 100, t.id)
    assert.equal(p.missing, 0, t.id)
  }
})

test('suggestions : tes accessoires d’abord, puis ceux des modèles ; catégorie connue', () => {
  const mine = learnWeapon([], { weapon: 'Z84M', parts: { muzzle: { name: 'Mon Frein', pts: 15 } } }, 1)
  const s = suggestParts(mine, 'z84m', 'muzzle').map((p) => p.name)
  assert.equal(s[0], 'Mon Frein')
  assert.ok(s.includes('Hybrid Suppressor [S]'))
  assert.ok(s.includes('Compensator'))
  assert.deepEqual(suggestParts([], 'Inconnue', 'muzzle'), [])
  assert.equal(knownCategory([], 'mk 24'), 'assault-rifle')
  assert.equal(knownCategory([], 'CZ3A1'), 'smg')
  assert.ok(templateWeapons().length >= 3)
})
