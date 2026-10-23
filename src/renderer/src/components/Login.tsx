import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import type { Game } from '@shared/types'
import type { LoginProps } from '../contracts'
import { BrandMark, BrandWordmark } from './ui/Brand'
import { Cover } from './ui/Cover'
import { Icon } from './ui/Icon'
import { useEscape } from './ui/Overlay'
import { StoreTag } from './ui/StoreTag'
import './login.css'

export type { LoginProps }

const COLUMNS = 4
const MIN_TILES = 16
const MAX_TILES = 32

// Noms fictifs : ils ne servent qu'à teinter les dégradés de remplissage (bleu → violet), jamais affichés.
const PLACEHOLDERS = [
  'Néon',
  'Polaris',
  'Mirage',
  'Odyssée',
  'Galaxie',
  'Rivage',
  'Arcane',
  'Céleste',
  'Vertige',
  'Écho',
  'Prisme',
  'Aurore',
  'Horizon',
  'Vortex',
  'Éclipse',
  'Saphir'
]

// Dérive lente par colonne : durée pour 4 jaquettes, phase de départ (fraction), décalage au repos, sens.
const COLUMN_MOTION = [
  { dur: 80, phase: 0, rest: '0%', down: false },
  { dur: 95, phase: 0.45, rest: '-12%', down: true },
  { dur: 88, phase: 0.25, rest: '-5%', down: false },
  { dur: 110, phase: 0.6, rest: '-16%', down: true }
]

interface Tile {
  key: string
  game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>
  placeholder: boolean
}

/** Répartit les jeux en 4 colonnes ; les dégradés sans titre comblent jusqu'à 16 tuiles au moins. */
function buildColumns(games: Game[]): Tile[][] {
  // Les vraies jaquettes d'abord, puis les jeux sans image (dégradé titré).
  const real = [...games.filter((g) => g.coverUrl), ...games.filter((g) => !g.coverUrl)].slice(0, MAX_TILES)
  const total = Math.max(MIN_TILES, Math.ceil(real.length / COLUMNS) * COLUMNS)
  const slots: (Tile | undefined)[] = new Array(total).fill(undefined)
  // Jeux répartis régulièrement dans la grille plutôt que tassés en haut.
  real.forEach((g, i) => {
    slots[Math.floor((i * total) / real.length)] = { key: g.id, game: g, placeholder: false }
  })
  let p = 0
  const tiles = slots.map((t) => t ?? { key: `ph:${p}`, game: { name: PLACEHOLDERS[p++ % PLACEHOLDERS.length] }, placeholder: true })
  return Array.from({ length: COLUMNS }, (_, c) => tiles.filter((_, i) => i % COLUMNS === c))
}

/** Mosaïque décorative : chaque colonne est doublée pour boucler sans couture. */
function Mosaic({ games }: { games: Game[] }): React.JSX.Element {
  const columns = useMemo(() => buildColumns(games), [games])
  return (
    <div className="login-wall" aria-hidden="true">
      {columns.map((tiles, c) => {
        const m = COLUMN_MOTION[c]
        // Vitesse constante quelle que soit la longueur de la colonne.
        const dur = m.dur * Math.max(1, tiles.length / 4)
        const style = { '--dur': `${dur}s`, '--delay': `${-dur * m.phase}s`, '--rest': m.rest } as CSSProperties
        return (
          <div key={c} className={`login-col ${m.down ? 'is-down' : ''}`} style={style}>
            {[...tiles, ...tiles].map((t, i) => (
              <Cover key={`${t.key}#${i < tiles.length ? 0 : 1}`} className="login-tile" game={t.game} variant="portrait" showTitle={!t.placeholder} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** Écran de connexion plein cadre : Steam, sans compte ou démo, avec la mosaïque des jeux détectés. */
export function Login({ games, pending, error, onSteam, onCancel, onSkip, onDemo }: LoginProps): React.JSX.Element {
  const waiting = pending === 'steam'
  const steamRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wasWaiting = useRef(waiting)

  // Le focus suit le bloc visible : le bloc masqué est inerte.
  useEffect(() => {
    if (wasWaiting.current === waiting) return
    wasWaiting.current = waiting
    const target = waiting ? cancelRef.current : steamRef.current
    target?.focus()
  }, [waiting])

  useEscape(waiting, onCancel)

  return (
    <div className="login">
      <div className="login-drag" aria-hidden="true">
        <div />
      </div>

      <section className="login-panel">
        <div className="login-brand">
          <BrandMark height={48} />
          <BrandWordmark size={20} />
        </div>

        <div className="login-stage">
          <div className={`login-form ${waiting ? 'is-hidden' : ''}`} inert={waiting}>
            <h1 className="display-l login-title">
              Tous tes jeux,
              <br />
              tous tes amis, <span>au même endroit.</span>
            </h1>
            <p className="login-sub">Steam, Epic Games et l'EA app réunis. Vois qui est en ligne et lance la partie en un clic.</p>

            <button ref={steamRef} type="button" className="login-provider" onClick={onSteam} disabled={pending !== null}>
              <span className="login-provider-tile" aria-hidden="true">
                <StoreTag kind="steam" size={28} />
              </span>
              <span className="login-provider-label">Continuer avec Steam</span>
              <Icon name="chevron-right" size={16} className="login-provider-chevron" />
            </button>

            {error && (
              <div className="login-error" role="alert">
                <Icon name="alert-circle" size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="login-or">ou</div>

            <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onSkip}>
              Continuer sans compte
            </button>
            <p className="caption login-skip-caption">Ta bibliothèque locale fonctionne sans connexion.</p>

            <button type="button" className="link-btn muted login-demo" onClick={onDemo}>
              Essayer le mode démo
            </button>
          </div>

          <div className={`login-wait ${waiting ? '' : 'is-hidden'}`} inert={!waiting} aria-live="polite">
            {waiting && (
              <>
                <span className="spinner lg" aria-hidden="true" />
                <h2>Termine la connexion dans ton navigateur</h2>
                <p>Une page de connexion vient de s'ouvrir. Reviens ici une fois connecté.</p>
                <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
                  Annuler
                </button>
              </>
            )}
          </div>
        </div>

        <p className="login-privacy">Steam ne transmet que ton identifiant public. Tes comptes et tes clés restent sur ce PC.</p>
      </section>

      <div className="login-mosaic">
        <Mosaic games={games} />
        <div className="login-veil" aria-hidden="true" />
        {games.length > 0 && (
          <p className="login-count">
            <strong className="num">{games.length}</strong> {games.length > 1 ? 'jeux détectés' : 'jeu détecté'} sur ce PC
          </p>
        )}
      </div>
    </div>
  )
}
