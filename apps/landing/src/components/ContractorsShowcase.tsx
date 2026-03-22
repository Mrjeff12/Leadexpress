export default function ContractorsShowcase() {
  return (
    <section className="relative bg-cream-dark overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        {/* Heading */}
        <div className="text-center mb-6 md:mb-8">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-2">
            Built for Contractors
          </p>
          <h2 className="text-2xl md:text-[32px] md:leading-[1.2] font-medium text-dark mb-2">
            Every trade. Every area. One WhatsApp message away.
          </h2>
          <p className="text-dark/40 max-w-md mx-auto text-sm">
            HVAC, plumbing, electrical, roofing — Lead Express watches your groups and sends you only the jobs that fit.
          </p>
        </div>

        {/* Floating glass card */}
        <div className="relative">
          {/* Glow behind the card */}
          <div className="absolute -inset-4 md:-inset-6 bg-gradient-to-br from-[#fe5b25]/20 via-orange-300/10 to-amber-200/15 rounded-3xl blur-2xl" />

          {/* Glass card */}
          <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.12),0_2px_20px_rgba(0,0,0,0.06)] p-2 md:p-3">
            {/* Image */}
            <div className="relative rounded-xl overflow-hidden">
              <picture>
                <img
                  src="/ourteam.jpg"
                  alt="The Lead Express team — helping contractors find jobs across the US"
                className="w-full h-auto block"
                loading="lazy"
                />
              </picture>
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 py-3 md:px-6 md:py-4">
                <p className="text-white/90 text-xs md:text-sm font-medium tracking-wide">
                  HVAC · Plumbing · Electrical · Roofing · Moving & more
                </p>
              </div>
            </div>

            {/* Stats inside the glass card */}
            <div className="mt-2 md:mt-3 grid grid-cols-4 gap-1.5 md:gap-2">
              {[
                { num: '15+', label: 'Trades' },
                { num: '24/7', label: 'Scanning' },
                { num: '<30s', label: 'Delivery' },
                { num: '2 min', label: 'Setup' },
              ].map(s => (
                <div key={s.label} className="bg-white/70 backdrop-blur-sm rounded-lg border border-white/50 py-2.5 px-2 text-center">
                  <p className="text-base md:text-lg font-bold text-dark">{s.num}</p>
                  <p className="text-[10px] text-dark/30">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
