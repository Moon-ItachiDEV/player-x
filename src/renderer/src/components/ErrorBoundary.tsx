// Dernier filet : une donnée inattendue (réponse d'API, base abîmée) ne doit pas laisser une fenêtre vide.
import { Component, type ReactNode } from 'react'

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error(error)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" style={{ height: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <h2>Player X a rencontré un problème</h2>
          <p>Recharge l'interface pour continuer. Tes jeux et tes réglages ne sont pas touchés.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    )
  }
}
