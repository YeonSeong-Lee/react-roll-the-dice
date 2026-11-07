import type { DiceValue } from './value'

export type { DiceValue } from './value'

/** 252 is the largest multiple of 6 below 256. */
const UNBIASED_LIMIT = 252
const MAX_RESAMPLES = 8

function secureDiceValue(): DiceValue | null {
  const webcrypto = globalThis.crypto
  if (typeof webcrypto?.getRandomValues !== 'function') return null

  const buffer = new Uint8Array(1)
  // Rejection sampling. Folding 252..255 back in with a plain modulo would make
  // 1..4 come up marginally more often than 5..6 — a loaded die, which is a
  // real bug in a dice library even though the skew is tiny.
  for (let attempt = 0; attempt < MAX_RESAMPLES; attempt++) {
    webcrypto.getRandomValues(buffer)
    const byte = buffer[0] as number
    if (byte < UNBIASED_LIMIT) return ((byte % 6) + 1) as DiceValue
  }
  return null
}

/**
 * Rolls a fair six-sided die.
 *
 * Uses `crypto.getRandomValues` when available. Pass `random` to supply your own
 * generator — a seeded PRNG for reproducible tests, for example.
 */
export function rollDiceValue(random?: () => number): DiceValue {
  if (!random) {
    const secure = secureDiceValue()
    if (secure !== null) return secure
  }

  const source = random ?? Math.random
  const index = Math.floor(source() * 6)
  // Guard against generators that return exactly 1, or drift out of range.
  return (Math.min(Math.max(index, 0), 5) + 1) as DiceValue
}
