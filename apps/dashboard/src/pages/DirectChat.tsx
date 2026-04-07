import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import {
  ArrowLeft,
  Send,
  Phone,
  Briefcase,
  Info,
  CheckCircle2,
  User,
} from 'lucide-react'

interface ChatMessage {
  id: number
  from: 'me' | 'them'
  text: string
  textHe: string
  time: string
}

const placeholderMessages: ChatMessage[] = [
  {
    id: 1,
    from: 'them',
    text: "Hi, I'm interested in the bathroom plumbing job. I have 8 years experience with similar work.",
    textHe: 'היי, אני מעוניין בעבודת האינסטלציה לחדר אמבט. יש לי 8 שנות ניסיון בעבודות דומות.',
    time: '2:15 PM',
  },
  {
    id: 2,
    from: 'me',
    text: 'Great! Do you have experience with water heater connections?',
    textHe: 'מעולה! יש לך ניסיון עם חיבורי דוד שמש?',
    time: '2:16 PM',
  },
  {
    id: 3,
    from: 'them',
    text: "Yes, I've done about 50 water heater installs. I can bring my own tools. When do you need this done?",
    textHe: 'כן, עשיתי בערך 50 התקנות דודי שמש. אני יכול להביא כלים משלי. מתי צריך את זה?',
    time: '2:17 PM',
  },
  {
    id: 4,
    from: 'me',
    text: 'This week if possible. Can you do Thursday?',
    textHe: 'השבוע אם אפשר. תוכל ביום חמישי?',
    time: '2:18 PM',
  },
  {
    id: 5,
    from: 'them',
    text: 'Thursday works. I can be there by 9 AM. Should take about 4-5 hours for the full job.',
    textHe: 'יום חמישי מתאים. אני יכול להגיע ב-9 בבוקר. אמור לקחת בערך 4-5 שעות לעבודה המלאה.',
    time: '2:19 PM',
  },
]

const contractor = {
  name: 'Carlos M.',
  initials: 'CM',
  job: 'Bathroom Plumbing',
  jobHe: 'אינסטלציה לחדר אמבט',
  budget: '$800',
  online: true,
}

export default function DirectChat() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { locale } = useI18n()
  const { profile } = useAuth()
  const isHe = locale === 'he'
  const [input, setInput] = useState('')

  return (
    <>
      {/* ── Mobile full-screen view ── */}
      <div
        className="md:hidden fixed inset-0 z-40 flex flex-col bg-[#f5f5f7]"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {/* Mobile Header */}
        <div className="bg-white/90 backdrop-blur-xl border-b border-black/[0.06] px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/messages')}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05] transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-[#1d1d1f]" />
          </button>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] font-bold text-sm flex-shrink-0 border border-black/[0.06]">
            {contractor.initials}
          </div>

          {/* Name + online */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#1d1d1f] leading-tight truncate">
              {contractor.name}
            </p>
            <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {isHe ? 'מחובר' : 'Online'}
            </span>
          </div>

          {/* Actions */}
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05] transition-colors flex-shrink-0">
            <Phone size={18} className="text-[#1d1d1f]" />
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05] transition-colors flex-shrink-0"
          >
            <Info size={18} className="text-[#1d1d1f]" />
          </button>
        </div>

        {/* Job context badge */}
        <div className="px-4 pt-3">
          <div className="bg-white rounded-[18px] border border-black/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.06)] p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#fe5b25]/10 flex items-center justify-center flex-shrink-0">
                <Briefcase size={14} className="text-[#fe5b25]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">
                  {isHe ? contractor.jobHe : contractor.job}
                </p>
                <p className="text-[11px] text-[#737373]">
                  {isHe ? 'תקציב' : 'Budget'}: {contractor.budget}
                </p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 bg-[#fe5b25] text-white text-xs font-semibold px-3 py-2 rounded-[10px] active:scale-[0.97] transition-transform">
              <CheckCircle2 size={13} />
              {isHe ? 'אשר' : 'Accept'}
            </button>
          </div>
        </div>

        {/* Coming Soon Banner — Mobile */}
        <div className="mx-4 mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
          <Info size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">
              {isHe ? 'הודעות בזמן אמת בקרוב!' : 'Real-time messaging coming soon!'}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {isHe ? 'זו תצוגה מקדימה. בינתיים, פנה לקבלנים דרך WhatsApp.' : 'This is a preview. For now, contact contractors via WhatsApp.'}
            </p>
          </div>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Date separator */}
          <div className="flex justify-center">
            <span className="text-[10px] text-[#737373] bg-black/[0.04] px-3 py-1 rounded-full">
              {isHe ? 'היום' : 'Today'}
            </span>
          </div>

          {placeholderMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'me' ? (isHe ? 'justify-start' : 'justify-end') : (isHe ? 'justify-end' : 'justify-start')}`}
            >
              <div className={`flex items-end gap-2 ${msg.from === 'me' ? 'flex-row-reverse' : ''} max-w-[80%]`}>
                {msg.from === 'them' && (
                  <div className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-black/[0.06] flex items-center justify-center text-[#1d1d1f] text-[9px] font-bold flex-shrink-0">
                    {contractor.initials}
                  </div>
                )}
                <div>
                  <div
                    className={
                      msg.from === 'me'
                        ? 'bg-[#1d1d1f] text-white rounded-[20px] rounded-br-[6px] px-4 py-3'
                        : 'bg-white rounded-[20px] rounded-bl-[6px] shadow-[0_1px_6px_rgba(0,0,0,0.08)] px-4 py-3'
                    }
                  >
                    <p className="text-[13px] leading-relaxed">
                      {isHe ? msg.textHe : msg.text}
                    </p>
                  </div>
                  <p
                    className={`text-[10px] text-[#a3a3a3] mt-1 ${
                      msg.from === 'me' ? (isHe ? 'text-left' : 'text-right') : ''
                    }`}
                  >
                    {msg.time}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="bg-white/90 backdrop-blur-xl border-t border-black/[0.06] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2.5">
          <div className="flex-1 bg-[#f5f5f7] rounded-[22px] flex items-center px-4 py-2.5">
            <input
              type="text"
              placeholder={isHe ? 'כתוב הודעה...' : 'Type a message...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent text-[14px] text-[#1d1d1f] outline-none placeholder-[#a3a3a3] tracking-tight"
            />
          </div>
          <button
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-[0.95] ${
              input.trim()
                ? 'shadow-md'
                : 'bg-[#1d1d1f]'
            }`}
            style={
              input.trim()
                ? { background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }
                : undefined
            }
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Desktop view ── */}
      <div
        className="hidden md:flex max-w-3xl mx-auto w-full flex-col"
        style={{ minHeight: 'calc(100vh - 120px)' }}
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/messages')}
            className="w-9 h-9 rounded-xl bg-white/60 backdrop-blur border border-stone-200/60 flex items-center justify-center hover:bg-white transition-colors"
          >
            <ArrowLeft size={16} className="text-stone-600" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm">
            {contractor.initials}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight text-stone-900">
              {contractor.name}
            </h1>
            <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {isHe ? 'מחובר' : 'Online'}
            </span>
          </div>
          <button className="w-9 h-9 rounded-xl bg-white/60 backdrop-blur border border-stone-200/60 flex items-center justify-center hover:bg-white transition-colors">
            <Phone size={15} className="text-stone-500" />
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-xl bg-white/60 backdrop-blur border border-stone-200/60 flex items-center justify-center hover:bg-white transition-colors"
          >
            <User size={15} className="text-stone-500" />
          </button>
        </div>

        {/* Job Context Badge */}
        <div className="glass-panel p-3 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
              <Briefcase size={14} className="text-[#fe5b25]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">
                {isHe ? contractor.jobHe : contractor.job}
              </p>
              <p className="text-xs text-stone-400">
                {isHe ? 'תקציב' : 'Budget'}: {contractor.budget}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 bg-[#fe5b25] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#e54f1f] transition-colors active:scale-[0.97]">
              <CheckCircle2 size={13} />
              {isHe ? 'אשר' : 'Accept'}
            </button>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="glass-panel p-4 mb-3 flex items-start gap-3 border-l-4 border-l-[#fe5b25]">
          <Info size={18} className="text-[#fe5b25] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-stone-800">
              {isHe ? 'הודעות בזמן אמת בקרוב!' : 'Real-time messaging coming soon!'}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              {isHe
                ? 'זו תצוגה מקדימה בלבד. ההודעות כאן אינן אמיתיות.'
                : 'This is a preview only. The messages shown here are not real.'}
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="glass-panel flex-1 p-4 md:p-6 space-y-3 overflow-y-auto mb-4" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          {/* Date separator */}
          <div className="flex justify-center">
            <span className="text-[10px] text-stone-400 bg-stone-50 px-3 py-1 rounded-full border border-stone-100">
              {isHe ? 'היום' : 'Today'}
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-3 stagger-children">
            {placeholderMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.from === 'me' ? (isHe ? 'justify-start' : 'justify-end') : (isHe ? 'justify-end' : 'justify-start')}`}
              >
                <div
                  className={`flex items-end gap-2 ${msg.from === 'me' ? 'flex-row-reverse' : ''} max-w-[80%] md:max-w-[65%]`}
                >
                  {msg.from === 'them' && (
                    <div className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 text-[9px] font-bold flex-shrink-0">
                      {contractor.initials}
                    </div>
                  )}
                  <div>
                    <div
                      className={
                        msg.from === 'me'
                          ? 'bg-[#1a1a1a] text-white rounded-2xl rounded-br-md px-4 py-3'
                          : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-stone-100'
                      }
                    >
                      <p className="text-[13px] leading-relaxed">
                        {isHe ? msg.textHe : msg.text}
                      </p>
                    </div>
                    <p
                      className={`text-[10px] text-stone-400 mt-1 ${
                        msg.from === 'me' ? (isHe ? 'text-left' : 'text-right') : ''
                      }`}
                    >
                      {msg.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="glass-panel p-3 flex items-center gap-2.5">
          <div className="flex-1 bg-stone-50 rounded-xl flex items-center px-4 py-3">
            <input
              type="text"
              placeholder={isHe ? 'כתוב הודעה...' : 'Type a message...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled
              className="flex-1 bg-transparent text-sm outline-none placeholder-stone-400 tracking-tight disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            disabled
            title={isHe ? 'בקרוב' : 'Coming soon'}
            className="w-11 h-11 rounded-xl bg-stone-200 flex items-center justify-center flex-shrink-0 cursor-not-allowed opacity-50"
          >
            <Send size={16} className="text-stone-400" />
          </button>
        </div>
        <p className="text-center text-[10px] text-stone-400 mt-1.5">
          {isHe ? 'הודעות ישירות יהיו זמינות בקרוב' : 'Direct messages will be available soon'}
        </p>
      </div>
    </>
  )
}
