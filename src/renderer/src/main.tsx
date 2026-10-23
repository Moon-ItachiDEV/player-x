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
import OverlayApp from './overlay/OverlayApp'

// La fenêtre de l'overlay CS2 charge la même page avec « #overlay ».
const isOverlay = location.hash === '#overlay'
// Fond transparent avant le premier rendu (sinon un éclair du fond de l'appli par-dessus le jeu).
if (isOverlay) document.documentElement.classList.add('ov-page')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOverlay ? (
      <OverlayApp />
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </StrictMode>
)
