import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Account, FriendPlatform } from '@shared/types'
import type { RailProps, View } from '../contracts'
import { Avatar } from './ui/Avatar'
import { BrandMark } from './ui/Brand'
import { Icon, type IconName } from './ui/Icon'
import './chrome.css'

export type { RailProps }

const PRIORITY: FriendPlatform[] = ['steam', 'discord', 'psn']
// Sur macOS, les feux de fenêtre occupent le coin haut gauche.
const IS_MAC = window.launcher?.platform === 'darwin'
const INDICATOR_H = 20
const MOVE_MS = 340

/** Compte affiché dans la barre : Steam, puis Discord, puis PSN. */
function primaryAccount(accounts: Account[]): Account | undefined {
  for (const p of PRIORITY) {
    const a = accounts.find((x) => x.platform === p)
    if (a) return a
  }
  return accounts[0]
}

const TOP_ITEMS: { view: View; icon: IconName; label: string }[] = [
  { view: 'library', icon: 'grid', label: 'Bibliothèque' },
  { view: 'profile', icon: 'user', label: 'Profil' },
  { view: 'stats', icon: 'chart', label: 'Stats de jeu' }
]

/** Barre latérale : logo, navigation, mode démo et avatar du compte. */
export function Rail({ view, onView, accounts, demo, accountMenuOpen, onToggleAccountMenu }: RailProps): React.JSX.Element {
  const railRef = useRef<HTMLElement>(null)
  const buttons = useRef<Partial<Record<View, HTMLButtonElement | null>>>({})
  const [indicatorY, setIndicatorY] = useState<number | null>(null)
  const [pillY, setPillY] = useState(0)
  const [animate, setAnimate] = useState(false)
  const [moving, setMoving] = useState(false)
  const lastView = useRef(view)

  // Indicateur actif et fond du bouton : ils glissent ensemble vers le bouton de la vue courante.
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const place = (): void => {
      const btn = buttons.current[view]
      if (!btn) return
      setIndicatorY(btn.offsetTop + (btn.offsetHeight - INDICATOR_H) / 2)
      setPillY(btn.offsetTop)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(rail)
    return () => ro.disconnect()
  }, [view, demo])

  // Pas de glissement à la première pose.
  useLayoutEffect(() => {
    if (indicatorY === null || animate) return
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [indicatorY, animate])

  // Changement de vue : la barre s'étire pendant le glissement (effets visuels uniquement, en CSS).
  useEffect(() => {
    if (lastView.current === view) return
    lastView.current = view
    if (!animate) return
    setMoving(true)
    const t = setTimeout(() => setMoving(false), MOVE_MS)
    return () => clearTimeout(t)
  }, [view, animate])

  const account = primaryAccount(accounts)
  const name = account?.name ?? 'Joueur'
  const accountLabel = account ? `Mon compte (${name})` : 'Compte invité'

  const navButton = (v: View, icon: IconName, label: string): React.JSX.Element => (
    <button
      key={v}
      ref={(el) => {
        buttons.current[v] = el
      }}
      className="rail-btn"
      aria-label={label}
      title={label}
      aria-current={view === v ? 'page' : undefined}
      onClick={() => onView(v)}
    >
      <Icon name={icon} size={22} />
    </button>
  )

  return (
    <nav ref={railRef} className="rail" aria-label="Navigation principale">
      <div className="rail-logo">{!IS_MAC && <BrandMark height={18} />}</div>

      {indicatorY !== null && (
        <>
          <span className={`rail-pill ${animate ? 'animate' : ''}`} style={{ transform: `translateY(${pillY}px)` }} aria-hidden="true" />
          {/* translate (et non transform) : l'étirement en scale reste centré sur la barre */}
          <span className={`rail-indicator ${animate ? 'animate' : ''} ${moving ? 'is-moving' : ''}`} style={{ translate: `0 ${indicatorY}px` }} aria-hidden="true" />
        </>
      )}

      {TOP_ITEMS.map((i) => navButton(i.view, i.icon, i.label))}

      <div className="rail-spacer" />

      {demo && (
        <span className="pill pill-outline-warning no-dot rail-demo" title="Mode démo actif : jeux et amis fictifs">
          <span aria-hidden="true">DÉMO</span>
          <span className="sr-only">Mode démo actif : jeux et amis fictifs</span>
        </span>
      )}

      {navButton('settings', 'settings', 'Paramètres')}

      <button
        className="rail-account"
        aria-label={accountLabel}
        title={accountLabel}
        aria-haspopup="menu"
        aria-expanded={accountMenuOpen}
        // Le menu se ferme au clic extérieur : sans ceci, ce clic le rouvrirait aussitôt.
        onMouseDown={(e) => accountMenuOpen && e.stopPropagation()}
        onClick={onToggleAccountMenu}
      >
        <Avatar name={name} url={account?.avatarUrl} size={40} status={account ? 'connected' : 'guest'} />
      </button>
    </nav>
  )
}
