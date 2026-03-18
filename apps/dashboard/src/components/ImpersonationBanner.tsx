import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export default function ImpersonationBanner() {
  const { impersonatedProfile, stopImpersonating } = useAuth()
  const navigate = useNavigate()

  if (!impersonatedProfile) return null

  const handleExit = () => {
    stopImpersonating()
    navigate('/admin/contractors')
  }

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 bg-red-500 text-white text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          Viewing as: <strong>{impersonatedProfile.full_name}</strong> — actions will affect their account
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Return to Admin
      </button>
    </div>
  )
}
