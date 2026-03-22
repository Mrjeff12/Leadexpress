import { useEffect, useState } from 'react'

/**
 * Tall vertical progress bar fixed on the left edge.
 * Shows scroll progress through Path 1 → Path 2 like a thick scrollbar.
 */
export default function StickyProgressBar() {
  const [visible, setVisible] = useState(false)
  const [activePath, setActivePath] = useState<1 | 2>(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const path1 = document.getElementById('path-1')
      const path2 = document.getElementById('path-2')
      if (!path1 || !path2) return

      const path1Top = path1.offsetTop
      const path2Top = path2.offsetTop
      const path2Bottom = path2Top + path2.offsetHeight
      const totalHeight = path2Bottom - path1Top
      const scrollY = window.scrollY + window.innerHeight * 0.4

      const isInPaths = scrollY >= path1Top - 100 && scrollY <= path2Bottom + 200
      setVisible(isInPaths)

      setActivePath(scrollY >= path2Top ? 2 : 1)

      const rawProgress = ((scrollY - path1Top) / totalHeight) * 100
      setProgress(Math.max(0, Math.min(100, rawProgress)))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Where does the midpoint fall on the track (roughly 50%) */
  const midPct = 50

  return (
    <>
      <style>{`
        .sp-bar {
          position: fixed;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .sp-bar.sp-hidden {
          opacity: 0;
          transform: translateY(-50%) translateX(-40px);
          pointer-events: none;
        }
        .sp-bar.sp-visible {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }

        /* ── Track ── */
        .sp-track {
          width: 6px;
          height: 320px;
          background: rgba(0,0,0,0.06);
          border-radius: 3px;
          position: relative;
          overflow: hidden;
        }
        .sp-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          border-radius: 3px;
          transition: height 0.25s ease;
        }
        .sp-fill-green {
          background: #10b981;
        }
        .sp-fill-orange {
          background: #fe5b25;
        }

        /* ── Node labels ── */
        .sp-node {
          position: absolute;
          left: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .sp-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid rgba(0,0,0,0.08);
          background: #faf9f6;
          transition: all 0.4s ease;
          flex-shrink: 0;
        }
        .sp-dot-green {
          border-color: #10b981;
          background: #10b981;
          box-shadow: 0 0 10px rgba(16,185,129,0.35);
        }
        .sp-dot-orange {
          border-color: #fe5b25;
          background: #fe5b25;
          box-shadow: 0 0 10px rgba(254,91,37,0.35);
        }
        .sp-dot-done {
          border-color: #10b981;
          background: #10b981;
        }
        .sp-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.4s ease;
          color: rgba(0,0,0,0.2);
        }
        .sp-label-green { color: #10b981; }
        .sp-label-orange { color: #fe5b25; }

        @media (max-width: 1279px) {
          .sp-bar { display: none !important; }
        }
      `}</style>

      <div className={`sp-bar ${visible ? 'sp-visible' : 'sp-hidden'}`}>
        <div className="sp-track">
          {/* Green fill for Path 1 (top half) */}
          <div
            className="sp-fill sp-fill-green"
            style={{
              height: `${Math.min(progress, midPct)}%`,
            }}
          />
          {/* Orange fill for Path 2 (bottom half) */}
          {progress > midPct && (
            <div
              className="sp-fill sp-fill-orange"
              style={{
                top: `${midPct}%`,
                height: `${progress - midPct}%`,
              }}
            />
          )}

          {/* Node 1: top */}
          <div
            className="sp-node"
            style={{ top: 0, transform: 'translateY(-50%)' }}
            onClick={() => document.getElementById('path-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <div className={`sp-dot ${activePath >= 1 ? (activePath === 2 ? 'sp-dot-done' : 'sp-dot-green') : ''}`} />
            <span className={`sp-label ${activePath >= 1 ? (activePath === 2 ? 'sp-label-green' : 'sp-label-green') : ''}`}>
              {activePath === 2 ? '✓ ' : ''}We find jobs for you
            </span>
          </div>

          {/* Node 2: middle */}
          <div
            className="sp-node"
            style={{ top: `${midPct}%`, transform: 'translateY(-50%)' }}
            onClick={() => document.getElementById('path-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <div className={`sp-dot ${activePath === 2 ? 'sp-dot-orange' : ''}`} />
            <span className={`sp-label ${activePath === 2 ? 'sp-label-orange' : ''}`}>
              You earn more
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
