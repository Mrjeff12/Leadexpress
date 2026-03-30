import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { MessageCircle, Sparkles, Search, Info } from 'lucide-react'

const chats = [
  {
    id: 'rebeca',
    name: 'Rebeca',
    nameHe: 'רבקה',
    subtitle: 'Your AI Assistant',
    subtitleHe: 'העוזרת החכמה שלך',
    last: 'I found 5 new leads for you!',
    lastHe: 'מצאתי 5 לידים חדשים בשבילך!',
    time: '9:17 AM',
    unread: 3,
    isBot: true,
    pinned: true,
  },
  {
    id: 'c1',
    name: 'Carlos M.',
    nameHe: 'Carlos M.',
    last: 'Thursday works. I can be there by 9 AM.',
    lastHe: 'יום חמישי מתאים. אני יכול להגיע ב-9 בבוקר.',
    time: '2:19 PM',
    unread: 1,
    job: 'Bathroom Plumbing',
    jobHe: 'אינסטלציה לחדר אמבט',
    initials: 'CM',
  },
  {
    id: 'c2',
    name: 'Tom B.',
    nameHe: 'Tom B.',
    last: 'Great job on the rekey!',
    lastHe: 'עבודה מצוינת על ההחלפה!',
    time: 'Yesterday',
    unread: 0,
    job: 'Lock Rekey',
    jobHe: 'החלפת מנעול',
    initials: 'TB',
  },
  {
    id: 'c3',
    name: 'Alex R.',
    nameHe: 'Alex R.',
    last: 'Is the plumbing job still available?',
    lastHe: 'עבודת האינסטלציה עדיין פנויה?',
    time: 'Yesterday',
    unread: 0,
    job: 'Bathroom Plumbing',
    jobHe: 'אינסטלציה לחדר אמבט',
    initials: 'AR',
  },
]

export default function MessagesInbox() {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const { profile } = useAuth()
  const isHe = locale === 'he'

  return (
    <div className="space-y-5" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {isHe ? 'הודעות' : 'Messages'}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {isHe ? 'כל השיחות שלך במקום אחד' : 'All your conversations in one place'}
          </p>
        </div>
        <button className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur border border-stone-200/60 flex items-center justify-center hover:bg-white transition-colors">
          <Search size={16} className="text-stone-500" />
        </button>
      </div>

      {/* Coming Soon Banner */}
      <div className="glass-panel p-4 flex items-start gap-3 border-l-4 border-l-[#fe5b25]">
        <Info size={18} className="text-[#fe5b25] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-stone-800">
            {isHe ? 'צ\'אט בזמן אמת בקרוב!' : 'Real-time chat coming soon!'}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {isHe
              ? 'אנחנו בונים מערכת הודעות מלאה. בינתיים, דברו עם רבקה ה-AI.'
              : 'We\'re building a full messaging system. Meanwhile, chat with Rebeca AI.'}
          </p>
        </div>
      </div>

      {/* Conversations List */}
      <div className="max-w-3xl mx-auto w-full">
        <div className="stagger-children space-y-2">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                navigate(c.isBot ? '/chat/rebeca' : `/chat/${c.id}`)
              }
              className={`glass-panel w-full flex items-center gap-3.5 p-4 text-left transition-all hover:shadow-md active:scale-[0.99] ${
                c.unread > 0 ? 'ring-1 ring-[#fe5b25]/10' : ''
              }`}
              dir={isHe ? 'rtl' : 'ltr'}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {c.isBot ? (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center shadow-sm">
                    <Sparkles size={18} className="text-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm">
                    {c.initials}
                  </div>
                )}
                {c.unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#fe5b25] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-sm">
                    {c.unread}
                  </span>
                )}
                {c.pinned && (
                  <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-[8px]">*</span>
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p
                      className={`text-sm truncate ${
                        c.unread > 0 ? 'font-bold text-stone-900' : 'font-medium text-stone-700'
                      }`}
                    >
                      {isHe ? c.nameHe : c.name}
                    </p>
                    {c.isBot && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#fe5b25]/10 text-[#fe5b25] flex-shrink-0">
                        AI
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] flex-shrink-0 ${
                      c.unread > 0 ? 'text-[#fe5b25] font-semibold' : 'text-stone-400'
                    }`}
                  >
                    {c.time}
                  </span>
                </div>
                {'job' in c && c.job && (
                  <p className="text-[11px] text-[#fe5b25] font-medium mt-0.5">
                    {isHe ? c.jobHe : c.job}
                  </p>
                )}
                <p
                  className={`text-xs truncate mt-0.5 ${
                    c.unread > 0 ? 'text-stone-700' : 'text-stone-400'
                  }`}
                >
                  {isHe ? c.lastHe : c.last}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Empty state (hidden when chats exist, shown as reference) */}
      {chats.length === 0 && (
        <div className="glass-panel p-12 text-center max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={28} className="text-stone-300" />
          </div>
          <h3 className="text-lg font-semibold text-stone-700">
            {isHe ? 'אין הודעות עדיין' : 'No messages yet'}
          </h3>
          <p className="text-sm text-stone-400 mt-1">
            {isHe ? 'ההודעות שלך יופיעו כאן' : 'Your conversations will appear here'}
          </p>
        </div>
      )}
    </div>
  )
}
