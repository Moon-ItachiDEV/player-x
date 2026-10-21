import { useEffect, useRef, useState } from 'react'
import type { Store } from '@shared/types'
import type { UiPrefs } from '../../contracts'
import { withViewTransition } from '../../motion'
import { Icon } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { KIND_LABEL } from '../ui/StoreTag'

/** `uninstalled` : jeux du compte Steam pas installés sur ce PC. */
export type LibTab = 'all' | 'fav' | 'uninstalled'
export type LibStore = 'all' | Store
export type LibSort = 'recent' | 'name' | 'launches' | 'playtime'
type CoverSize = UiPrefs['coverSize']

export const SORT_LABEL: Record<LibSort, string> = { recent: 'Récents', name: 'Nom (A–Z)', launches: 'Plus lancés', playtime: 'Plus joués' }
export const STORES: Store[] = ['steam', 'epic', 'ea']
const SIZE_LABEL: Record<CoverSize, string> = { S: 'Petites', M: 'Moyennes', L: 'Grandes' }

interface ToolbarProps {
  /** Jeux de l'onglet (tous, favoris ou non installés), avant le filtre de store. */
  total: number
  /** Nombre de jeux affichés dans la grille (pour « Résultats pour … »). */
  resultCount: number
  /** Jeux par store dans l'onglet. */
  storeCounts: Record<Store, number>
  store: LibStore
  sort: LibSort
  coverSize: CoverSize
  query: string
  scanning: boolean
  /** Premier scan sans aucun jeu : bouton de scan seulement. */
  loading?: boolean
  onStore: (s: LibStore) => void
  onSort: (s: LibSort) => void
  onCoverSize: (s: CoverSize) => void
  onClearQuery: () => void
  onRescan: () => void
}

/** Barre collante : menus Store / Trier par / Taille, résumé, relance du scan. Le filet n'apparaît qu'une fois collée. */
export function LibraryToolbar(props: ToolbarProps): React.JSX.Element {
  const { total, resultCount, storeCounts, store, sort, coverSize, query, scanning, loading, onStore, onSort, onCoverSize, onClearQuery, onRescan } = props
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const root = el.closest<HTMLElement>('.content')
    // Le contenu défile sous la barre du haut (son padding) : la zone observée commence sous la barre.
    const bar = root ? parseFloat(getComputedStyle(root).paddingTop) || 0 : 0
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)), {
      root,
      rootMargin: `-${bar}px 0px 0px 0px`
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const present = STORES.filter((s) => storeCounts[s] > 0)
  // Les jaquettes glissent vers leur nouvelle place (transition de vue).
  const reorder = (fn: () => void): void => withViewTransition(fn, { kind: 'reorder' })

  return (
    <>
      <div ref={sentinel} className="lib-sentinel" aria-hidden="true" />
      <div className={`lib-toolbar ${stuck ? 'is-stuck' : ''}`}>
        {loading ? (
          <span className="caption">Recherche des jeux installés…</span>
        ) : (
          <div className="lib-picks">
            <PickMenu<LibStore>
              label="Store"
              value={store}
              options={[{ value: 'all', label: 'Tous', hint: total }, ...present.map((s) => ({ value: s as LibStore, label: KIND_LABEL[s], hint: storeCounts[s] }))]}
              onPick={(v) => reorder(() => onStore(v))}
            />
            <PickMenu<LibSort>
              label="Trier par"
              value={sort}
              options={(Object.keys(SORT_LABEL) as LibSort[]).map((s) => ({ value: s, label: SORT_LABEL[s] }))}
              onPick={(v) => reorder(() => onSort(v))}
            />
            <PickMenu<CoverSize>
              label="Taille"
              value={coverSize}
              display={coverSize}
              options={(Object.keys(SIZE_LABEL) as CoverSize[]).map((s) => ({ value: s, label: SIZE_LABEL[s], hint: s }))}
              onPick={onCoverSize}
            />
          </div>
        )}

        <div className="lib-tb-end">
          {query ? (
            <p className="lib-tb-summary" aria-live="polite">
              <span className="lib-tb-query" title={query}>
                Résultats pour « {query} »
              </span>{' '}
              · <span className="num">{resultCount}</span>
              <button className="link-btn lib-tb-clear" onClick={onClearQuery}>
                Effacer
              </button>
            </p>
          ) : (
            !loading && (
              <p className="lib-tb-summary num">
                {total} jeu{total > 1 ? 'x' : ''}
                {present.length > 1 && present.map((s) => ` · ${KIND_LABEL[s]} ${storeCounts[s]}`).join('')}
              </p>
            )
          )}
          <button
            className="btn btn-secondary btn-sm lib-rescan"
            title={scanning ? 'Scan en cours…' : 'Chercher à nouveau les jeux installés'}
            aria-disabled={scanning}
            aria-busy={scanning}
            onClick={() => !scanning && onRescan()}
          >
            <Icon name="refresh" size={15} className={scanning ? 'spin' : ''} />
            {scanning ? 'Scan en cours…' : 'Relancer le scan'}
          </button>
        </div>
      </div>
    </>
  )
}
