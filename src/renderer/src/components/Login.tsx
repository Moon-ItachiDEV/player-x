interface Props {
  onLogin: (platform: 'steam' | 'discord' | 'psn') => void
  onSkip: () => void
  onDemo: () => void
}

export function Login({ onLogin, onSkip, onDemo }: Props): React.JSX.Element {
  return (
    <div className="login">
      <div className="login-glow" />
      <div className="login-card">
        <div className="logo big">
          <span>PG</span>
        </div>
        <h1>
          PLATEFORME <em>GAMING</em>
        </h1>
        <p>Tous tes jeux au même endroit. Vois qui est en ligne et lance la partie en un clic.</p>
        <button className="login-btn steam" onClick={() => onLogin('steam')}>
          Se connecter avec Steam
        </button>
        <button className="login-btn discord" onClick={() => onLogin('discord')}>
          Se connecter avec Discord
        </button>
        <div className="login-alt">
          <button className="link-btn" onClick={onSkip}>
            Continuer sans compte
          </button>
          <span>·</span>
          <button className="link-btn" onClick={onDemo}>
            Essayer en mode démo
          </button>
        </div>
      </div>
    </div>
  )
}
