import { useMemo, useState } from 'react'
import { cleanName, norm, plural, timeAgo } from '@shared/text'
import type { Friend, Game } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { StoreTag } from '../ui/StoreTag'
import { FavStar, usePop } from './GameCard'

interface HeroProps {
  game: Game
  friends: Friend[]
  launching: boolean
  onLaunch: (g: Game) => void
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

/**
 * Jeu à la une. Image : bannière (heroUrl), sinon jaquette floutée + jaquette nette à droite,
 * sinon le dégradé généré. Chaque image en échec retombe sur le cas suivant.
 */
export function Hero({ game, friends, launching, onLaunch, onOpen, onFavorite }: HeroProps): React.JSX.Element {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set())
  const fail = (u: string): void => setFailed((prev) => new Set(prev).add(u))
  const done = (u: string): void => setLoaded((prev) => new Set(prev).add(u))
  const [pop, firePop] = usePop()

  const heroUrl = game.heroUrl && !failed.has(game.heroUrl) ? game.heroUrl : undefined
  const posterUrl = !heroUrl && game.coverUrl && !failed.has(game.coverUrl) ? game.coverUrl : undefined
  const players = useMemo(() => {
    const key = norm(game.name)
    return friends.filter((f) => f.status === 'in-game' && !!f.game && norm(f.game) === key)
  }, [friends, game.name])

  const name = cleanName(game.name)
  const fav = !!game.favorite
  const kicker = game.lastPlayed ? 'Reprendre' : 'À la une'

  return (
    <section className={`lib-hero ${posterUrl ? 'has-poster' : ''}`} style={{ background: generatedBackground(game.name) }} aria-label={`${kicker} : ${name}`}>
      {heroUrl && (
        <img
          key={heroUrl}
          className={`lib-hero-img ${loaded.has(heroUrl) ? 'is-loaded' : ''}`}
          src={heroUrl}
          alt=""
          draggable={false}
          onLoad={() => done(heroUrl)}
          onError={() => fail(heroUrl)}
        />
      )}
      {posterUrl && (
        <img
          key={`blur-${posterUrl}`}
          className={`lib-hero-img lib-hero-blur ${loaded.has(posterUrl) ? 'is-loaded' : ''}`}
          src={posterUrl}
          alt=""
          draggable={false}
          onLoad={() => done(posterUrl)}
          onError={() => fail(posterUrl)}
        />
      )}
      <div className="lib-hero-scrim" aria-hidden="true" />
      {posterUrl && (
        <img
          key={`poster-${posterUrl}`}
          className={`lib-hero-poster ${loaded.has(posterUrl) ? 'is-loaded' : ''}`}
          src={posterUrl}
          alt=""
          draggable={false}
          onLoad={() => done(posterUrl)}
          onError={() => fail(posterUrl)}
        />
      )}

      <div className="lib-hero-body">
        <p className="overline lib-hero-kicker">{kicker}</p>
        <h2 className="lib-hero-title">{name}</h2>
        <div className="lib-hero-meta">
          <StoreTag kind={game.store} long />
          <span>{game.lastPlayed ? `Lancé ${timeAgo(game.lastPlayed)}` : 'Jamais lancé depuis Player X'}</span>
          {!!game.launches && <span className="num">{plural(game.launches, 'lancement', 'lancements')}</span>}
        </div>
        <div className="lib-hero-actions">
          <button className={`btn btn-primary btn-play ${launching ? 'is-launching' : ''}`} disabled={launching} onClick={() => onLaunch(game)}>
            {launching ? (
              <>
                <span className="spinner" />
                Lancement…
              </>
            ) : (
              <>
                <Icon name="play" size={18} />
                Jouer
              </>
            )}
          </button>
          <button
            className={`lib-glass-btn ${fav ? 'is-on' : ''}`}
            aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onClick={() => {
              firePop()
              onFavorite(game)
            }}
          >
            <FavStar on={fav} pop={pop} size={20} />
          </button>
          <button className="lib-glass-btn" aria-label="Détails" title="Détails" onClick={() => onOpen(game)}>
            <Icon name="info" size={20} />
          </button>
        </div>
      </div>

      {players.length > 0 && <FriendsChip players={players} />}
    </section>
  )
}

/** « 2 amis y jouent », « 1 ami et 1 membre Discord y jouent » avec leurs avatars. Les membres d'un serveur Discord ne sont pas des amis. */
function FriendsChip({ players }: { players: Friend[] }): React.JSX.Element {
  const n = players.length
  const pals = players.filter((p) => p.platform !== 'discord').length
  const members = n - pals
  return (
    <div className="lib-hero-friends" title={players.map((p) => p.name).join(', ')}>
      <span className="lib-hero-avatars">
        {players.slice(0, 3).map((p) => (
          <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={24} />
        ))}
      </span>
      <span className="lib-hero-friends-dot" aria-hidden="true" />
      <span>
        {pals > 0 && (
          <>
            <span className="num">{pals}</span> {pals > 1 ? 'amis' : 'ami'}
          </>
        )}
        {pals > 0 && members > 0 && ' et '}
        {members > 0 && (
          <>
            <span className="num">{members}</span> {members > 1 ? 'membres Discord' : 'membre Discord'}
          </>
        )}
        {n > 1 ? ' y jouent' : ' y joue'}
      </span>
    </div>
  )
}

/** Héros fantôme pendant le premier scan. */
export function HeroSkeleton(): React.JSX.Element {
  return (
    <div className="lib-hero-skel skel" aria-hidden="true">
      <div className="lib-hero-skel-bars">
        <span style={{ width: 120, height: 10 }} />
        <span style={{ width: 320, height: 28 }} />
        <span style={{ width: 180, height: 12 }} />
      </div>
    </div>
  )
}
