import { X, Users, Briefcase, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface DrawerProps { open: boolean; onClose: () => void }

const items = [
  { icon: Users, label: 'Groups', desc: 'WhatsApp groups', path: '/groups' },
  { icon: Briefcase, label: 'My Jobs', desc: 'Published & received', path: '/jobs' },
  { icon: CreditCard, label: 'Subscription', desc: 'Plan & billing', path: '/sub' },
  { icon: Settings, label: 'Settings', desc: 'Preferences', path: '/settings' },
]

export default function Drawer({ open, onClose }: DrawerProps) {
  const nav = useNavigate()
  return (
    <>
      {open && <div className="fixed inset-0 z-50 drawer-overlay anim-fade" onClick={onClose} />}
      <div className={`fixed top-0 left-0 bottom-0 z-50 w-[300px] bg-white transform transition-transform duration-[400ms] ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>

        <div className="pt-14 px-6 pb-8">
          <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
            <X size={15} />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--dark)] flex items-center justify-center text-white text-lg font-bold">MJ</div>
            <div>
              <h3 className="t-sub text-[16px]">Mike Johnson</h3>
              <span className="t-tiny text-[var(--brand)]">Verified Contractor</span>
            </div>
          </div>

          {/* Completion */}
          <div className="flex items-center gap-3 card-filled p-4 rounded-2xl">
            <span className="t-title text-[var(--brand)]">72%</span>
            <div>
              <p className="t-sub text-[13px]">Profile</p>
              <p className="t-tiny text-muted">Add photo to level up</p>
            </div>
          </div>
        </div>

        <div className="px-5 space-y-1">
          {items.map((item, i) => {
            const I = item.icon
            return (
              <button key={i} onClick={() => { nav(item.path); onClose() }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl press text-left hover:bg-[var(--gray-50)] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[var(--gray-50)] flex items-center justify-center">
                  <I size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1">
                  <p className="t-sub">{item.label}</p>
                  <p className="t-tiny text-muted">{item.desc}</p>
                </div>
                <ChevronRight size={15} className="text-faded" />
              </button>
            )
          })}
        </div>

        <div className="absolute bottom-8 left-6">
          <button className="flex items-center gap-2 text-muted press">
            <LogOut size={15} /><span className="t-small">Log Out</span>
          </button>
        </div>
      </div>
    </>
  )
}
