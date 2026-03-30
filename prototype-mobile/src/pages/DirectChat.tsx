import { useState } from 'react'
import { Send, ArrowLeft, Mic, Phone, Briefcase, CheckCircle2, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const messages = [
  { id: 1, from: 'them', text: "Hi, I'm interested in the bathroom plumbing job. I have 8 years experience with similar work.", time: '2:15 PM' },
  { id: 2, from: 'me', text: "Great! Do you have experience with water heater connections?", time: '2:16 PM' },
  { id: 3, from: 'them', text: "Yes, I've done about 50 water heater installs. I can bring my own tools. When do you need this done?", time: '2:17 PM' },
  { id: 4, from: 'me', text: "This week if possible. Can you do Thursday?", time: '2:18 PM' },
  { id: 5, from: 'them', text: "Thursday works. I can be there by 9 AM. Should take about 4-5 hours for the full job.", time: '2:19 PM' },
]

export default function DirectChat() {
  const nav = useNavigate()
  const [input, setInput] = useState('')

  return (
    <div className="flex flex-col bg-[var(--gray-50)]" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-[var(--gray-100)]">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
            <ArrowLeft size={17} strokeWidth={1.8} />
          </button>
          <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face"
            alt="Carlos M." className="w-10 h-10 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="text-[15px] font-bold tracking-tight">Carlos M.</h1>
            <p className="text-[10px] text-green-500 font-medium">Online</p>
          </div>
          <button className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
            <Phone size={16} strokeWidth={1.8} />
          </button>
        </div>

        {/* Job context + actions */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[var(--brand-light)] rounded-lg px-3 py-2">
            <Briefcase size={12} className="text-[var(--brand)]" />
            <span className="text-[11px] font-medium text-[var(--brand)]">Bathroom Plumbing · $800</span>
          </div>
          <button className="bg-[var(--brand)] text-white text-[11px] font-semibold px-3 py-2 rounded-lg press flex items-center gap-1">
            <CheckCircle2 size={12} /> Accept
          </button>
          <button onClick={() => nav('/profile')} className="bg-[var(--gray-50)] text-[11px] font-semibold px-3 py-2 rounded-lg press flex items-center gap-1">
            <User size={12} /> Profile
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-area px-4 py-4 space-y-3">
        <div className="flex justify-center">
          <span className="text-[10px] text-faded bg-white px-3 py-1 rounded-full shadow-sm">Today</span>
        </div>

        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'} anim-up`}
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className={msg.from === 'me' ? 'max-w-[75%]' : 'max-w-[75%] flex gap-2 items-end'}>
              {msg.from === 'them' && (
                <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face"
                  alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              )}
              <div>
                <div className={msg.from === 'me'
                  ? 'bg-[var(--dark)] text-white rounded-2xl rounded-br-md px-3.5 py-2.5'
                  : 'bg-white rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm'
                }>
                  <p className="text-[13px] leading-[1.45]">{msg.text}</p>
                </div>
                <p className={`text-[9px] text-faded mt-0.5 ${msg.from === 'me' ? 'text-right' : ''}`}>{msg.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom,6px)+8px)] bg-white border-t border-[var(--gray-100)]">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[var(--gray-50)] rounded-2xl flex items-center px-4 py-3">
            <input type="text" placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)}
              className="flex-1 bg-transparent text-[14px] outline-none placeholder-[var(--gray-400)] tracking-tight" />
          </div>
          {input ? (
            <button className="w-10 h-10 rounded-full bg-[var(--brand)] flex items-center justify-center press flex-shrink-0">
              <Send size={15} className="text-white ml-0.5" />
            </button>
          ) : (
            <button className="w-10 h-10 rounded-full bg-[var(--dark)] flex items-center justify-center press flex-shrink-0">
              <Mic size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
