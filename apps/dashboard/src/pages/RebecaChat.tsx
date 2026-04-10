import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Send,
  ArrowLeft,
  Zap,
  Mic,
  Flame,
  MapPin,
  ChevronRight,
  Plus,
  MessageCircle,
  Search,
} from 'lucide-react'

/* ─── Rebeca Avatar ─── */
function RebecaAvatar({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/rebeca.jpg"
      alt="Rebeca"
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

/* ─── Lead card ─── */
interface Lead {
  id?: string
  type: string
  name: string
  loc: string
  budget: string
  dist: string
  urgent?: boolean
  /** 'scanner' = came from WhatsApp group scan, 'publisher' = published via platform */
  source_type?: 'scanner' | 'publisher'
  /** phone number of the sender (scanner leads) — used to open WhatsApp */
  sender_phone?: string
  /** UUID of publisher profile (publisher leads) — used to open in-app chat */
  publisher_id?: string
}

/**
 * WhatsApp-style lead preview card.
 * Mimics the look of a WhatsApp business message — white bubble, green checkmarks,
 * contact-like header, and "Send via WhatsApp" / "Chat" action buttons that feel
 * native to WhatsApp Business conversations.
 */
function LeadCard({ lead, onNavigate }: { lead: Lead; onNavigate: (path: string) => void }) {
  const initials = lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  function openWhatsApp() {
    if (lead.sender_phone) {
      const phone = lead.sender_phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`, '_blank')
    } else if (lead.id) {
      onNavigate(`/leads/${lead.id}`)
    }
  }

  function openInAppChat() {
    if (lead.source_type === 'publisher' && lead.publisher_id) {
      onNavigate(`/chat/${lead.publisher_id}`)
    } else if (lead.id) {
      onNavigate(`/leads/${lead.id}`)
    }
  }

  return (
    <div className="max-w-[300px] rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(11,20,26,0.13),0_1px_3px_rgba(11,20,26,0.07)]"
      style={{ background: '#ffffff' }}>

      {/* Contact header — WhatsApp vCard style */}
      <div className="px-2.5 pt-2.5 pb-2 flex items-center gap-2.5 border-b border-[#e9edef]">
        {/* Avatar with orange gradient */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-semibold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #fe5b25 0%, #e8408a 100%)' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[14.2px] font-medium text-[#1d1d1f] truncate" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
              {lead.name}
            </p>
            {/* Verified checkmark — orange */}
            <svg width="14" height="14" viewBox="0 0 16 15" fill="none" className="flex-shrink-0">
              <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.487a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.51z" fill="#fe5b25"/>
              <path d="M11.78 3.317l-.478-.373a.365.365 0 0 0-.51.064l-5.398 6.932a.32.32 0 0 1-.484.032L2.81 7.445a.319.319 0 0 0-.484.032l-.378.488a.418.418 0 0 0 .036.54L5.47 11.91c.14.139.359.125.484-.033l5.889-8.05a.366.366 0 0 0-.063-.51z" fill="#fe5b25"/>
            </svg>
          </div>
          <p className="text-[12.5px] text-[#667781] truncate" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            {lead.type} · {lead.loc}
          </p>
        </div>
      </div>

      {/* Message body — looks like a text message inside the card */}
      <div className="px-3 py-2.5">
        {lead.urgent && (
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm mb-1.5"
            style={{ background: '#ffe8e0' }}>
            <Flame size={9} className="text-[#fe5b25]" />
            <span className="text-[9.5px] font-semibold text-[#fe5b25] tracking-wider">URGENT</span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className="text-[14px] font-medium text-[#1d1d1f] leading-tight truncate">{lead.type}</p>
          <span className="text-[13.5px] font-semibold text-[#fe5b25] flex-shrink-0">{lead.budget}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
          <MapPin size={10} strokeWidth={2} />
          <span className="truncate">{lead.loc}</span>
          <span className="text-[#c7c7cc]">·</span>
          <span className="flex-shrink-0">{lead.dist}</span>
        </div>
      </div>

      {/* Action buttons — WhatsApp (green) + Chat (black) */}
      <div className="border-t border-[#e9edef] grid grid-cols-2">
        <button
          onClick={openWhatsApp}
          className="py-2.5 text-[14px] font-medium text-[#25D366] flex items-center justify-center gap-1.5 active:bg-[#f0f2f5] transition-colors border-r border-[#e9edef]"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.117 1.528 5.845L.057 23.493a.75.75 0 00.918.961l5.84-1.528A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5c-1.98 0-3.84-.538-5.437-1.476l-.39-.228-4.043 1.059 1.079-3.935-.252-.403A10.454 10.454 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z"/>
          </svg>
          WhatsApp
        </button>
        <button
          onClick={openInAppChat}
          className="py-2.5 text-[14px] font-medium text-[#1d1d1f] flex items-center justify-center gap-1.5 active:bg-[#f0f2f5] transition-colors"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
        >
          <MessageCircle size={15} strokeWidth={2} />
          Chat
        </button>
      </div>
    </div>
  )
}

/* ─── Channel picker ─── */
function ChannelPicker() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <p className="text-[13px] font-semibold text-[#1d1d1f] mb-0.5">Ready to send to Sarah M.</p>
      <p className="text-[12px] text-[#86868b] mb-3">Choose how to reach out:</p>
      <div className="bg-[#f5f5f7] rounded-xl p-3 mb-3">
        <p className="text-[12px] text-[#636366] italic leading-relaxed">
          "Hi Sarah, this is Mike Johnson, a licensed locksmith. I'm 2 miles away and can be there in ~10 minutes. Want me to head over?"
        </p>
        <button className="text-[11px] text-[#fe5b25] font-semibold mt-1.5">Edit message</button>
      </div>
      <div className="space-y-2">
        {[
          { color: '#25D366', Icon: MessageCircle, label: 'WhatsApp', sub: 'Send via WhatsApp' },
          { color: '#fe5b25', Icon: Zap, label: 'In-App Chat', sub: 'Send via Masterleadflow' },
        ].map(({ color, Icon, label, sub }) => (
          <button key={label} className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-white border border-black/[0.06] active:scale-[0.98] transition-transform">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: color }}>
              <Icon size={15} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">{label}</p>
              <p className="text-[11px] text-[#86868b]">{sub}</p>
            </div>
            <ChevronRight size={14} className="text-[#c7c7cc]" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Messages data ─── */
interface Msg {
  id: number; from: 'bot' | 'user'; time: string; showTime?: boolean
  content: { type: 'text'; text: string } | { type: 'leads'; leads: Lead[] } | { type: 'channels' }
  quickReplies?: string[]
}

const messages: Msg[] = [
  {
    id: 1, from: 'bot', time: '9:15 AM', showTime: true,
    content: { type: 'text', text: "Hey! 👋 I found 5 new leads in your area this morning. Want me to show you the best ones?" },
    quickReplies: ['Show leads', 'Publish a job', 'My schedule'],
  },
  { id: 2, from: 'user', time: '9:16 AM', content: { type: 'text', text: 'Show me the leads' } },
  {
    id: 3, from: 'bot', time: '9:16 AM', showTime: true,
    content: { type: 'text', text: "Here are today's best matches for you:" },
  },
  {
    id: 4, from: 'bot', time: '9:16 AM',
    content: {
      type: 'leads', leads: [
        {
          id: 'demo-1',
          type: 'Lockout Service', name: 'Sarah M.', loc: 'Miami, FL', dist: '2.3 mi', budget: '$80-120', urgent: true,
          source_type: 'scanner', sender_phone: '13055550001',
        },
        {
          id: 'demo-2',
          type: 'Lock Rekey (3)', name: 'James K.', loc: 'Ft. Lauderdale', dist: '8 mi', budget: '$150-200',
          source_type: 'scanner', sender_phone: '13055550002',
        },
        {
          id: 'demo-3',
          type: 'Smart Lock Install', name: 'David R.', loc: 'Boca Raton', dist: '15 mi', budget: '$200-300',
          source_type: 'publisher', publisher_id: 'demo-publisher-uuid',
        },
      ]
    },
  },
  { id: 5, from: 'user', time: '9:17 AM', content: { type: 'text', text: 'Claim the first one' } },
  {
    id: 6, from: 'bot', time: '9:17 AM', showTime: true,
    content: { type: 'text', text: "Done! ✅ Claimed the lockout from Sarah M. — I drafted a message for her. How would you like to reach out?" },
  },
  {
    id: 7, from: 'bot', time: '9:17 AM',
    content: { type: 'channels' },
    quickReplies: ['Next lead', 'My schedule'],
  },
]

export default function RebecaChat() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  return (
    <div className="md:p-6 md:flex md:justify-center md:items-start md:min-h-[calc(100vh-120px)]">
    <div
      className="fixed inset-0 z-40 flex flex-col md:static md:z-auto md:w-full md:max-w-[440px] md:h-[calc(100vh-160px)] md:rounded-[28px] md:overflow-hidden md:shadow-[0_12px_48px_rgba(0,0,0,0.12)] md:border md:border-black/[0.06]"
      style={{ background: '#f5f5f7' }}
    >

        {/* Header — white frosted glass */}
        <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-b border-black/[0.06]"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center active:scale-[0.88] transition-transform flex-shrink-0"
            >
              <ArrowLeft size={16} strokeWidth={2} className="text-[#1d1d1f]" />
            </button>

            <RebecaAvatar size={38} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] font-semibold tracking-tight text-[#1d1d1f]">Rebeca</h1>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                  <span className="text-[11px] text-[#86868b] font-medium">Online</span>
                </div>
              </div>
              <p className="text-[11px] text-[#86868b]">Your AI Lead Assistant</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="mx-4 mt-3 rounded-2xl bg-[#fe5b25]/5 border border-[#fe5b25]/20 p-3 flex items-start gap-2.5">
          <Sparkles size={16} className="text-[#fe5b25] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-[#1d1d1f]">
              Rebeca AI coming soon!
            </p>
            <p className="text-[11px] text-[#86868b] mt-0.5">
              This is a preview. Chat with Rebeca via WhatsApp for now.
            </p>
          </div>
        </div>

        {/* Messages scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-3 space-y-1">

          {messages.map((msg, i) => (
            <div key={msg.id} className="mb-1">
              {/* Timestamp */}
              {msg.showTime && (
                <p className="text-[11px] text-[#aeaeb2] text-center my-3 font-medium">{msg.time}</p>
              )}

              <div className={`flex ${msg.from === 'user' ? 'justify-end' : 'items-end gap-2'}`}
                style={{ animation: 'fadeIn 0.25s ease', animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>

                {/* Bot avatar */}
                {msg.from === 'bot' && (
                  <div className="flex-shrink-0 mb-0.5">
                    <RebecaAvatar size={26} />
                  </div>
                )}

                <div className={`${msg.from === 'user' ? 'max-w-[75%]' : 'flex-1 max-w-[84%]'}`}>

                  {/* Text bubble */}
                  {msg.content.type === 'text' && (
                    <div className={
                      msg.from === 'user'
                        ? 'bg-[#1d1d1f] text-white px-4 py-2.5 rounded-[20px] rounded-br-[6px] shadow-sm'
                        : 'bg-white text-[#1d1d1f] px-4 py-2.5 rounded-[20px] rounded-bl-[6px] shadow-[0_1px_6px_rgba(0,0,0,0.08)] border border-black/[0.04]'
                    }>
                      <p className="text-[14px] leading-[1.45]">{msg.content.text}</p>
                    </div>
                  )}

                  {/* Lead cards */}
                  {msg.content.type === 'leads' && (
                    <div className="space-y-2.5 mt-1">
                      {msg.content.leads.map((lead, j) => (
                        <LeadCard key={j} lead={lead} onNavigate={navigate} />
                      ))}
                    </div>
                  )}

                  {/* Channel picker */}
                  {msg.content.type === 'channels' && (
                    <div className="mt-1">
                      <ChannelPicker />
                    </div>
                  )}

                  {/* Quick reply chips */}
                  {msg.quickReplies && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {msg.quickReplies.map((r, j) => (
                        <button key={j}
                          className="bg-white border border-black/[0.08] px-3.5 py-2 rounded-full text-[12px] font-medium text-[#1d1d1f] active:scale-[0.95] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-1.5 transition-transform">
                          {r === 'Show leads' && <Zap size={11} className="text-[#fe5b25]" />}
                          {r === 'Publish a job' && <Plus size={11} className="text-[#636366]" />}
                          {r === 'Next lead' && <ChevronRight size={11} className="text-[#636366]" />}
                          {r === 'My schedule' && <Search size={11} className="text-[#636366]" />}
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          <div className="flex items-end gap-2 mt-2">
            <RebecaAvatar size={26} />
            <div className="bg-white rounded-[20px] rounded-bl-[6px] px-4 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.08)] border border-black/[0.04] flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#c7c7cc]"
                  style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>

          <div className="h-4" />
        </div>

        {/* Input bar */}
        <div
          className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-black/[0.06] px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex-1 bg-[#f5f5f7] rounded-[22px] flex items-center px-4 py-2.5 min-h-[44px]">
              <input
                type="text"
                placeholder="Message Rebeca..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { setInput('') } }}
                className="flex-1 bg-transparent text-[15px] text-[#1d1d1f] outline-none placeholder-[#aeaeb2] tracking-tight"
              />
            </div>
            {/* Send button — always visible, orange, disabled when empty */}
            <button
              onClick={() => { if (input.trim()) setInput('') }}
              disabled={!input.trim()}
              className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 active:scale-[0.88] transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #fe5b25)',
                boxShadow: input.trim() ? '0 4px 14px rgba(254,91,37,0.40)' : 'none',
              }}
              aria-label="Send"
            >
              <Send size={17} className="text-white ml-0.5" />
            </button>
            {/* Mic button — separate, secondary action */}
            <button
              className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 active:scale-[0.88] transition-all bg-[#f5f5f7]"
              aria-label="Record voice message"
            >
              <Mic size={18} className="text-[#1d1d1f]" />
            </button>
          </div>
        </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
    </div>
  )
}
