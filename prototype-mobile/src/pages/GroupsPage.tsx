import { ArrowLeft, Plus, Link2, MessageSquare, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const groups = [
  { name: 'Miami Locksmith Network', messages: 1247, leads: 12 },
  { name: 'South FL Contractors', messages: 3891, leads: 8 },
  { name: 'Broward Home Services', messages: 892, leads: 5 },
]

export default function GroupsPage() {
  const nav = useNavigate()
  const totalMessages = groups.reduce((s, g) => s + g.messages, 0)
  const totalLeads = groups.reduce((s, g) => s + g.leads, 0)

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight flex-1">WhatsApp Groups</h1>
        <button className="w-9 h-9 rounded-full bg-[var(--brand)] flex items-center justify-center press">
          <Plus size={17} className="text-white" />
        </button>
      </div>

      <div className="px-5 pb-6">

        {/* Stats */}
        <div className="flex gap-2.5 mb-5 anim-up">
          <div className="card-filled flex-1 p-3.5 rounded-xl text-center">
            <p className="text-[22px] font-bold tracking-tight">{groups.length}</p>
            <p className="text-[10px] text-muted">Groups</p>
          </div>
          <div className="card-filled flex-1 p-3.5 rounded-xl text-center">
            <p className="text-[22px] font-bold tracking-tight">{totalMessages.toLocaleString()}</p>
            <p className="text-[10px] text-muted">Messages scanned</p>
          </div>
          <div className="card-filled flex-1 p-3.5 rounded-xl text-center">
            <p className="text-[22px] font-bold tracking-tight text-green-600">{totalLeads}</p>
            <p className="text-[10px] text-muted">Leads found</p>
          </div>
        </div>

        {/* Groups list - WhatsApp style */}
        <p className="t-label mb-2">Your Groups</p>
        <div className="space-y-2 mb-5">
          {groups.map((g, i) => (
            <div key={i} className="card p-4 press anim-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3">
                {/* WhatsApp icon */}
                <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212L4 20l1.212-3.757A8 8 0 1112 20z"/>
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="t-sub text-[14px] truncate">{g.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <MessageSquare size={10} /> {g.messages.toLocaleString()} msgs
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                      <Zap size={10} /> {g.leads} leads
                    </span>
                  </div>
                </div>

                {/* Scanning indicator */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] text-green-600 font-medium">Live</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add group */}
        <div className="card p-4 border-2 border-dashed border-[var(--gray-200)] anim-up">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-2">
              <Link2 size={16} className="text-[#25D366]" />
            </div>
            <p className="t-sub text-[13px] mb-1">Add WhatsApp Group</p>
            <p className="text-[10px] text-muted mb-3">Paste your group invite link</p>
            <div className="flex items-center gap-2 bg-[var(--gray-50)] rounded-xl px-3.5 py-3">
              <Link2 size={14} className="text-[var(--gray-400)]" />
              <input type="text" placeholder="https://chat.whatsapp.com/..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder-[var(--gray-400)]" />
            </div>
            <button className="w-full btn-dark mt-3 text-[13px] py-3">
              <Plus size={14} /> Add Group
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
