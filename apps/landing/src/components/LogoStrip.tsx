export default function LogoStrip() {
  const logos = ['innovio', 'ZenZap', 'sparkle', 'LumLabs', 'Pulse', 'Craftgram']

  return (
    <section className="py-12 border-y border-dark/5 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...logos, ...logos].map((name, i) => (
          <div key={i} className="mx-12 flex items-center gap-2 text-dark/30">
            <div className="w-5 h-5 rounded bg-dark/10" />
            <span className="text-lg font-bold tracking-wide">{name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
