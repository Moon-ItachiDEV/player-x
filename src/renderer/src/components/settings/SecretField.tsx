// Champs de clé / identifiant : chacun s'enregistre seul (bouton « Enregistrer » tant qu'il y a une modification, ou Entrée).
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Icon } from '../ui/Icon'
import { errorMessage, useToast } from '../ui/Toasts'

interface BaseProps {
  label: string
  /** Valeur enregistrée. */
  value: string
  /** Enregistre et renvoie la valeur réellement stockée. */
  onSave: (v: string) => Promise<string>
  /** Toasts après enregistrement / effacement. */
  savedToast: string
  clearedToast: string
  placeholder?: string
  /** Renvoie un message d'erreur si la saisie n'est pas valable (une valeur vide est toujours acceptée). */
  validate?: (v: string) => string | null
  /** Accord de « Enregistrée / Non renseignée ». */
  masculine?: boolean
}

interface FieldProps extends BaseProps {
  secret: boolean
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, value, onSave, savedToast, clearedToast, placeholder, validate, masculine, secret },
  ref
) {
  const notify = useToast()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => input.current as HTMLInputElement)
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(false)
  const [saving, setSaving] = useState(false)

  // La valeur enregistrée a changé (sauvegarde, autre écran) : on repart d'elle.
  useEffect(() => setDraft(value), [value])

  const next = draft.trim()
  const dirty = next !== value
  const error = dirty && next && validate ? validate(next) : null
  const e = masculine ? '' : 'e'

  const save = async (): Promise<void> => {
    if (!dirty || error || saving) return
    setSaving(true)
    try {
      // On repart de la valeur stockée : le champ ne reste pas « modifié » si elle diffère de la saisie.
      const stored = await onSave(next)
      setDraft(stored)
      setShown(false)
      // Jamais la valeur elle-même dans un toast.
      notify(stored ? savedToast : clearedToast, { kind: 'success', id: `field-${id}` })
    } catch (err) {
      notify(errorMessage(err), { kind: 'error', id: `field-${id}` })
    } finally {
      setSaving(false)
    }
  }

  const paste = async (): Promise<void> => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) {
        setDraft(text)
        input.current?.focus()
      } else notify('Le presse-papiers est vide', { kind: 'info' })
    } catch {
      notify('Impossible de lire le presse-papiers', { kind: 'error' })
    }
  }

  let caption: React.ReactNode
  if (error) caption = error
  else if (dirty) caption = 'Modification non enregistrée · Entrée pour enregistrer, Échap pour annuler'
  else if (!value) caption = `Non renseigné${e}`
  else if (secret) caption = value.length >= 12 ? `Enregistré${e} · se termine par ${value.slice(-4)}` : `Enregistré${e}`
  else caption = `Enregistré${e}`

  return (
    <div className="set-field">
      <label className="set-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="set-field-row">
        <div className={`set-input ${secret ? 'mono' : ''} ${error ? 'invalid' : ''}`}>
          <input
            ref={input}
            id={id}
            type={secret && !shown ? 'password' : 'text'}
            value={draft}
            placeholder={placeholder}
            readOnly={saving}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={`${id}-cap`}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                save()
              } else if (ev.key === 'Escape' && dirty) {
                ev.stopPropagation()
                setDraft(value)
              }
            }}
          />
          {secret && (
            <button
              type="button"
              className="icon-btn set-in-btn"
              aria-label={shown ? 'Masquer la valeur' : 'Afficher la valeur'}
              title={shown ? 'Masquer' : 'Afficher'}
              aria-pressed={shown}
              onClick={() => setShown((s) => !s)}
            >
              <Icon name={shown ? 'eye-off' : 'eye'} size={16} />
            </button>
          )}
          <button type="button" className="icon-btn set-in-btn" aria-label="Coller depuis le presse-papiers" title="Coller" onClick={paste} disabled={saving}>
            <Icon name="clipboard" size={16} />
          </button>
        </div>
        {dirty && (
          <button type="button" className="btn btn-primary btn-sm set-field-save" onClick={save} disabled={!!error || saving}>
            {saving && <span className="spinner" />}
            Enregistrer
          </button>
        )}
      </div>
      <div id={`${id}-cap`} className={`set-field-cap ${error ? 'err' : dirty ? 'dirty' : ''}`}>
        {error && <Icon name="alert-circle" size={13} />}
        {caption}
      </div>
    </div>
  )
})

/** Clé ou jeton masqué, avec boutons Afficher / Coller. */
export const SecretField = forwardRef<HTMLInputElement, BaseProps>(function SecretField(props, ref) {
  return <Field ref={ref} {...props} secret />
})

/** Champ texte simple (identifiants), même logique d'enregistrement. */
export const TextField = forwardRef<HTMLInputElement, BaseProps>(function TextField(props, ref) {
  return <Field ref={ref} {...props} secret={false} />
})
