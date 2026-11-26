import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.scss'
import App from './App.tsx'
import { TooltipLayer } from './game/ui/TooltipLayer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <TooltipLayer />
  </StrictMode>,
)
