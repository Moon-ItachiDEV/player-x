// Paramètres › À propos : version installée et mises à jour automatiques (GitHub Releases).
import { useState } from 'react'
import { timeAgo } from '@shared/text'
import type { UpdateState } from '@shared/types'
import { BrandMark } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { errorMessage, useToast } from '../ui/Toasts'
import { useUpdateState } from '../UpdateNotice'
import { SectionHead, SettingRow, useNow } from './parts'

const RELEASES_URL = 'https://github.com/Moon-ItachiDEV/player-x/releases'

export function AboutSection(): React.JSX.Element {
  const notify = useToast()
  const now = useNow()
  const [update, setUpdate] = useUpdateState()
  const [busy, setBusy] = useState<'check' | 'install' | null>(null)

  const check = async (): Promise<void> => {
    if (busy) return
    setBusy('check')
    try {
      setUpdate(await window.launcher.checkForUpdates())
    } catch (e) {
      notify(errorMessage(e), { kind: 'error', id: 'update' })
    } finally {
      setBusy(null)
    }
  }

  const install = async (): Promise<void> => {
    if (busy) return
    setBusy('install')
    try {
      await window.launcher.installUpdate()
      // L'appli se ferme dans la foulée ; si rien ne se passe, le bouton redevient utilisable.
      setTimeout(() => setBusy(null), 15_000)
    } catch (e) {
      notify(errorMessage(e), { kind: 'error', id: 'update' })
      setBusy(null)
    }
  }

  const checking = busy === 'check' || update?.state === 'checking'
  const canCheck = !!update && update.state !== 'disabled' && update.state !== 'downloading' && !checking

  return (
    <>
      <SectionHead title="À propos">La version installée de Player X et ses mises à jour.</SectionHead>

      <div className="set-ab-card">
        <BrandMark height={30} className="set-ab-mark" />
        <div className="set-ab-id">
          <div className="set-ab-name">Player X</div>
          <div className="caption">
            Version <span className="num">{window.launcher.version}</span>
          </div>
        </div>
        <p className="set-ab-tagline">Lance tes jeux Steam, Epic et EA et vois tes amis en ligne.</p>
      </div>
      <p className="caption set-ab-privacy">
        Player X n'a pas de serveur : tes données restent sur ce PC et ne sont échangées qu'avec Steam, Discord et PlayStation. Les mises à jour viennent de
        GitHub.
      </p>

      <h3 className="set-block-title">Mises à jour</h3>
      <div className="set-rows">
        <SettingRow label="Mises à jour automatiques" value={<UpdateStatus update={update} now={now} />}>
          {update?.state === 'ready' ? (
            <button className="btn btn-primary" onClick={install} disabled={busy === 'install'}>
              {busy === 'install' ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
              {busy === 'install' ? 'Redémarrage…' : 'Redémarrer pour mettre à jour'}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={check} disabled={!canCheck} aria-busy={checking}>
              {checking ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
              {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
            </button>
          )}
        </SettingRow>
        <SettingRow label="Notes de version" value="Les nouveautés de chaque version, sur GitHub">
          <button className="btn btn-ghost" onClick={() => window.launcher.openExternal(RELEASES_URL)}>
            Notes de version
            <Icon name="external-link" size={14} />
          </button>
        </SettingRow>
      </div>
      <p className="set-help set-ab-help">
        Player X vérifie au démarrage puis toutes les 6 heures, télécharge en arrière-plan et installe la nouvelle version au prochain redémarrage.
      </p>
    </>
  )
}

/** Texte d'état. Seule la phrase principale est annoncée (pas les « il y a 2 min » ni les pourcentages qui bougent). */
function UpdateStatus({ update, now }: { update: UpdateState | null; now: number }): React.JSX.Element {
  let tone = ''
  let phrase: React.ReactNode
  let detail: React.ReactNode = null
  let progress: number | null = null

  switch (update?.state) {
    case undefined:
      phrase = 'Chargement…'
      break
    case 'disabled':
      phrase = 'Les mises à jour automatiques ne fonctionnent que dans la version installée.'
      break
    case 'idle':
      phrase = 'Première vérification dans quelques secondes.'
      break
    case 'checking':
      phrase = 'Recherche d’une nouvelle version…'
      break
    case 'none':
      tone = 'ok'
      phrase = 'Tu as la dernière version'
      detail = ` · vérifié ${timeAgo(update.checkedAt, Math.max(now, update.checkedAt))}`
      break
    case 'downloading':
      phrase = (
        <>
          Téléchargement de <span className="num">{update.version}</span>…
        </>
      )
      detail = <span className="num"> {update.percent} %</span>
      progress = update.percent
      break
    case 'ready':
      tone = 'ready'
      phrase = (
        <>
          <span className="num">{update.version}</span> est prête
        </>
      )
      detail = ' · elle s’installera aussi à la fermeture de Player X'
      break
    case 'error':
      tone = 'err'
      phrase = update.message
      break
  }

  return (
    <span className={`set-ab-status ${tone}`}>
      <span className="set-ab-line">
        {tone === 'ok' && <Icon name="check-circle" size={13} />}
        {tone === 'ready' && <Icon name="check-circle" size={13} />}
        {tone === 'err' && <Icon name="alert-circle" size={13} />}
        <span>
          <span role="status">{phrase}</span>
          {detail && <span aria-hidden={progress !== null || undefined}>{detail}</span>}
        </span>
      </span>
      {progress !== null && (
        <span className="set-ab-track" role="progressbar" aria-label="Téléchargement de la mise à jour" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span className="set-ab-fill" style={{ transform: `scaleX(${progress / 100})` }} />
        </span>
      )}
    </span>
  )
}
