import { useMemo, useState } from 'react'
import type { Game, ScanReport, Store } from '@shared/types'
import { Badge } from './Badge'

type Filter = 'all' | 'favorites' | Store

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'favorites', label: 'Favoris' },
  { id: 'steam', label: 'Steam' },
  { id: 'epic', label: 'Epic' },
  { id: 'ea', label: 'EA' }
]

// Couleur stable par jeu pour les jaquettes générées quand le store n'en fournit pas.
function hue(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

function Cover({ game }: { game: Game }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (game.coverUrl && !failed) return <img className="cover-img" src={game.coverUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
  const h = hue(game.name)
  return (
    <div className="cover-fallback" style={{ background: `linear-gradient(160deg, hsl(${h} 70% 35%), hsl(${(h + 60) % 360} 70% 12%))` }}>
      <span>{game.name}</span>
    </div>
  )
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Jamais lancé'
  const min = Math.round((Date.now() - ts) / 60_000)
  if (min < 1) return "À l'instant"
  if (min < 60) return `Il y a ${min} min`
  if (min < 1440) return `Il y a ${Math.round(min / 60)} h`
  return `Il y a ${Math.round(min / 1440)} j`
}

export function ScanDetails({ report }: { report: ScanReport[] }): React.JSX.Element {
  return (
    <div className="scan-report">
      {report.map((r) => (
        <div key={r.store} className="scan-row">
          <div className="scan-head">
            <Badge kind={r.store} />
            <b>{r.found} jeu(x)</b>
            {r.error && <span className="scan-error">{r.error}</span>}
          </div>
          {r.checked.map((c) => (
            <div key={c} className="scan-line">
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

interface Props {
  games: Game[]
  scanning: boolean
  report: ScanReport[]
  onLaunch: (g: Game) => void
  onRefresh: () => void
  onFavorite: (g: Game) => void
}

export function Library({ games, scanning, report, onLaunch, onRefresh, onFavorite }: Props): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const featured = useMemo(
    () => [...games].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || Number(!!b.heroUrl) - Number(!!a.heroUrl))[0],
    [games]
  )

  const visible = games.filter((g) => {
    if (filter === 'favorites' && !g.favorite) return false
    if (filter !== 'all' && filter !== 'favorites' && g.store !== filter) return false
    return g.name.toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="library">
      {featured && (
        <section className="hero">
          {featured.heroUrl && <img className="hero-bg" src={featured.heroUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
          <div className="hero-shade" />
          <div className="hero-body">
            <div className="hero-kicker">{featured.lastPlayed ? 'Reprendre' : 'À la une'}</div>
            <h1>{featured.name}</h1>
            <div className="hero-meta">
              <Badge kind={featured.store} />
              <span>{timeAgo(featured.lastPlayed)}</span>
            </div>
            <button className="play-btn big" onClick={() => onLaunch(featured)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M7 4v16l13-8z" />
              </svg>
              JOUER
            </button>
          </div>
        </section>
      )}

      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="chip-count">
                {f.id === 'all' ? games.length : f.id === 'favorites' ? games.filter((g) => g.favorite).length : games.filter((g) => g.store === f.id).length}
              </span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Rechercher un jeu…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" onClick={onRefresh} title="Rescanner les jeux installés" disabled={scanning}>
          <svg className={scanning ? 'spin' : ''} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {games.length === 0 && !scanning && (
        <div className="empty">
          <h3>Aucun jeu détecté</h3>
          <p>Le scan cherche les jeux installés via Steam, Epic Games et l’EA app sur ce PC. Voici ce qu’il a examiné :</p>
          <ScanDetails report={report} />
        </div>
      )}

      <div className="grid">
        {visible.map((g) => (
          <article key={g.id} className="card" onDoubleClick={() => onLaunch(g)}>
            <Cover game={g} />
            <button className={`fav ${g.favorite ? 'on' : ''}`} onClick={() => onFavorite(g)} title="Favori">
              ★
            </button>
            <div className="card-overlay">
              <button className="play-btn" onClick={() => onLaunch(g)}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M7 4v16l13-8z" />
                </svg>
                Jouer
              </button>
            </div>
            <div className="card-foot">
              <div className="card-title">{g.name}</div>
              <Badge kind={g.store} />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
