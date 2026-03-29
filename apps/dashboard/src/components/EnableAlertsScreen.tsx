import { useEffect } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import OnboardingProgress from './OnboardingProgress'

export default function EnableAlertsScreen() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { status: pushStatus, enable: enablePush, isLoading } = usePushNotifications()

  async function updateStep(step: string) {
    if (!profile?.id) return
    await supabase.from('contractors').update({ onboarding_step: step }).eq('user_id', profile.id)
  }

  async function handleEnable() {
    await enablePush()
    await updateStep('push_enabled')
    navigate('/')
  }

  function handleSkip() {
    navigate('/')
  }

  // Auto-skip if unsupported (not in PWA on iOS) or already granted
  useEffect(() => {
    if (pushStatus === 'loading') return
    if (pushStatus === 'unsupported' || pushStatus === 'denied') {
      navigate('/')
    } else if (pushStatus === 'granted') {
      updateStep('push_enabled')
      navigate('/')
    }
  }, [pushStatus])

  if (pushStatus === 'loading' || pushStatus === 'unsupported' || pushStatus === 'denied' || pushStatus === 'granted') {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 flex flex-col px-6 pt-8 pb-6 max-w-md mx-auto w-full">
        <OnboardingProgress current={3} />

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Bell icon with pulse */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-[#fe5b25]/10 flex items-center justify-center">
              <Bell className="w-10 h-10 text-[#fe5b25]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/20 animate-ping" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Turn on lead alerts
          </h1>
          <p className="text-gray-500 text-sm mb-3 max-w-[280px]">
            Get notified instantly when a new job matches your area. Don't miss out.
          </p>

          {/* Trial badge */}
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-8">
            <span className="text-sm">⚡</span>
            <span className="text-amber-700 text-xs font-semibold">Required for your 7-day free trial</span>
          </div>
        </div>

        {/* Bottom action area */}
        <div className="space-y-3 pb-4">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Bell className="w-5 h-5" />
                Enable Alerts
              </>
            )}
          </button>

          <button
            onClick={handleSkip}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
