import type { DiceValue } from './types'

export const DICE_VALUES: readonly DiceValue[] = [1, 2, 3, 4, 5, 6]

/**
 * Which value sits on each side of the cube.
 *
 * Opposite faces sum to 7 (1-6, 2-5, 3-4) and the die is right-handed — the
 * Western convention, where 1, 2 and 3 run counter-clockwise around the vertex
 * they share. Equivalently: with the die oriented so 1 faces +x and 2 faces +y,
 * 3 faces +z.
 *
 * The transforms follow the standard CSS cube construction: rotate each face
 * into place, then push it out by half the edge length.
 */
export const FACE_PLACEMENT: Record<DiceValue, string> = {
  1: 'rotateY(0deg) translateZ(var(--rtd-half))', // front
  2: 'rotateX(-90deg) translateZ(var(--rtd-half))', // bottom
  3: 'rotateY(90deg) translateZ(var(--rtd-half))', // right
  4: 'rotateY(-90deg) translateZ(var(--rtd-half))', // left
  5: 'rotateX(90deg) translateZ(var(--rtd-half))', // top
  6: 'rotateY(180deg) translateZ(var(--rtd-half))', // back
}

/**
 * Cube rotation that brings a given value to face the camera — the inverse of
 * that face's placement.
 *
 * This is not the final resting rotation. `.rtd-cube` applies a further fixed
 * `rotateX(90deg)` outside these, which carries the front position round to the
 * top, so the value actually settles face up. Keeping this table as the plain
 * inverse of `FACE_PLACEMENT` is what lets that extra quarter turn stay a
 * single readable step in the stylesheet.
 *
 * The accumulated-turn trick in `Dice.tsx` is safe because `rotateX` and
 * `rotateY` are each individually periodic in 360deg: adding a multiple of a
 * full turn to either argument yields the identical matrix, whatever the other
 * axis happens to be.
 */
export const FACE_ROTATION: Record<DiceValue, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
}

type WorldSide = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

/**
 * How much to darken a face, by where it sits in the world. Lit as if a soft
 * light sat above and slightly to the front-left. A cube whose sides are all
 * the same shade reads as flat no matter how correct the geometry is.
 */
const WORLD_SHADE: Record<WorldSide, number> = {
  top: 0,
  front: 0.04,
  right: 0.1,
  back: 0.11,
  left: 0.14,
  bottom: 0.18,
}

/**
 * Which value ends up on each side of the world once `value` is showing — the
 * layout above, permuted by that value's resting rotation (its `FACE_ROTATION`
 * entry plus the `rotateX(90deg)` that stands the die up).
 *
 * `top` always equals the value, since that is the whole point of the extra
 * quarter turn, and every row still pairs to 7 across each axis — the quickest
 * way to check one by hand.
 */
const ORIENTATION: Record<DiceValue, Record<WorldSide, DiceValue>> = {
  1: { top: 1, bottom: 6, front: 2, back: 5, left: 4, right: 3 },
  2: { top: 2, bottom: 5, front: 6, back: 1, left: 4, right: 3 },
  3: { top: 3, bottom: 4, front: 2, back: 5, left: 1, right: 6 },
  4: { top: 4, bottom: 3, front: 2, back: 5, left: 6, right: 1 },
  5: { top: 5, bottom: 2, front: 1, back: 6, left: 4, right: 3 },
  6: { top: 6, bottom: 1, front: 2, back: 5, left: 3, right: 4 },
}

/**
 * Shade for every face, given the value currently showing.
 *
 * Keying the light to the cube's own sides instead would tie it to the die
 * rather than the scene: land on 2 and the face pointing at you would be lit
 * like the underside of the die, so the whole thing would look like it changed
 * colour. Lighting belongs to the world, so it is resolved per roll.
 */
export function faceShades(value: DiceValue): Record<DiceValue, number> {
  const orientation = ORIENTATION[value]
  const shades = {} as Record<DiceValue, number>
  for (const side of Object.keys(orientation) as WorldSide[]) {
    shades[orientation[side]] = WORLD_SHADE[side]
  }
  return shades
}

/** Pip positions as [row, column] on a 3x3 grid, 1-indexed. */
export const PIP_LAYOUT: Record<DiceValue, readonly (readonly [number, number])[]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
}
