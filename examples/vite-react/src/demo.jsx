import { StrictMode, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Dice } from 'react-roll-the-dice'
import './demo.css'

// Frame-capture mode. `?film` freezes the roll and exposes window.__scrub(ms),
// so the README GIF is rendered one deterministic instant at a time from a
// single page load rather than re-running the animation for every frame.
const FILM = new URLSearchParams(location.search).has('film')

const PRESS_AT = 120
const ROLL_AT = 220
const DURATION = 1400
const SETTLED_AT = ROLL_AT + DURATION
const SCRIPTED_VALUE = 5

// Feeds Dice's `random` prop: result 5, then turnsX, turnsY, settle yaw.
const SCRIPT = [0.72, 0.5, 0.92, 0.74]
const scriptedRandom = () => {
  let i = 0
  return () => SCRIPT[i++ % SCRIPT.length]
}

function Demo() {
  const dice = useRef(null)
  const [result, setResult] = useState(null)
  const [pressed, setPressed] = useState(false)
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!FILM) return
    dice.current.roll()
    // Hold every animation in the scene at one instant. Applied directly rather
    // than from an effect on `t`: scrubbing to the value React already holds
    // bails out of the re-render, and the animations would run free.
    const hold = (ms) => {
      const at = Math.max(0, ms - ROLL_AT)
      document.querySelectorAll('.rtd-scene *').forEach((el) =>
        el.getAnimations().forEach((a) => {
          a.pause()
          a.currentTime = at
        }),
      )
    }
    window.__scrub = (ms) => {
      flushSync(() => setT(ms))
      hold(ms)
    }
    hold(0)
    window.__filmReady = true
  }, [])

  const showResult = FILM ? t >= SETTLED_AT : result !== null
  const isPressed = FILM ? t >= PRESS_AT && t < ROLL_AT + 130 : pressed
  const value = FILM ? SCRIPTED_VALUE : result

  return (
    <div className="card">
      <div className="stage">
        <Dice
          ref={dice}
          size={128}
          duration={DURATION}
          random={FILM ? scriptedRandom() : undefined}
          onRollEnd={setResult}
        />
      </div>
      <div className="panel">
        <button
          className={isPressed ? 'btn is-pressed' : 'btn'}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          onClick={() => {
            setResult(null)
            dice.current?.roll()
          }}
        >
          Roll
        </button>
        <p className={showResult ? 'out is-on' : 'out'}>
          You rolled <strong>{value ?? '—'}</strong>
        </p>
      </div>
    </div>
  )
}

const tree = <Demo />
createRoot(document.getElementById('root')).render(
  FILM ? tree : <StrictMode>{tree}</StrictMode>,
)
