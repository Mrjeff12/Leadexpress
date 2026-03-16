import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import HeroTest from './HeroTest'

// Toggle between App and HeroTest to compare hero options
const showHeroTest = new URLSearchParams(window.location.search).has('herotest')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showHeroTest ? <HeroTest /> : <App />}
  </StrictMode>,
)
