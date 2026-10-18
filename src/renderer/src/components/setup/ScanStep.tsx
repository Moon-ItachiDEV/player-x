// Étape 1 : analyse du PC. Résultat par store, jaquettes distribuées en éventail, puis passage au choix des favoris.
import { useCallback, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import { plural } from '@shared/text'
import type { Game, ScanReport, Store } from '@shared/types'
import { motionReduced } from '../../motion'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'

export const STORES: Store[] = ['steam', 'epic', 'ea']
const DECK_MAX = 7

interface StoreResult {
  store: Store
  count: number
  error?: string
  checked: string[]
}

/** Nombre de jeux par store (ce que l'étape 2 montrera) ; le rapport du scan donne les erreurs et les dossiers examinés. */
export function storeResults(games: Game[], report: ScanReport[], demo: boolean): StoreResult[] {
  return STORES.map((store) => {
    const r = demo ? undefined : report.find((x) => x.store === store)
    const count = games.filter((g) => g.store === store).length
    return { store, count: count || r?.found || 0, error: r?.error, checked: r?.checked ?? [] }
  })
}

/** Le meilleur jeu au centre, puis alternativement à droite et à gauche. */
function arrangeDeck(games: Game[]): { game: Game; rank: number }[] {
  const score = (g: Game): number => (g.favorite ? 8 : 0) + (g.coverUrl ? 4 : 0) + (g.lastPlayed ? 2 : 0)
  const best = [...games].sort((a, b) => score(b) - score(a) || (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)).slice(0, DECK_MAX)
  const slots: { game: Game; rank: number }[] = []
  best.forEach((game, rank) => {
    if (rank % 2 === 1) slots.push({ game, rank })
    else slots.unshift({ game, rank })
  })
  return slots
}

function fan(i: number, n: number, rank: number): CSSProperties {
  const k = i - (n - 1) / 2
  return { '--k': k, '--k2': k * k, '--ak': Math.abs(k), '--i': rank, zIndex: 20 - Math.round(Math.abs(k) * 2) } as CSSProperties
}

/** Éventail décoratif : les jaquettes trouvées, des squelettes pendant l'analyse, des cadres vides sinon. */
function Deck({ games, scanning }: { games: Game[]; scanning: boolean }): React.JSX.Element {
  const cards = useMemo(() => arrangeDeck(games), [games])
  if (cards.length === 0) {
    const n = scanning ? 5 : 3
    return (
      <div className={`deck ${scanning ? 'is-scanning' : 'is-empty'}`} style={{ '--half': (n - 1) / 2 } as CSSProperties} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="deck-card" style={fan(i, n, Math.abs(i - (n - 1) / 2))}>
            <div className={`deck-card-in ${scanning ? 'skel' : 'is-ghost'}`}>
              {!scanning && i === 1 && <Icon name="gamepad" size={28} />}
            </div>
          </div>
        ))}
        {scanning && <div className="deck-beam fx-loop" />}
      </div>
    )
  }
  return (
    <div className={`deck ${scanning ? 'is-scanning' : ''}`} style={{ '--half': (cards.length - 1) / 2 } as CSSProperties} aria-hidden="true">
      {cards.map(({ game, rank }, i) => (
        <div key={game.id} className="deck-card" style={fan(i, cards.length, rank)}>
          <div className="deck-card-in">
            <Cover game={game} />
          </div>
        </div>
      ))}
      {scanning && <div className="deck-beam fx-loop" />}
    </div>
  )
}

function StoreRow({ r, i, scanning }: { r: StoreResult; i: number; scanning: boolean }): React.JSX.Element {
  const state = scanning ? 'scanning' : r.error ? 'error' : r.count ? 'found' : 'none'
  return (
    <li className={`scan-store is-${state}`} style={{ '--i': i } as CSSProperties}>
      <StoreTag kind={r.store} size={34} />
      <span className="scan-store-text">
        <span className="scan-store-name">{STORE_LONG[r.store]}</span>
        <span key={state} className="scan-store-status" title={state === 'error' ? r.error : undefined}>
          {state === 'scanning' && 'Recherche…'}
          {state === 'found' && (
            <>
              <strong className="num">{r.count}</strong> {r.count > 1 ? 'jeux trouvés' : 'jeu trouvé'}
            </>
          )}
          {state === 'none' && 'Aucun jeu'}
          {state === 'error' && <>Erreur&nbsp;: {r.error}</>}
        </span>
      </span>
      <span key={`i-${state}`} className="scan-store-mark" aria-hidden="true">
        {state === 'scanning' && <span className="spinner" />}
        {state === 'found' && <Icon name="check" size={14} />}
        {state === 'error' && <Icon name="alert-circle" size={16} />}
        {state === 'none' && <span className="scan-store-dash" />}
      </span>
      <span className="scan-store-bar fx-loop" aria-hidden="true" />
    </li>
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
  headingRef: RefObject<HTMLHeadingElement | null>
  onNext: () => void
  onRescan: () => void
  onEnableDemo: () => void
  onSkip: () => void
}

export function ScanStep({ games, report, scanning, demo, headingRef, onNext, onRescan, onEnableDemo, onSkip }: ScanStepProps): React.JSX.Element {
  const [showChecked, setShowChecked] = useState(false)
  const results = useMemo(() => storeResults(games, report, demo), [games, report, demo])
  const total = games.length
  const phase = scanning ? 'scanning' : total ? 'found' : 'none'
  const summary =
    phase === 'scanning'
      ? 'Analyse en cours'
      : phase === 'found'
        ? `${plural(total, 'jeu trouvé', 'jeux trouvés')}\u00a0: ${results
            .filter((r) => r.count)
            .map((r) => `${r.count} ${STORE_LONG[r.store]}`)
            .join(', ')}`
        : 'Aucun jeu trouvé'

  return (
    <section className={`scan is-${phase}`} aria-labelledby="setup-title">
      <header className="setup-head">
        <p className="setup-overline">
          {phase === 'scanning' ? (
            <>
              <span className="setup-pulse fx-loop" aria-hidden="true" />
              Analyse en cours
            </>
          ) : demo && phase === 'found' ? (
            'Mode démo'
          ) : (
            'Analyse terminée'
          )}
        </p>
        <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="setup-title">
          {phase === 'scanning' && 'Analyse de ton PC'}
          {phase === 'found' && (
            <>
              <span className="setup-num num">{total}</span> {total > 1 ? 'jeux trouvés' : 'jeu trouvé'}
            </>
          )}
          {phase === 'none' && 'Aucun jeu trouvé'}
        </h1>
        <p className="setup-sub">
          {phase === 'scanning' && "On cherche les jeux installés avec Steam, Epic Games et l'EA app. Ça ne prend que quelques secondes."}
          {phase === 'found' &&
            (demo
              ? 'Des jeux fictifs pour découvrir Player X. Prochaine étape\u00a0: choisir tes favoris.'
              : 'Ta bibliothèque est prête. Prochaine étape\u00a0: choisir les jeux que tu lances le plus.')}
          {phase === 'none' && "On n'a trouvé aucun jeu Steam, Epic Games ou EA sur ce PC. Si tu viens d'en installer un, relance le scan."}
        </p>
        <p className="sr-only" aria-live="polite">
          {summary}
        </p>
      </header>

      <Deck games={games} scanning={scanning} />

      <ul className="scan-stores" aria-label="Résultat par store">
        {results.map((r, i) => (
          <StoreRow key={r.store} r={r} i={i} scanning={scanning} />
        ))}
      </ul>

      {phase !== 'none' ? (
        <div className="scan-actions">
          <button type="button" className="btn btn-primary btn-lg setup-cta" onClick={onNext} disabled={scanning || total === 0}>
            {scanning ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Analyse en cours…
              </>
            ) : (
              <>
                Choisir mes favoris
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
            {!demo && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={onEnableDemo}>
                Essayer le mode démo
              </button>
            )}
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
    </section>
  )
}
