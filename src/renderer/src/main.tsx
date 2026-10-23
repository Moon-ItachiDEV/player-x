import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées : l'appli s'affiche pareil hors ligne et dans le .exe.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow/800.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import '@fontsource/michroma'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import OverlayApp from './overlay/OverlayApp'

// La fenêtre de l'overlay CS2 charge la même page avec « #overlay ».
const isOverlay = location.hash === '#overlay'

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
