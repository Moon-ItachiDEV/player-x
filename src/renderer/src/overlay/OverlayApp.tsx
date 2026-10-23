// Overlay CS2 (bêta) : la page de la fenêtre transparente posée par-dessus le jeu (main/services/cs2Overlay.ts).
// Elle suit le match tout seul : temps d'achat, pastille pendant le round, mi-temps, fin du match. Trois styles à essayer
// en jeu (Paramètres › Overlay) : A façon Apple, B verre, C finition du style Player X. Rien ne se clique : la souris
// et le clavier restent au jeu ; Alt+X masque l'overlay.
import { useEffect, useState } from 'react'
import { formatKd, killDeath, mapLabel, modeLabel, RESULT_LABEL } from '@shared/cs2'
import type { Cs2Live, Cs2OverlayConfig, Cs2OverlayStyle, Cs2Recap, Cs2Round } from '@shared/types'
import { sampleCs2Recap } from '../components/cs2/useCs2'
import './overlay.css'

const api = window.launcher

/** Les maquettes sont dessinées sur un écran de 1080 px de haut : l'overlay suit la hauteur de l'écran. */
const DESIGN_H = 1080
/** Fin du match : le bilan reste 20 s, puis se replie. */
const END_MS = 20_000

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const other = (s: 'CT' | 'T'): 'CT' | 'T' => (s === 'CT' ? 'T' : 'CT')

type View = { kind: 'buy' | 'pill' | 'half'; live: Cs2Live } | { kind: 'end'; recap: Cs2Recap } | null

// ---------- aperçu (chiffres d'exemple) ----------

function sampleLive(phase: 'buy' | 'pill' | 'half'): Cs2Live {
  const r = sampleCs2Recap()
  const done = phase === 'half' ? 12 : 7
  const rounds = r.rounds.slice(0, done)
  const us = rounds.filter((x) => x.side === x.winner).length
  return {
    map: 'de_mirage',
    mode: 'competitive',
    phase: phase === 'half' ? 'intermission' : 'live',
    roundPhase: phase === 'buy' ? 'freezetime' : phase === 'half' ? 'over' : 'live',
    round: phase === 'half' ? 12 : 8,
    rounds,
    side: 'CT',
    score: { us, them: done - us },
    kills: phase === 'half' ? 14 : 9,
    deaths: phase === 'half' ? 9 : 5,
    assists: phase === 'half' ? 3 : 2,
    mvps: 2,
    points: 24,
    health: 100,
    money: 4250,
    roundKills: phase === 'pill' ? 1 : 0,
    adr: phase === 'half' ? 88 : 92,
    hsPct: phase === 'half' ? 46 : 44,
    startedAt: Date.now() - 20 * 60_000
  }
}

/** Les quatre pièces, 6 s chacune, puis rien. */
function previewView(at: number, now: number): View {
  const t = now - at
  if (t < 6_000) return { kind: 'buy', live: sampleLive('buy') }
  if (t < 12_000) return { kind: 'pill', live: sampleLive('pill') }
  if (t < 18_000) return { kind: 'half', live: sampleLive('half') }
  if (t < 24_000) return { kind: 'end', recap: sampleCs2Recap() }
  return null
}

// ---------- ce que montre le vrai match ----------

function liveView(live: Cs2Live | null, end: Cs2Recap | null, now: number): View {
  if (end && now - end.endedAt < END_MS && (!live || live.phase === 'gameover')) return { kind: 'end', recap: end }
  if (!live) return null
  if (live.phase === 'intermission') return { kind: 'half', live }
  if (live.phase !== 'live') return null
  if (live.roundPhase === 'freezetime') return { kind: 'buy', live }
  return { kind: 'pill', live }
}

export default function OverlayApp(): React.JSX.Element | null {
  const [cfg, setCfg] = useState<Cs2OverlayConfig>({ style: 'off', hidden: false })
  const [live, setLive] = useState<Cs2Live | null>(null)
  const [end, setEnd] = useState<Cs2Recap | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [scale, setScale] = useState(() => window.innerHeight / DESIGN_H)

  useEffect(() => {
    // Peint une première fois (transparent) : la fenêtre peut s'afficher sans éclair de fond.
    requestAnimationFrame(() => requestAnimationFrame(() => void api.cs2OverlayReady().catch(() => {})))
    api.cs2OverlayConfig().then(setCfg).catch(() => {})
    api
      .cs2State()
      .then((s) => setLive(s.live))
      .catch(() => {})
    const offCfg = api.onCs2OverlayConfig(setCfg)
    const offLive = api.onCs2Live(setLive)
    // Bilan de fin de match (affiché en jeu même quand la fenêtre de Player X est cachée).
    const offRecap = api.onCs2Recap(({ recap, reason }) => {
      if (reason !== 'open' && Date.now() - recap.endedAt < END_MS) setEnd(recap)
    })
    const onResize = (): void => setScale(window.innerHeight / DESIGN_H)
    window.addEventListener('resize', onResize)
    return () => {
      offCfg()
      offLive()
      offRecap()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Bilan replié : on l'oublie, l'horloge s'arrête.
  useEffect(() => {
    if (!end) return
    const id = setTimeout(() => setEnd(null), Math.max(0, END_MS - (Date.now() - end.endedAt)))
    return () => clearTimeout(id)
  }, [end])

  // Horloge : l'aperçu avance et le bilan se replie tout seul.
  const ticking = cfg.previewAt !== undefined || !!end
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [ticking])

  if (cfg.style === 'off' || cfg.hidden) return null
  const view = cfg.previewAt !== undefined ? previewView(cfg.previewAt, now) : liveView(live, end, now)
  if (!view) return null
  const style = cfg.style
  const endLeft = view.kind === 'end' ? Math.max(0, Math.ceil((END_MS - (now - (cfg.previewAt !== undefined ? cfg.previewAt + 18_000 : view.recap.endedAt))) / 1000)) : 0

  return (
    <div className={`ov-root ov-${style}`} style={{ zoom: scale }} aria-hidden="true">
      {view.kind === 'buy' && <Buy key={`buy-${view.live.round}`} live={view.live} style={style} />}
      {view.kind === 'pill' && <Pill key="pill" live={view.live} style={style} />}
      {view.kind === 'half' && <Half key="half" live={view.live} style={style} />}
      {view.kind === 'end' && <End key={`end-${view.recap.id}`} recap={view.recap} style={style} left={Math.min(20, endLeft)} />}
      {cfg.previewAt !== undefined && <span className="ov-sample">Aperçu · chiffres d’exemple · Alt+X pour masquer</span>}
    </div>
  )
}

// ---------- pièces ----------

function Strip({ rounds, style, upcoming = 0 }: { rounds: Cs2Round[]; style: Cs2OverlayStyle; upcoming?: number }): React.JSX.Element {
  return (
    <ol className="ov-strip">
      {rounds.map((r, i) => {
        const prev = rounds[i - 1]
        const swap = !!prev?.side && !!r.side && prev.side !== r.side
        const tone = !r.side ? 'is-unknown' : r.side === r.winner ? 'is-won' : 'is-lost'
        return (
          <li key={r.n} className={`ov-r ${tone} ${swap ? 'is-swap' : ''}`}>
            {style === 'c' && tone === 'is-won' && <Glyph d="M20 6L9 17l-5-5" />}
            {style === 'c' && tone === 'is-lost' && <Glyph d="M18 6L6 18M6 6l12 12" />}
          </li>
        )
      })}
      {Array.from({ length: upcoming }, (_, i) => (
        <li key={`u${i}`} className="ov-r is-next" />
      ))}
    </ol>
  )
}

function Glyph({ d }: { d: string }): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Score({ live }: { live: Cs2Live }): React.JSX.Element | null {
  if (!live.score || !live.side) return null
  return (
    <div className="ov-score">
      <span className="ov-score-side">
        <span className={`ov-side is-${live.side.toLowerCase()}`}>Ton camp · {live.side}</span>
        <b>{live.score.us}</b>
      </span>
      <span className="ov-dash">–</span>
      <span className="ov-score-side is-them">
        <span className={`ov-side is-${other(live.side).toLowerCase()}`}>{other(live.side)}</span>
        <b>{live.score.them}</b>
      </span>
    </div>
  )
}

function Stats({ items }: { items: [string, string][] }): React.JSX.Element {
  return (
    <dl className="ov-stats" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(([k, v]) => (
        <div key={k} className="ov-stat">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const kda = (l: Pick<Cs2Live, 'kills' | 'deaths' | 'assists'>): string => `${l.kills}/${l.deaths}/${l.assists}`
const pctOf = (n?: number): string => (n === undefined ? '–' : `${n} %`)

function Buy({ live, style }: { live: Cs2Live; style: Cs2OverlayStyle }): React.JSX.Element {
  return (
    <section className="ov-card ov-buy ov-enter">
      <div className="ov-head ov-s1">
        <span className="ov-title">Round {live.round} · temps d’achat</span>
        <span className="ov-sub">{mapLabel(live.map)}</span>
      </div>
      <div className="ov-row ov-s2">
        <Score live={live} />
        {live.money !== undefined && (
          <span className="ov-money">
            <span className="ov-k">Ton argent</span>
            <b>{int.format(live.money)}&nbsp;$</b>
          </span>
        )}
      </div>
      {live.rounds.length > 0 && (
        <div className="ov-s3">
          <Strip rounds={live.rounds} style={style} upcoming={1} />
        </div>
      )}
      <div className="ov-s4">
        <Stats items={[['K/D/A', kda(live)], ['ADR', live.adr === undefined ? '–' : String(live.adr)], ['HS', pctOf(live.hsPct)]]} />
      </div>
    </section>
  )
}

function Pill({ live, style }: { live: Cs2Live; style: Cs2OverlayStyle }): React.JSX.Element {
  return (
    <div className={`ov-card ov-pill ov-enter ${style === 'a' ? 'is-island' : ''}`}>
      <b className="ov-pill-kda">{kda(live)}</b>
      <span className="ov-pill-sep" />
      <span>
        ADR <b>{live.adr === undefined ? '–' : live.adr}</b>
      </span>
      <span className={live.roundKills ? 'ov-pill-hot' : undefined}>
        Ce round <b>{live.roundKills}&nbsp;élim.</b>
      </span>
    </div>
  )
}

function Half({ live, style }: { live: Cs2Live; style: Cs2OverlayStyle }): React.JSX.Element {
  // Pendant la mi-temps, CS2 peut déjà donner le camp de la suite : le camp joué est celui du dernier round,
  // et le score (compté pour le camp actuel) est retourné si le camp a déjà changé.
  const played = live.rounds.at(-1)?.side ?? live.side
  const flipped = !!played && !!live.side && played !== live.side
  const s = live.score && flipped ? { us: live.score.them, them: live.score.us } : live.score
  const lead = !s ? 'Mi-temps' : s.us > s.them ? 'Devant' : s.us < s.them ? 'Derrière' : 'À égalité'
  return (
    <section className="ov-card ov-buy ov-enter">
      <div className="ov-head ov-s1">
        <span className="ov-title">Mi-temps · {mapLabel(live.map)}</span>
      </div>
      <div className="ov-lead ov-s2">
        <b>{lead}</b>
        {s && (
          <span>
            {s.us}–{s.them}
          </span>
        )}
      </div>
      {played && (
        <p className="ov-line ov-s2">
          Tu passes <b>{other(played)}</b> après la mi-temps.
        </p>
      )}
      {live.rounds.length > 0 && (
        <div className="ov-s3">
          <Strip rounds={live.rounds} style={style} />
        </div>
      )}
      <div className="ov-s4">
        <Stats items={[['K/D/A', kda(live)], ['K/D', formatKd(killDeath(live))], ['ADR', live.adr === undefined ? '–' : String(live.adr)], ['HS', pctOf(live.hsPct)]]} />
      </div>
    </section>
  )
}

function End({ recap: r, style, left }: { recap: Cs2Recap; style: Cs2OverlayStyle; left: number }): React.JSX.Element {
  const adr = r.hasRounds && r.roundsTracked > 0 ? int.format(r.damage / r.roundsTracked) : '–'
  const hs = r.trackedKills > 0 ? pctOf(Math.round((r.headshots / r.trackedKills) * 100)) : '–'
  const multi = [r.multi.k3 && `${r.multi.k3} × 3K`, r.multi.k4 && `${r.multi.k4} × 4K`, r.multi.k5 && `${r.multi.k5} ace`].filter(Boolean).join(' · ')
  return (
    <section className={`ov-card ov-end ov-enter ${style === 'a' ? 'is-sheet' : ''}`}>
      {style === 'a' && <span className="ov-grabber" />}
      {style === 'b' && <span className="ov-liquid" />}
      {style === 'b' && <span className="ov-sweep" />}
      <div className="ov-end-top ov-s1">
        <span className="ov-kicker">
          Bilan de match · {modeLabel(r.mode)}
          {r.sample ? ' · exemple' : ''}
        </span>
        <span className="ov-sub">se replie dans {left}&nbsp;s</span>
      </div>
      <div className="ov-end-title ov-s1">
        <b>{mapLabel(r.map)}</b>
        <b className={`ov-res is-${r.result}`}>{RESULT_LABEL[r.result]}</b>
        {r.score && r.result !== 'left' && (
          <span>
            {r.score.us}–{r.score.them}
          </span>
        )}
      </div>
      <div className="ov-s2">
        <Stats items={[['K/D', formatKd(killDeath(r))], ['K/D/A', kda(r)], ['ADR', adr], ['HS', hs]]} />
      </div>
      {r.rounds.length > 0 && (
        <div className="ov-s3">
          <Strip rounds={r.rounds} style={style} />
        </div>
      )}
      <p className="ov-line ov-s4">
        {r.best ? `Meilleur round : le ${r.best.n}e, ${r.best.kills} élim.` : `${r.mvps} MVP`}
        {multi && ` · ${multi}`}
        {r.best && ` · ${r.mvps} MVP`}
      </p>
    </section>
  )
}
