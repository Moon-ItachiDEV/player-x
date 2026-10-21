import { useMemo, useState } from 'react'
import { capitalize, formatDate, timeAgo } from '@shared/text'
import type { Achievement, GameAchievements } from '@shared/types'
import { Icon } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { AchIcon } from './AchIcon'
import { completion, formatPercent, isUnlocked, rarityOf } from './format'
import type { AchievementsLoad } from './useAchievements'
import './achievements.css'

/** Identifiant du lecteur de la fiche pour la liste complète (les annonces Steam ont des identifiants numériques). */
export const ACH_VIEW = 'achievements'

const RARE_MAX = 3

const byRarity = (a: Achievement, b: Achievement): number => (a.percent ?? 101) - (b.percent ?? 101)
const byRecent = (a: Achievement, b: Achievement): number => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)

/** Message à la place de la section, ou null quand il n'y a rien à dire (jeu Epic/EA, jeu sans succès). */
function blockedText(state: GameAchievements['state']): string | null {
  switch (state) {
    case 'no-account':
      return 'Connecte ton compte Steam (Paramètres › Comptes) pour voir tes succès.'
    case 'no-key':
      return 'Ajoute ta clé Steam Web API (Paramètres › Comptes) pour voir tes succès.'
    case 'key-refused':
      return 'Steam refuse ta clé Web API : vérifie-la dans Paramètres › Comptes.'
    case 'private':
      return 'Ton profil Steam cache les détails de tes jeux : passe-les en « Public » dans ta confidentialité Steam pour voir tes succès.'
    default:
      return null
  }
}

interface SectionProps {
  state: AchievementsLoad
  onOpenAll: (opener: HTMLElement) => void
  onRetry: () => void
}

/** Section « Succès » de la fiche d'un jeu Steam : progression, plus rares débloqués, dernier débloqué. */
export function AchievementsSection({ state, onOpenAll, onRetry }: SectionProps): React.JSX.Element | null {
  const data = state.status === 'ready' ? state.data : null
  const picks = useMemo(() => {
    if (!data) return null
    const done = data.list.filter(isUnlocked)
    return {
      rare: [...done].sort(byRarity).slice(0, RARE_MAX),
      last: [...done].filter((a) => a.unlockedAt).sort(byRecent)[0] as Achievement | undefined,
      // Rien de débloqué : le plus courant, pour donner une piste.
      easiest: done.length ? undefined : ([...data.list].filter((a) => a.percent !== undefined && !a.hidden).sort(byRarity).at(-1) as Achievement | undefined)
    }
  }, [data])

  if (data && (data.state === 'not-steam' || data.state === 'none')) return null
  const blocked = data ? blockedText(data.state) : null
  const pct = data ? completion(data.unlocked, data.total) : 0

  return (
    <section className="sheet-section ach" aria-labelledby="ach-h" aria-busy={state.status === 'loading'}>
      <h3 id="ach-h" className="sheet-h">
        Succès
        {data?.state === 'ready' && (
          <span className="sheet-h-count num">
            {data.unlocked} / {data.total}
          </span>
        )}
      </h3>
      {state.status === 'loading' && <SectionSkeleton />}
      {state.status === 'error' && (
        <div className="ach-error">
          <p className="caption">{state.message}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={14} />
            Réessayer
          </button>
        </div>
      )}
      {blocked && <p className="caption">{blocked}</p>}
      {data?.state === 'ready' && picks && (
        <>
          <div className="ach-progress">
            <span className="ach-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Succès débloqués">
              <span style={{ width: `${pct}%` }} className={pct === 100 ? 'is-perfect' : undefined} />
            </span>
            <span className="ach-pct num">{pct === 100 ? '100 %' : `${pct} %`}</span>
          </div>
          {picks.rare.length > 0 ? (
            <>
              <p className="overline ach-sub">Tes plus rares</p>
              <ul className="ach-list is-compact">
                {picks.rare.map((a) => (
                  <li key={a.id}>
                    <AchRow ach={a} compact />
                  </li>
                ))}
              </ul>
              {picks.last && (
                <p className="caption ach-last">
                  Dernier débloqué : <b>{picks.last.name}</b>, {timeAgo(picks.last.unlockedAt!)}
                </p>
              )}
            </>
          ) : (
            <p className="caption ach-last">
              Aucun succès débloqué pour l'instant.
              {picks.easiest && (
                <>
                  {' '}
                  Le plus courant : <b>{picks.easiest.name}</b> ({formatPercent(picks.easiest.percent!)} des joueurs).
                </>
              )}
            </p>
          )}
          <button className="btn btn-secondary btn-sm ach-all" onClick={(e) => onOpenAll(e.currentTarget)}>
            Voir les {data.total} succès
            <Icon name="chevron-right" size={14} />
          </button>
        </>
      )}
    </section>
  )
}

function SectionSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true">
      <span className="skel" style={{ display: 'block', height: 8, marginBottom: 16 }} />
      {[0, 1].map((i) => (
        <div key={i} className="ach-row is-compact">
          <span className="skel" style={{ width: 40, height: 40, flexShrink: 0 }} />
          <span className="ach-row-text">
            <span className="skel" style={{ width: '50%', height: 13 }} />
            <span className="skel" style={{ width: '75%', height: 10 }} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Un succès : icône, nom, description, rareté, date. Un succès caché pas encore débloqué reste masqué jusqu'au clic. */
function AchRow({ ach, compact = false }: { ach: Achievement; compact?: boolean }): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  const done = isUnlocked(ach)
  const secret = ach.hidden && !done && !revealed
  const rarity = rarityOf(ach.percent)
  return (
    <div className={`ach-row ${compact ? 'is-compact' : ''} ${done ? 'is-done' : ''}`}>
      <AchIcon ach={ach} size={compact ? 40 : 52} />
      <span className="ach-row-text">
        <span className="ach-name">
          {secret ? 'Succès caché' : ach.name}
          {ach.hidden && !compact && <span className="ach-tag">Caché</span>}
        </span>
        {secret ? (
          <span className="ach-desc">
            Les détails apparaissent une fois débloqué.{' '}
            <button className="link-btn" onClick={() => setRevealed(true)}>
              Révéler
            </button>
          </span>
        ) : (
          (ach.description || !compact) && (
            <span className="ach-desc">{ach.description || (ach.hidden ? 'Steam ne donne sa description qu’une fois débloqué.' : 'Pas de description sur Steam.')}</span>
          )
        )}
      </span>
      <span className="ach-row-side">
        {ach.percent !== undefined && (
          <span className={`ach-rarity num ${rarity ? `is-${rarity.tier}` : ''}`} title={`${formatPercent(ach.percent)} des joueurs Steam l'ont débloqué`}>
            {formatPercent(ach.percent)}
            {rarity && !compact && <small>{rarity.label}</small>}
          </span>
        )}
        {!compact && done && <span className="ach-date num">{ach.unlockedAt ? capitalize(formatDate(ach.unlockedAt)) : 'Débloqué'}</span>}
      </span>
    </div>
  )
}

type Filter = 'all' | 'done' | 'todo'
type Sort = 'game' | 'rare' | 'recent'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'game', label: 'Ordre du jeu' },
  { value: 'rare', label: 'Plus rares' },
  { value: 'recent', label: 'Derniers débloqués' }
]

interface ViewProps {
  gameName: string
  state: AchievementsLoad
  backRef: React.RefObject<HTMLButtonElement | null>
  onBack: () => void
  onClose: () => void
  onRetry: () => void
}

/** Tous les succès du jeu, dans la fiche (comme le lecteur des actus). */
export function AchievementsView({ gameName, state, backRef, onBack, onClose, onRetry }: ViewProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('game')
  const data = state.status === 'ready' && state.data.state === 'ready' ? state.data : null

  const shown = useMemo(() => {
    if (!data) return []
    const list = data.list.filter((a) => (filter === 'all' ? true : filter === 'done' ? isUnlocked(a) : !isUnlocked(a)))
    if (sort === 'rare') return [...list].sort(byRarity)
    // Les débloqués d'abord, du plus récent au plus ancien ; les autres dans l'ordre du jeu.
    if (sort === 'recent') return [...list].sort((a, b) => Number(isUnlocked(b)) - Number(isUnlocked(a)) || byRecent(a, b))
    return list
  }, [data, filter, sort])

  const pct = data ? completion(data.unlocked, data.total) : 0
  const filters: { id: Filter; label: string; count: number }[] = data
    ? [
        { id: 'all', label: 'Tous', count: data.total },
        { id: 'done', label: 'Débloqués', count: data.unlocked },
        { id: 'todo', label: 'À débloquer', count: data.total - data.unlocked }
      ]
    : []

  return (
    <div className="ach-view">
      <div className="news-bar">
        <button ref={backRef} className="btn btn-ghost btn-sm news-back" onClick={onBack} title="Retour à la fiche (Échap)">
          <Icon name="chevron-left" size={16} />
          Retour
        </button>
        <span className="news-bar-game">{gameName}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la fiche" title="Fermer la fiche">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="ach-view-body">
        <h2 className="ach-view-title">Succès</h2>
        {state.status === 'loading' && <p className="caption">Chargement…</p>}
        {state.status === 'error' && (
          <div className="ach-error">
            <p className="caption">{state.message}</p>
            <button className="btn btn-secondary btn-sm" onClick={onRetry}>
              <Icon name="refresh" size={14} />
              Réessayer
            </button>
          </div>
        )}
        {data && (
          <>
            <div className="ach-view-head">
              <span className="ach-view-count num">
                {data.unlocked}
                <small> / {data.total}</small>
              </span>
              <span className="ach-bar is-big" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Succès débloqués">
                <span style={{ width: `${pct}%` }} className={pct === 100 ? 'is-perfect' : undefined} />
              </span>
              <span className="ach-pct num">{pct}&#8239;%</span>
            </div>
            <div className="ach-tools">
              <div className="ach-chips" role="group" aria-label="Afficher">
                {filters.map((f) => (
                  <button key={f.id} className="ach-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                    <span className="num">{f.count}</span>
                  </button>
                ))}
              </div>
              <PickMenu label="Trier" value={sort} options={SORTS} onPick={setSort} />
            </div>
            {shown.length ? (
              <ul className="ach-list">
                {shown.map((a) => (
                  <li key={a.id}>
                    <AchRow ach={a} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption ach-empty">{filter === 'done' ? 'Aucun succès débloqué pour l’instant.' : 'Tout est débloqué. Bravo !'}</p>
            )}
            <p className="caption ach-source">Rareté : part des joueurs Steam du jeu qui ont débloqué le succès.</p>
          </>
        )}
      </div>
    </div>
  )
}
