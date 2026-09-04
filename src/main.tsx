import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { restoreSession } from './auth/session'

// Avant le premier rendu : sans cela, un rafraîchissement de page afficherait
// brièvement le formulaire de connexion avant de basculer sur le dashboard.
// L'appel est synchrone et ne lève jamais, y compris si le navigateur refuse
// l'accès au stockage.
restoreSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
