import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées : l'appli s'affiche pareil hors ligne et dans le .exe.
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'
import '@fontsource/michroma'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
