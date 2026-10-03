// What the fighter currently has in his hands.
//
// The equip state used to live inside <Player>, but now two very different
// parts of the app need it: the number keys (1-3) and the inventory panel.
// Rather than lifting it into App and threading props through the canvas,
// it lives here as a tiny external store that React subscribes to with
// `useSyncExternalStore`. Plain mutable state, one notify on change.

let held = null
const listeners = new Set()

export function getHeld() {
  return held
}

export function subscribeHeld(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setHeld(next) {
  const value = next || null
  if (value === held) return
  held = value
  for (const fn of listeners) fn()
}

// equipping what is already in hand puts it away again
export function toggleHeld(next) {
  setHeld(held === next ? null : next)
}
