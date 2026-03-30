import { useState } from 'react'
import { Send, Mic, Zap, MapPin, ArrowLeft, Flame, ChevronRight, Plus, MessageCircle, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function RebecaAvatar({ size = 28 }: { size?: number }) {
  return (
    <div className="flex-shrink-0" style={{ width: size, height: size }}>
      <img src="/rebeca.jpg"
        alt="Rebeca" className="rounded-full object-cover" style={{ width: size, height: size }} />
    </div>
  )
}

interface Lead { type: string; name: string; loc: string; budget: string; dist: string; urgent?: boolean }

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm press ${lead.urgent ? 'border border-[var(--brand)]/20' : 'border border-[var(--gray-100)]'}`}>
      {lead.urgent && (
        <div className="flex items-center gap-1.5 mb-2">
          <Flame size={11} className="text-[var(--brand)]" />
          <span className="text-[10px] font-bold text-[var(--brand)] tracking-wide">URGENT</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-[15px] font-bold tracking-tight">{lead.type}</h4>
        <span className="text-[15px] font-bold text-green-600">{lead.budget}</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[12px] text-muted">{lead.name}</span>
        <span className="text-[11px] text-faded flex items-center gap-0.5"><MapPin size={9}/>{lead.loc}</span>
        <span className="text-[11px] text-faded">{lead.dist}</span>
      </div>
      <button className="w-full bg-[var(--dark)] text-white py-3 rounded-xl t-sub flex items-center justify-center gap-2 press">
        <Zap size={14} /> Claim Lead
      </button>
    </div>
  )
}

/* Channel picker after claiming */
function ChannelPicker() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--gray-100)]">
      <p className="t-sub text-[13px] mb-1">Ready to send to Sarah M.</p>
      <p className="text-[12px] text-muted mb-3">Choose how to reach out:</p>

      {/* Preview message */}
      <div className="bg-[var(--gray-50)] rounded-xl p-3 mb-3">
        <p className="text-[12px] text-[var(--gray-500)] italic leading-relaxed">
          "Hi Sarah, this is Mike Johnson, a licensed locksmith. I saw your lockout request and I'm available right now. I'm about 2 miles away and can be there in ~10 minutes. Want me to head over?"
        </p>
        <button className="text-[11px] text-[var(--brand)] font-semibold mt-1.5">Edit message</button>
      </div>

      {/* Channel buttons */}
      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#25D366]/10 press border border-[#25D366]/20">
          <div className="w-9 h-9 rounded-lg bg-[#25D366] flex items-center justify-center">
            <MessageCircle size={16} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold">WhatsApp</p>
            <p className="text-[10px] text-muted">Send via WhatsApp</p>
          </div>
          <ChevronRight size={14} className="text-faded" />
        </button>

        <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0088cc]/10 press border border-[#0088cc]/20">
          <div className="w-9 h-9 rounded-lg bg-[#0088cc] flex items-center justify-center">
            <Send size={14} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold">Telegram</p>
            <p className="text-[10px] text-muted">Send via Telegram</p>
          </div>
          <ChevronRight size={14} className="text-faded" />
        </button>

        <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--brand)]/5 press border border-[var(--brand)]/15">
          <div className="w-9 h-9 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold">In-App Chat</p>
            <p className="text-[10px] text-muted">Send via Masterleadflow</p>
          </div>
          <ChevronRight size={14} className="text-faded" />
        </button>
      </div>
    </div>
  )
}

interface Msg {
  id: number; from: 'bot'|'user'; time: string; showTime?: boolean
  content: { type: 'text'; text: string } | { type: 'leads'; leads: Lead[] } | { type: 'channels' }
  quickReplies?: string[]
}

const messages: Msg[] = [
  {
    id: 1, from: 'bot', time: '9:15 AM', showTime: true,
    content: { type: 'text', text: "Hey Mike! 👋 I found 5 new locksmith leads in your area this morning." },
    quickReplies: ['Show leads', 'Publish a job', 'My schedule'],
  },
  { id: 2, from: 'user', time: '9:16 AM', content: { type: 'text', text: 'Show me the leads' } },
  {
    id: 3, from: 'bot', time: '9:16 AM', showTime: true,
    content: { type: 'text', text: "Here are today's best matches:" },
  },
  {
    id: 4, from: 'bot', time: '9:16 AM',
    content: { type: 'leads', leads: [
      { type: 'Lockout Service', name: 'Sarah M.', loc: 'Miami, FL', dist: '2.3 mi', budget: '$80-120', urgent: true },
      { type: 'Lock Rekey (3)', name: 'James K.', loc: 'Ft. Lauderdale', dist: '8 mi', budget: '$150-200' },
      { type: 'Smart Lock Install', name: 'David R.', loc: 'Boca Raton', dist: '15 mi', budget: '$200-300' },
    ]},
  },
  { id: 5, from: 'user', time: '9:17 AM', content: { type: 'text', text: 'Claim the first one' } },
  {
    id: 6, from: 'bot', time: '9:17 AM', showTime: true,
    content: { type: 'text', text: "Done! ✅ Claimed the lockout from Sarah M. I prepared a message for her. Pick how you want to reach out:" },
  },
  {
    id: 7, from: 'bot', time: '9:17 AM',
    content: { type: 'channels' },
    quickReplies: ['Next lead', 'My schedule'],
  },
]

export default function RebecaChat() {
  const [input, setInput] = useState('')
  const nav = useNavigate()

  return (
    <div className="flex flex-col bg-[var(--gray-50)]" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="bg-[var(--brand)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center press">
            <ArrowLeft size={17} strokeWidth={1.8} className="text-white" />
          </button>
          <RebecaAvatar size={36} />
          <div className="flex-1">
            <h1 className="text-[15px] font-bold tracking-tight text-white">Rebeca</h1>
            <p className="text-[11px] text-white/70 font-medium">Your AI assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-area px-4 py-3 space-y-3">

        {messages.map((msg, i) => (
          <div key={msg.id}>
            {msg.showTime && msg.from === 'bot' && (
              <p className="text-[10px] text-[var(--gray-400)] text-center mb-2 mt-1">{msg.time}</p>
            )}

            <div className={`flex ${msg.from === 'user' ? 'justify-end' : 'items-end gap-2'} anim-up`}
              style={{ animationDelay: `${i * 30}ms` }}>

              {msg.from === 'bot' && <RebecaAvatar size={24} />}

              <div className={msg.from === 'user' ? 'max-w-[72%]' : 'flex-1 max-w-[82%]'}>
                {msg.content.type === 'text' && (
                  <div className={msg.from === 'user'
                    ? 'bg-[var(--dark)] text-white rounded-2xl rounded-br-md px-3.5 py-2.5'
                    : 'bg-white rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm'
                  }>
                    <p className="text-[13px] leading-[1.45] whitespace-pre-line">{msg.content.text}</p>
                  </div>
                )}

                {msg.content.type === 'leads' && (
                  <div className="space-y-2.5">
                    {msg.content.leads.map((lead, j) => (
                      <LeadCard key={j} lead={lead} />
                    ))}
                  </div>
                )}

                {msg.content.type === 'channels' && <ChannelPicker />}

                {msg.quickReplies && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.quickReplies.map((r, j) => (
                      <button key={j} className="bg-white border border-[var(--gray-200)] px-3.5 py-2 rounded-full text-[12px] font-medium press shadow-sm flex items-center gap-1.5">
                        {r === 'Show leads' && <Zap size={11} className="text-[var(--brand)]" />}
                        {r === 'Publish a job' && <Plus size={11} />}
                        {r === 'Next lead' && <ChevronRight size={11} />}
                        {r === 'My schedule' && <Search size={11} />}
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <RebecaAvatar size={20} />
        <div className="flex gap-1 px-3 py-2 bg-white rounded-2xl shadow-sm">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--gray-400)]"
              style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom,6px)+8px)] bg-white border-t border-[var(--gray-100)]">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[var(--gray-50)] rounded-2xl flex items-center px-4 py-3">
            <input type="text" placeholder="Ask Rebeca anything..." value={input} onChange={e => setInput(e.target.value)}
              className="flex-1 bg-transparent text-[14px] outline-none placeholder-[var(--gray-400)] tracking-tight" />
          </div>
          {input ? (
            <button className="w-11 h-11 rounded-full bg-[var(--brand)] flex items-center justify-center press flex-shrink-0">
              <Send size={16} className="text-white ml-0.5" />
            </button>
          ) : (
            <button className="w-11 h-11 rounded-full bg-[var(--dark)] flex items-center justify-center press flex-shrink-0">
              <Mic size={17} className="text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
