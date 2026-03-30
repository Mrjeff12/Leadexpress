import { ArrowLeft, Zap, CheckCircle2, MessageCircle, Star, Bell, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const notifications = [
  { type: 'lead', title: 'New urgent lead nearby', desc: 'Lockout Service · Miami, FL · $80-120', time: '5m ago', unread: true, icon: Zap },
  { type: 'response', title: 'Carlos M. responded to your job', desc: 'Bathroom Plumbing · Interested', time: '12m ago', unread: true, icon: Users },
  { type: 'message', title: 'New message from Tom B.', desc: 'Hey, are you available tomorrow?', time: '35m ago', unread: true, icon: MessageCircle },
  { type: 'job', title: 'Job accepted!', desc: 'Lock Rekey · James K. confirmed', time: '1h ago', unread: false, icon: CheckCircle2 },
  { type: 'lead', title: '3 new leads in your area', desc: 'Lock Rekey, Smart Lock, Deadbolt', time: '2h ago', unread: false, icon: Zap },
  { type: 'review', title: 'New review from Sarah M.', desc: '⭐ 5.0 — "Excellent work!"', time: 'Yesterday', unread: false, icon: Star },
  { type: 'system', title: 'Profile 72% complete', desc: 'Add ID verification to unlock more leads', time: 'Yesterday', unread: false, icon: Bell },
]

export default function NotificationsPage() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight flex-1">Notifications</h1>
        <button className="text-[11px] text-[var(--brand)] font-semibold press">Mark all read</button>
      </div>

      <div className="px-5 pb-6">
        <div className="space-y-1 stagger">
          {notifications.map((n, i) => {
            const I = n.icon
            return (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl press anim-up ${n.unread ? 'bg-[var(--brand-light)]/50' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  n.type === 'lead' ? 'bg-[var(--brand-light)]' :
                  n.type === 'response' ? 'bg-blue-50' :
                  n.type === 'message' ? 'bg-green-50' :
                  n.type === 'job' ? 'bg-green-50' :
                  n.type === 'review' ? 'bg-amber-50' :
                  'bg-[var(--gray-100)]'
                }`}>
                  <I size={15} className={
                    n.type === 'lead' ? 'text-[var(--brand)]' :
                    n.type === 'response' ? 'text-blue-500' :
                    n.type === 'message' ? 'text-green-600' :
                    n.type === 'job' ? 'text-green-600' :
                    n.type === 'review' ? 'text-amber-500' :
                    'text-muted'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[13px] ${n.unread ? 'font-bold' : 'font-medium'}`}>{n.title}</p>
                    {n.unread && <div className="w-2 h-2 rounded-full bg-[var(--brand)] flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{n.desc}</p>
                  <p className="text-[10px] text-faded mt-1">{n.time}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
