import { useState } from 'react'
import { MapPin, Clock, DollarSign, Zap, Flame, Inbox, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Tab = 'new' | 'claimed' | 'passed'

const leads = {
  new: [
    { id:1, type:'Lockout Service', name:'Sarah M.', loc:'Miami, FL', time:'5m', budget:'$80-120', urgent:true, source:'whatsapp' as const },
    { id:2, type:'Lock Rekey (3 locks)', name:'James K.', loc:'Ft. Lauderdale', time:'23m', budget:'$150-200', urgent:false, source:'whatsapp' as const },
    { id:3, type:'Smart Lock Install', name:'David R.', loc:'Boca Raton', time:'45m', budget:'$200-300', urgent:false, source:'app' as const },
    { id:4, type:'Car Lockout', name:'Maria S.', loc:'Doral, FL', time:'1h', budget:'$60-90', urgent:true, source:'whatsapp' as const },
    { id:5, type:'Deadbolt Replace', name:'Tom B.', loc:'Coral Gables', time:'2h', budget:'$120-180', urgent:false, source:'app' as const },
  ],
  claimed: [
    { id:6, type:'Lockout Service', name:'Sarah M.', loc:'Miami, FL', time:'5m ago', budget:'$80', urgent:false },
  ],
  passed: [] as any[],
}

export default function LeadsPage() {
  const [tab, setTab] = useState<Tab>('new')
  const nav = useNavigate()

  return (
    <div className="page-content">
      <div className="px-5 pt-4 pb-6">

        {/* Compact header with tabs inline */}
        <div className="flex items-center justify-between mb-3 anim-up">
          <h1 className="text-[22px] font-bold tracking-tight">Leads</h1>
          <div className="flex gap-1.5">
            {(['new','claimed','passed'] as Tab[]).map(t => {
              const count = leads[t].length
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium press transition-all ${
                    tab === t ? 'bg-[var(--dark)] text-white' : 'bg-[var(--gray-100)] text-muted'
                  }`}>
                  {t === 'new' ? 'New' : t === 'claimed' ? 'Claimed' : 'Passed'}
                  {count > 0 && <span className="ml-1 opacity-50">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filters - compact */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar anim-up">
          <span className="text-[11px] font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-3 py-1.5 rounded-full whitespace-nowrap">Locksmith</span>
          <span className="text-[11px] font-medium text-muted bg-[var(--gray-100)] px-3 py-1.5 rounded-full whitespace-nowrap">Miami Area</span>
          <span className="text-[11px] font-medium text-muted bg-[var(--gray-100)] px-3 py-1.5 rounded-full whitespace-nowrap">Today</span>
        </div>

        {/* Empty state */}
        {leads[tab].length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-[var(--gray-100)] flex items-center justify-center mx-auto mb-3">
              <Inbox size={20} className="text-[var(--gray-400)]" />
            </div>
            <p className="t-sub mb-1">No leads here</p>
            <p className="text-[11px] text-muted">New leads will appear as they come in</p>
          </div>
        ) : (
          /* Compact lead list */
          <div className="space-y-1.5 stagger">
            {leads[tab].map((l, i) => (
              <div key={l.id} onClick={() => nav('/lead')}
                className={`card px-4 py-3 flex items-center gap-3 press anim-up ${l.urgent ? 'border-l-[3px] border-l-[var(--brand)]' : ''}`}>

                {/* Initials */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                  l.urgent ? 'bg-[var(--brand)]' : 'bg-[var(--dark)]'
                }`}>{l.name.split(' ').map(n=>n[0]).join('')}</div>

                {/* Info - compact */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold truncate">{l.type}</p>
                    {l.urgent && <Flame size={10} className="text-[var(--brand)] flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted">{l.name}</span>
                    <span className="text-[10px] text-faded">{l.loc}</span>
                    <span className="text-[10px] text-faded">{l.time}</span>
                    {(l as any).source === 'whatsapp' ? (
                      <span className="text-[8px] font-semibold text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded-full">WA</span>
                    ) : (
                      <span className="text-[8px] font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-1.5 py-0.5 rounded-full">APP</span>
                    )}
                  </div>
                </div>

                {/* Price + action */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[12px] font-bold text-green-600">{l.budget}</span>
                  {tab === 'new' ? (
                    <ChevronRight size={14} className="text-faded" />
                  ) : (
                    <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
