import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Loader2, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import JobCardPreview, { type ParsedLead } from '../components/JobCardPreview'
import { useI18n } from '../lib/i18n'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  parsed_data?: ParsedLead
  published?: { lead_id: string; matched_count: number }
}

export default function PublishChat() {
  const { user } = useAuth()
  const { locale } = useI18n()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: locale === 'he'
        ? 'ספר לי על עבודה שאתה רוצה לפרסם. פשוט תתאר אותה בטבעיות — אני אסגנן אותה ואמצא קבלנים מתאימים.\n\nדוגמה: "יש לי לקוחה שצריכה ניקוי ארובה במיאמי, FL 33101"'
        : "Tell me about a job you want to publish. Just describe it naturally — I'll format it professionally and find matching contractors.\n\nExample: \"I have a client who needs chimney cleaning in Miami, FL 33101\"",
    },
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (msg: Omit<Message, 'id'>) => {
    const newMsg = { ...msg, id: crypto.randomUUID() }
    setMessages((prev) => [...prev, newMsg])
    return newMsg.id
  }

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const userText = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userText })
    setIsProcessing(true)

    try {
      const res = await supabase.functions.invoke('ai-publish-lead', {
        body: { text: userText, action: 'parse' },
      })

      if (res.error) throw new Error(res.error.message)

      const parsed = res.data.data as ParsedLead

      if (parsed.confidence < 0.5 || parsed.missing_fields?.length > 0) {
        const missing = parsed.missing_fields?.join(' and ') || 'some details'
        addMessage({
          role: 'assistant',
          content: locale === 'he'
            ? `צריך עוד קצת מידע — מה ה-${missing}?`
            : `I need a bit more info — could you tell me the ${missing}?`,
        })
      } else {
        addMessage({
          role: 'assistant',
          content: locale === 'he'
            ? 'הנה מודעת העבודה שלך — מוכן לפרסם?'
            : "Here's your job posting — ready to publish?",
          parsed_data: parsed,
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      addMessage({
        role: 'assistant',
        content: `Something went wrong: ${message}. Try again?`,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePublish = async (msgId: string, data: ParsedLead) => {
    setIsPublishing(true)
    try {
      const res = await supabase.functions.invoke('ai-publish-lead', {
        body: { action: 'publish', lead_data: data },
      })

      if (res.error) throw new Error(res.error.message)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, published: { lead_id: res.data.lead_id, matched_count: res.data.matched_count } }
            : m,
        ),
      )

      addMessage({
        role: 'assistant',
        content: locale === 'he'
          ? `פורסם! ${res.data.matched_count} קבלנים יראו את זה בפיד שלהם.\n\nרוצה לפרסם עוד עבודה?`
          : `Published! ${res.data.matched_count} contractors will see this in their feed.\n\nWant to publish another job?`,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      addMessage({
        role: 'assistant',
        content: `Failed to publish: ${message}. Try again?`,
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleEdit = (_data: ParsedLead) => {
    setInput(
      locale === 'he'
        ? 'תשנה את... ל...'
        : 'Actually, change the profession to ... and location to ...',
    )
  }

  const startNewSession = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: locale === 'he' ? 'מוכן לעוד אחת! ספר לי על העבודה.' : 'Ready for another one! Tell me about the job.',
      },
    ])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#fe5b25] flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-stone-800">
            {locale === 'he' ? 'פרסם עבודה' : 'Publish a Job'}
          </h1>
        </div>
        <button
          onClick={startNewSession}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-stone-100
                     hover:bg-stone-200 rounded-lg text-stone-500 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          {locale === 'he' ? 'חדש' : 'New'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#fe5b25] text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {msg.parsed_data && !msg.published && (
                <div className="mt-3">
                  <JobCardPreview
                    data={msg.parsed_data}
                    onPublish={() => handlePublish(msg.id, msg.parsed_data!)}
                    onEdit={() => handleEdit(msg.parsed_data!)}
                    isPublishing={isPublishing}
                  />
                </div>
              )}

              {msg.published && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-sm text-emerald-700 font-medium">
                    {locale === 'he'
                      ? `\u2705 פורסם — ${msg.published.matched_count} קבלנים מתאימים`
                      : `\u2705 Published — ${msg.published.matched_count} contractors matched`}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-stone-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={
              locale === 'he'
                ? 'תתאר את העבודה... למשל "אינסטלציה בהיוסטון TX 77001"'
                : 'Describe the job... e.g. "Plumbing leak in Houston TX 77001"'
            }
            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3
                       text-sm text-stone-800 placeholder-stone-400 focus:outline-none
                       focus:border-[#fe5b25]/50 focus:ring-1 focus:ring-[#fe5b25]/20
                       transition-all"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-3 bg-[#fe5b25] hover:bg-[#e04d1c]
                       disabled:bg-stone-100 disabled:text-stone-400
                       rounded-xl transition-all text-white"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
