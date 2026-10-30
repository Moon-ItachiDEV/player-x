// Calcul d'une config et recherche des meilleures configs. Les règles de calcul sont celles de la « BF6 Attachment
// Database » d'AntiPhysicsGames (v0.9.4, computeBuild et recNet), https://github.com/AntiPhysicsGames/battlefield6-attachment-database,
// licence CC BY-NC-SA 4.0 (crédit, pas d'usage commercial, dérivés sous la même licence) : ce fichier est distribué sous
// cette même licence. La recherche des meilleures configs (objectifs, contraintes) est propre à Player X.
//
// Chaque accessoire porte les valeurs du panneau quand il est seul sur l'arme de série. Une config les empile :
// - temps de visée, sortie de sprint, vitesse en visant et hanche avancent sur l'échelle du jeu d'autant de crans que
//   chaque accessoire en fait gagner seul (bornés au bout de l'échelle) ;
// - contrôle, précision, mobilité, recul, variation du recul et vitesse de la balle s'additionnent ;
// - le reste (chargeur, rechargement, multiplicateurs, options) prend la valeur de l'accessoire ;
// - le recul se compte en crans sur une valeur cachée (+RECn, −RECn, Linear = −1), pour que des crans trop petits pour
//   se voir seuls comptent une fois empilés.
// Le panneau arrondit ses valeurs : une barre empilée peut tomber à un point près.
import type { ArmoryAttachment, ArmoryWeapon, Build, SlotId, Stats } from './types'

export const SLOT_ORDER: SlotId[] = ['optic', 'optic-accessory', 'muzzle', 'barrel', 'underbarrel', 'magazine', 'ammo', 'accessory', 'right-accessory', 'ergonomics']
/** Emplacements qui ne restent jamais vides. */
export const REQUIRED: SlotId[] = ['optic', 'barrel', 'magazine', 'ammo']
export const BUDGET = 100

/** Échelles du jeu (relevés d'AntiPhysicsGames). */
export const LADDER: Record<string, number[]> = {
  ads_time_in_ms: [500, 433, 367, 300, 250, 200, 167, 133, 100],
  sprint_recovery_ms: [400, 350, 300, 267, 233, 200, 167, 133, 100, 83, 67],
  ads_move_speed_mult: [0.47, 0.54, 0.6, 0.67, 0.75, 0.82],
  hipfire: [29, 34, 40, 47, 54, 62]
}
const SUMMED = new Set(['control', 'precision', 'mobility', 'recoil_amount_deg', 'recoil_variation_deg', 'muzzle_velocity'])
/** Stats où une valeur plus basse est meilleure. */
export const LOWER_BETTER = new Set(['ads_time_in_ms', 'sprint_recovery_ms', 'reload_s', 'recoil_amount_deg', 'recoil_variation_deg', 'spot_3d_m', 'spot_2d_m'])

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

export const slotsOf = (w: ArmoryWeapon): SlotId[] => SLOT_ORDER.filter((s) => (w.attachments[s]?.length ?? 0) > 0)

export const pickAtt = (w: ArmoryWeapon, slot: SlotId, name: string | undefined): ArmoryAttachment | undefined =>
  name === undefined ? undefined : w.attachments[slot]?.find((a) => a.name === name)

/** Accessoires d'optique que l'optique choisie accepte. */
export function opticAccessories(w: ArmoryWeapon, b: Build): ArmoryAttachment[] {
  const enables = pickAtt(w, 'optic', b.optic)?.enables ?? []
  return (w.attachments['optic-accessory'] ?? []).filter((a) => enables.includes(a.name))
}

/** Config de série : le premier accessoire des emplacements obligatoires, rien ailleurs. */
export function defaultBuild(w: ArmoryWeapon): Build {
  const b: Build = {}
  for (const s of REQUIRED) {
    const first = w.attachments[s]?.[0]
    if (first) b[s] = first.name
  }
  return b
}

/** Config relue (stockage, lien) : noms inconnus retirés, emplacements obligatoires remplis, accessoire d'optique accepté. */
export function normalizeBuild(w: ArmoryWeapon, raw: unknown): Build {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const b: Build = {}
  for (const s of slotsOf(w)) {
    const name = src[s]
    if (typeof name === 'string' && pickAtt(w, s, name)) b[s] = name
    else if (REQUIRED.includes(s)) b[s] = w.attachments[s]![0].name
  }
  if (b['optic-accessory'] && !opticAccessories(w, b).some((a) => a.name === b['optic-accessory'])) delete b['optic-accessory']
  return b
}

/** Points de la config ; `unknown` : au moins un accessoire sans points relevés. */
export function buildPoints(w: ArmoryWeapon, b: Build): { total: number; unknown: boolean } {
  let total = 0
  let unknown = false
  for (const s of SLOT_ORDER) {
    const a = pickAtt(w, s, b[s])
    if (!a) continue
    if (a.pts === null) unknown = true
    else total += a.pts
  }
  return { total, unknown }
}

/** Crans de recul d'un accessoire : +RECn = n, −RECn = −n, Linear = −1 ; « coup par coup seulement » : aucun. */
export function recNet(tags: string[] = []): number {
  const ps = tags.map((t) => t.match(/^([+-]?)(REC|LINEAR|SEMI-ONLY)(\d?)$/)).filter((m): m is RegExpMatchArray => !!m)
  if (ps.some((m) => m[2] === 'SEMI-ONLY')) return 0
  let n = 0
  for (const m of ps) n += m[2] === 'LINEAR' ? -1 : (Number(m[3]) || 1) * (m[1] === '-' ? -1 : 1)
  return n
}

const round = (k: string, v: number): number => +v.toFixed(k.endsWith('_deg') ? 1 : 0)

export interface Computed {
  /** Arme de série (panneau et barres). */
  base: Stats
  /** Avec la config. */
  out: Stats
  /** Stats qui voudraient dépasser le bout de leur échelle (affichées « ≤ » ou « ≥ »). */
  beyond: Set<string>
}

/** Panneau de l'arme avec la config (règles d'AntiPhysicsGames). */
export function computeBuild(w: ArmoryWeapon, b: Build): Computed {
  const base: Stats = { ...w.stats, ...w.bars }
  const out: Stats = { ...base }
  const step: Record<string, number> = {}
  const add: Record<string, number> = {}
  const beyond = new Set<string>()
  let net = 0
  for (const s of SLOT_ORDER) {
    const a = pickAtt(w, s, b[s])
    if (!a) continue
    net += recNet(a.tags)
    for (const [k, v] of Object.entries(a.changes ?? {})) {
      const L = LADDER[k]
      const bv = base[k]
      if (L && typeof bv === 'number' && typeof v === 'number' && L.includes(bv) && L.includes(v)) step[k] = (step[k] ?? 0) + L.indexOf(v) - L.indexOf(bv)
      else if (SUMMED.has(k) && typeof v === 'number' && typeof bv === 'number') add[k] = (add[k] ?? 0) + v - bv
      else out[k] = v
    }
  }
  for (const [k, n] of Object.entries(step)) {
    const L = LADDER[k]
    const i = L.indexOf(base[k] as number) + n
    out[k] = L[Math.max(0, Math.min(L.length - 1, i))]
    if (i < 0 || i >= L.length) beyond.add(k)
  }
  for (const [k, d] of Object.entries(add)) out[k] = round(k, (base[k] as number) + d)
  if (w.recModel && num(base.recoil_amount_deg) !== undefined) out.recoil_amount_deg = +(w.recModel.b * (1 - w.recModel.s * net)).toFixed(1)
  return { base, out, beyond }
}

/** Temps pour tuer (100 points de vie, toutes les balles au but) : de près, ou au plus loin, au corps ou à la tête. */
export function timeToKill(out: Stats, range: 'close' | 'far', head = false): { shots: number; ms: number } | null {
  const dmg = num(range === 'close' ? out.dmg : out.long_range_dmg)
  const rof = num(out.rof)
  const mult = head ? num(out.headshot_mult) : 1
  if (!dmg || !rof || !mult) return null
  const shots = Math.ceil(100 / (dmg * mult) - 1e-9)
  return { shots, ms: Math.round(((shots - 1) * 60_000) / rof) }
}

// ---------- meilleures configs ----------

export type GoalId = 'close' | 'mid' | 'long' | 'control' | 'ads' | 'hipfire' | 'balanced'
export const GOALS: GoalId[] = ['close', 'mid', 'long', 'control', 'ads', 'hipfire', 'balanced']

const n = (o: Stats, k: string): number => num(o[k]) ?? 0

/** Un critère : une somme de stats, chacune avec son sens (+1 plus grand = mieux, −1 plus petit = mieux). */
type Term = [string, number][]
const BARS: Term = [
  ['hipfire', 1],
  ['precision', 1],
  ['control', 1],
  ['mobility', 1]
]

/** Critères de chaque objectif, du plus important au moins important. */
export const GOAL_TERMS: Record<GoalId, Term[]> = {
  close: [
    [
      ['hipfire', 1],
      ['mobility', 1]
    ],
    [['ads_time_in_ms', -1]],
    [['control', 1]]
  ],
  mid: [
    [
      ['control', 1],
      ['precision', 1]
    ],
    [['ads_time_in_ms', -1]],
    [['mobility', 1]]
  ],
  long: [
    [
      ['control', 1],
      ['precision', 1]
    ],
    [['muzzle_velocity', 1]],
    [['headshot_mult', 1]],
    [['ads_time_in_ms', -1]],
    [['mobility', 1]]
  ],
  control: [[['control', 1]], [['recoil_amount_deg', -1]], [['recoil_variation_deg', -1]], [['ads_time_in_ms', -1]], [['mobility', 1]]],
  ads: [[['ads_time_in_ms', -1]], [['mobility', 1]], [['control', 1]]],
  hipfire: [[['hipfire', 1]], [['mobility', 1]], [['control', 1]]],
  balanced: [BARS, [['ads_time_in_ms', -1]]]
}

/** Note d'une config pour un objectif (à comparer critère par critère, plus grand = meilleur). */
export const goalScore = (g: GoalId, o: Stats): number[] => GOAL_TERMS[g].map((t) => t.reduce((sum, [k, sign]) => sum + sign * n(o, k), 0))

/** Emplacements que la recherche essaie ; les autres (optique, accessoires d'optique et de droite, ergonomie) restent ceux du joueur. */
export const SEARCHED: SlotId[] = ['muzzle', 'barrel', 'underbarrel', 'magazine', 'ammo', 'accessory']

export interface BestOptions {
  /** Emplacements verrouillés : gardés tels quels. */
  locked?: SlotId[]
  /** Chargeur d'au moins tant de balles (sinon les petits chargeurs gagnent toujours en mobilité). */
  minMag?: number
  /** Bouche du canon limitée aux silencieux (sauf si elle est verrouillée). */
  suppressed?: boolean
}

export interface BestBuild {
  build: Build
  out: Stats
  pts: number
}

export const isSuppressor = (a: ArmoryAttachment): boolean => /suppress/i.test(a.type) || /suppress/i.test(a.name)

/** Choix possibles d'un emplacement pour la recherche (null = vide). */
export function searchChoices(w: ArmoryWeapon, s: SlotId, opts: BestOptions): (ArmoryAttachment | null)[] {
  const base = num(w.stats.mag)
  let list = (w.attachments[s] ?? []).filter((a) => a.pts !== null)
  if (s === 'magazine' && opts.minMag) list = list.filter((a) => (num(a.changes?.mag) ?? base ?? 0) >= opts.minMag!)
  if (s === 'muzzle' && opts.suppressed) list = list.filter(isSuppressor)
  return REQUIRED.includes(s) || (s === 'muzzle' && opts.suppressed) ? list : [null, ...list]
}

// Accessoire précompilé pour la recherche : ses crans, ses ajouts et ses valeurs imposées, rangés par stat.
interface Fast {
  att: ArmoryAttachment | null
  pts: number
  steps: [number, number][]
  adds: [number, number][]
  sets: [number, number][]
  rec: number
}

/**
 * Meilleure config de chaque objectif, dans le budget de 100 points, en essayant toutes les combinaisons des
 * emplacements de SEARCHED (sauf ceux verrouillés). À égalité, la moins chère. Même calcul que computeBuild,
 * précompilé (les tests le vérifient sur toutes les combinaisons).
 */
export function bestBuilds(w: ArmoryWeapon, current: Build, opts: BestOptions = {}): Record<GoalId, BestBuild | null> {
  const locked = new Set(opts.locked ?? [])
  const cur = normalizeBuild(w, current)
  const searched = SEARCHED.filter((s) => !locked.has(s) && (w.attachments[s]?.length ?? 0) > 0)
  const fixed: Build = {}
  for (const s of SLOT_ORDER) if (!searched.includes(s) && cur[s]) fixed[s] = cur[s]
  const fixedPts = buildPoints(w, fixed)
  const empty = Object.fromEntries(GOALS.map((g) => [g, null])) as Record<GoalId, BestBuild | null>
  if (fixedPts.unknown || fixedPts.total > BUDGET) return empty

  // Stats suivies, indexées.
  const keys = [
    'hipfire',
    'precision',
    'control',
    'mobility',
    'ads_time_in_ms',
    'sprint_recovery_ms',
    'ads_move_speed_mult',
    'muzzle_velocity',
    'recoil_amount_deg',
    'recoil_variation_deg',
    'headshot_mult',
    'mag'
  ]
  const idx = new Map(keys.map((k, i) => [k, i]))
  const base: Stats = { ...w.stats, ...w.bars }
  const compile = (a: ArmoryAttachment | null): Fast => {
    const f: Fast = { att: a, pts: a?.pts ?? 0, steps: [], adds: [], sets: [], rec: recNet(a?.tags) }
    for (const [k, v] of Object.entries(a?.changes ?? {})) {
      const i = idx.get(k)
      if (i === undefined || typeof v !== 'number') continue
      const L = LADDER[k]
      const bv = base[k]
      if (L && typeof bv === 'number' && L.includes(bv) && L.includes(v)) f.steps.push([i, L.indexOf(v) - L.indexOf(bv)])
      else if (SUMMED.has(k) && typeof bv === 'number') f.adds.push([i, v - bv])
      else f.sets.push([i, v])
    }
    return f
  }
  const fixedFast = SLOT_ORDER.filter((s) => fixed[s]).map((s) => compile(pickAtt(w, s, fixed[s])!))
  // Dans un emplacement, un choix aussi bon partout qu'un autre et pas plus cher le rend inutile à essayer : chaque
  // objectif ne combine que des stats dans leur bon sens (crans d'échelle, ajouts, crans de recul).
  const good = (f: Fast): Float64Array => {
    const v = new Float64Array(keys.length + 1)
    for (const [i, d] of f.steps) v[i] += d
    for (const [i, d] of f.adds) v[i] += LOWER_BETTER.has(keys[i]) ? -d : d
    v[keys.length] = f.rec
    return v
  }
  const sameSets = (a: Fast, b: Fast): boolean => a.sets.length === b.sets.length && a.sets.every(([i, v], j) => b.sets[j][0] === i && b.sets[j][1] === v)
  const prune = (list: Fast[]): Fast[] => {
    const g = list.map(good)
    return list.filter((b, j) => {
      for (let i = 0; i < list.length; i++) {
        if (i === j) continue
        const a = list[i]
        if (a.pts > b.pts || !sameSets(a, b)) continue
        let ge = true
        let gt = a.pts < b.pts
        for (let k = 0; k < g[i].length && ge; k++) {
          if (g[i][k] < g[j][k] - 1e-9) ge = false
          else if (g[i][k] > g[j][k] + 1e-9) gt = true
        }
        // Strictement meilleur, ou identique et placé avant : b est écarté.
        if (ge && (gt || i < j)) return false
      }
      return true
    })
  }
  const choices = searched.map((s) => prune(searchChoices(w, s, opts).map(compile)))
  if (choices.some((c) => !c.length)) return empty

  const K = keys.length
  // Config en cours, construite emplacement par emplacement (posée en descendant, retirée en remontant).
  const step = new Float64Array(K)
  const add = new Float64Array(K)
  const set = new Float64Array(K)
  // Comme computeBuild : une stat qui a reçu des crans (ou des ajouts) les applique, même si leur somme est nulle.
  const stepped = new Int32Array(K)
  const added = new Int32Array(K)
  const has = new Uint8Array(K)
  let net = 0
  // Valeurs de la config en cours (0 pour une stat que l'arme n'a pas, comme goalScore).
  const vals = new Float64Array(K)
  const recIdx = idx.get('recoil_amount_deg')!
  // Critères compilés en indices de stats ; meilleure note, points et choix de chaque objectif.
  const cterms = GOALS.map((g) => GOAL_TERMS[g].map((t) => t.map(([k, sign]) => [idx.get(k)!, sign] as [number, number])))
  const termValue = (t: [number, number][]): number => {
    let x = 0
    for (let j = 0; j < t.length; j++) x += t[j][1] * vals[t[j][0]]
    return x
  }
  const bestScore = cterms.map((t) => new Float64Array(t.length))
  const bestPts = new Float64Array(GOALS.length)
  const bestPick: (Fast[] | null)[] = GOALS.map(() => null)
  const recModel = w.recModel && num(base.recoil_amount_deg) !== undefined ? w.recModel : null
  const baseVals = keys.map((k) => num(base[k]))
  const ladderAt = keys.map((k, i) => (LADDER[k] && baseVals[i] !== undefined ? LADDER[k].indexOf(baseVals[i]!) : -1))

  // Un niveau par emplacement, dans l'ordre de computeBuild (la dernière valeur imposée gagne) : un emplacement
  // gardé n'a qu'un choix. searchedAt : rang de l'emplacement dans `searched`, ou −1.
  const levels: Fast[][] = []
  const searchedAt: number[] = []
  let fi = 0
  for (const s of SLOT_ORDER) {
    if (fixed[s]) {
      levels.push([fixedFast[fi++]])
      searchedAt.push(-1)
    }
    const si = searched.indexOf(s)
    if (si >= 0) {
      levels.push(choices[si])
      searchedAt.push(si)
    }
  }
  const pickAt: Fast[] = new Array(levels.length)

  const apply = (f: Fast, saved: number[]): void => {
    net += f.rec
    for (const [i, d] of f.steps) {
      step[i] += d
      stepped[i]++
    }
    for (const [i, d] of f.adds) {
      add[i] += d
      added[i]++
    }
    for (const [i, v] of f.sets) {
      saved.push(set[i], has[i])
      set[i] = v
      has[i] = 1
    }
  }
  const undo = (f: Fast, saved: number[]): void => {
    net -= f.rec
    for (const [i, d] of f.steps) {
      step[i] -= d
      stepped[i]--
    }
    for (const [i, d] of f.adds) {
      add[i] -= d
      added[i]--
    }
    for (let j = f.sets.length - 1; j >= 0; j--) {
      const i = f.sets[j][0]
      has[i] = saved.pop()!
      set[i] = saved.pop()!
    }
  }

  const leaf = (pts: number): void => {
    for (let i = 0; i < K; i++) {
      const bv = baseVals[i]
      if (bv === undefined) continue
      let v = has[i] ? set[i] : bv
      if (stepped[i] && ladderAt[i] >= 0) {
        const L = LADDER[keys[i]]
        v = L[Math.max(0, Math.min(L.length - 1, ladderAt[i] + Math.round(step[i])))]
      }
      if (added[i]) v = round(keys[i], bv + add[i])
      vals[i] = v
    }
    if (recModel) vals[recIdx] = +(recModel.b * (1 - recModel.s * net)).toFixed(1)
    for (let g = 0; g < GOALS.length; g++) {
      const terms = cterms[g]
      const bs = bestScore[g]
      let d = 0
      if (bestPick[g]) {
        for (let t = 0; t < terms.length && d === 0; t++) {
          const x = termValue(terms[t])
          if (Math.abs(x - bs[t]) > 1e-9) d = x - bs[t]
        }
      }
      if (!bestPick[g] || d > 0 || (d === 0 && pts < bestPts[g])) {
        for (let t = 0; t < terms.length; t++) bs[t] = termValue(terms[t])
        bestPts[g] = pts
        bestPick[g] = pickAt.slice()
      }
    }
  }

  // Points minimaux des niveaux restants, pour couper tôt (les emplacements gardés comptent dans le budget).
  const minRest = levels.map((_, i) => levels.slice(i + 1).reduce((sum, c) => sum + Math.min(...c.map((f) => f.pts)), 0))
  const walk = (lv: number, pts: number): void => {
    if (lv === levels.length) return leaf(pts)
    const saved: number[] = []
    for (const f of levels[lv]) {
      const p = pts + f.pts
      if (p + minRest[lv] > BUDGET) continue
      apply(f, saved)
      pickAt[lv] = f
      walk(lv + 1, p)
      undo(f, saved)
    }
  }
  walk(0, 0)

  const result = { ...empty }
  GOALS.forEach((g, gi) => {
    const p = bestPick[gi]
    if (!p) return
    const build: Build = { ...fixed }
    p.forEach((f, lv) => {
      const si = searchedAt[lv]
      if (si >= 0 && f.att) build[searched[si]] = f.att.name
    })
    result[g] = { build, out: computeBuild(w, build).out, pts: bestPts[gi] }
  })
  return result
}
