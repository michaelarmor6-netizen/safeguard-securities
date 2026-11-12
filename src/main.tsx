import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SafeguardApp from './SafeguardApp'
import { isSafeguardMode } from './config/liveCollections'

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__sgInstallPrompt = event as BeforeInstallPromptEvent
  window.dispatchEvent(new Event('sg-install-ready'))
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSafeguardMode ? (
      <BrowserRouter>
        <SafeguardApp />
      </BrowserRouter>
    ) : (
      <App />
    )}
  </StrictMode>,
)
