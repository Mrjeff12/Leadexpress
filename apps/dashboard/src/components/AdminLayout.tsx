import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'

// Import existing admin pages
import AdminDashboard from '../pages/AdminDashboard'
import AdminContractors from '../pages/AdminContractors'
import AdminGroups from '../pages/AdminGroups'
import AdminWhatsApp from '../pages/AdminWhatsApp'
import AdminLeads from '../pages/AdminLeads'
import AdminProspects from '../pages/AdminProspects'
import ProspectDetail from '../pages/ProspectDetail'

// Import new admin pages
import MessageTemplates from '../pages/admin/MessageTemplates'
import Subscriptions from '../pages/admin/Subscriptions'
import Revenue from '../pages/admin/Revenue'
import Analytics from '../pages/admin/Analytics'
import ActivityLog from '../pages/admin/ActivityLog'
import Professions from '../pages/admin/Professions'
import ServiceAreas from '../pages/admin/ServiceAreas'
import SystemSettings from '../pages/admin/SystemSettings'
import LeadsMap from '../pages/admin/LeadsMap'
import ContractorDetail from '../pages/admin/ContractorDetail'

import AdminInbox from '../pages/AdminInbox'
import AdminGroupDetail from '../pages/AdminGroupDetail'

export default function AdminLayout() {
  const location = useLocation()
  const isFullBleed = location.pathname === '/admin/leads-map' || location.pathname === '/admin/inbox'

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <div className="le-bg" />
      <div className="le-grain" />
      <AdminSidebar />
      <main className="relative transition-all duration-300 admin-main-content flex-1 flex flex-col h-full overflow-hidden">
        <div className={isFullBleed ? 'flex-1 relative overflow-hidden flex flex-col h-full' : 'max-w-6xl mx-auto w-full px-6 py-8 flex-1 overflow-y-auto'}>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/inbox" element={<AdminInbox />} />
            <Route path="/leads" element={<AdminLeads />} />
            <Route path="/prospects" element={<AdminProspects />} />
            <Route path="/prospects/:id" element={<ProspectDetail />} />
            <Route path="/contractors" element={<AdminContractors />} />
            <Route path="/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/groups" element={<AdminGroups />} />
            <Route path="/groups/:id" element={<AdminGroupDetail />} />
            <Route path="/message-templates" element={<MessageTemplates />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/professions" element={<Professions />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="/leads-map" element={<LeadsMap />} />
            <Route path="/contractors/:id" element={<ContractorDetail />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
