import { Star } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/* Profile photos — one per testimonial slot */
const avatars = [
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/52.jpg',
  'https://randomuser.me/api/portraits/men/75.jpg',
  'https://randomuser.me/api/portraits/women/65.jpg',
  'https://randomuser.me/api/portraits/men/22.jpg',
]

function TestimonialCard({ item, avatarUrl }: { item: { text: string; name: string; role: string }; avatarUrl: string }) {
  return (
    <div className="flex-shrink-0 w-[320px] md:w-[360px] bg-white/70 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm p-5 mx-2">
      {/* Stars */}
      <div className="flex items-center gap-0.5 mb-3">
        {[1, 2, 3, 4, 5].map(s => (
          <Star key={s} size={12} fill="#f59e0b" className="text-amber-400" />
        ))}
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">
        "{item.text}"
      </p>

      <div className="flex items-center gap-3">
        <img
          src={avatarUrl}
          alt={item.name}
          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
          <p className="text-xs text-gray-400">{item.role}</p>
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsSection() {
  const { t } = useLang()
  const items = t.testimonials.items

  /* Split into two rows */
  const row1 = items.slice(0, 3)
  const row2 = items.slice(3, 6)
  const avatars1 = avatars.slice(0, 3)
  const avatars2 = avatars.slice(3, 6)

  return (
    <>
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-track-left {
          animation: marquee-left 35s linear infinite;
        }
        .marquee-track-right {
          animation: marquee-right 35s linear infinite;
        }
        .marquee-track-left:hover,
        .marquee-track-right:hover {
          animation-play-state: paused;
        }
      `}</style>

      <section className="py-16 md:py-20 overflow-hidden">
        {/* Subtle header */}
        <div className="text-center mb-8 px-6">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-2">
            {t.testimonials.subtitle}
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-gray-900">
            {t.testimonials.title}
          </h2>
        </div>

        {/* Row 1 — scrolls left */}
        <div className="mb-3">
          <div className="flex marquee-track-left" style={{ width: 'max-content' }}>
            {[...row1, ...row1, ...row1, ...row1].map((item, i) => (
              <TestimonialCard key={`r1-${i}`} item={item} avatarUrl={avatars1[i % 3]} />
            ))}
          </div>
        </div>

        {/* Row 2 — scrolls right */}
        <div>
          <div className="flex marquee-track-right" style={{ width: 'max-content' }}>
            {[...row2, ...row2, ...row2, ...row2].map((item, i) => (
              <TestimonialCard key={`r2-${i}`} item={item} avatarUrl={avatars2[i % 3]} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
