// apps/landing/src/remotion/explainer/Scene5CTA.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_5_START, TOTAL_FRAMES } from './shared/theme'
import { LogoAd } from './shared/LogoAd'

export function Scene5CTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const sceneIn = interpolate(frame, [SCENE_5_START, SCENE_5_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const logoIn = sp(frame, fps, SCENE_5_START + 20, { damping: 12 })
  const taglineIn = sp(frame, fps, SCENE_5_START + 50, { damping: 10 })
  const ctaIn = sp(frame, fps, SCENE_5_START + 80, { damping: 10 })
  const urlIn = sp(frame, fps, SCENE_5_START + 100, { damping: 12 })

  // CTA pulse
  const pulse = Math.sin(frame * 0.06) * 0.03 + 1

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: sceneIn,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Green glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoIn,
          transform: `scale(${interpolate(logoIn, [0, 1], [0.8, 1.2])})`,
        }}
      >
        <LogoAd scale={1} />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineIn,
          transform: `translateY(${interpolate(taglineIn, [0, 1], [20, 0])}px)`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 56,
            margin: 0,
            color: COLORS.dark,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}
        >
          Get jobs. Send jobs.{' '}
          <span style={{ color: COLORS.success }}>Get paid.</span>
        </h1>
      </div>

      {/* CTA Button */}
      <div
        style={{
          opacity: ctaIn,
          transform: `scale(${interpolate(ctaIn, [0, 1], [0.8, 1]) * pulse})`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: COLORS.whatsapp,
            color: '#fff',
            borderRadius: 50,
            padding: '18px 40px',
            fontSize: 20,
            fontWeight: 700,
            boxShadow: `0 8px 30px rgba(37,211,102,0.3)`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width={22} height={22}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Start Free →
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlIn,
          transform: `translateY(${interpolate(urlIn, [0, 1], [10, 0])}px)`,
        }}
      >
        <span
          style={{
            fontSize: 18,
            color: COLORS.graySubtle,
            opacity: 0.5,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          masterleadflow.com
        </span>
      </div>
    </AbsoluteFill>
  )
}
