import { useEffect, useRef } from 'react'
import { hud } from '../ui/hud.js'

/* ------------------------------------------------------------------ *
 * The health bar is a flat UI element drawn in HTML on top of the     *
 * canvas — rounded ends, a smooth gradient fill, no voxels and no     *
 * geometry. It is positioned each frame from the screen-space anchor  *
 * the renderer publishes in `hud`, so it rides over his head while    *
 * keeping a constant size on screen.                                  *
 * ------------------------------------------------------------------ */

const WIDTH = 140
const HEIGHT = 10

export default function HealthBar() {
  const wrap = useRef(null)
  const fill = useRef(null)

  useEffect(() => {
    let raf = 0
    let lastFrac = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = wrap.current
      if (!el) return
      if (!hud.show) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
        return
      }
      if (el.style.visibility !== 'visible') el.style.visibility = 'visible'
      el.style.transform = `translate3d(${hud.x - WIDTH / 2}px, ${hud.y - HEIGHT}px, 0)`
      const frac = Math.max(0, Math.min(1, hud.hp / hud.max))
      if (frac !== lastFrac) {
        lastFrac = frac
        const hue = 2 + frac * 12
        fill.current.style.width = `${frac * 100}%`
        fill.current.style.background = `linear-gradient(180deg,
          hsl(${hue + 8}, 80%, 64%) 0%,
          hsl(${hue}, 78%, 51%) 45%,
          hsl(${hue - 2}, 82%, 38%) 100%)`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrap}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        background: 'rgba(24, 22, 20, 0.5)',
        boxShadow:
          '0 1px 4px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.28)',
        padding: 1.5,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        visibility: 'hidden',
        willChange: 'transform',
        zIndex: 5,
      }}
    >
      <div
        ref={fill}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: HEIGHT / 2,
          background: 'linear-gradient(180deg, hsl(22,80%,64%) 0%, hsl(14,78%,51%) 45%, hsl(12,82%,38%) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
          transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      />
    </div>
  )
}
