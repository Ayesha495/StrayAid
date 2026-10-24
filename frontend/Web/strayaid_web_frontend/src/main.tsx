import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource-variable/inter"
import "leaflet/dist/leaflet.css"
import './index.css'
import './styles/tailwind.css'
// The design system used by the newer pages (scoped by the .ds class in ds.css).
import './styles/tokens.css'
import './styles/ui.css'
import './styles/ds.css'
import './styles/depth.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
