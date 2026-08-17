import type { HTMLAttributes } from 'react'

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6

export interface DiceHandle {
  /** Starts a roll and synchronously returns the value it will land on. */
  roll(): DiceValue
  /** Jumps to a face with no animation. Useful for restoring saved state. */
  set(value: DiceValue): void
  /** The face currently showing (updates as soon as a roll starts). */
  readonly value: DiceValue
  /** True while a roll animation is in flight. */
  readonly rolling: boolean
}

export interface DiceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onAnimationEnd' | 'children'> {
  /** Edge length. Numbers are treated as pixels. @default 80 */
  size?: number | string
  /** Face shown before the first roll. @default 1 */
  defaultValue?: DiceValue
  /** Roll animation length in milliseconds. @default 1400 */
  duration?: number
  /** Face background. Any CSS color. @default '#fdfdfb' */
  faceColor?: string
  /** Pip color. Any CSS color. @default '#16181d' */
  pipColor?: string
  /** Make the die itself clickable (and keyboard-operable). @default false */
  rollOnClick?: boolean
  /** Render the built-in stylesheet inline. @default true */
  injectStyles?: boolean
  /** CSP nonce forwarded to the injected `<style>` tag. */
  nonce?: string
  /** Custom RNG returning a float in [0, 1). Injected for tests or seeding. */
  random?: () => number
  /** Fires when a roll begins, with the value it will land on. */
  onRollStart?: (value: DiceValue) => void
  /** Fires when the roll animation settles. */
  onRollEnd?: (value: DiceValue) => void
}
