import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  onChange?: (n: number) => void
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  count?: number
}

const SIZE_PX = { sm: 16, md: 20, lg: 28 } as const
const FILLED = '#ff6b35'
const EMPTY = '#2c2c2e'

export default function StarRating({
  rating,
  onChange,
  size = 'md',
  showValue,
  count,
}: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const interactive = !!onChange
  const px = SIZE_PX[size]
  const display = interactive && hover > 0 ? hover : rating

  return (
    <span
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => interactive && setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = display >= star ? 1 : display >= star - 0.5 ? 0.5 : 0

        return (
          <span
            key={star}
            className={interactive ? 'cursor-pointer' : ''}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => interactive && setHover(star)}
            style={{ position: 'relative', width: px, height: px }}
          >
            {/* Empty background star */}
            <Star
              size={px}
              fill={EMPTY}
              color={EMPTY}
              strokeWidth={0}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
            {/* Filled overlay — full or half via clipPath */}
            {fill > 0 && (
              <Star
                size={px}
                fill={FILLED}
                color={FILLED}
                strokeWidth={0}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  clipPath:
                    fill === 0.5
                      ? 'inset(0 50% 0 0)'
                      : undefined,
                }}
              />
            )}
          </span>
        )
      })}

      {showValue && (
        <span className="ml-1 font-semibold text-[#a1a1a6]" style={{ fontSize: px * 0.7 }}>
          {rating.toFixed(1)}
        </span>
      )}
      {typeof count === 'number' && (
        <span className="ml-0.5 text-[#636366]" style={{ fontSize: px * 0.6 }}>
          ({count})
        </span>
      )}
    </span>
  )
}
