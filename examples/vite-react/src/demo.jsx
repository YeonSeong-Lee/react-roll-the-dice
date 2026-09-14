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

const INSTALL = 'npm install react-roll-the-dice'

const USAGE = `import { useRef } from 'react'
import { Dice, type DiceHandle } from 'react-roll-the-dice'

function Board() {
  const dice = useRef<DiceHandle>(null)

  return (
    <>
      <Dice ref={dice} size={120} onRollEnd={(value) => console.log(value)} />
      <button onClick={() => dice.current?.roll()}>Roll</button>
    </>
  )
}`

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code">
      <pre>
        <code>{code}</code>
      </pre>
      <button
        className="copy"
        onClick={() =>
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function Demo() {
  const dice = useRef(null)
  const [result, setResult] = useState(null)
  const [rolling, setRolling] = useState(false)
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

  const die = (
    <Dice
      ref={dice}
      size={128}
      duration={DURATION}
      random={FILM ? scriptedRandom() : undefined}
      onRollEnd={(v) => {
        setResult(v)
        setRolling(false)
      }}
    />
  )

  const rollButton = (
    <button
      className={isPressed ? 'btn is-pressed' : 'btn'}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={() => {
        setResult(null)
        setRolling(true)
        dice.current?.roll()
      }}
    >
      Roll
    </button>
  )

  // The film frame keeps the original side-by-side card, so the README GIF
  // stays unchanged.
  if (FILM) {
    return (
      <div className="card">
        <div className="stage">{die}</div>
        <div className="panel">
          {rollButton}
          <p className={showResult ? 'out is-on' : 'out'}>
            You rolled <strong>{value ?? '—'}</strong>
          </p>
        </div>
      </div>
    )
  }

  const readout = rolling ? '…' : (result ?? '—')

  const table = (
    <div className="table">
      <div className="table-stage">{die}</div>
      <div className="table-bar">
        <p className="readout" aria-live="polite">
          <span className="readout-label">Result</span>
          {/* Keyed so each new value replays the fade-in. */}
          <strong
            key={readout}
            className={result === null ? 'readout-value is-empty' : 'readout-value'}
          >
            {readout}
          </strong>
        </p>
        {rollButton}
      </div>
    </div>
  )

  return (
    <main className="page">
      <header className="hero">
        <h1>react-roll-the-dice</h1>
        <p className="tagline">
          A 3D die for React, built from nothing but CSS. No canvas, no WebGL,
          no physics engine, no animation library.
        </p>
        <ul className="facts">
          <li><strong>0</strong> runtime dependencies</li>
          <li><strong>CSS</strong> only</li>
          <li><strong>~6 kB</strong> gzipped</li>
        </ul>
      </header>

      {table}

      <section className="usage">
        <h2>Usage</h2>
        <CodeBlock code={INSTALL} />
        <CodeBlock code={USAGE} />
        <p className="note">
          No stylesheet import needed — the component renders its own{' '}
          <code>&lt;style&gt;</code>. React is the only peer dependency.
        </p>
        <p className="links">
          <a href="https://github.com/YeonSeong-Lee/react-roll-the-dice">GitHub</a>
          <a href="https://www.npmjs.com/package/react-roll-the-dice">npm</a>
        </p>
      </section>
    </main>
  )
}

const tree = <Demo />
createRoot(document.getElementById('root')).render(
  FILM ? tree : <StrictMode>{tree}</StrictMode>,
)
