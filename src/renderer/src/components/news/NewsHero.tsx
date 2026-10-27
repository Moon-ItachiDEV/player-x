import { useEffect, useRef, useState } from 'react'
import { capitalize, cleanName, norm, timeAgo } from '@shared/text'
import type { Game, NewsFeedItem } from '@shared/types'
import { setArtBase } from '../../motion'
import { generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { heroNameSize, shortTitle } from './feedView'
import { useGameNews } from './useGameNews'

export type GameArt = Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>

/** Une image candidate de l'écran : celle de l'annonce, puis la bannière du jeu, puis sa jaquette (floutée). */
interface ArtSource {
  url: string
  blur: boolean
  kind: 'post' | 'game'
}
/** Le visuel de l'écran. `key` : l'image d'un même jeu ne refait pas de fondu d'une annonce à l'autre. */
export interface Visual {
  key: string
  name: string
  sources: ArtSource[]
}

/** L'annonce complète (et son image) arrive : on attend au plus ce temps avant de montrer l'image du jeu. */
const WAIT_POST_MS = 700
/** Jeu à la une depuis ce temps-là avant de demander ses annonces à Steam : un choix posé, pas chaque jeu traversé. */
const SETTLE_MS = 250
/** Durée du fondu d'une image à l'autre : l'ancienne reste dessous ce temps-là. */
const FADE_MS = 600

interface FeatureProps {
  item: NewsFeedItem
  game: GameArt
  now: number
  onRead: (gameId: string, postId: string) => void
}

/**
 * « À la une », comme l'Accueil : la plus récente annonce de la vue, son image (sinon celle du jeu) en plein cadre sous
 * la barre du haut ; en bas à gauche, le nom du jeu en très grand, le titre dessous et un seul bouton. Le haut de l'image
 * reste libre : les images d'annonce y ont souvent leur propre texte (« PITCH NOTES · UPDATE V1.1 »).
 */
export function NewsFeature({ item, game, now, onRead }: FeatureProps): React.JSX.Element {
  // Image de l'annonce : le relevé n'a que les titres, la fiche du jeu a le reste (même lecture, même cache).
  // Le premier jeu est demandé tout de suite ; les suivants une fois le choix posé, pas à chaque jeu traversé.
  const [settled, setSettled] = useState(item.gameId)
  useEffect(() => {
    const t = setTimeout(() => setSettled(item.gameId), SETTLE_MS)
    return () => clearTimeout(t)
  }, [item.gameId])
  const { state } = useGameNews(item.gameId, settled === item.gameId)
  const post = state.status === 'ready' ? state.news.posts.find((p) => p.id === item.id) : undefined

  // Relevé du jeu lent : passé un court délai, l'image du jeu s'affiche sans attendre celle de l'annonce.
  const [waited, setWaited] = useState(false)
  const [waitFor, setWaitFor] = useState(item.gameId)
  if (waitFor !== item.gameId) {
    setWaitFor(item.gameId)
    setWaited(false)
  }
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), WAIT_POST_MS)
    return () => clearTimeout(t)
  }, [item.gameId])

  const resolved = state.status !== 'loading' || waited
  const visual: Visual | null = !resolved
    ? null
    : post?.image
      ? { key: `${item.gameId}:${item.id}`, name: game.name, sources: [{ url: post.image, blur: false, kind: 'post' }, ...gameVisual(item.gameId, game).sources] }
      : gameVisual(item.gameId, game)

  const name = cleanName(item.gameName)
  const title = shortTitle(item.title, item.gameName)
  const when = capitalize(timeAgo(item.date, Math.max(now, item.date)))
  const verb = item.patch ? 'Lire le patch' : "Lire l'actu"

  return (
    <section className="nf-hero" aria-label="À la une">
      <NewsArt visual={visual} />
      <div className="nf-hero-text">
        {/* key : seul ce bloc se remonte (et s'anime) quand l'annonce change ; le bouton reste, le focus aussi. */}
        <div key={`${item.gameId}:${item.id}`} className="nf-hero-anim">
          <p className="nf-hero-kicker num">
            {item.patch ? `Patch · ${when}` : when}
            {item.isNew && (
              <span className="news-badge nf-hero-new">
                <span className="news-badge-dot" aria-hidden="true" />
                Nouveau
              </span>
            )}
          </p>
          <p className="nf-hero-game" data-size={heroNameSize(item.gameName)}>
            {name}
          </p>
          {/* Annonce intitulée comme le jeu : le nom suffit à l'écran. */}
          <h2 className={norm(title) === norm(name) ? 'sr-only' : 'nf-hero-title'} title={item.title}>
            {title}
          </h2>
        </div>
        <div className="nf-hero-actions">
          <button className="btn btn-primary nf-read" aria-label={`${verb} : ${item.title}`} onClick={() => onRead(item.gameId, item.id)}>
            {verb}
          </button>
        </div>
      </div>
    </section>
  )
}

/** Onglet Patchs, jeu choisi sans patch : l'écran garde l'image du jeu, dit pourquoi il est vide et comment en sortir. */
export function NoPatchHero({ gameId, game, onAll }: { gameId: string; game: GameArt; onAll: () => void }): React.JSX.Element {
  const name = cleanName(game.name)
  return (
    <section className="nf-hero is-empty" aria-labelledby="nf-hero-empty-h">
      <NewsArt visual={gameVisual(gameId, game)} />
      <div className="nf-hero-text">
        <div className="nf-hero-anim">
          <p className="nf-hero-game" data-size={heroNameSize(game.name)}>
            {name}
          </p>
          <h2 id="nf-hero-empty-h" className="nf-hero-title">
            Aucun patch récent
          </h2>
          <p className="nf-hero-note">{name} n'a pas publié de notes de patch dans ses dernières annonces.</p>
        </div>
        <div className="nf-hero-actions">
          <button className="btn nf-glass" onClick={onAll}>
            <Icon name="list" size={18} />
            Voir toutes les actus
          </button>
        </div>
      </div>
    </section>
  )
}

/** Premier relevé : la forme de l'écran du haut (surtitre, nom, titre, bouton), sans image. */
export function HeroSkeleton(): React.JSX.Element {
  return (
    <section className="nf-hero is-skel" aria-hidden="true">
      <div className="nf-hero-text">
        <span className="skel nf-skel-kicker" />
        <span className="skel nf-skel-game" />
        <span className="skel nf-skel-title" />
        <span className="skel nf-skel-btn" />
      </div>
    </section>
  )
}

/* ---------- l'image, en plein cadre ---------- */

/** Visuel d'un jeu : sa bannière, sinon sa jaquette floutée, sinon le dégradé généré (aucune source). */
export function gameVisual(gameId: string, game: GameArt): Visual {
  const sources: ArtSource[] = []
  if (game.heroUrl) sources.push({ url: game.heroUrl, blur: false, kind: 'game' })
  if (game.coverUrl) sources.push({ url: game.coverUrl, blur: true, kind: 'game' })
  return { key: gameId, name: game.name, sources }
}

/** Image de l'écran, posée en fondu sur la précédente. `visual` null : on garde celle qui est affichée (annonce en route). */
export function NewsArt({ visual }: { visual: Visual | null }): React.JSX.Element {
  const [current, setCurrent] = useState<Visual | null>(visual)
  if (visual && visual.key !== current?.key) setCurrent(visual)
  // Même visuel, sources changées (l'annonce est arrivée sans image, ou une bannière manque) : on suit.
  else if (visual && current && visual !== current && visual.sources.map((s) => s.url).join() !== current.sources.map((s) => s.url).join()) setCurrent(visual)

  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const fail = (u: string): void => setFailed((f) => (f.has(u) ? f : new Set(f).add(u)))
  const pick = (v: Visual): ArtSource | undefined => v.sources.find((s) => !failed.has(s.url))
  const src = current ? pick(current) : undefined

  // Changement d'image : l'ancienne reste dessous le temps du fondu.
  const last = useRef<{ v: Visual; src?: ArtSource } | null>(current ? { v: current, src } : null)
  const [prev, setPrev] = useState<{ v: Visual; src?: ArtSource } | null>(null)
  const layerKey = current ? `${current.key}|${src?.url ?? ''}` : ''
  useEffect(() => {
    if (!current) return
    const was = last.current
    last.current = { v: current, src }
    if (!was || `${was.v.key}|${was.src?.url ?? ''}` === layerKey) return
    setPrev(was)
    const t = setTimeout(() => setPrev(null), FADE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerKey])

  // Fond de la page aux couleurs de l'image (Ambient) : il reste sous la liste « Tes jeux ».
  useEffect(() => setArtBase(src?.url), [src?.url])
  useEffect(() => () => setArtBase(null), [])

  return (
    <div className="nf-art" aria-hidden="true">
      {prev && <ArtLayer key={`prev|${prev.v.key}|${prev.src?.url ?? ''}`} v={prev.v} src={prev.src} still onFail={fail} />}
      {current && <ArtLayer key={layerKey} v={current} src={src} onFail={fail} />}
      <div className="nf-scrim" />
    </div>
  )
}

function ArtLayer({ v, src, still, onFail }: { v: Visual; src?: ArtSource; still?: boolean; onFail: (u: string) => void }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`nf-art-layer ${still ? 'is-still' : ''}`} style={{ background: generatedBackground(v.name) }}>
      {src && (
        <img
          className={`nf-img is-${src.kind} ${src.blur ? 'is-blur' : ''} ${loaded || still ? 'is-loaded' : ''}`}
          src={src.url}
          alt=""
          draggable={false}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => onFail(src.url)}
        />
      )}
    </div>
  )
}
