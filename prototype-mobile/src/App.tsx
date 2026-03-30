import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import BottomTabBar from './components/BottomTabBar'
import Drawer from './components/Drawer'
import HomePage from './pages/HomePage'
import RebecaChat from './pages/RebecaChat'
import LeadsPage from './pages/LeadsPage'
import ProfilePage from './pages/ProfilePage'
import LeadDetail from './pages/LeadDetail'
import ServiceAreas from './pages/ServiceAreas'
import SubscriptionPage from './pages/SubscriptionPage'
import GroupsPage from './pages/GroupsPage'
import JobsPage from './pages/JobsPage'
import JobDetail from './pages/JobDetail'
import PublishedJobDetail from './pages/PublishedJobDetail'
import DirectChat from './pages/DirectChat'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import NotificationsPage from './pages/NotificationsPage'
import VerifyIdentity from './pages/VerifyIdentity'
import MessagesInbox from './pages/MessagesInbox'
import CompleteAccount from './pages/CompleteAccount'
import PublicProfileView from './pages/PublicProfileView'
import MyReviews from './pages/MyReviews'
import EditProfessions from './pages/EditProfessions'

const noShellHeader = ['/', '/rebeca', '/lead', '/areas', '/subscription', '/groups', '/jobs', '/job', '/published-job', '/chat', '/login', '/onboarding', '/notifications', '/verify', '/messages', '/complete-account', '/public-profile', '/reviews', '/professions']
const noTabBar = ['/rebeca', '/lead', '/areas', '/subscription', '/groups', '/job', '/published-job', '/chat', '/login', '/onboarding', '/notifications', '/verify', '/messages', '/complete-account', '/public-profile', '/reviews', '/professions']

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const showHeader = !noShellHeader.includes(location.pathname)
  const showTabBar = !noTabBar.includes(location.pathname)

  return (
    <div className="mobile-frame">
      {showHeader && (
        <Header title="Masterleadflow" onMenuOpen={() => setDrawerOpen(true)} notificationCount={2} />
      )}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <Routes>
        <Route path="/" element={<HomePage onMenuOpen={() => setDrawerOpen(true)} />} />
        <Route path="/rebeca" element={<RebecaChat />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/lead" element={<LeadDetail />} />
        <Route path="/areas" element={<ServiceAreas />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/sub" element={<SubscriptionPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/job" element={<JobDetail />} />
        <Route path="/published-job" element={<PublishedJobDetail />} />
        <Route path="/chat" element={<DirectChat />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/verify" element={<VerifyIdentity />} />
        <Route path="/messages" element={<MessagesInbox />} />
        <Route path="/complete-account" element={<CompleteAccount />} />
        <Route path="/public-profile" element={<PublicProfileView />} />
        <Route path="/reviews" element={<MyReviews />} />
        <Route path="/professions" element={<EditProfessions />} />
      </Routes>

      {showTabBar && <BottomTabBar />}
    </div>
  )
}
