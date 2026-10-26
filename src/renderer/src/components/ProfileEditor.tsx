// « Modifier le profil » (Profil) : ton pseudo et ta photo dans Player X. Ils passent avant ceux de Steam partout où
// Player X te montre (shared/profile.ts). La photo est recadrée au carré et réduite ici (256 × 256, WebP) : rien ne part
// sur Internet, elle reste dans les réglages de ce PC. Vides : le pseudo et la photo du compte principal reviennent.
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cleanProfileName, GUEST_NAME, type Identity, PROFILE_NAME_MAX } from '@shared/profile'
import { Avatar } from './ui/Avatar'
import { Icon } from './ui/Icon'
import { Dialog } from './ui/Overlay'
import { errorMessage, useToast } from './ui/Toasts'

const SIDE = 256
/** Au-delà, l'image est sûrement une erreur de fichier (une photo de téléphone fait 3 à 10 Mo). */
const MAX_FILE = 25 * 1024 * 1024

/** Recadre au centre, réduit à 256 × 256 et encode en WebP (JPEG si WebP manque). */
export async function toAvatar(file: Blob): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) throw new Error('Choisis une image : PNG, JPEG, WebP ou GIF.')
  if (file.size > MAX_FILE) throw new Error('Image trop lourde : 25 Mo au plus.')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('Cette image ne peut pas être lue.')
  }
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cette image ne peut pas être lue.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIDE, SIDE)
  bmp.close()
  const webp = canvas.toDataURL('image/webp', 0.86)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88)
}

interface Props {
  open: boolean
  me: Identity
  /** Pseudo et photo enregistrés ('' : ceux du compte). */
  current: { name: string; avatar: string }
  onClose: () => void
  onSave: (patch: { profileName: string; profileAvatar: string }) => Promise<void>
}

export function ProfileEditor({ open, me, current, onClose, onSave }: Props): React.JSX.Element | null {
  const notify = useToast()
  const id = useId()
  const file = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(current.name)
  const [avatar, setAvatar] = useState(current.avatar)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  // Réouvert : on repart de ce qui est enregistré.
  useEffect(() => {
    if (!open) return
    setName(current.name)
    setAvatar(current.avatar)
    setDrag(false)
  }, [open, current.name, current.avatar])

  const account = me.account
  const fallbackName = account?.name ?? GUEST_NAME
  const shownName = cleanProfileName(name) || fallbackName
  const shownAvatar = avatar || account?.avatarUrl

  const pick = async (f: Blob | undefined): Promise<void> => {
    if (!f) return
    try {
      setAvatar(await toAvatar(f))
    } catch (e) {
      notify(errorMessage(e), { kind: 'error', id: 'profile-photo' })
    }
  }

  const save = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await onSave({ profileName: cleanProfileName(name), profileAvatar: avatar })
      notify('Profil enregistré', { kind: 'success', id: 'profile-saved' })
      onClose()
    } catch (e) {
      notify(errorMessage(e), { kind: 'error', id: 'profile-saved' })
    } finally {
      setBusy(false)
    }
  }

  // Dans <body> : posé dans la page, le dialogue passerait sous les barres animées du Profil.
  return createPortal(
    <Dialog
      open={open}
      title="Modifier le profil"
      className="pe-dialog"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <span className="spinner" />}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="pe">
        <div
          className={`pe-photo ${drag ? 'is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void pick(e.dataTransfer.files[0])
          }}
        >
          <button type="button" className="pe-avatar" onClick={() => file.current?.click()} aria-label="Choisir une photo">
            <Avatar name={shownName} url={shownAvatar} size={112} />
            <span className="pe-avatar-edit" aria-hidden="true">
              <Icon name="image" size={18} />
            </span>
          </button>
          <div className="pe-photo-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => file.current?.click()}>
              <Icon name="image" size={15} />
              Choisir une photo
            </button>
            {avatar && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatar('')}>
                {account?.avatarUrl ? `Photo ${account.platform === 'steam' ? 'de Steam' : 'du compte'}` : 'Retirer la photo'}
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              void pick(e.currentTarget.files?.[0])
              e.currentTarget.value = ''
            }}
          />
        </div>

        <div className="pe-field">
          <label className="pe-label" htmlFor={id}>
            Pseudo
          </label>
          <div className="pe-input">
            <input
              id={id}
              value={name}
              maxLength={PROFILE_NAME_MAX + 8}
              placeholder={fallbackName}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
            />
            {name && (
              <button type="button" className="icon-btn" aria-label={`Reprendre ${fallbackName}`} title={`Reprendre ${fallbackName}`} onClick={() => setName('')}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Dialog>,
    document.body
  )
}
