import { useEffect, useRef } from 'react'
import { hud } from '../ui/hud.js'

/* ------------------------------------------------------------------ *
 * The health bar is a flat UI element drawn in HTML on top of the     *
 * canvas — rounded ends, a smooth gradient fill, no voxels and no     *
 * geometry. The renderer publishes a screen position for it in `hud`  *
 * every frame, so it rides over his head at a constant on-screen      *
 * size. If the renderer isn't feeding it (nothing drawn yet), the bar *
 * parks itself near the top of the screen rather than disappearing.   *
 * ------------------------------------------------------------------ */

const WIDTH = 150
const HEIGHT = 11
const MARGIN = 8

export default function HealthBar() {
  const wrap = useRef(null)
  const fill = useRef(null)

  useEffect(() => {
    let raf = 0
    let lastFrac = -1
    let lastVis = ''

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = wrap.current
      if (!el) return

      const vw = window.innerWidth
      const vh = window.innerHeight
      // has the renderer written a position recently?
      const live = performance.now() - hud.t < 500

      let show = true
      let x = vw / 2
      let y = Math.max(MARGIN + HEIGHT, vh * 0.12)
      if (live) {
        show = hud.show
        x = hud.x
        y = hud.y - HEIGHT
      }

      const vis = show ? 'visible' : 'hidden'
      if (vis !== lastVis) {
        lastVis = vis
        el.style.visibility = vis
      }
      if (show) {
        // keep it on screen even when he walks towards the edge of the frame
        x = Math.min(Math.max(x, WIDTH / 2 + MARGIN), vw - WIDTH / 2 - MARGIN)
        y = Math.min(Math.max(y, MARGIN), vh - HEIGHT - MARGIN)
        el.style.transform = `translate3d(${Math.round(x - WIDTH / 2)}px, ${Math.round(y)}px, 0)`
      }

      const frac = Math.max(0, Math.min(1, hud.hp / hud.max))
      if (frac !== lastFrac) {
        lastFrac = frac
        const hue = 2 + frac * 12
        fill.current.style.width = `${frac * 100}%`
        fill.current.style.background = `linear-gradient(180deg,
          hsl(${hue + 8}, 82%, 64%) 0%,
          hsl(${hue}, 80%, 51%) 45%,
          hsl(${hue - 2}, 84%, 38%) 100%)`
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrap}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        background: 'rgba(28, 25, 22, 0.55)',
        boxShadow:
          '0 1px 5px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.3)',
        padding: 2,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        willChange: 'transform',
        zIndex: 2147483000,
      }}
    >
      <div
        ref={fill}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: HEIGHT / 2,
          background:
            'linear-gradient(180deg, hsl(22,82%,64%) 0%, hsl(14,80%,51%) 45%, hsl(12,84%,38%) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.42)',
          transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      />
    </div>
  )
}
