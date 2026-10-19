import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { capitalize } from '@shared/text'
import type { Bf6Account, Bf6Point } from '@shared/types'
import { Segmented } from '../ui/Overlay'
import './progress.css'

// Progression : un relevé de tes totaux par jour (pris à chaque ouverture de la page, et par Player X en arrière-plan),
// gardé sur ce PC. La courbe montre l'évolution d'un ratio ; les tuiles, ce que tu as fait sur la période.

const api = window.launcher

type Metric = 'kd' | 'kpm' | 'win'
type Range = '7' | '30' | 'all'

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

const METRICS: Record<Metric, { label: string; short: string; value: (p: Bf6Point) => number; format: (n: number) => string; signed: (n: number) => string }> =
  {
    kd: {
      label: 'Ratio K/D',
      short: 'K/D',
      value: (p) => (p.deaths ? p.kills / p.deaths : p.kills),
      format: (n) => dec.format(n),
      signed: (n) => `${n >= 0 ? '+' : '−'}${dec.format(Math.abs(n))}`
    },
    kpm: {
      label: 'Éliminations par minute',
      short: 'Élim./min',
      value: (p) => p.killsPerMinute,
      format: (n) => dec.format(n),
      signed: (n) => `${n >= 0 ? '+' : '−'}${dec.format(Math.abs(n))}`
    },
    win: {
      label: 'Victoires',
      short: '% victoires',
      value: (p) => (p.wins + p.losses ? (p.wins / (p.wins + p.losses)) * 100 : 0),
      format: (n) => `${pct.format(n)} %`,
      signed: (n) => `${n >= 0 ? '+' : '−'}${pct.format(Math.abs(n))} pt`
    }
  }

const RANGE_DAYS: Record<Range, number> = { '7': 7, '30': 30, all: Infinity }

/** Durée lisible pour un écart de temps de jeu. */
function playedFor(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${h} h`
}

/** Graduations « rondes » couvrant [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max - min < 1e-9) {
    const pad = Math.max(Math.abs(max) * 0.05, 0.05)
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  // La dernière graduation est toujours au-dessus du maximum : la courbe ne sort jamais du cadre.
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let i = 0; start + i * step <= end + step * 1e-6; i++) ticks.push(Math.round((start + i * step) / step) * step)
  return ticks
}

/** Décimales utiles pour un pas de graduation (0,05 → 2, 0,5 → 1, 5 → 0). */
const stepDecimals = (step: number): number => Math.min(2, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)))

/** « 1er août », « 12 sept. » */
const dayLabel = (t: number): string => dayFmt.format(t).replace(/^1 /, '1er ')

export function Progress({ account, fetchedAt }: { account: Bf6Account; fetchedAt: number }): React.JSX.Element | null {
  const [history, setHistory] = useState<Bf6Point[] | null>(null)
  const [metric, setMetric] = useState<Metric>('kd')
  const [range, setRange] = useState<Range>('30')

  // Relu à chaque nouvelle lecture des stats : le relevé du jour vient peut-être d'être ajouté.
  useEffect(() => {
    let alive = true
    api
      .bf6History(account)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]))
    return () => {
      alive = false
    }
  }, [account, fetchedAt])

  const points = useMemo(() => {
    if (!history) return []
    const days = RANGE_DAYS[range]
    if (!Number.isFinite(days)) return history
    const since = Date.now() - days * 86_400_000
    const inRange = history.filter((p) => p.at >= since)
    // Le relevé juste avant la période sert de point de départ, s'il n'est pas trop ancien
    // (sinon « 7 j » afficherait des mois après une longue pause).
    const before = history.filter((p) => p.at < since && p.at >= since - Math.max(2, days / 2) * 86_400_000).at(-1)
    return before ? [before, ...inRange] : inRange
  }, [history, range])

  if (!history) return <div className="skel pg-skel" />

  const first = points[0]
  const last = points.at(-1)
  const m = METRICS[metric]
  const enough = points.length >= 2 && first && last

  const dKills = enough ? last.kills - first.kills : 0
  const dDeaths = enough ? last.deaths - first.deaths : 0
  const dMatches = enough ? last.matches - first.matches : 0
  const dWins = enough ? last.wins - first.wins : 0
  const dSeconds = enough ? last.secondsPlayed - first.secondsPlayed : 0
  const change = enough ? m.value(last) - m.value(first) : 0

  return (
    <section className="card-surface bf-card pg" aria-labelledby="pg-title">
      <header className="bf-card-head">
        <div className="pg-head-text">
          <h2 id="pg-title" className="bf-card-title">
            Progression
          </h2>
          <span className="caption">Un relevé par jour, gardé sur ce PC</span>
        </div>
        {history.length >= 2 && (
          <div className="pg-controls">
            <Segmented
              label="Indicateur"
              value={metric}
              options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].short }))}
              onChange={setMetric}
            />
            <Segmented
              label="Période"
              value={range}
              options={[
                { value: '7', label: '7 j' },
                { value: '30', label: '30 j' },
                { value: 'all', label: 'Tout' }
              ]}
              onChange={setRange}
            />
          </div>
        )}
      </header>

      {enough ? (
        <>
          <div className="pg-summary">
            <div className="pg-now">
              <span className="overline">{m.label}</span>
              <span className="pg-now-value num">{m.format(m.value(last))}</span>
              <span className={`pg-change ${change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`}>
                <span className="pg-arrow" aria-hidden="true">
                  {change > 0 ? '↗' : change < 0 ? '↘' : '→'}
                </span>
                <span className="num">{m.signed(change)}</span> depuis le {dayLabel(first.at)}
              </span>
            </div>
            <dl className="pg-tiles">
              <Tile label="Éliminations" value={`+${int.format(dKills)}`} />
              <Tile label="K/D sur la période" value={dec.format(dDeaths ? dKills / dDeaths : dKills)} />
              <Tile label="Parties" value={int.format(dMatches)} sub={dMatches ? `${int.format(dWins)} gagnée${dWins > 1 ? 's' : ''}` : undefined} />
              <Tile label="Temps de jeu" value={playedFor(dSeconds)} />
            </dl>
          </div>
          <Chart key={`${range}:${points.length}`} points={points} metric={metric} />
        </>
      ) : (
        <div className="pg-empty">
          <svg className="pg-empty-art" viewBox="0 0 240 64" aria-hidden="true">
            <path className="pg-empty-line" d="M4 52 C 40 50, 60 30, 96 34 S 150 18, 180 22 S 220 10, 236 8" />
            <circle className="pg-empty-dot" cx="4" cy="52" r="4" />
          </svg>
          <p className="bf-text">
            {history.length >= 2
              ? 'Pas encore deux relevés sur cette période : choisis « Tout » pour voir toute ta courbe.'
              : history.length
                ? 'Premier relevé enregistré. Reviens demain : ta courbe se dessine à raison d’un relevé par jour.'
                : 'Ta courbe commence aujourd’hui : Player X garde un relevé de tes stats chaque jour.'}
          </p>
        </div>
      )}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }): React.JSX.Element {
  return (
    <div className="pg-tile">
      <dt className="caption">{label}</dt>
      <dd className="num">
        {value}
        {sub && <span className="caption pg-tile-sub">{sub}</span>}
      </dd>
    </div>
  )
}

/* ---------- courbe ---------- */

const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

function Chart({ points, metric }: { points: Bf6Point[]; metric: Metric }): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const gradId = `pg-grad${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const m = METRICS[metric]

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = (width: number): void => setW(Math.max(280, Math.round(width)))
    // Largeur réelle dès le premier rendu : la courbe ne se dessine pas d'abord à 640 px.
    fit(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = points.map(m.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const yMin = ticks[0]
  const yMax = ticks.at(-1)!
  const t0 = points[0].at
  const t1 = points.at(-1)!.at
  const x = (t: number): number => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (w - PAD.left - PAD.right)
  const y = (v: number): number => PAD.top + (1 - (v - yMin) / Math.max(1e-9, yMax - yMin)) * (H - PAD.top - PAD.bottom)
  const xy = points.map((p, i) => [x(p.at), y(values[i])] as const)
  const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const area = `${line} L${xy.at(-1)![0].toFixed(1)} ${H - PAD.bottom} L${xy[0][0].toFixed(1)} ${H - PAD.bottom} Z`

  // Dates en bas : réparties dans le temps, jamais à moins de 80 px l'une de l'autre.
  const labelCount = Math.min(points.length, w < 480 ? 3 : 5)
  const labelIdx: number[] = []
  for (let i = 0; i < labelCount; i++) {
    const target = t0 + ((t1 - t0) * i) / Math.max(1, labelCount - 1)
    let best = 0
    for (let j = 1; j < points.length; j++) if (Math.abs(points[j].at - target) < Math.abs(points[best].at - target)) best = j
    const prevIdx = labelIdx.at(-1)
    if (prevIdx === undefined || xy[best][0] - xy[prevIdx][0] >= 80) labelIdx.push(best)
    // La dernière date gagne sur l'avant-dernière quand elles se gênent.
    else if (i === labelCount - 1 && labelIdx.length > 1) labelIdx[labelIdx.length - 1] = best
  }
  const tickDecimals = stepDecimals(ticks.length > 1 ? ticks[1] - ticks[0] : 1)
  const tickText = (t: number): string => {
    const n = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: tickDecimals, maximumFractionDigits: tickDecimals }).format(t)
    return metric === 'win' ? `${n} %` : n
  }

  const nearest = (clientX: number): number => {
    const rect = box.current!.getBoundingClientRect()
    const px = clientX - rect.left
    let best = 0
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i][0] - px) < Math.abs(xy[best][0] - px)) best = i
    return best
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = active ?? points.length - 1
    setActive(Math.min(points.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  const a = active !== null ? points[active] : null
  const prev = active !== null && active > 0 ? points[active - 1] : null
  const tipLeft = active !== null ? Math.min(Math.max(xy[active][0], 90), w - 90) : 0

  return (
    <div
      ref={box}
      className="pg-chart"
      tabIndex={0}
      role="img"
      aria-label={`${m.label} : de ${m.format(values[0])} le ${dayLabel(t0)} à ${m.format(values.at(-1)!)} le ${dayLabel(t1)}. Flèches gauche et droite pour parcourir les jours.`}
      onPointerMove={(e) => setActive(nearest(e.clientX))}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="pg-grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
                {tickText(t)}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={xy[i][0]} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
              {dayLabel(points[i].at)}
            </text>
          ))}
        </g>
        <path className="pg-area" d={area} fill={`url(#${gradId})`} style={{ d: `path('${area}')` } as React.CSSProperties} />
        <path className="pg-line" d={line} pathLength={1} style={{ d: `path('${line}')` } as React.CSSProperties} />
        {active !== null && (
          <g className="pg-cross">
            <line x1={xy[active][0]} x2={xy[active][0]} y1={PAD.top} y2={H - PAD.bottom} />
          </g>
        )}
        <circle className="pg-last-halo" cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r="10" />
        <circle className="pg-dot is-last" cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r="4.5" />
        {active !== null && active !== points.length - 1 && <circle className="pg-dot" cx={xy[active][0]} cy={xy[active][1]} r="4.5" />}
      </svg>

      {a && (
        <div className="pg-tip" style={{ left: tipLeft, top: Math.max(0, xy[active!][1] - 12) }} role="presentation">
          <span className="pg-tip-day">{capitalize(longDay.format(a.at))}</span>
          <span className="pg-tip-value">
            <span className="pg-tip-swatch" aria-hidden="true" />
            {m.short} <strong className="num">{m.format(values[active!])}</strong>
          </span>
          {prev && (
            <span className="caption pg-tip-delta">
              {a.at - prev.at < 1.5 * 86_400_000 ? 'Depuis la veille' : `Depuis le ${dayLabel(prev.at)}`} :{' '}
              <span className="num">+{int.format(a.kills - prev.kills)}</span> élim., <span className="num">{int.format(a.matches - prev.matches)}</span> partie
              {a.matches - prev.matches > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <table className="sr-only">
        <caption>{m.label} par jour</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">{m.short}</th>
            <th scope="col">Éliminations</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.at}>
              <td>{longDay.format(p.at)}</td>
              <td>{m.format(values[i])}</td>
              <td>{int.format(p.kills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
