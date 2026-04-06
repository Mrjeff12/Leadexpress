/* ─── Design System (matches tailwind.config.js + landing page) ─── */
import { spring, interpolate } from 'remotion'

export const COLORS = {
  cream: '#faf9f6',
  creamDark: '#f5f2ed',
  dark: '#0b0707',
  graySubtle: '#3b3b3b',
  primary: '#fe5b25',
  primaryDark: '#e04d1c',
  whatsapp: '#25D366',
  success: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  red: '#FF3B30',
  amber: '#FF9500',
  cardBorder: '#efeff1',
  waDark: '#0b141a',
  waBubble: '#202c33',
  waBubbleGreen: '#DCF8C6',
} as const

export const FONT = {
  family: 'Inter, system-ui, -apple-system, sans-serif',
  heading: { fontWeight: 500, letterSpacing: '-0.04em' } as const,
  bold: { fontWeight: 700 } as const,
  semibold: { fontWeight: 600 } as const,
} as const

export const SHADOW = {
  card: '0 4px 24px rgba(0,0,0,0.06)',
  cardHover: '0 8px 40px rgba(0,0,0,0.1)',
  phone: '0 25px 80px rgba(0,0,0,0.25)',
} as const

/* ─── Timing ─── */
export const FPS = 30
export const SCENE_1_START = 0
export const SCENE_2_START = 90
export const SCENE_3_START = 540
export const SCENE_4_START = 900
export const SCENE_5_START = 1260
export const TOTAL_FRAMES = 1500
export const WIDTH = 1920
export const HEIGHT = 1080

/* ─── Helpers ─── */

export function sp(
  frame: number,
  fps: number,
  delay: number,
  cfg?: { damping?: number; stiffness?: number }
) {
  return spring({
    frame,
    fps,
    delay,
    config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 },
  })
}

export function fadeIn(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

export function fadeOut(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
