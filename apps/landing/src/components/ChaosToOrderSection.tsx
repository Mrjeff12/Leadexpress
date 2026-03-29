import { useLang } from '../i18n/LanguageContext'

export default function ChaosToOrderSection() {
  const { lang } = useLang()
  const isHe = lang === 'he'

  return (
    <section className="section-padding bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Text side */}
          <div className={`flex-1 ${isHe ? 'text-right' : 'text-left'} text-center md:text-start`}>
            <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-500 rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {isHe ? 'הבעיה' : 'The Problem'}
            </div>
            <h2 className="text-3xl md:text-5xl font-medium mb-4">
              {isHe
                ? 'אתה מפסיד עבודות. ומפסיד כסף על סאבים גרועים.'
                : 'You\'re missing jobs. And losing money on bad subs.'}
            </h2>
            <p className="text-gray-subtle/70 max-w-xl mb-4">
              {isHe
                ? 'עשרות קבלנים, הודעה אחת — מי שמגיב ראשון לוקח. אתה מפסיד אלפי דולרים בחודש כי לא ראית את ההודעה בזמן.'
                : 'Dozens of contractors, one message — first to respond wins. You\'re losing thousands every month because you didn\'t see it in time.'}
            </p>
            <p className="text-gray-subtle/70 max-w-xl">
              {isHe
                ? 'ובזמן שאתה מעביר עבודות דרך ווצאפ — אין אימות, אין ביקורות, אין הגנה. כסף הולך לאיבוד. עבודות לא נעשות.'
                : 'And when you pass jobs through WhatsApp — no verification, no reviews, no protection. Money disappears. Work doesn\'t get done.'}
            </p>
          </div>

          {/* Image side */}
          <div className="flex-1 max-w-md md:max-w-lg">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
              <img
                src="/frustrated-technician.jpg"
                alt={isHe ? 'טכנאי מתוסכל בתוך הוואן שלו מסתכל על הטלפון' : 'Frustrated technician in his van looking at his phone'}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
