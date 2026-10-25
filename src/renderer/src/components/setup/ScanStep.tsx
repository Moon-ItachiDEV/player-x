// Étape « Analyse » : le scan plateforme par plateforme (Steam, Epic Games, EA app), chacune avec son état et son compteur,
// et les jaquettes trouvées qui remplissent deux murs de part et d'autre. Le scan renvoie tout d'un coup : les plateformes
// sont révélées une à une à partir du vrai rapport (animation courte, coupée par « Réduire les animations »).
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import { cleanName, plural } from '@shared/text'
import type { Game, ScanReport, Store } from '@shared/types'
import { motionReduced } from '../../motion'
import { BrandMark } from '../ui/Brand'
import { CountUp } from '../ui/CountUp'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'

export const STORES: Store[] = ['steam', 'epic', 'ea']
/** Emplacements de chaque mur (3 colonnes × 4 rangées). */
const WALL_SLOTS = 12
/** Délai avant la première plateforme, puis entre deux plateformes. */
const REVEAL_FIRST_MS = 420
const REVEAL_NEXT_MS = 620
/** L'anneau : rayon 92 dans une boîte de 200. */
const RING_C = 2 * Math.PI * 92

/** « Non installé » : le genre suit le nom du store (l'EA app). */
const ABSENT: Record<Store, string> = { steam: 'Non installé', epic: 'Non installé', ea: 'Non installée' }

interface StoreResult {
  store: Store
  count: number
  error?: string
  absent: boolean
  checked: string[]
}

/** Nombre de jeux par store (ce que l'étape Favoris montrera) ; le rapport du scan donne les erreurs, l'absence et les dossiers examinés. */
export function storeResults(games: Game[], report: ScanReport[], demo: boolean): StoreResult[] {
  return STORES.map((store) => {
    const r = demo ? undefined : report.find((x) => x.store === store)
    const count = games.filter((g) => g.store === store).length || r?.found || 0
    return { store, count, error: r?.error, absent: !count && !!r?.absent, checked: r?.checked ?? [] }
  })
}

/** Jaquettes d'abord, puis joués récemment, puis par nom : le haut du mur est le plus parlant. */
function wallOrder(a: Game, b: Game): number {
  return (
    Number(!!b.coverUrl) - Number(!!a.coverUrl) ||
    (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) ||
    cleanName(a.name).localeCompare(cleanName(b.name), 'fr')
  )
}

type RowState = 'pending' | 'found' | 'none' | 'absent' | 'error'

function rowState(r: StoreResult, shown: boolean): RowState {
  if (!shown) return 'pending'
  return r.error ? 'error' : r.count ? 'found' : r.absent ? 'absent' : 'none'
}

function StoreRow({ r, state }: { r: StoreResult; state: RowState }): React.JSX.Element {
  return (
    <li className={`scan-row is-${state}`}>
      <span key={state} className="scan-row-mark" aria-hidden="true">
        {state === 'pending' && <span className="spinner" />}
        {state === 'found' && <Icon name="check" size={14} />}
        {state === 'error' && <Icon name="alert-circle" size={14} />}
        {(state === 'none' || state === 'absent') && <span className="scan-row-dash" />}
      </span>
      <span className="scan-row-text">
        <span className="scan-row-name">{STORE_LONG[r.store]}</span>
        {state === 'error' && <span className="scan-row-error">{r.error}</span>}
      </span>
      <span key={`v-${state}`} className="scan-row-value">
        {state === 'pending' && 'Recherche…'}
        {state === 'found' && <CountUp value={r.count} format={(n) => plural(Math.round(n), 'jeu', 'jeux')} />}
        {state === 'none' && 'Aucun jeu'}
        {state === 'absent' && ABSENT[r.store]}
        {state === 'error' && 'Erreur'}
      </span>
    </li>
  )
}

/** Un mur de jaquettes : les emplacements libres sont des cadres vides pendant l'analyse, puis s'effacent. */
function Wall({ games, side, done }: { games: Game[]; side: 'left' | 'right'; done: boolean }): React.JSX.Element {
  return (
    <div className={`scan-wall is-${side} ${done ? 'is-done' : ''}`} aria-hidden="true">
      {Array.from({ length: WALL_SLOTS }, (_, i) => {
        const g = games[i]
        return g ? (
          <span key={g.id} className="scan-tile" style={{ '--i': i } as CSSProperties}>
            <Cover game={g} />
          </span>
        ) : (
          <span key={`slot-${i}`} className="scan-slot" />
        )
      })}
    </div>
  )
}

/** Dossiers et sources examinés, pour comprendre un scan vide. */
function Checked({ results }: { results: StoreResult[] }): React.JSX.Element {
  const any = results.some((r) => r.checked.length || r.error)
  // Déplié sous le pli : on le fait remonter dans la vue.
  const reveal = useCallback((el: HTMLElement | null) => el?.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' }), [])
  if (!any)
    return (
      <p ref={reveal} id="setup-checked" className="caption scan-checked-none">
        Aucun dossier examiné pour l'instant. Relance le scan.
      </p>
    )
  return (
    <ul ref={reveal} id="setup-checked" className="scan-checked">
      {results.map((r) => (
        <li key={r.store}>
          <span className="scan-checked-head">
            <StoreTag kind={r.store} />
            {STORE_LONG[r.store]}
          </span>
          {r.error && <p className="scan-checked-error">{r.error}</p>}
          {r.checked.length > 0 ? (
            <ul>
              {r.checked.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption">Aucun dossier examiné.</p>
          )}
        </li>
      ))}
    </ul>
  )
}

interface ScanStepProps {
  games: Game[]
  report: ScanReport[]
  scanning: boolean
  demo: boolean
  /** Déjà révélée une fois (retour depuis une autre étape) : tout s'affiche sans animation. */
  instant: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  nextLabel: string
  onRevealed: () => void
  onNext: () => void
  onRescan: () => void
  onSkip: () => void
}

export function ScanStep(props: ScanStepProps): React.JSX.Element {
  const { games, report, scanning, demo, instant, headingRef, nextLabel, onRevealed, onNext, onRescan, onSkip } = props
  const [showChecked, setShowChecked] = useState(false)
  const results = useMemo(() => storeResults(games, report, demo), [games, report, demo])
  const [revealed, setRevealed] = useState(() => (!scanning && (instant || motionReduced()) ? STORES.length : 0))

  // Pendant le scan, rien n'est révélé ; ensuite une plateforme après l'autre (tout d'un coup si les animations sont réduites).
  useEffect(() => {
    if (scanning) {
      setRevealed(0)
      return
    }
    if (revealed >= STORES.length) return
    if (motionReduced()) {
      setRevealed(STORES.length)
      return
    }
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? REVEAL_FIRST_MS : REVEAL_NEXT_MS)
    return () => clearTimeout(t)
  }, [scanning, revealed])

  const done = !scanning && revealed >= STORES.length
  useEffect(() => {
    if (done) onRevealed()
  }, [done, onRevealed])

  // Les jaquettes des plateformes révélées, réparties à gauche et à droite en partant du centre.
  const walls = useMemo(() => {
    const shown = STORES.slice(0, scanning ? 0 : revealed)
    const list = shown.flatMap((s) => games.filter((g) => g.store === s).sort(wallOrder)).slice(0, WALL_SLOTS * 2)
    return { left: list.filter((_, i) => i % 2 === 0), right: list.filter((_, i) => i % 2 === 1) }
  }, [games, revealed, scanning])

  const total = games.length
  const phase = !done ? 'scanning' : total ? 'found' : 'none'
  const progress = scanning ? 0 : revealed / STORES.length
  const summary =
    phase === 'scanning'
      ? 'Analyse en cours'
      : phase === 'found'
        ? `${plural(total, 'jeu trouvé', 'jeux trouvés')} : ${results
            .filter((r) => r.count)
            .map((r) => `${r.count} ${STORE_LONG[r.store]}`)
            .join(', ')}`
        : 'Aucun jeu trouvé'

  return (
    <section className={`scan is-${phase}`} aria-labelledby="setup-title">
      <Wall games={walls.left} side="left" done={done} />

      <div className="scan-core">
        <div className="scan-ring" aria-hidden="true">
          <svg viewBox="0 0 200 200" className={`scan-ring-svg ${phase === 'scanning' ? 'fx-loop' : ''}`}>
            <defs>
              <linearGradient id="scan-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--brand-1)" />
                <stop offset=".5" stopColor="var(--brand-2)" />
                <stop offset="1" stopColor="var(--brand-3)" stopOpacity={phase === 'scanning' ? 0 : 1} />
              </linearGradient>
            </defs>
            <circle className="scan-ring-track" cx="100" cy="100" r="92" />
            {phase !== 'none' && (
              <circle
                className="scan-ring-arc"
                cx="100"
                cy="100"
                r="92"
                stroke="url(#scan-ring-grad)"
                strokeDasharray={phase === 'scanning' ? `${RING_C * 0.62} ${RING_C}` : `${RING_C} ${RING_C}`}
              />
            )}
          </svg>
          <BrandMark height={120} className="scan-ring-mark" />
          {phase === 'found' && (
            <span className="scan-ring-check">
              <Icon name="check" size={20} />
            </span>
          )}
        </div>

        <header className="scan-head">
          <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="scan-title">
            {phase === 'scanning' && 'On cherche tes jeux…'}
            {phase === 'found' && (
              <>
                <span className="setup-num num">
                  <CountUp value={total} format={(n) => String(Math.round(n))} />
                </span>{' '}
                {total > 1 ? 'jeux trouvés' : 'jeu trouvé'}
              </>
            )}
            {phase === 'none' && 'Aucun jeu trouvé'}
          </h1>
          <p className="scan-sub">
            {phase === 'scanning' && (demo ? 'Mode démo : des jeux fictifs pour découvrir Player X.' : 'Steam, Epic Games et l’EA app. Ça prend quelques secondes.')}
            {phase === 'found' &&
              (demo ? 'Mode démo : des jeux fictifs pour découvrir Player X.' : 'Ta bibliothèque est prête.')}
            {phase === 'none' && "Aucun jeu Steam, Epic Games ou EA sur ce PC. Si tu viens d'en installer un, relance le scan."}
          </p>
          <p className="sr-only" aria-live="polite">
            {summary}
          </p>
        </header>

        <ul className="scan-rows" aria-label="Résultat par plateforme">
          {results.map((r, i) => (
            <StoreRow key={r.store} r={r} state={rowState(r, !scanning && i < revealed)} />
          ))}
        </ul>

        <div
          className={`scan-progress ${scanning ? 'is-busy' : ''}`}
          role="progressbar"
          aria-label="Plateformes analysées"
          aria-valuemin={0}
          aria-valuemax={STORES.length}
          aria-valuenow={scanning ? undefined : revealed}
        >
          <span className={scanning ? 'fx-loop' : ''} style={{ '--p': progress } as CSSProperties} />
        </div>

        {phase !== 'none' ? (
          <div className="scan-actions">
            {/* Pendant la révélation, le scan est fini : on peut déjà continuer. */}
            <button type="button" className="btn btn-primary btn-lg setup-cta" onClick={onNext} disabled={scanning || total === 0}>
              {scanning ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Analyse en cours…
                </>
              ) : (
                <>
                  {nextLabel}
                  <Icon name="chevron-right" size={18} />
                </>
              )}
            </button>
            <p className="scan-foot">
              {!demo && phase === 'found' && (
                <>
                  Il manque un jeu&nbsp;?{' '}
                  <button type="button" className="link-btn" onClick={onRescan}>
                    Relancer le scan
                  </button>
                  <span className="scan-foot-sep" aria-hidden="true" />
                </>
              )}
              <button type="button" className="link-btn muted" onClick={onSkip}>
                Passer pour l'instant
              </button>
            </p>
          </div>
        ) : (
          <div className="scan-actions">
            <div className="scan-actions-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={onRescan}>
                <Icon name="refresh" size={16} />
                Relancer le scan
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={onSkip}>
                Continuer
              </button>
            </div>
            <button
              type="button"
              className="link-btn muted scan-checked-toggle"
              aria-expanded={showChecked}
              aria-controls="setup-checked"
              onClick={() => setShowChecked((o) => !o)}
            >
              Voir les dossiers examinés
              <Icon name="chevron-down" size={14} className={showChecked ? 'is-open' : ''} />
            </button>
            {showChecked && <Checked results={results} />}
          </div>
        )}
      </div>

      <Wall games={walls.right} side="right" done={done} />
    </section>
  )
}
