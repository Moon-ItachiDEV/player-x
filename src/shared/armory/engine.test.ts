// Tests de l'Armurerie (npm run test:armory) : calcul d'une config et recherche des meilleures configs, sur le M433.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore TS5097
import { BUDGET, goalScore, GOALS, REQUIRED, SEARCHED, bestBuilds, buildPoints, computeBuild, defaultBuild, normalizeBuild, recNet, searchChoices, timeToKill } from './engine.ts'
// @ts-ignore TS5097
import { M433 } from './weapons/m433.ts'
import type { SlotId } from './types'

const w = M433

test('config de série : les emplacements obligatoires, et le panneau de série', () => {
  const b = defaultBuild(w)
  assert.deepEqual(Object.keys(b).sort(), [...REQUIRED].sort())
  for (const s of REQUIRED) assert.equal(w.attachments[s]![0].changes, undefined, `${s} : la pièce de série ne change rien`)
  const { base, out } = computeBuild(w, b)
  for (const k of Object.keys(base)) assert.deepEqual(out[k], base[k], k)
})

test('chaque accessoire seul donne son relevé du panneau', () => {
  for (const [slot, list] of Object.entries(w.attachments)) {
    for (const a of list!) {
      const b = { ...defaultBuild(w), [slot]: a.name }
      if (slot === 'optic-accessory') continue
      const { out } = computeBuild(w, b)
      for (const [k, v] of Object.entries(a.changes ?? {})) {
        if (k === 'recoil_amount_deg') {
          // Recul : calculé en crans sur la valeur cachée ; le panneau arrondit au dixième.
          assert.ok(Math.abs((out[k] as number) - (v as number)) <= 0.05 + 1e-9, `${a.name} ${k} : ${out[k]} au lieu de ${v}`)
        } else assert.deepEqual(out[k], v, `${a.name} : ${k}`)
      }
    }
  }
})

test('crans de recul', () => {
  assert.equal(recNet(['+REC2', 'HIDE-3D']), 2)
  assert.equal(recNet(['-REC1']), -1)
  assert.equal(recNet(['LINEAR']), -1)
  assert.equal(recNet(['+REC1', 'SEMI-ONLY']), 0)
  assert.equal(recNet([]), 0)
})

test("points, config relue, accessoire d'optique", () => {
  const b = normalizeBuild(w, { optic: 'Iron Sights', 'optic-accessory': 'Magnifier', muzzle: 'Inconnu', barrel: '16.5" Fluted' })
  assert.equal(b.muzzle, undefined)
  assert.equal(b['optic-accessory'], undefined, "les mires de base n'acceptent pas la loupe")
  assert.equal(b.barrel, '16.5" Fluted')
  assert.equal(b.magazine, w.attachments.magazine![0].name)
  const p = buildPoints(w, b)
  assert.equal(p.unknown, false)
  assert.equal(p.total, 5 + 20 + 5 + 5)
  assert.deepEqual(normalizeBuild(w, null), defaultBuild(w))
})

test('temps pour tuer : de près, au plus loin, à la tête', () => {
  const { out } = computeBuild(w, defaultBuild(w))
  assert.deepEqual(timeToKill(out, 'close'), { shots: 4, ms: Math.round((3 * 60_000) / 830) })
  assert.deepEqual(timeToKill(out, 'far'), { shots: 6, ms: Math.round((5 * 60_000) / 830) })
  assert.equal(timeToKill(out, 'close', true)!.shots, 3)
  assert.equal(timeToKill({}, 'close'), null)
})

/** Recherche « à la main » : toutes les combinaisons, chacune calculée par computeBuild. */
function brute(cur: Record<string, string>, opts: { locked?: SlotId[]; minMag?: number; suppressed?: boolean }) {
  const locked = new Set(opts.locked ?? [])
  const searched = SEARCHED.filter((s) => !locked.has(s))
  const fixed: Record<string, string> = {}
  for (const [s, v] of Object.entries(normalizeBuild(w, cur))) if (!searched.includes(s as never)) fixed[s] = v!
  const fixedPts = buildPoints(w, fixed).total
  const lists = searched.map((s) => searchChoices(w, s, opts))
  const best: Record<string, { score: number[]; pts: number } | null> = {}
  const cmp = (a: number[], b: number[]): number => {
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return a[i] - b[i]
    return 0
  }
  const rec = (i: number, b: Record<string, string>, pts: number): void => {
    if (pts > BUDGET) return
    if (i === lists.length) {
      const { out } = computeBuild(w, b)
      for (const g of GOALS) {
        const score = goalScore(g, out)
        const cur = best[g]
        const d = cur ? cmp(score, cur.score) : 1
        if (d > 0 || (d === 0 && cur && pts < cur.pts)) best[g] = { score, pts }
      }
      return
    }
    for (const a of lists[i]) {
      const next = { ...b }
      if (a) next[searched[i]] = a.name
      rec(i + 1, next, pts + (a?.pts ?? 0))
    }
  }
  rec(0, fixed, fixedPts)
  return best
}

for (const [label, cur, opts] of [
  ['config de série, 30 balles au moins', {}, { minMag: 30 }],
  ['avec silencieux, sous le canon verrouillé', { underbarrel: 'Low-Profile Stubby' }, { minMag: 30, suppressed: true, locked: ['underbarrel'] }],
  ['optique chère, sans contrainte', { optic: w.attachments.optic!.at(-1)!.name }, {}]
] as const) {
  test(`meilleures configs = toutes les combinaisons essayées (${label})`, () => {
    const fast = bestBuilds(w, cur, opts as never)
    const ref = brute(cur as never, opts as never)
    for (const g of GOALS) {
      const f = fast[g]
      const r = ref[g]
      assert.ok(f && r, g)
      assert.deepEqual(goalScore(g, f!.out), r!.score, `${g} : score`)
      assert.equal(f!.pts, r!.pts, `${g} : points`)
      assert.ok(f!.pts <= BUDGET)
      assert.equal(buildPoints(w, f!.build).total, f!.pts)
      if ((opts as { minMag?: number }).minMag) assert.ok(((f!.out.mag as number) ?? 0) >= 30, `${g} : chargeur`)
    }
  })
}

test('avec silencieux : la bouche est un silencieux ; verrou respecté', () => {
  const r = bestBuilds(w, { muzzle: 'Flash Hider' }, { suppressed: true, minMag: 30 })
  for (const g of GOALS) assert.match(r[g]!.build.muzzle!, /Suppressor/)
  const locked = bestBuilds(w, { muzzle: 'Flash Hider' }, { suppressed: true, locked: ['muzzle'] })
  for (const g of GOALS) assert.equal(locked[g]!.build.muzzle, 'Flash Hider')
})
