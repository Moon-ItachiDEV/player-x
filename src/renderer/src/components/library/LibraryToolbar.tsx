import { useEffect, useRef, useState } from 'react'
import type { Store } from '@shared/types'
import type { UiPrefs } from '../../contracts'
import { withViewTransition } from '../../motion'
import { Icon, type IconName } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { KIND_LABEL } from '../ui/StoreTag'

export type LibStore = 'all' | Store
/** `uninstalled` : jeux du compte Steam pas installés sur ce PC ; `all` les mêle aux jeux installés. */
export type LibInstall = 'all' | 'installed' | 'uninstalled'
export type LibSort = 'recent' | 'name' | 'launches' | 'playtime'
export type LibView = 'grid' | 'list'
type CoverSize = UiPrefs['coverSize']

export const SORT_LABEL: Record<LibSort, string> = {
  recent: 'Dernière partie',
  name: 'Nom (A–Z)',
  launches: 'Plus lancés',
  playtime: 'Plus joués'
}
export const STORES: Store[] = ['steam', 'epic', 'ea']
const SIZE_LABEL: Record<CoverSize, string> = {
  S: 'Petites',
  M: 'Moyennes',
  L: 'Grandes'
}
const INSTALL_LABEL: Record<LibInstall, string> = {
  all: 'Tous',
  installed: 'Installés',
  uninstalled: 'Non installés'
}

interface SegOption<T extends string> {
  value: T
  label?: string
  /** Compteur après le libellé (« Steam · 8 »). */
  count?: number
  icon?: IconName
  /** Bouton à icône seule : nom accessible et infobulle. */
  name?: string
  disabled?: boolean
}

/** Pilules à choix unique (boutons à bascule, aria-pressed). */
function Seg<T extends string>({
  label,
  value,
  options,
  onPick,
  icons
}: {
  label: string
  value: T
  options: SegOption<T>[]
  onPick: (v: T) => void
  icons?: boolean
}): React.JSX.Element {
  return (
    <div className={`lib-seg ${icons ? 'is-icons' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="lib-seg-btn"
          aria-pressed={o.value === value}
          aria-label={o.name}
          title={o.name}
          disabled={o.disabled}
          onClick={() => o.value !== value && onPick(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
          {o.count !== undefined && <span className="lib-seg-count num">· {o.count}</span>}
        </button>
      ))}
    </div>
  )
}

interface ToolbarProps {
  /** Stores présents dans la bibliothèque (installés ou non). */
  stores: Store[]
  /** Jeux par store dans la sélection en cours (installation, favoris), avant le filtre de store. */
  storeCounts: Record<Store, number>
  /** Jeux de la sélection en cours, avant le filtre de store. */
  total: number
  store: LibStore
  /** null : aucun jeu non installé connu, le choix n'a pas lieu d'être. */
  install: LibInstall | null
  fav: boolean
  favCount: number
  sort: LibSort
  view: LibView
  coverSize: CoverSize
  scanning: boolean
  /** Premier scan sans aucun jeu : bouton de scan seulement. */
  loading?: boolean
  onStore: (s: LibStore) => void
  onInstall: (i: LibInstall) => void
  onFav: (on: boolean) => void
  onSort: (s: LibSort) => void
  onView: (v: LibView) => void
  onCoverSize: (s: CoverSize) => void
  onRescan: () => void
}

/** Barre collante : plateforme, installation, favoris, tri, taille, grille ou liste, relance du scan. Le verre n'apparaît qu'une fois collée. */
export function LibraryToolbar(props: ToolbarProps): React.JSX.Element {
  const { stores, storeCounts, total, store, install, fav, favCount, sort, view, coverSize, scanning, loading } = props
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

  // Les jaquettes glissent vers leur nouvelle place (transition de vue).
  const reorder = (fn: () => void): void => withViewTransition(fn, { kind: 'reorder' })

  const rescan = (
    <button
      type="button"
      className="lib-icon-btn"
      aria-label={scanning ? 'Scan en cours…' : 'Relancer le scan'}
      title={scanning ? 'Scan en cours…' : 'Relancer le scan : chercher à nouveau les jeux installés'}
      aria-disabled={scanning}
      aria-busy={scanning}
      onClick={() => !scanning && props.onRescan()}
    >
      <Icon name="refresh" size={17} className={scanning ? 'spin' : ''} />
    </button>
  )

  return (
    <>
      <div ref={sentinel} className="lib-sentinel" aria-hidden="true" />
      <div className={`lib-toolbar ${stuck ? 'is-stuck' : ''}`}>
        <div className="lib-filters">
          {loading ? (
            <>
              <span className="lib-filters-status caption">Recherche des jeux installés…</span>
              <div className="lib-filters-end">{rescan}</div>
            </>
          ) : (
            <>
              <Seg<LibStore>
                label="Plateforme"
                value={store}
                options={[
                  { value: 'all', label: 'Tout', count: total },
                  ...stores.map((s) => ({
                    value: s as LibStore,
                    label: KIND_LABEL[s],
                    count: storeCounts[s],
                    disabled: storeCounts[s] === 0 && store !== s
                  }))
                ]}
                onPick={(v) => reorder(() => props.onStore(v))}
              />
              {install && (
                <Seg<LibInstall>
                  label="Installation"
                  value={install}
                  options={(Object.keys(INSTALL_LABEL) as LibInstall[]).map((i) => ({ value: i, label: INSTALL_LABEL[i] }))}
                  onPick={(v) => reorder(() => props.onInstall(v))}
                />
              )}
              <div className="lib-seg">
                <button type="button" className="lib-seg-btn lib-fav-btn" aria-pressed={fav} onClick={() => reorder(() => props.onFav(!fav))}>
                  <Icon name="star" size={15} filled={fav} />
                  Favoris
                  <span className="lib-seg-count num">· {favCount}</span>
                </button>
              </div>
              {/* Tri et affichage : ensemble, calés à droite, même quand la barre passe sur deux lignes */}
              <div className="lib-filters-end">
                <PickMenu<LibSort>
                  label="Trier"
                  value={sort}
                  className="lib-pick"
                  options={(Object.keys(SORT_LABEL) as LibSort[]).map((s) => ({
                    value: s,
                    label: SORT_LABEL[s]
                  }))}
                  onPick={(v) => reorder(() => props.onSort(v))}
                />
                {view === 'grid' && (
                  <PickMenu<CoverSize>
                    label="Taille"
                    value={coverSize}
                    display={coverSize}
                    className="lib-pick"
                    options={(Object.keys(SIZE_LABEL) as CoverSize[]).map((s) => ({ value: s, label: SIZE_LABEL[s], hint: s }))}
                    onPick={props.onCoverSize}
                  />
                )}
                <Seg<LibView>
                  label="Affichage"
                  icons
                  value={view}
                  options={[
                    { value: 'grid', icon: 'grid', name: 'Grille' },
                    { value: 'list', icon: 'list', name: 'Liste' }
                  ]}
                  onPick={props.onView}
                />
                {rescan}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
