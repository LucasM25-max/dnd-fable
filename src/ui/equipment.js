// What the fighter currently has in his hands, and what he is wearing.
//
// The equip state used to live inside <Player>, but now several very
// different parts of the app need it: the number keys (1-3), the inventory
// panel, and the body model itself (the hauberk is built onto him, so
// taking it off means rebuilding the body without it — src/voxel/human.js).
// Rather than lifting it into App and threading props through the canvas,
// it lives here as a tiny external store that React subscribes to with
// `useSyncExternalStore`. Plain mutable state, one notify on change.
//
// `held` is the weapon in his hands (a gear key, or null).
// `armour` is the armour on his body ('mail' for the hauberk, or null).

let held = null
let armour = 'mail' // the chain mail starts on him
const listeners = new Set()
const armourListeners = new Set()

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

export function getArmour() {
  return armour
}

export function subscribeArmour(fn) {
  armourListeners.add(fn)
  return () => armourListeners.delete(fn)
}

export function setArmour(next) {
  const value = next || null
  if (value === armour) return
  armour = value
  for (const fn of armourListeners) fn()
}

// taking off what he is already wearing puts it in the inventory, and vice versa
export function toggleArmour(next) {
  setArmour(armour === next ? null : next)
}
