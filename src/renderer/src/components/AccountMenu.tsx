import { useEffect, useRef } from 'react'
import type { Account, FriendPlatform } from '@shared/types'
import type { AccountMenuProps } from '../contracts'
import { Avatar } from './ui/Avatar'
import { Icon } from './ui/Icon'
import { Menu } from './ui/Overlay'
import { KIND_LABEL, StoreTag } from './ui/StoreTag'
import './chrome.css'

export type { AccountMenuProps }

const PLATFORMS: FriendPlatform[] = ['steam', 'discord', 'psn']
const MENU_STYLE: React.CSSProperties = { left: 'calc(var(--rail-w) + 10px)', top: 72, width: 288 }

/** Compte principal : Steam, puis Discord, puis PSN. */
function primaryAccount(accounts: Account[]): Account | undefined {
  for (const p of PLATFORMS) {
    const a = accounts.find((x) => x.platform === p)
    if (a) return a
  }
  return accounts[0]
}

/** Popover du compte, ancré sous la salutation du menu latéral. */
export function AccountMenu({ open, accounts, onClose, onProfile, onAccounts, onSettings, onLogin }: AccountMenuProps): React.JSX.Element | null {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Focus sur la première entrée à l'ouverture, retour au déclencheur à la fermeture.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bodyRef.current?.querySelector<HTMLElement>('.menu-item')?.focus({ preventScroll: true })
    return () => {
      const active = document.activeElement
      if (opener?.isConnected && (!active || active === document.body)) opener.focus({ preventScroll: true })
    }
  }, [open])

  const primary = primaryAccount(accounts)
  const run = (fn: () => void) => (): void => {
    fn()
    onClose()
  }

  // Flèches haut/bas, Début/Fin entre les entrées.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    if (!items.length) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const last = items.length - 1
    let next = 0
    if (e.key === 'End') next = last
    else if (e.key === 'ArrowDown') next = i < 0 || i === last ? 0 : i + 1
    else if (e.key === 'ArrowUp') next = i <= 0 ? last : i - 1
    items[next].focus()
  }

  return (
    <Menu open={open} onClose={onClose} style={MENU_STYLE} className="acc-menu">
      <div ref={bodyRef} onKeyDown={onKeyDown}>
        <div className="acc-head">
          <Avatar name={primary?.name ?? 'Joueur'} url={primary?.avatarUrl} size={40} status={primary ? 'connected' : 'guest'} />
          <div className="acc-head-text">
            <span className="acc-name">{primary?.name ?? 'Joueur'}</span>
            <span className="caption">{primary ? `Compte principal : ${KIND_LABEL[primary.platform]}` : 'Invité · aucun compte connecté'}</span>
          </div>
        </div>

        <div className="acc-rows" role="group" aria-label="Comptes">
          {PLATFORMS.map((p) => {
            const account = accounts.find((a) => a.platform === p)
            return account ? (
              <div key={p} className="acc-row">
                <StoreTag kind={p} size={20} />
                <span className="acc-row-name">
                  {account.name}
                  <span className="sr-only"> ({KIND_LABEL[p]})</span>
                </span>
                <span className="pill pill-success acc-pill">Connecté</span>
              </div>
            ) : (
              <div key={p} className="acc-row is-missing">
                <StoreTag kind={p} size={20} />
                <button role="menuitem" className="acc-connect" onClick={run(p === 'steam' ? onLogin : onAccounts)}>
                  Connecter {KIND_LABEL[p]}
                </button>
              </div>
            )
          })}
        </div>

        <div className="menu-sep" />

        <button role="menuitem" className="menu-item" onClick={run(onProfile)}>
          <Icon name="user" size={16} />
          Voir mon profil
        </button>
        <button role="menuitem" className="menu-item" onClick={run(onAccounts)}>
          <Icon name="link" size={16} />
          Comptes connectés
        </button>
        <button role="menuitem" className="menu-item" onClick={run(onSettings)}>
          <Icon name="settings" size={16} />
          Paramètres
        </button>

      </div>
    </Menu>
  )
}
