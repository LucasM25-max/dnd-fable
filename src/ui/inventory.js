// Whether the inventory drawer is open.
//
// Two parts of the app need this bit of state: the drawer owns it, and the
// world canvas reads it — while the inventory is up the camera holds still
// (the cursor is on its way to the handle and the slots, and the world
// turning underneath it would fight the click), and a click on the world
// puts the inventory away. The cursor itself is never captured or locked:
// it stays visible and free the whole time. Same pattern as
// src/ui/equipment.js, which holds what is in his hands and what he wears.
//
// Plain mutable state, one notify on change — same pattern, same reasons.

let open = false
const listeners = new Set()

export const isInventoryOpen = () => open

export const subscribeInventory = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setInventoryOpen(next) {
  const value = !!next
  if (value === open) return
  open = value
  for (const fn of listeners) fn()
}

export const toggleInventory = () => setInventoryOpen(!open)
