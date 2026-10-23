import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées : l'appli s'affiche pareil hors ligne et dans le .exe.
// Design « Braise » : Inter pour l'interface, Sora pour les titres et les chiffres.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
