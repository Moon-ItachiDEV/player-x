// Paramètres › À propos : version installée et mises à jour automatiques (GitHub Releases).
import { useState } from 'react'
import { timeAgo } from '@shared/text'
import type { UpdateState } from '@shared/types'
import { BrandMark } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import { errorMessage, useToast } from '../ui/Toasts'
import { useUpdateState } from '../UpdateNotice'
import { gameRunning, isRealUpdateBusy, lastUpdate, useStore } from '../../update/session'
import { requestRestart, warpActive } from '../../update/stage'
import { preview, startPreview } from '../../update/preview'
import { fpGroups, mo, pair, pct } from '../../update/format'
import { SectionHead, SettingRow, useNow } from './parts'

const RELEASES_URL = 'https://github.com/Moon-ItachiDEV/player-x/releases'

export function AboutSection(): React.JSX.Element {
  const notify = useToast()
  const now = useNow()
  const [update, setUpdate] = useUpdateState()
  const [checkBusy, setCheckBusy] = useState(false)
  const last = useStore(lastUpdate).value
  const previewing = useStore(preview).active
  const inGame = useStore(gameRunning)

  const check = async (): Promise<void> => {
    if (checkBusy) return
    setCheckBusy(true)
    try {
      setUpdate(await window.launcher.checkForUpdates())
    } catch (e) {
      notify(errorMessage(e), { kind: 'error', id: 'update' })
    } finally {
      setCheckBusy(false)
    }
  }

  // Même chemin que la carte : l'ordre part d'abord, puis le saut part de ce bouton.
  // Si le redémarrage échoue, la scène rend la main et le focus à ce bouton (plus de réactivation au bout de 15 s).
  const restart = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (update?.state !== 'ready' || warpActive()) return
    const button = e.currentTarget
    requestRestart({ version: update.version, origin: button.getBoundingClientRect(), trigger: button })
  }

  const copyFingerprint = (hex: string): void => {
    // Dans la promesse : un presse-papiers absent finit aussi en « Copie impossible ».
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(hex))
      .then(() => notify('Empreinte copiée', { kind: 'success', id: 'update-fp' }))
      .catch(() => notify('Copie impossible', { kind: 'error', id: 'update-fp' }))
  }

  const checking = checkBusy || update?.state === 'checking'
  const canCheck =
    !!update && update.state !== 'disabled' && update.state !== 'downloading' && update.state !== 'verifying' && update.state !== 'installing' && !checking
  // Empreinte connue à partir de la 3e étape de la vérification.
  const fp = (update?.state === 'ready' || update?.state === 'verifying') && update.fingerprint ? { version: update.version, hex: update.fingerprint } : null
  const busyForPreview = isRealUpdateBusy(update)

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
          {update?.state === 'ready' || update?.state === 'installing' ? (
            <button className="btn btn-primary" onClick={restart} disabled={update.state === 'installing'}>
              {update.state === 'installing' ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
              {update.state === 'installing' ? 'Redémarrage…' : 'Redémarrer pour mettre à jour'}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={check} disabled={!canCheck} aria-busy={checking}>
              {checking ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
              {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
            </button>
          )}
        </SettingRow>
        {fp && (
          <SettingRow
            label={`Empreinte de la ${fp.version}`}
            value={
              <span className="set-ab-fp" title={fp.hex}>
                {fpGroups(fp.hex)}
              </span>
            }
          >
            <button className="btn btn-ghost" onClick={() => copyFingerprint(fp.hex)}>
              <Icon name="copy" size={14} />
              Copier l'empreinte
            </button>
          </SettingRow>
        )}
        {last && (
          <SettingRow
            label="Dernière mise à jour"
            value={
              <>
                <span className="num">{last.from}</span> → <span className="num">{last.to}</span> · {timeAgo(last.installedAt, Math.max(now, last.installedAt))}
                {/* Une empreinte n'est enregistrée qu'après une signature valide. */}
                {last.fingerprint && ' · signée'}
                {last.size !== undefined && <span className="num"> · {mo(last.size)}</span>}
              </>
            }
          >
            {null}
          </SettingRow>
        )}
        <SettingRow label="Animation de mise à jour" value="Rejoue la séquence sans rien télécharger ni installer">
          <button
            className="btn btn-secondary"
            onClick={(e) => void startPreview({ from: 'about', trigger: e.currentTarget })}
            disabled={busyForPreview || previewing || inGame}
            title={busyForPreview ? 'Indisponible pendant une vraie mise à jour' : inGame ? 'Indisponible pendant une partie' : undefined}
          >
            Voir l'aperçu
          </button>
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

const STEP_DETAIL = { signature: 'signature (1/3)', check: 'contrôle (3/3)' } as const

/** Texte d'état. Seule la phrase principale est annoncée (pas les « il y a 2 min » ni les pourcentages qui bougent). */
function UpdateStatus({ update, now }: { update: UpdateState | null; now: number }): React.JSX.Element {
  let tone = ''
  let phrase: React.ReactNode
  let detail: React.ReactNode = null
  /** Barre : avancement 0 → 1 et ce qu'elle mesure. */
  let track: { p: number; label: string; key: string } | null = null

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
    case 'downloading': {
      const percent = Math.max(0, Math.min(100, Math.floor(update.percent)))
      phrase = (
        <>
          Téléchargement de <span className="num">{update.version}</span>…
        </>
      )
      detail = (
        <span className="num">
          {' '}
          {pct(percent)}
          {update.transferred !== undefined && !!update.total && ` · ${pair(update.transferred, update.total)}`}
        </span>
      )
      track = { p: percent / 100, label: 'Téléchargement de la mise à jour', key: `dl-${update.version}` }
      break
    }
    case 'verifying': {
      phrase = (
        <>
          Vérification de <span className="num">{update.version}</span>…
        </>
      )
      // Pendant l'empreinte : la vraie part déjà lue. Avant et après : barre pleine (le fichier est là).
      const hashP = update.step === 'hash' && update.total ? Math.max(0, Math.min(1, (update.hashed ?? 0) / update.total)) : 1
      detail = (
        <span className="num">
          {' '}
          {update.step === 'hash' ? `empreinte ${pct(Math.floor(hashP * 100))} (2/3)` : STEP_DETAIL[update.step]}
        </span>
      )
      // Une barre par étape : passer de « pleine » à 0 ne la fait jamais reculer en glissant.
      track = { p: hashP, label: 'Vérification de la mise à jour', key: `vf-${update.version}-${update.step}` }
      break
    }
    case 'ready':
      tone = 'ready'
      phrase = (
        <>
          <span className="num">{update.version}</span> est prête et signée
        </>
      )
      detail = " · elle s'installera aussi à la fermeture de Player X"
      break
    case 'installing':
      phrase = (
        <>
          Redémarrage pour installer la <span className="num">{update.version}</span>…
        </>
      )
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
        {update?.state === 'ready' && <Icon name="shield-check" size={13} />}
        {tone === 'err' && <Icon name="alert-circle" size={13} />}
        <span>
          <span role="status">{phrase}</span>
          {detail && <span aria-hidden={track !== null || undefined}>{detail}</span>}
        </span>
      </span>
      {track && (
        <span
          key={track.key}
          className="set-ab-track"
          role="progressbar"
          aria-label={track.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(track.p * 100)}
          style={{ '--p': track.p.toFixed(3) } as React.CSSProperties}
        >
          <span className="set-ab-win">
            <span className="set-ab-fill" />
          </span>
        </span>
      )}
    </span>
  )
}
