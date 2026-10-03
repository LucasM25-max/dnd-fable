import { Html } from '@react-three/drei'

/* ------------------------------------------------------------------ *
 * Health bar: a flat, smooth UI element anchored over his head.       *
 * It is a DOM overlay (not voxels, not geometry), so the corners are  *
 * properly round, the fill is a clean gradient, and it keeps the same *
 * size on screen however far away the camera is.                      *
 * ------------------------------------------------------------------ */

const WIDTH = 132
const HEIGHT = 9

export default function HealthBar({ hp = 14, max = 14, show = true }) {
  if (!show) return null
  const frac = Math.max(0, Math.min(1, hp / max))
  const hue = 4 + frac * 10 // slips towards red as it empties

  return (
    <Html
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      transform={false}
    >
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          borderRadius: HEIGHT / 2,
          background: 'rgba(22, 20, 18, 0.55)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
          padding: 1.5,
          boxSizing: 'border-box',
          overflow: 'hidden',
          backdropFilter: 'blur(1px)',
        }}
      >
        <div
          style={{
            width: `${frac * 100}%`,
            height: '100%',
            borderRadius: HEIGHT / 2,
            background: `linear-gradient(180deg,
              hsl(${hue + 6}, 78%, 62%) 0%,
              hsl(${hue}, 76%, 50%) 46%,
              hsl(${hue - 2}, 80%, 38%) 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        />
      </div>
    </Html>
  )
}
