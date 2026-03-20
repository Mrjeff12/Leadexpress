import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import PartnersPage from './pages/PartnersPage'
import CommunityDirectory from './pages/CommunityDirectory'
import PartnerProfile from './pages/PartnerProfile'
import JoinRedirect from './pages/JoinRedirect'
import { LanguageProvider } from './i18n/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/community" element={<CommunityDirectory />} />
          <Route path="/community/:slug" element={<PartnerProfile />} />
          <Route path="/join/:code" element={<JoinRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
)
