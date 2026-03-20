import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const PartnerHome = lazy(() => import('./PartnerHome'))
const PartnerReferrals = lazy(() => import('./PartnerReferrals'))
const PartnerCommunities = lazy(() => import('./PartnerCommunities'))
const PartnerGroupDetail = lazy(() => import('./PartnerGroupDetail'))
const PartnerWallet = lazy(() => import('./PartnerWallet'))
const PartnerShare = lazy(() => import('./PartnerShare'))
const PartnerSettings = lazy(() => import('./PartnerSettings'))

function PartnerFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
    </div>
  )
}

export default function PartnerLayout() {
  return (
    <Suspense fallback={<PartnerFallback />}>
      <Routes>
        <Route index element={<PartnerHome />} />
        <Route path="referrals" element={<PartnerReferrals />} />
        <Route path="communities" element={<PartnerCommunities />} />
        <Route path="groups/:groupId" element={<PartnerGroupDetail />} />
        <Route path="wallet" element={<PartnerWallet />} />
        <Route path="share" element={<PartnerShare />} />
        <Route path="settings" element={<PartnerSettings />} />
        <Route path="*" element={<Navigate to="/partner" replace />} />
      </Routes>
    </Suspense>
  )
}
