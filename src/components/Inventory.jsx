import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import ItemIcon from './ItemIcon.jsx'
import { ITEMS, splitCoin, totalValue, totalWeight, lb } from '../data/items.js'
import { getHeld, subscribeHeld, toggleHeld } from '../ui/equipment.js'
import '../ui/inventory.css'

/* ------------------------------------------------------------------ *
 * The pack.                                                           *
 *                                                                     *
 * A satchel button sits in the top right corner; pressing it (or `I`) *
 * opens a brass-and-leather panel listing what the fighter carries.   *
 * Every row shows the item's real voxel model turning in its slot,    *
 * what it weighs and what it costs, and clicking a row puts it in his *
 * hands — the same state the 1/2/3 keys drive.                        *
 * ------------------------------------------------------------------ */

/* ---------------- coin formatting (10 sp = 1 gp) ---------------- */

function coinText(silver) {
  const { gold, silver: sp } = splitCoin(silver)
  if (gold && sp) return `${gold} gp ${sp} sp`
  if (gold) return `${gold} gp`
  return `${sp} sp`
}

function Coin({ silver }) {
  const { gold } = splitCoin(silver)
  return <span className={`coin ${gold ? 'gold' : 'silver'}`} aria-hidden="true" />
}

/* ---------------- line art ---------------- */

const Satchel = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 9.5h14a1.5 1.5 0 0 1 1.5 1.5v7A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18v-7A1.5 1.5 0 0 1 5 9.5Z" />
    <path d="M8 9.5V7a4 4 0 0 1 8 0v2.5" />
    <path d="M3.7 13.2h16.6" />
    <path d="M12 12.6v3.1" />
    <path d="M9.6 20.4v-4.2M14.4 20.4v-4.2" />
  </svg>
)

const Crest = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 3.2 27 7v8.6c0 6.2-4.3 11-11 13.2C9 26.6 5 21.8 5 15.6V7l11-3.8Z" />
    <path d="M16 7.6v16.2" />
    <path d="M10.4 11.4h11.2" />
    <path d="M11.2 19.8c3-1.2 6.6-1.2 9.6 0" opacity=".75" />
  </svg>
)

const Corner = ({ className }) => (
  <svg className={`inv-corner ${className}`} viewBox="0 0 26 26" fill="none"
    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
    <path d="M1 9V3.4A2.4 2.4 0 0 1 3.4 1H9" />
    <path d="M4.6 12.4V6.2A1.6 1.6 0 0 1 6.2 4.6h6.2" opacity=".6" />
    <path d="M1.4 15.6c3.4-.6 5.8-3.1 6.3-6.4" opacity=".45" />
  </svg>
)

const Anvil = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 8.5h9.5l3.2 3.1H21c0 2.6-2.1 4.4-4.7 4.4H9.4C5.9 16 3 13 3 8.5Z" />
    <path d="M10.5 16v2.2" />
    <path d="M6.6 21h8.2l-1.3-2.8H7.9L6.6 21Z" />
  </svg>
)

/* ---------------- panel ---------------- */

function ItemRow({ item, equipped, onEquip }) {
  const stackWeight = item.weightLb * item.qty
  const stackCost = item.costSilver * item.qty
  return (
    <li>
      <button
        type="button"
        className={`inv-row${equipped ? ' is-equipped' : ''}`}
        onClick={() => onEquip(item)}
        aria-pressed={equipped}
        title={equipped ? `Put the ${item.name.toLowerCase()} away` : `Draw the ${item.name.toLowerCase()}`}
      >
        <span className="inv-slot">
          <ItemIcon item={item} />
          {item.qty > 1 && <span className="inv-qty">×{item.qty}</span>}
        </span>

        <span className="inv-info">
          <span className="inv-name">
            <span className="n">{item.name}</span>
            <span className="inv-kbd">{item.hotkey}</span>
          </span>

          <span className="inv-type">
            {item.type} · {item.damage}
          </span>

          <span className="inv-traits">
            {item.traits.map((t) => (
              <span key={t}>{t}</span>
            ))}
            {equipped && <span className="is-on">In hand</span>}
          </span>

          <span className="inv-blurb">{item.blurb}</span>

          <span className="inv-stats">
            <span className="inv-stat">
              <Anvil />
              <span className="v">{lb(stackWeight)}</span>
              <span className="ea">{item.qty > 1 ? `${lb(item.weightLb)} each` : 'weight'}</span>
            </span>
            <span className="inv-stat">
              <Coin silver={stackCost} />
              <span className="v">{coinText(stackCost)}</span>
              <span className="ea">{item.qty > 1 ? `${coinText(item.costSilver)} each` : 'cost'}</span>
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}

export default function Inventory() {
  const held = useSyncExternalStore(subscribeHeld, getHeld, getHeld)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const isOpen = useRef(false) // read by the handlers without re-binding them
  const timer = useRef(0)

  // closing plays a short animation, so the panel outlives `open` briefly
  const close = useCallback(() => {
    if (!isOpen.current) return
    isOpen.current = false
    setOpen(false)
    setClosing(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setClosing(false), 130)
  }, [])

  const show = useCallback(() => {
    if (isOpen.current) return
    isOpen.current = true
    clearTimeout(timer.current)
    setClosing(false)
    setOpen(true)
    // the game holds the pointer; hand it back so the pack can be clicked
    if (document.pointerLockElement) document.exitPointerLock()
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
    // clicking back into the world to look around puts the pack away
    const onLock = () => {
      if (document.pointerLockElement) close()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLock)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLock)
    }
  }, [toggle, close])

  useEffect(() => () => clearTimeout(timer.current), [])

  const items = ITEMS
  const weight = totalWeight(items)
  const value = totalValue(items)
  const count = items.reduce((n, it) => n + it.qty, 0)

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
        <span className="inv-tally">{count}</span>
        <span className="inv-kbd">I</span>
      </button>

      {(open || closing) && (
        <aside
          className={`inv-panel${closing ? ' is-closing' : ''}`}
          role="dialog"
          aria-label="Pack"
        >
          <Corner className="tl" />
          <Corner className="tr" />
          <Corner className="bl" />
          <Corner className="br" />

          <header className="inv-head">
            <span className="inv-crest">
              <Crest width="30" height="30" />
            </span>
            <div className="inv-title">
              <h2>Pack</h2>
              <p>Carried arms &amp; equipment</p>
            </div>
            <button type="button" className="inv-close" onClick={close} aria-label="Close pack">
              ✕
            </button>
          </header>

          <div className="inv-rule" aria-hidden="true">
            <i />
          </div>

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
            <span className="inv-total">
              <span className="k">Load</span>
              <span className="v">{lb(weight)}</span>
            </span>
            <span className="sep" />
            <span className="inv-total">
              <span className="k">Worth</span>
              <span className="v">
                <Coin silver={value} />
                {coinText(value)}
              </span>
            </span>
            <span className="inv-hint">
              Click an item to draw it
              <br />
              1 – 3 equip · 0 stows · I closes
            </span>
          </footer>
        </aside>
      )}
    </div>
  )
}
