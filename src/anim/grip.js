/* Two-handed carry for the greatsword.
 *
 * A greatsword is not swung about one-handed, so when it is drawn both arms
 * are driven to a fixed stance and the sword hangs off the torso rather than
 * off a fist. That way the grip runs exactly through both hands and they can
 * never drift apart — the whole upper body moves as one piece, which is how
 * you actually carry five feet of steel.
 *
 * Angles and transform come from tools/solveGrip.mjs: give it a target point
 * for each fist and it solves the arm chain and derives the sword's frame.
 */
export const TWO_HAND = {
  armR: { shoulder: [-0.4129, 0.6001, 0.2312], elbow: [-1.2436, 0.4077] },
  armL: { shoulder: [-0.417, -0.6022, -0.2631], elbow: [-0.6374, -0.6004] },
  sword: {
    p: [-0.0321, 0.26, 0.3001],
    r: [0.1755, 0.0712, 0.3816],
    grip: -8.8606,
  },
}
