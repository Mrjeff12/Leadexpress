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
    <div
      className="max-w-3xl mx-auto w-full flex flex-col"
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
  )
}
