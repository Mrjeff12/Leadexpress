import { Routes, Route, Navigate } from 'react-router-dom'
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

export default function AdminLayout() {
  return (
    <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      <AdminSidebar />
      <main className="relative transition-all duration-300" style={{ paddingInlineStart: 264 }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/leads" element={<AdminLeads />} />
            <Route path="/prospects" element={<AdminProspects />} />
            <Route path="/prospects/:id" element={<ProspectDetail />} />
            <Route path="/contractors" element={<AdminContractors />} />
            <Route path="/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/groups" element={<AdminGroups />} />
            <Route path="/message-templates" element={<MessageTemplates />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/professions" element={<Professions />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
