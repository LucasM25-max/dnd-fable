import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import ItemIcon from './ItemIcon.jsx'
import { CARRY_LIMIT, ITEMS, splitCoin, totalValue, totalWeight, lb } from '../data/items.js'
import { getHeld, subscribeHeld, toggleHeld } from '../ui/equipment.js'
import '../ui/inventory.css'

/* ------------------------------------------------------------------ *
 * The pack.                                                           *
 *                                                                     *
 * A drawer welded to the right edge of the screen. The handle is part *
 * of the drawer, so pressing it (or `I`) slides the whole assembly     *
 * out from the side. Inside: an inspector across the top, and the kit  *
 * below it as a grid of slots — icons, counts and hotkeys only, the    *
 * way BG3 or WoW lay a bag out. Clicking a slot loads the item into    *
 * the inspector; equipping is an explicit action in there, and drives  *
 * the same state the 1/2/3 keys do.                                    *
 * ------------------------------------------------------------------ */

const GRID_SLOTS = 20 // the bag always looks like a bag, full or not

/* ---------------- coin (10 sp = 1 gp) ---------------- */

function coinText(silver) {
  const { gold, silver: sp } = splitCoin(silver)
  if (gold && sp) return `${gold}g ${sp}s`
  if (gold) return `${gold}g`
  return `${sp}s`
}

/* ---------------- glyphs, one pen weight ---------------- */

const PEN = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Satchel = (props) => (
  <svg viewBox="0 0 24 24" {...PEN} {...props}>
    <path d="M5.2 9.6h13.6c.8 0 1.4.6 1.4 1.4v6.8c0 1.4-1.1 2.5-2.5 2.5H6.3a2.5 2.5 0 0 1-2.5-2.5V11c0-.8.6-1.4 1.4-1.4Z" />
    <path d="M8.2 9.6V7.3a3.8 3.8 0 0 1 7.6 0v2.3" />
    <path d="M4 13.3h16" />
    <path d="M12 12.7v3" />
  </svg>
)

const Anvil = (props) => (
  <svg viewBox="0 0 24 24" {...PEN} {...props}>
    <path d="M3.2 8.6h9.3l3.2 3h5.1c0 2.5-2.1 4.3-4.6 4.3H9.5c-3.4 0-6.3-2.9-6.3-7.3Z" />
    <path d="M10.6 15.9v2.2" />
    <path d="M6.7 21h8.1l-1.3-2.9H8L6.7 21Z" />
  </svg>
)

const CoinGlyph = (props) => (
  <svg viewBox="0 0 24 24" {...PEN} {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.2" />
  </svg>
)

const Chevron = (props) => (
  <svg viewBox="0 0 24 24" {...PEN} {...props}>
    <path d="M14.5 6 8.8 12l5.7 6" />
  </svg>
)

/* ---------------- one slot ---------------- */

function ItemCell({ item, equipped, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`inv-cell r-${item.rarity || 'common'}${equipped ? ' is-equipped' : ''}${
        selected ? ' is-selected' : ''
      }`}
      onClick={() => onSelect(item.id)}
      onDoubleClick={() => toggleHeld(item.gear)}
      aria-pressed={selected}
      aria-label={item.name}
      title={item.name}
    >
      <span className="inv-cell-art">
        <ItemIcon item={item} size={64} spin={false} />
      </span>
      {item.hotkey && <span className="inv-cell-key">{item.hotkey}</span>}
      {item.qty > 1 && <span className="inv-cell-qty">{item.qty}</span>}
    </button>
  )
}

/* ---------------- the inspector ---------------- */

function Detail({ item, equipped }) {
  if (!item) {
    return (
      <section className="inv-detail is-empty" aria-live="polite">
        <span className="inv-detail-empty">Select an item</span>
      </section>
    )
  }

  const stackWeight = item.weightLb * item.qty
  const stackCost = item.costSilver * item.qty

  return (
    <section className={`inv-detail r-${item.rarity || 'common'}`} aria-live="polite">
      <div className={`inv-detail-art r-${item.rarity || 'common'}`}>
        <ItemIcon item={item} size={104} />
      </div>

      <div className="inv-detail-body">
        <h2 className="inv-detail-name">{item.name}</h2>
        <p className="inv-detail-sub">
          {item.type} · {item.damage}
        </p>

        <ul className="inv-detail-traits">
          {item.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <div className="inv-detail-stats">
          <span>
            <Anvil />
            {lb(stackWeight)}
          </span>
          <span>
            <CoinGlyph />
            {coinText(stackCost)}
          </span>
          {item.qty > 1 && <span className="ea">×{item.qty}</span>}
        </div>

        <div className="inv-detail-actions">
          <button
            type="button"
            className={`inv-act is-primary${equipped ? ' is-on' : ''}`}
            onClick={() => toggleHeld(item.gear)}
          >
            {equipped ? 'Unequip' : 'Equip'}
            <em>{item.hotkey}</em>
          </button>
          <button type="button" className="inv-act" disabled>
            Drop
          </button>
        </div>
      </div>
    </section>
  )
}

/* ---------------- the drawer ---------------- */

export default function Inventory() {
  const held = useSyncExternalStore(subscribeHeld, getHeld, getHeld)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(ITEMS[0]?.id ?? null)
  const isOpen = useRef(false) // read by the handlers without re-binding them

  const close = useCallback(() => {
    isOpen.current = false
    setOpen(false)
  }, [])

  const toggle = useCallback(() => {
    isOpen.current = !isOpen.current
    setOpen(isOpen.current)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'KeyI') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, close])

  const items = ITEMS
  const selected = items.find((it) => it.id === selectedId) || null
  const weight = totalWeight(items)
  const value = totalValue(items)
  const load = Math.min(1, weight / CARRY_LIMIT)
  const empties = Math.max(0, GRID_SLOTS - items.length)

  return (
    <div className={`inv${open ? ' is-open' : ''}`}>
      <div className="inv-dock">
        <button
          type="button"
          className="inv-tab"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Close pack' : 'Open pack'}
          title="Pack (I)"
        >
          <span className="inv-tab-face">
            <Satchel />
            <Chevron className="inv-tab-chev" />
          </span>
        </button>

        <aside className="inv-panel" role="dialog" aria-label="Pack" aria-hidden={!open}>
          <Detail item={selected} equipped={selected ? held === selected.gear : false} />

          <div className="inv-grid-wrap">
            <div className="inv-grid">
              {items.map((item) => (
                <ItemCell
                  key={item.id}
                  item={item}
                  equipped={held === item.gear}
                  selected={item.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
              {Array.from({ length: empties }, (_, i) => (
                <span key={`e${i}`} className="inv-cell is-empty" aria-hidden="true" />
              ))}
            </div>
          </div>

          <footer className="inv-foot">
            <div className="inv-load">
              <div className="inv-load-bar">
                <span style={{ transform: `scaleX(${load})` }} />
              </div>
              <span className="inv-load-num">
                {Math.round(weight)}/{CARRY_LIMIT}
              </span>
            </div>
            <span className="inv-coin">
              <CoinGlyph />
              {coinText(value)}
            </span>
          </footer>
        </aside>
      </div>
    </div>
  )
}
