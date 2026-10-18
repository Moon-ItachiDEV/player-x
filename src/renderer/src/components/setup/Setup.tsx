// Écran de démarrage (plein cadre, hors coque) : analyse du PC, puis choix des jeux favoris en grandes jaquettes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Game } from '@shared/types'
import type { SetupProps } from '../../contracts'
import { BrandMark, BrandWordmark } from '../ui/Brand'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { FavoritesStep } from './FavoritesStep'
import { ScanStep } from './ScanStep'
import { SetupBackdrop } from './SetupBackdrop'
import './setup.css'

export type { SetupProps }

// Sur macOS, les feux de fenêtre occupent le coin haut gauche.
const IS_MAC = window.launcher?.platform === 'darwin'
const STEPS = ['Analyse', 'Favoris', "C'est parti"] as const
const STACK_MAX = 4

type Step = 1 | 2 | 3

interface StepperProps {
  current: Step
  canGo: (s: Step) => boolean
  onGo: (s: Step) => void
}

/** 1 Analyse · 2 Favoris · 3 C'est parti. Les étapes déjà accessibles sont des boutons. */
function Stepper({ current, canGo, onGo }: StepperProps): React.JSX.Element {
  return (
    <ol className="setup-steps" aria-label="Étapes">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step
        const state = n < current ? 'done' : n === current ? 'current' : 'todo'
        const inner = (
          <>
            <span className="setup-step-dot">{state === 'done' ? <Icon name="check" size={12} /> : n}</span>
            <span className="setup-step-label">{label}</span>
            {state === 'done' && <span className="sr-only">, terminée</span>}
          </>
        )
        return (
          <li key={n} className={`setup-step-item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {n !== current && canGo(n) ? (
              <button type="button" className="setup-step-btn" onClick={() => onGo(n)}>
                {inner}
              </button>
            ) : (
              <span className="setup-step-btn">{inner}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Les dernières jaquettes choisies, empilées à côté du compteur. */
function SelectedStack({ games }: { games: Game[] }): React.JSX.Element | null {
  if (games.length === 0) return null
  const shown = games.slice(-STACK_MAX)
  const more = games.length - shown.length
  return (
    <span className="setup-stack" aria-hidden="true">
      {shown.map((g) => (
        <span key={g.id} className="setup-stack-item">
          <Cover game={g} showTitle={false} />
        </span>
      ))}
      {more > 0 && <span className="setup-stack-more num">+{more}</span>}
    </span>
  )
}

const favoritesOf = (games: Game[]): string[] => games.filter((g) => g.favorite).map((g) => g.id)

export function Setup({ firstRun, games, report, scanning, demo, onRescan, onEnableDemo, onDone, onSkip }: SetupProps): React.JSX.Element {
  const [step, setStep] = useState<1 | 2>(firstRun ? 1 : 2)
  // Sans jeu, il n'y a rien à choisir : on reste sur l'analyse (relancer, démo, continuer).
  const view: 1 | 2 = step === 2 && games.length > 0 ? 2 : 1
  const [order, setOrder] = useState<string[]>(() => favoritesOf(games))
  const touched = useRef(false)
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true)
  const main = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Les favoris existants sont présélectionnés ; tant qu'on n'a rien touché, ils suivent la bibliothèque (scan fini, démo activée).
  useEffect(() => {
    if (touched.current) return
    const next = favoritesOf(games)
    setOrder((prev) => (prev.join('\n') === next.join('\n') ? prev : next))
  }, [games])

  const known = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const picked = useMemo(() => order.filter((id) => known.has(id)), [order, known])
  const selected = useMemo(() => new Set(picked), [picked])
  const pickedGames = useMemo(() => picked.map((id) => known.get(id) as Game), [picked, known])
  const count = picked.length

  const toggle = useCallback((id: string) => {
    touched.current = true
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const clear = (): void => {
    touched.current = true
    setOrder([])
  }

  const finish = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      await onDone(picked)
    } finally {
      // En cas d'échec, App affiche l'erreur et l'écran reste ouvert : on peut réessayer.
      if (mounted.current) setSaving(false)
    }
  }

  // Changement d'étape : retour en haut, et le titre prend le focus (lecteurs d'écran, clavier).
  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [view])

  // Ctrl+F / Ctrl+K : la recherche des favoris (celle de la barre du haut n'existe pas ici).
  useEffect(() => {
    if (view !== 2) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k') && search.current) {
        e.preventDefault()
        search.current.focus()
        search.current.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const current: Step = saving ? 3 : view
  const canGo = (s: Step): boolean => (s === 1 ? view === 2 && !saving : s === 2 ? view === 1 && !scanning && games.length > 0 : false)

  return (
    <div className={`setup ${IS_MAC ? 'is-mac' : ''}`} aria-busy={saving || undefined}>
      <SetupBackdrop games={games} />

      <header className="setup-top">
        <div className="setup-brand">
          <BrandMark height={22} />
          <BrandWordmark size={13} />
        </div>
        <Stepper current={current} canGo={canGo} onGo={(s) => setStep(s === 1 ? 1 : 2)} />
      </header>

      <main ref={main} className="setup-main">
        <div key={view} className="setup-step">
          {view === 1 ? (
            <ScanStep
              games={games}
              report={report}
              scanning={scanning}
              demo={demo}
              headingRef={heading}
              onNext={() => setStep(2)}
              onRescan={onRescan}
              onEnableDemo={onEnableDemo}
              onSkip={onSkip}
            />
          ) : (
            <FavoritesStep games={games} selected={selected} demo={demo} onToggle={toggle} headingRef={heading} searchRef={search} />
          )}
        </div>
      </main>

      {view === 2 && (
        <footer className="setup-foot">
          <button type="button" className="btn btn-ghost setup-skip" onClick={onSkip} disabled={saving}>
            {firstRun ? 'Passer' : 'Annuler'}
          </button>
          <div className="setup-tally">
            <SelectedStack games={pickedGames} />
            <p className="setup-count" aria-live="polite">
              {count === 0 ? (
                'Aucun favori sélectionné'
              ) : (
                <>
                  <strong className="num">{count}</strong> {count > 1 ? 'favoris sélectionnés' : 'favori sélectionné'}
                </>
              )}
            </p>
            {count > 0 && (
              <button type="button" className="link-btn muted setup-clear" onClick={clear} disabled={saving}>
                Tout retirer
              </button>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-lg setup-go" onClick={finish} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                {firstRun ? (count > 0 ? "C'est parti" : 'Continuer sans favori') : count > 0 ? 'Enregistrer' : 'Enregistrer sans favori'}
                <Icon name="chevron-right" size={18} />
              </>
            )}
          </button>
        </footer>
      )}
    </div>
  )
}
