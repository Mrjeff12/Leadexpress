/**
 * Generate a deterministic SVG data-URI avatar from initials.
 * No external service dependencies.
 */

const COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
  '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#e11d48',
  '#f59e0b', '#84cc16', '#0ea5e9', '#d946ef', '#a855f7',
  '#22c55e', '#f43f5e', '#0891b2', '#7c3aed', '#2563eb',
]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Returns an SVG data-URI for an avatar with the given initials.
 * @param name - Full name (initials extracted automatically)
 * @param id - Optional numeric id for color selection (falls back to name hash)
 */
export function initialsAvatar(name: string, id?: number): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()

  const colorIdx = id !== undefined ? id % COLORS.length : hashCode(name) % COLORS.length
  const bg = COLORS[colorIdx]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="40" fill="${bg}"/>
    <text x="40" y="40" dy=".35em" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="white">
      ${initials}
    </text>
  </svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Photo-realistic stock avatars for marketing pages.
 * Deterministic by id — same id always returns same photo.
 * Uses randomuser.me (free, no attribution required).
 */
const PHOTO_AVATARS: Record<number, string> = {
  11: 'https://randomuser.me/api/portraits/men/32.jpg',
  15: 'https://randomuser.me/api/portraits/men/45.jpg',
  22: 'https://randomuser.me/api/portraits/men/22.jpg',
  33: 'https://randomuser.me/api/portraits/men/75.jpg',
  47: 'https://randomuser.me/api/portraits/men/36.jpg',
  51: 'https://randomuser.me/api/portraits/men/52.jpg',
  60: 'https://randomuser.me/api/portraits/men/67.jpg',
}

/**
 * Returns a photo avatar URL for known IDs, or falls back to SVG silhouette.
 * @param id - Numeric id for deterministic selection
 */
export function genericAvatar(id: number): string {
  if (PHOTO_AVATARS[id]) return PHOTO_AVATARS[id]

  const bg = COLORS[id % COLORS.length]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="40" fill="${bg}"/>
    <circle cx="40" cy="30" r="14" fill="white" opacity="0.85"/>
    <ellipse cx="40" cy="68" rx="22" ry="18" fill="white" opacity="0.85"/>
  </svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
