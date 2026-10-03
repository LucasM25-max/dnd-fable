import { useEffect, useMemo } from 'react'
import { buildHuman } from '../voxel/human.js'
import ItemThumb from './ItemThumb.jsx'
import '../ui/inventory.css'

/* ------------------------------------------------------------------ *
 * The inventory: a satchel button pinned to the top-right corner and  *
 * the parchment panel it folds out. Each entry carries the weapon's   *
 * live voxel model on a slow turntable, its price and its weight;     *
 * clicking an entry takes that weapon in hand (or stows it again) —   *
 * the very same state the 1/2/3/0 hotkeys drive.                      *
 * ------------------------------------------------------------------ */

const SILVER_PER_GOLD = 10

const ITEMS = [
  {
    key: 'greatsword',
    name: 'Greatsword',
    flavor: 'A gold-pommeled two-hander of campaign steel',
    qty: 1,
    costSpEach: 500, // 50 gp
    weightEachLb: 6,
  },
  {
    key: 'flail',
    name: 'Flail',
    flavor: 'A spiked iron ball swinging on a chain',
    qty: 1,
    costSpEach: 100, // 10 gp
    weightEachLb: 2,
  },
  {
    key: 'javelin',
    name: 'Javelins',
    flavor: 'Socketed throwing spears in a leather sheaf',
    qty: 8,
    costSpEach: 5,
    weightEachLb: 2,
  },
]

// silver -> display: whole gold when it divides evenly, silver otherwise
const asCoins = (sp) =>
  sp % SILVER_PER_GOLD === 0
    ? { kind: 'gold', text: `${sp / SILVER_PER_GOLD} gp` }
    : { kind: 'silver', text: `${sp} sp` }

/* ------------------------------ icons ------------------------------ */

function BagIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.2 6.5h7.6c2.9 0 5.2 2.3 5.2 5.2v4.6c0 2.9-2.3 5.2-5.2 5.2H8.2c-2.9 0-5.2-2.3-5.2-5.2v-4.6c0-2.9 2.3-5.2 5.2-5.2z"
        fill="#5a422a"
        stroke="#e9cf92"
        strokeWidth="1.5"
      />
      <path
        d="M9 6.5V5.4a3 3 0 0 1 6 0v1.1"
        fill="none"
        stroke="#e9cf92"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.2 11.4c3.9-1.6 11.7-1.6 15.6 0"
        fill="none"
        stroke="#e9cf92"
        strokeWidth="1.2"
        opacity="0.75"
      />
      <rect
        x="10.4"
        y="12.6"
        width="3.2"
        height="4.4"
        rx="1"
        fill="#f1dfa8"
        stroke="#7a5c22"
        strokeWidth="1.1"
      />
      <path d="M10.4 14.7h3.2" stroke="#7a5c22" strokeWidth="1.1" />
    </svg>
  )
}

function Coin({ kind }) {
  const gold = kind === 'gold'
  return (
    <svg className="inv-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6.9"
        fill={gold ? '#e8c468' : '#ccd2da'}
        stroke={gold ? '#9a7420' : '#79828f'}
        strokeWidth="1.2"
      />
      <circle
        cx="8"
        cy="8"
        r="4.1"
        fill="none"
        stroke={gold ? '#aa8025' : '#8b95a3'}
        strokeWidth="1"
      />
      <path
        d="M4.8 5.9a4.2 4.2 0 0 1 2.6-1.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}

function Scales() {
  return (
    <svg className="inv-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="#8a6a2c" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2.5v9.7" />
        <path d="M5.2 13.2h5.6" />
        <path d="M3.4 3.9h9.2" />
        <path d="M3.4 3.9 1.4 8.5m2-4.6 2 4.6" />
        <path d="M1.1 8.5a2.3 2.3 0 0 0 4.6 0" />
        <path d="M12.6 3.9l2 4.6m-2-4.6-2 4.6" />
        <path d="M10.3 8.5a2.3 2.3 0 0 0 4.6 0" />
      </g>
      <circle cx="8" cy="2.2" r="0.85" fill="#8a6a2c" />
    </svg>
  )
}

function Cross() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="#f0dfae"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --------------------------- the component ------------------------- */

export default function Inventory({ held, setHeld, open, setOpen }) {
  // the same cached voxel data the fighter is drawn from
  const gear = useMemo(() => buildHuman().gear, [])

  // I opens/closes the panel (letting go of the mouse if it is locked);
  // Escape closes it too
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'KeyI') {
        const next = !open
        if (next && document.pointerLockElement) document.exitPointerLock()
        setOpen(next)
      } else if (e.code === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const rows = ITEMS.map((it) => {
    const each = asCoins(it.costSpEach)
    const sheaf = asCoins(it.costSpEach * it.qty)
    return {
      ...it,
      coinKind: each.kind,
      costText:
        it.qty === 1 ? each.text : `${each.text} each · ${sheaf.text} the sheaf`,
      weightText:
        it.qty === 1
          ? `${it.weightEachLb} lb.`
          : `${it.weightEachLb} lb. each · ${it.weightEachLb * it.qty} lb. the sheaf`,
    }
  })

  const totals = rows.reduce(
    (a, r) => ({
      valueSp: a.valueSp + r.costSpEach * r.qty,
      weightLb: a.weightLb + r.weightEachLb * r.qty,
      pieces: a.pieces + r.qty,
    }),
    { valueSp: 0, weightLb: 0, pieces: 0 }
  )
  const value = asCoins(totals.valueSp)

  return (
    <div className="inv-root">
      <button
        type="button"
        className="inv-toggle"
        data-open={open}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="inventory-panel"
        title="Inventory (I)"
      >
        <BagIcon />
        <span>Inventory</span>
        <span className="inv-key" aria-hidden="true">
          I
        </span>
      </button>

      {open && (
        <section className="inv-panel" id="inventory-panel" role="dialog" aria-label="Inventory">
          <header className="inv-header">
            <span className="inv-rule" />
            <span className="inv-gem" aria-hidden="true" />
            <h2 className="inv-title">Inventory</h2>
            <span className="inv-gem" aria-hidden="true" />
            <span className="inv-rule" />
          </header>
          <button
            type="button"
            className="inv-close"
            onClick={() => setOpen(false)}
            aria-label="Close inventory"
          >
            <Cross />
          </button>

          <ul className="inv-list">
            {rows.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  className="inv-item"
                  data-held={held === it.key || undefined}
                  aria-pressed={held === it.key}
                  onClick={() => setHeld((h) => (h === it.key ? null : it.key))}
                >
                  <span className="inv-thumb">
                    <ItemThumb data={gear[it.key]} />
                    {it.qty > 1 && <span className="inv-qty">×{it.qty}</span>}
                  </span>
                  <span className="inv-info">
                    <span className="inv-name-row">
                      <span className="inv-name">{it.name}</span>
                      {held === it.key && <span className="inv-chip">In hand</span>}
                    </span>
                    <span className="inv-flavor">{it.flavor}</span>
                    <span className="inv-stats">
                      <span className="inv-stat">
                        <Coin kind={it.coinKind} />
                        {it.costText}
                      </span>
                      <span className="inv-stat">
                        <Scales />
                        {it.weightText}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <footer className="inv-footer">
            <span className="inv-count">
              {rows.length} items · {totals.pieces} pieces
            </span>
            <span className="inv-totals">
              <span className="inv-stat">
                <Coin kind={value.kind} />
                {value.text} value
              </span>
              <span className="inv-stat">
                <Scales />
                {totals.weightLb} lb. carried
              </span>
            </span>
            <span className="inv-note">10 silver = 1 gold</span>
          </footer>
          <p className="inv-hint">
            Click an item to take it in hand — click it again to stow it.
          </p>
        </section>
      )}
    </div>
  )
}
