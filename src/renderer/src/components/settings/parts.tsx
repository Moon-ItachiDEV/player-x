// Petites briques communes aux sections des paramètres.
import { useEffect, useId, useState } from 'react'
import type { ScanReport } from '@shared/types'
import { STORE_LONG } from '../ui/StoreTag'

export function SectionHead({ title, children }: { title: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <header className="set-head">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  )
}

interface CardProps {
  /** Titre du bloc (h3). Sans titre, la carte ne porte que ses lignes. */
  title?: string
  /** Petite mention à droite du titre (« Discord · 3 masqués »). */
  meta?: React.ReactNode
  /** Pastille « Bêta » après le titre. */
  beta?: boolean
  className?: string
  children: React.ReactNode
}

/** Bloc de réglages : un panneau arrondi, son titre et ses lignes. */
export function SettingsCard({ title, meta, beta, className = '', children }: CardProps): React.JSX.Element {
  const id = useId()
  return (
    <section className={`set-card ${className}`} aria-labelledby={title ? id : undefined}>
      {title && (
        <header className="set-card-head">
          <h3 id={id}>
            {title}
            {beta && <span className="set-beta">Bêta</span>}
          </h3>
          {meta && <span className="set-card-meta">{meta}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

interface RowProps {
  label: string
  /** Valeur actuelle (pas une description). */
  value: React.ReactNode
  children: React.ReactNode
}

export function SettingRow({ label, value, children }: RowProps): React.JSX.Element {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-label">{label}</div>
        <div className="set-row-value">{value}</div>
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  )
}

/** Repli animé (grid-template-rows 0fr → 1fr). Le contenu replié sort de l'ordre de tabulation. */
export function Collapse({ open, id, children }: { open: boolean; id?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div id={id} className={`set-collapse ${open ? 'open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="set-collapse-inner">{children}</div>
    </div>
  )
}

/** Horloge qui avance toutes les 30 s, pour les « il y a 3 min ». */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function readLocal<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

/** Légende d'un store dans le rapport de scan. */
export function storeCaption(r: ScanReport): string {
  if (r.error) return r.error
  if (r.found > 0) return `${r.found} jeu${r.found > 1 ? 'x' : ''} trouvé${r.found > 1 ? 's' : ''}`
  return 'Non trouvé sur ce PC'
}

/** Version texte du rapport, pour le diagnostic et le presse-papiers. */
export function reportText(report: ScanReport[]): string {
  return report
    .map((r) => [`${STORE_LONG[r.store]} : ${r.error ? `erreur · ${r.error}` : storeCaption(r).toLowerCase()}`, ...r.checked.map((c) => `  ${c}`)].join('\n'))
    .join('\n\n')
}

export const prefersReducedMotion = (): boolean =>
  document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches
