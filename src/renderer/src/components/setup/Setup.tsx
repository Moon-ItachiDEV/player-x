// Accueil de Player X (plein cadre, hors coque) : bienvenue, analyse du PC plateforme par plateforme, Counter-Strike 2
// s'il est installé, choix des jeux favoris, puis « C'est prêt ». Rouvert pour les favoris, il va droit au choix.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CS2_GAME_ID } from '@shared/cs2'
import { plural } from '@shared/text'
import type { Game } from '@shared/types'
import type { SetupProps } from '../../contracts'
import { useStore } from '../../update/session'
import { Cs2RecapDialog } from '../cs2/Cs2Recap'
import { shownCs2 } from '../cs2/useCs2'
import { BrandMark, BrandWordmark } from '../ui/Brand'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { Cs2Step } from './Cs2Step'
import { FavoritesStep } from './FavoritesStep'
import { ScanStep } from './ScanStep'
import { SetupBackdrop } from './SetupBackdrop'
import './setup.css'

export type { SetupProps }

// Sur macOS, les feux de fenêtre occupent le coin haut gauche.
const IS_MAC = window.launcher?.platform === 'darwin'
const STACK_MAX = 4

type Step = 'welcome' | 'scan' | 'cs2' | 'favorites' | 'ready'

const STEP_LABEL: Record<Exclude<Step, 'welcome'>, string> = {
  scan: 'Analyse',
  cs2: 'Counter-Strike 2',
  favorites: 'Favoris',
  ready: "C'est parti"
}

interface StepperProps {
  steps: Exclude<Step, 'welcome'>[]
  current: Step
  canGo: (s: Step) => boolean
  onGo: (s: Step) => void
}

/** Analyse · (Counter-Strike 2) · Favoris · C'est parti. Les étapes déjà accessibles sont des boutons. */
function Stepper({ steps, current, canGo, onGo }: StepperProps): React.JSX.Element {
  const at = steps.indexOf(current as Exclude<Step, 'welcome'>)
  return (
    <ol className="setup-steps" aria-label="Étapes">
      {steps.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'todo'
        const inner = (
          <>
            <span className="setup-step-dot">{state === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="setup-step-label">{STEP_LABEL[s]}</span>
            {state === 'done' && <span className="sr-only">, terminée</span>}
          </>
        )
        return (
          <li key={s} className={`setup-step-item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {s !== current && canGo(s) ? (
              <button type="button" className="setup-step-btn" onClick={() => onGo(s)}>
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

/** Écran d'ouverture : l'icône, le nom, une phrase, un bouton. */
function WelcomeStep({ headingRef, onStart }: { headingRef: React.RefObject<HTMLHeadingElement | null>; onStart: () => void }): React.JSX.Element {
  return (
    <section className="setup-hello" aria-labelledby="setup-title">
      <div className="setup-hello-mark">
        <span className="setup-hello-halo fx-loop" aria-hidden="true" />
        <BrandMark height={184} className="setup-hello-icon" />
      </div>
      <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="setup-hello-title">
        Bienvenue dans Player X
      </h1>
      <p className="setup-hello-sub">Tous tes jeux Steam, Epic et EA au même endroit, avec tes amis et tes parties en direct.</p>
      <button type="button" className="btn btn-primary btn-lg setup-hello-go" onClick={onStart}>
        Commencer
      </button>
    </section>
  )
}

interface ReadyProps {
  total: number
  favorites: number
  saving: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onReplay: () => void
  onFinish: () => void
}

/** Dernière étape du premier passage : le bilan, puis l'accueil (c'est là que les favoris sont enregistrés). */
function ReadyStep({ total, favorites, saving, headingRef, onReplay, onFinish }: ReadyProps): React.JSX.Element {
  return (
    <section className="setup-fin" aria-labelledby="setup-title">
      <span className="setup-fin-check" aria-hidden="true">
        <Icon name="check" size={56} />
      </span>
      <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="setup-fin-title">
        C'est prêt&nbsp;!
      </h1>
      <p className="setup-fin-sub">
        {total === 0
          ? 'Aucun jeu pour le moment. Tes jeux apparaîtront dès qu’un scan les trouvera.'
          : `${plural(total, 'jeu trouvé', 'jeux trouvés')} · ${favorites === 0 ? 'aucun favori pour l’instant' : plural(favorites, 'favori', 'favoris')}`}
      </p>
      <div className="setup-fin-actions">
        <button type="button" className="btn btn-secondary btn-lg setup-fin-replay" onClick={onReplay} disabled={saving}>
          Revoir l'accueil
        </button>
        <button type="button" className="btn btn-primary btn-lg setup-fin-go" onClick={onFinish} disabled={saving}>
          {saving ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Enregistrement…
            </>
          ) : (
            "Aller à l'accueil"
          )}
        </button>
      </div>
    </section>
  )
}

export function Setup(props: SetupProps): React.JSX.Element {
  const { firstRun, replay, games, report, scanning, demo, settings, onSaveSettings, onRescan, onDone, onSkip } = props
  const [step, setStep] = useState<Step>(firstRun ? 'welcome' : 'favorites')
  const hasCs2 = useMemo(() => games.some((g) => g.id === CS2_GAME_ID), [games])
  // Sans jeu, il n'y a rien à choisir : on reste sur l'analyse (relancer, démo, continuer). Sans CS2, pas d'étape CS2.
  const view: Step =
    (step === 'favorites' && games.length === 0) || (step === 'cs2' && !hasCs2) ? 'scan' : step
  const [order, setOrder] = useState<string[]>(() => favoritesOf(games))
  const touched = useRef(false)
  const [saving, setSaving] = useState(false)
  // L'analyse a déjà été révélée une fois : en y revenant, les plateformes s'affichent sans rejouer l'animation.
  const [scanSeen, setScanSeen] = useState(false)
  const mounted = useRef(true)
  const main = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const sampleRecap = useStore(shownCs2)

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

  // Rejoué depuis les paramètres : « Commencer » relance un scan normal (rien n'est effacé).
  const start = (): void => {
    if (replay && !scanning) onRescan()
    setStep('scan')
  }

  // Changement d'étape : retour en haut, et le titre prend le focus (lecteurs d'écran, clavier).
  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [view])

  // Ctrl+F / Ctrl+K : la recherche des favoris (celle de la barre du haut n'existe pas ici).
  useEffect(() => {
    if (view !== 'favorites') return
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

  const steps = useMemo(() => {
    const list: Exclude<Step, 'welcome'>[] = ['scan']
    if (hasCs2) list.push('cs2')
    list.push('favorites', 'ready')
    return list
  }, [hasCs2])
  // Rouvert pour les favoris, l'enregistrement est la dernière étape (« C'est parti » pendant qu'il se fait).
  const current: Step = saving && view === 'favorites' ? 'ready' : view
  const canGo = (s: Step): boolean => {
    if (saving) return false
    const at = steps.indexOf(current as Exclude<Step, 'welcome'>)
    const to = steps.indexOf(s as Exclude<Step, 'welcome'>)
    if (to < 0 || s === 'ready') return false
    if (to < at) return true
    // En avant : seulement vers une étape déjà possible (analyse finie, des jeux).
    return !scanning && games.length > 0 && to <= steps.indexOf('favorites') && (firstRun ? scanSeen : true)
  }
  const afterScan: Step = hasCs2 ? 'cs2' : 'favorites'
  const afterFavorites = (): void => {
    if (firstRun) setStep('ready')
    else void finish()
  }

  return (
    <div className={`setup is-${view} ${IS_MAC ? 'is-mac' : ''}`} aria-busy={saving || undefined}>
      <SetupBackdrop games={games} />

      <header className="setup-top">
        {view !== 'welcome' && (
          <>
            <div className="setup-brand">
              <BrandMark height={36} />
              <BrandWordmark size={17} />
            </div>
            <Stepper steps={steps} current={current} canGo={canGo} onGo={setStep} />
          </>
        )}
      </header>

      <main ref={main} className="setup-main">
        <div key={view} className="setup-step">
          {view === 'welcome' && <WelcomeStep headingRef={heading} onStart={start} />}
          {view === 'scan' && (
            <ScanStep
              games={games}
              report={report}
              scanning={scanning}
              demo={demo}
              instant={scanSeen}
              headingRef={heading}
              nextLabel={hasCs2 ? 'Continuer' : 'Choisir mes favoris'}
              onRevealed={() => setScanSeen(true)}
              onNext={() => setStep(afterScan)}
              onRescan={onRescan}
              onSkip={onSkip}
            />
          )}
          {view === 'cs2' && (
            <Cs2Step
              game={known.get(CS2_GAME_ID) as Game}
              settings={settings}
              onSaveSettings={onSaveSettings}
              headingRef={heading}
              onBack={() => setStep('scan')}
              onNext={() => setStep('favorites')}
            />
          )}
          {view === 'favorites' && (
            <FavoritesStep games={games} selected={selected} demo={demo} onToggle={toggle} headingRef={heading} searchRef={search} />
          )}
          {view === 'ready' && (
            <ReadyStep total={games.length} favorites={count} saving={saving} headingRef={heading} onReplay={() => setStep('welcome')} onFinish={finish} />
          )}
        </div>
      </main>

      {view === 'favorites' && (
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
          <button type="button" className="btn btn-primary btn-lg setup-go" onClick={afterFavorites} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                {firstRun ? (count > 0 ? 'Continuer' : 'Continuer sans favori') : count > 0 ? 'Enregistrer' : 'Enregistrer sans favori'}
                <Icon name="chevron-right" size={18} />
              </>
            )}
          </button>
        </footer>
      )}

      {/* « Voir un exemple » de l'étape CS2 : la même carte d'exemple que dans Paramètres. */}
      {sampleRecap && <Cs2RecapDialog recap={sampleRecap} art={known.get(CS2_GAME_ID)?.heroUrl || known.get(CS2_GAME_ID)?.coverUrl} onClose={() => shownCs2.set(null)} />}
    </div>
  )
}
