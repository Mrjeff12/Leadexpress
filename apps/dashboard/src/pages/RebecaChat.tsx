import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import {
  Sparkles,
  Send,
  ArrowLeft,
  Zap,
  Briefcase,
  CalendarDays,
  HelpCircle,
  Info,
} from 'lucide-react'

interface BotMessage {
  id: number
  from: 'bot' | 'user'
  text: string
  textHe: string
  time: string
}

const placeholderMessages: BotMessage[] = [
  {
    id: 1,
    from: 'bot',
    text: "Hey! I'm Rebeca, your AI assistant. I help you find leads, manage your schedule, and grow your business. What can I do for you today?",
    textHe: 'היי! אני רבקה, העוזרת החכמה שלך. אני עוזרת לך למצוא לידים, לנהל את הלו"ז ולהצמיח את העסק. מה אני יכולה לעשות בשבילך היום?',
    time: '9:15 AM',
  },
  {
    id: 2,
    from: 'user',
    text: 'Show me my leads',
    textHe: 'תראי לי את הלידים',
    time: '9:16 AM',
  },
  {
    id: 3,
    from: 'bot',
    text: "I found 5 new leads in your area this morning! 3 are urgent lockout requests. Want me to show you the details?",
    textHe: 'מצאתי 5 לידים חדשים באזור שלך הבוקר! 3 מהם בקשות דחופות לפריצת מנעול. רוצה שאראה לך את הפרטים?',
    time: '9:16 AM',
  },
  {
    id: 4,
    from: 'user',
    text: 'Yes, show me',
    textHe: 'כן, תראי לי',
    time: '9:17 AM',
  },
  {
    id: 5,
    from: 'bot',
    text: "Here's the top match:\n\nLockout Service - Sarah M.\nMiami, FL (2.3 mi away)\nBudget: $80-120\nUrgent - needs help now!\n\nWant me to claim this lead for you?",
    textHe: 'הנה ההתאמה הטובה ביותר:\n\nשירות פריצה - Sarah M.\nMiami, FL (3.7 ק"מ)\nתקציב: $80-120\nדחוף - צריכה עזרה עכשיו!\n\nרוצה שאתפוס את הליד הזה בשבילך?',
    time: '9:17 AM',
  },
]

const quickActions = [
  { key: 'leads', icon: Zap, label: 'Show my leads', labelHe: 'הראי לידים' },
  { key: 'publish', icon: Briefcase, label: 'Publish a job', labelHe: 'פרסמי עבודה' },
  { key: 'schedule', icon: CalendarDays, label: 'My schedule', labelHe: 'לו"ז שלי' },
  { key: 'help', icon: HelpCircle, label: 'Help', labelHe: 'עזרה' },
]

export default function RebecaChat() {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const { profile } = useAuth()
  const isHe = locale === 'he'
  const [input, setInput] = useState('')

  const userName = profile?.full_name?.split(' ')[0] || (isHe ? 'שלום' : 'there')

  return (
    <div
      className="max-w-3xl mx-auto w-full flex flex-col"
      style={{ minHeight: 'calc(100vh - 120px)' }}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/messages')}
          className="w-9 h-9 rounded-xl bg-white/60 backdrop-blur border border-stone-200/60 flex items-center justify-center hover:bg-white transition-colors md:hidden"
        >
          <ArrowLeft size={16} className="text-stone-600" />
        </button>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center shadow-sm">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold tracking-tight text-stone-900">
            {isHe ? 'רבקה' : 'Rebeca'}
          </h1>
          <p className="text-xs text-stone-400">
            {isHe ? 'העוזרת החכמה שלך' : 'Your AI Assistant'}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {isHe ? 'מקוון' : 'Online'}
        </span>
      </div>

      {/* Coming Soon Banner */}
      <div className="glass-panel p-3 mb-4 flex items-center gap-2.5 border-l-4 border-l-[#fe5b25]">
        <Info size={15} className="text-[#fe5b25] flex-shrink-0" />
        <p className="text-xs text-stone-500">
          {isHe
            ? 'צ\'אט AI בקרוב! זו תצוגה מקדימה של הממשק.'
            : 'AI chat coming soon! This is a preview of the interface.'}
        </p>
      </div>

      {/* Chat Area */}
      <div className="glass-panel flex-1 p-4 md:p-6 space-y-4 overflow-y-auto mb-4" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {/* Welcome */}
        <div className="text-center py-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Sparkles size={22} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-stone-700">
            {isHe ? `היי ${userName}! 👋` : `Hey ${userName}! 👋`}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {isHe ? 'רבקה כאן כדי לעזור לך' : 'Rebeca is here to help you'}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-3 stagger-children">
          {placeholderMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'user' ? (isHe ? 'justify-start' : 'justify-end') : (isHe ? 'justify-end' : 'justify-start')}`}
            >
              <div className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''} max-w-[85%] md:max-w-[70%]`}>
                {msg.from === 'bot' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center flex-shrink-0">
                    <Sparkles size={10} className="text-white" />
                  </div>
                )}
                <div>
                  <div
                    className={
                      msg.from === 'user'
                        ? 'bg-[#1a1a1a] text-white rounded-2xl rounded-br-md px-4 py-3'
                        : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-stone-100'
                    }
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-line">
                      {isHe ? msg.textHe : msg.text}
                    </p>
                  </div>
                  <p className={`text-[10px] text-stone-400 mt-1 ${msg.from === 'user' ? (isHe ? 'text-left' : 'text-right') : ''}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Typing indicator */}
        <div className={`flex items-end gap-2 ${isHe ? 'justify-end' : 'justify-start'}`}>
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center flex-shrink-0">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="flex gap-1 px-4 py-3 bg-white rounded-2xl shadow-sm border border-stone-100">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-stone-400"
                style={{
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickActions.map((action) => (
          <button
            key={action.key}
            className="glass-panel flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-stone-600 hover:text-[#fe5b25] hover:border-[#fe5b25]/20 transition-all active:scale-[0.97]"
          >
            <action.icon size={14} className="text-[#fe5b25]" />
            {isHe ? action.labelHe : action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="glass-panel p-3 flex items-center gap-2.5">
        <div className="flex-1 bg-stone-50 rounded-xl flex items-center px-4 py-3">
          <input
            type="text"
            placeholder={isHe ? 'שאלי את רבקה...' : 'Ask Rebeca anything...'}
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
        {isHe ? 'הצ\'אט עם רבקה יהיה זמין בקרוב' : 'Chat with Rebeca will be available soon'}
      </p>
    </div>
  )
}
