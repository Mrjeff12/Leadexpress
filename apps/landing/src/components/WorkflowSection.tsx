import { ArrowRight } from 'lucide-react'
import { Player } from '@remotion/player'
import { useLang } from '../i18n/LanguageContext'
import {
  HowItWorksDemo,
  HOW_IT_WORKS_DURATION,
  HOW_IT_WORKS_FPS,
  HOW_IT_WORKS_WIDTH,
  HOW_IT_WORKS_HEIGHT,
} from '../remotion/HowItWorksDemo'

export default function WorkflowSection() {
  const { lang } = useLang()
  const he = lang === 'he'

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            {he ? 'איך זה עובד' : 'How It Works'}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark tracking-tight mb-3">
            {he ? 'איך זה עובד' : 'How It Works'}
          </h2>
          <p className="text-gray-subtle/60 max-w-lg mx-auto">
            {he ? 'הגדר תוך 2 דקות. התחל לקבל לידים היום.' : 'Set up in 2 minutes. Start getting leads today.'}
          </p>
        </div>

        {/* Two-column: Animation + Steps */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Remotion Animation */}
          <div className="rounded-2xl overflow-hidden shadow-xl border border-stone-100">
            <Player
              component={HowItWorksDemo}
              durationInFrames={HOW_IT_WORKS_DURATION}
              fps={HOW_IT_WORKS_FPS}
              compositionWidth={HOW_IT_WORKS_WIDTH}
              compositionHeight={HOW_IT_WORKS_HEIGHT}
              style={{ width: '100%' }}
              autoPlay
              loop
              controls={false}
            />
          </div>

          {/* Steps text */}
          <div className="space-y-8">
            {[
              {
                num: '1',
                title: he ? 'ספר לנו מה אתה עושה' : 'Tell Us What You Do',
                desc: he
                  ? 'הגדר את המקצוע שלך (אינסטלציה, חשמל, מיזוג...) ואת האזורים שבהם אתה עובד. זה הכל.'
                  : 'Set your trade (HVAC, plumbing, electrical...) and the areas you work in. That\'s it.',
                color: '#fe5b25',
              },
              {
                num: '2',
                title: he ? 'אנחנו מנטרים 24/7' : 'We Monitor 24/7',
                desc: he
                  ? 'ה-AI שלנו קורא כל הודעה בקבוצות WhatsApp — שלך ושלנו — ומחלץ בקשות עבודה אמיתיות.'
                  : 'Our AI reads every message in WhatsApp groups — yours and ours — and extracts real job requests.',
                color: '#3b82f6',
              },
              {
                num: '3',
                title: he ? 'קבל לידים בWhatsApp' : 'Get Leads on WhatsApp',
                desc: he
                  ? 'עבודות תואמות נשלחות ישירות לWhatsApp שלך. מעוניין? אנחנו מחברים אותך למפרסם המקורי.'
                  : 'Matching jobs are sent directly to your WhatsApp. Interested? We connect you to the original poster.',
                color: '#f59e0b',
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                  style={{ background: step.color }}
                >
                  {step.num}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-dark mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-subtle/60 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}

            <a
              href="#pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dark text-white font-bold text-sm hover:bg-dark/90 transition-all mt-2"
            >
              {he ? 'התחל עכשיו' : 'Start Getting Leads'}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
