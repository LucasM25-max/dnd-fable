import { useEffect, useRef, useSyncExternalStore } from 'react'
import { hud } from '../ui/hud.js'
import { getArmour, subscribeArmour } from '../ui/equipment.js'
import { ITEMS, UNARMOURED_AC } from '../data/items.js'

/* ------------------------------------------------------------------ *
 * The health bar is a flat UI element drawn in HTML on top of the     *
 * canvas — rounded ends, a smooth gradient fill, and his current and  *
 * maximum hit points written across it. At its side hangs his Armour  *
 * Class in a small blue shield, reading the same armour store the     *
 * inventory drives: the mail's 16 while it is on him, his             *
 * shirtsleeves otherwise. The renderer publishes a screen position    *
 * for the pair in `hud` every frame, so they ride over his head at a  *
 * constant on-screen size. If the renderer isn't feeding it (nothing  *
 * drawn yet), the bar parks itself near the top of the screen rather  *
 * than disappearing.                                                 *
 * ------------------------------------------------------------------ */

const BAR_W = 150
const BAR_H = 15 // tall enough to carry the numbers across it
const SHIELD_W = 22
const SHIELD_H = 24
const GAP = 6
const WIDTH = BAR_W + GAP + SHIELD_W // the whole assembly, for centring
const HEIGHT = SHIELD_H
const MARGIN = 8

export default function HealthBar() {
  const wrap = useRef(null)
  const fill = useRef(null)
  const fracText = useRef(null)

  // Armour Class: the worn armour's number while he wears it, 10 + Dex
  // otherwise — the same bit of state the inventory's Equip button flips
  const armour = useSyncExternalStore(subscribeArmour, getArmour)
  const ac = (armour && ITEMS.find((it) => it.worn === armour)?.ac) || UNARMOURED_AC

  useEffect(() => {
    let raf = 0
    let lastFrac = -1
    let lastText = ''
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
      const text = `${Math.round(hud.hp)}/${Math.round(hud.max)}`
      if (text !== lastText) {
        lastText = text
        fracText.current.textContent = text
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrap}
      aria-label={`Health ${hud.hp} of ${hud.max}, Armour Class ${ac}`}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        alignItems: 'center',
        gap: GAP,
        pointerEvents: 'none',
        userSelect: 'none',
        willChange: 'transform',
        zIndex: 2147483000,
      }}
    >
      {/* Armour Class: a blue heater shield with the number in it */}
      <span
        style={{
          position: 'relative',
          flex: 'none',
          width: SHIELD_W,
          height: SHIELD_H,
          display: 'inline-block',
          filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))',
        }}
      >
        <svg width={SHIELD_W} height={SHIELD_H} viewBox="0 0 24 26" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="hp-ac-shield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7cb8ec" />
              <stop offset="0.55" stopColor="#4d86c6" />
              <stop offset="1" stopColor="#33619e" />
            </linearGradient>
          </defs>
          <path
            d="M3 3.2 H21 V12 C21 18 17 21.9 12 24.6 C7 21.9 3 18 3 12 Z"
            fill="url(#hp-ac-shield)"
            stroke="rgba(232, 240, 252, 0.85)"
            strokeWidth="1.3"
          />
          {/* a breath of sheen under the boss */}
          <path
            d="M5.2 5.2 H18.8 V11.4 C18.8 15.6 16.2 18.6 12 21 C7.8 18.6 5.2 15.6 5.2 11.4 Z"
            fill="rgba(255, 255, 255, 0.1)"
          />
        </svg>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            paddingBottom: 1,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            fontSize: '10.5px',
            fontWeight: 700,
            lineHeight: 1,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {ac}
        </span>
      </span>

      {/* the bar itself, with his hit points written across it */}
      <div
        style={{
          position: 'relative',
          flex: 'none',
          width: BAR_W,
          height: BAR_H,
          borderRadius: BAR_H / 2,
          background: 'rgba(28, 25, 22, 0.55)',
          boxShadow:
            '0 1px 5px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.3)',
          padding: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          ref={fill}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: (BAR_H - 4) / 2,
            background:
              'linear-gradient(180deg, hsl(22,82%,64%) 0%, hsl(14,80%,51%) 45%, hsl(12,84%,38%) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.42)',
            transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        />
        <span
          ref={fracText}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.75)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {`${hud.hp}/${hud.max}`}
        </span>
      </div>
    </div>
  )
}
