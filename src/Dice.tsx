import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { DiceStyles } from './DiceStyles'
import { DICE_VALUES, FACE_PLACEMENT, FACE_ROTATION, PIP_LAYOUT, faceShades } from './faces'
import { rollDiceValue } from './random'
import type { DiceHandle, DiceProps, DiceValue } from './types'

/** Extra whole turns added per roll, so no two throws trace the same arc. */
const MIN_TURNS = 2
const TURN_SPREAD = 3
/** Degrees the die can settle away from square, either way, about the vertical. */
const MAX_YAW = 10
/** Slack after the transition should have ended, for the fallback timer. */
const SETTLE_GRACE_MS = 80

interface DiceState {
  value: DiceValue
  rx: number
  ry: number
  yaw: number
  rollId: number
  instant: boolean
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }
    // Safari below 14 only exposes the deprecated API.
    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  return reduced
}

export const Dice = forwardRef<DiceHandle, DiceProps>(function Dice(
  {
    size = 80,
    defaultValue = 1,
    duration = 1400,
    faceColor,
    pipColor,
    rollOnClick = false,
    injectStyles = true,
    nonce,
    random,
    onRollStart,
    onRollEnd,
    className,
    style,
    onClick,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [state, setState] = useState<DiceState>(() => ({
    value: defaultValue,
    rx: FACE_ROTATION[defaultValue].x,
    ry: FACE_ROTATION[defaultValue].y,
    yaw: 0,
    rollId: 0,
    instant: false,
  }))
  const [rolling, setRolling] = useState(false)

  const cubeRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<DiceValue>(defaultValue)
  const rollingRef = useRef(false)
  // Turns only ever accumulate, so every roll rotates forward. Rewinding to a
  // smaller angle would read as the die un-rolling itself.
  const turnsX = useRef(0)
  const turnsY = useRef(0)

  // Latest-callback refs keep the settle effect keyed on the roll alone; it must
  // not tear down and re-arm because the consumer passed a new inline handler.
  const randomRef = useRef(random)
  const onRollStartRef = useRef(onRollStart)
  const onRollEndRef = useRef(onRollEnd)
  randomRef.current = random
  onRollStartRef.current = onRollStart
  onRollEndRef.current = onRollEnd

  const prefersReducedMotion = usePrefersReducedMotion()
  const effectiveDuration = prefersReducedMotion ? 0 : Math.max(0, duration)

  const markRolling = useCallback((next: boolean) => {
    rollingRef.current = next
    setRolling(next)
  }, [])

  const roll = useCallback((): DiceValue => {
    const pick = randomRef.current ?? Math.random
    const next = rollDiceValue(randomRef.current)

    turnsX.current += MIN_TURNS + Math.floor(pick() * TURN_SPREAD)
    turnsY.current += MIN_TURNS + Math.floor(pick() * TURN_SPREAD)
    const rx = FACE_ROTATION[next].x + 360 * turnsX.current
    const ry = FACE_ROTATION[next].y + 360 * turnsY.current
    const yaw = Math.round((pick() * 2 - 1) * MAX_YAW * 10) / 10

    valueRef.current = next
    markRolling(true)
    setState((prev) => ({
      value: next,
      rx,
      ry,
      yaw,
      rollId: prev.rollId + 1,
      instant: false,
    }))
    onRollStartRef.current?.(next)
    return next
  }, [markRolling])

  const set = useCallback(
    (next: DiceValue) => {
      // Keep the accumulated turns so a later roll still moves forward.
      const rx = FACE_ROTATION[next].x + 360 * turnsX.current
      const ry = FACE_ROTATION[next].y + 360 * turnsY.current

      valueRef.current = next
      markRolling(false)
      setState((prev) => ({ ...prev, value: next, rx, ry, instant: true }))
    },
    [markRolling],
  )

  useImperativeHandle(
    ref,
    () => ({
      roll,
      set,
      get value() {
        return valueRef.current
      },
      get rolling() {
        return rollingRef.current
      },
    }),
    [roll, set],
  )

  // Drop the transition suppression once the browser has painted the jump.
  useEffect(() => {
    if (!state.instant) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setState((prev) => (prev.instant ? { ...prev, instant: false } : prev))
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [state.instant])

  // Settle detection. `transitionend` is the accurate signal, but it never
  // arrives when the transition is zero-length (reduced motion) and can be
  // skipped in a backgrounded tab — hence the timer, whichever lands first wins.
  useEffect(() => {
    if (state.rollId === 0) return

    const cube = cubeRef.current
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      markRolling(false)
      onRollEndRef.current?.(valueRef.current)
    }

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === cube && event.propertyName === 'transform') finish()
    }

    cube?.addEventListener('transitionend', handleTransitionEnd)
    const timer = setTimeout(finish, effectiveDuration + SETTLE_GRACE_MS)

    return () => {
      cube?.removeEventListener('transitionend', handleTransitionEnd)
      clearTimeout(timer)
    }
  }, [state.rollId, effectiveDuration, markRolling])

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event)
    if (rollOnClick && !event.defaultPrevented) roll()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (!rollOnClick || event.defaultPrevented) return
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      roll()
    }
  }

  const cssVariables: Record<string, string> = {
    '--rtd-size': typeof size === 'number' ? `${size}px` : size,
    '--rtd-duration': `${effectiveDuration}ms`,
    '--rtd-rx': `${state.rx}deg`,
    '--rtd-ry': `${state.ry}deg`,
    '--rtd-yaw': `${state.yaw}deg`,
  }
  if (faceColor) cssVariables['--rtd-face-color'] = faceColor
  if (pipColor) cssVariables['--rtd-pip-color'] = pipColor

  const phaseClass =
    state.rollId === 0 ? '' : state.rollId % 2 === 1 ? ' rtd-scene--a' : ' rtd-scene--b'

  // Resolved from the value rather than the cube side, so the lighting stays
  // put in the scene while the die turns. It changes as the roll starts, where
  // the tumble hides the switch.
  const shades = faceShades(state.value)

  return (
    <>
      {injectStyles ? <DiceStyles nonce={nonce} /> : null}
      <div
        role={rollOnClick ? 'button' : 'img'}
        aria-label={`Dice showing ${state.value}`}
        aria-live="polite"
        tabIndex={rollOnClick ? 0 : undefined}
        {...rest}
        className={
          `rtd-scene${phaseClass}${rollOnClick ? ' rtd-scene--clickable' : ''}` +
          (className ? ` ${className}` : '')
        }
        style={{ ...(cssVariables as CSSProperties), ...style }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-rolling={rolling ? '' : undefined}
        data-value={state.value}
      >
        <div className="rtd-thrower">
          <div className="rtd-view">
            <div
              ref={cubeRef}
              className={`rtd-cube${state.instant ? ' rtd-cube--instant' : ''}`}
            >
              {DICE_VALUES.map((face) => (
                <div
                  key={face}
                  className="rtd-face"
                  style={
                    {
                      transform: FACE_PLACEMENT[face],
                      '--rtd-shade': String(shades[face]),
                    } as CSSProperties
                  }
                >
                  {PIP_LAYOUT[face].map(([row, column], index) => (
                    <span
                      key={index}
                      className="rtd-pip"
                      style={{ gridArea: `${row} / ${column}` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rtd-shadow" />
      </div>
    </>
  )
})
