import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import ItemIcon from './ItemIcon.jsx'
import { CARRY_LIMIT, ITEMS, splitCoin, totalValue, totalWeight, lb } from '../data/items.js'
import { getHeld, subscribeHeld, toggleHeld } from '../ui/equipment.js'
import '../ui/inventory.css'

/* ------------------------------------------------------------------ *
 * The pack.                                                           *
 *                                                                     *
 * A paper tab in the top right corner; pressing it (or `I`) unfolds   *
 * the sheet his kit is written out on. Each entry is drawn from the   *
 * real voxel model, says what it weighs and what it cost, and         *
 * clicking it puts the thing in his hands — the same state the 1/2/3  *
 * keys drive.                                                         *
 * ------------------------------------------------------------------ */

/* ---------------- coin (10 sp = 1 gp) ---------------- */

function coinText(silver) {
  const { gold, silver: sp } = splitCoin(silver)
  if (gold && sp) return `${gold} gp ${sp} sp`
  if (gold) return `${gold} gp`
  return `${sp} sp`
}

/* ---------------- line art, all one pen weight ---------------- */

const PEN = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
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

const Crest = (props) => (
  <svg viewBox="0 0 32 32" {...PEN} {...props}>
    <path d="M16 4 26 7.3v7.9c0 5.8-3.9 10.3-10 12.4-6.1-2.1-10-6.6-10-12.4V7.3L16 4Z" />
    <path d="M11.4 11.8 20.6 21.2" />
    <path d="M20.6 11.8 11.4 21.2" />
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

/* ---------------- one entry ---------------- */

function ItemRow({ item, equipped, onEquip }) {
  const stackWeight = item.weightLb * item.qty
  const stackCost = item.costSilver * item.qty
  const verb = equipped ? 'Put away the' : 'Take up the'
  return (
    <li>
      <button
        type="button"
        className={`inv-row${equipped ? ' is-equipped' : ''}`}
        onClick={() => onEquip(item)}
        aria-pressed={equipped}
        title={`${verb} ${item.name.toLowerCase()}`}
      >
        <span className="inv-slot">
          <span className="inv-floor" />
          <ItemIcon item={item} size={96} />
          {item.qty > 1 && <span className="inv-qty">×{item.qty}</span>}
        </span>

        <span className="inv-info">
          <span className="inv-name">
            <span className="n">{item.name}</span>
            {equipped && <span className="held">in hand</span>}
            <span className="key">{item.hotkey}</span>
          </span>

          <span className="inv-type">
            {item.type} · {item.damage}
          </span>

          <span className="inv-traits">{item.traits.join(' · ')}</span>

          <span className="inv-blurb">{item.blurb}</span>

          <span className="inv-stats">
            <span className="inv-stat">
              <Anvil />
              {lb(stackWeight)}
              {item.qty > 1 && <span className="ea">{lb(item.weightLb)} each</span>}
            </span>
            <span className="inv-stat">
              <CoinGlyph />
              {coinText(stackCost)}
              {item.qty > 1 && <span className="ea">{coinText(item.costSilver)} each</span>}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}

/* ---------------- the sheet ---------------- */

export default function Inventory() {
  const held = useSyncExternalStore(subscribeHeld, getHeld, getHeld)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const isOpen = useRef(false) // read by the handlers without re-binding them
  const timer = useRef(0)

  // closing plays a short fade, so the sheet outlives `open` briefly
  const close = useCallback(() => {
    if (!isOpen.current) return
    isOpen.current = false
    setOpen(false)
    setClosing(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setClosing(false), 90)
  }, [])

  const show = useCallback(() => {
    if (isOpen.current) return
    isOpen.current = true
    clearTimeout(timer.current)
    setClosing(false)
    setOpen(true)
  }, [])

  const toggle = useCallback(() => {
    if (isOpen.current) close()
    else show()
  }, [close, show])

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

  useEffect(() => () => clearTimeout(timer.current), [])

  const items = ITEMS
  const weight = totalWeight(items)
  const value = totalValue(items)

  return (
    <div className="inv">
      <button
        type="button"
        className={`inv-btn${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Close pack' : 'Open pack'}
        title="Pack (I)"
      >
        <Satchel />
        <em>I</em>
      </button>

      {(open || closing) && (
        <aside
          className={`inv-panel${closing ? ' is-closing' : ''}`}
          role="dialog"
          aria-label="Pack"
        >
          <header className="inv-head">
            <span className="inv-crest">
              <Crest width="30" height="30" />
            </span>
            <div className="inv-title">
              <h2>Pack</h2>
              <p>what he is carrying</p>
            </div>
            <button type="button" className="inv-close" onClick={close} aria-label="Close pack">
              ✕
            </button>
          </header>

          <div className="inv-rule" aria-hidden="true" />

          <ul className="inv-list">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                equipped={held === item.gear}
                onEquip={(it) => toggleHeld(it.gear)}
              />
            ))}
          </ul>

          <footer className="inv-foot">
            <div className="inv-totals">
              <span className="k">Load</span>
              <span>{lb(weight)}</span>
              <span className="dot">·</span>
              <span className="k">Worth</span>
              <span>{coinText(value)}</span>
              <span className="ea">carries {lb(CARRY_LIMIT)} easily</span>
            </div>
            <span className="inv-hint">
              click an entry to take it up · 1–3 equip · 0 stows · I closes
            </span>
          </footer>
        </aside>
      )}
    </div>
  )
}
