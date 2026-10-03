// A tiny shared box the renderer writes to every frame and the HTML overlay
// reads from. Deliberately plain mutable state: the health bar must not cause
// a React re-render 60 times a second.
export const hud = {
  x: 0, // screen position of the anchor over his head, in CSS pixels
  y: 0,
  show: false,
  hp: 14,
  max: 14,
}
