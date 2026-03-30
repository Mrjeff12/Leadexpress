import { ArrowLeft, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const chats = [
  { name: 'Rebeca', photo: '/rebeca.jpg', last: 'I found 5 new leads for you!', time: '9:17 AM', unread: 3, isBot: true },
  { name: 'Carlos M.', photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face', last: 'Thursday works. I can be there by 9 AM.', time: '2:19 PM', unread: 1, job: 'Bathroom Plumbing' },
  { name: 'Tom B.', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', last: 'Great job on the rekey!', time: 'Yesterday', unread: 0, job: 'Lock Rekey' },
  { name: 'Alex R.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', last: 'Is the plumbing job still available?', time: 'Yesterday', unread: 0, job: 'Bathroom Plumbing' },
]

export default function MessagesInbox() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">Messages</h1>
      </div>

      <div className="px-5 pb-6">
        <div className="space-y-1 stagger">
          {chats.map((c, i) => (
            <button key={i} onClick={() => nav(c.isBot ? '/rebeca' : '/chat')}
              className={`w-full flex items-center gap-3 p-3 rounded-xl press text-left anim-up ${c.unread > 0 ? 'bg-[var(--gray-50)]' : ''}`}>
              <div className="relative flex-shrink-0">
                {c.isBot ? (
                  <div className="w-12 h-12 rounded-full bg-[var(--brand)] flex items-center justify-center">
                    <Sparkles size={18} className="text-white" />
                  </div>
                ) : (
                  <img src={c.photo} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
                )}
                {c.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[var(--brand)] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                    {c.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-[14px] ${c.unread > 0 ? 'font-bold' : 'font-medium'}`}>{c.name}</p>
                  <span className={`text-[10px] ${c.unread > 0 ? 'text-[var(--brand)] font-semibold' : 'text-faded'}`}>{c.time}</span>
                </div>
                {c.job && <p className="text-[10px] text-[var(--brand)] font-medium">{c.job}</p>}
                <p className={`text-[12px] truncate mt-0.5 ${c.unread > 0 ? 'text-[var(--dark)]' : 'text-muted'}`}>{c.last}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
