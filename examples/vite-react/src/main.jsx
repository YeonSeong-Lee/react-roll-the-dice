import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Dice, rollDiceValue } from 'react-roll-the-dice'
// Exercises the CSS subpath export. Only <ManualStyles /> below relies on it —
// every other die on this page injects its own styles.
import 'react-roll-the-dice/styles.css'

function App() {
  const diceRef = useRef(null)
  const [log, setLog] = useState([])
  const [distribution, setDistribution] = useState(null)

  const push = (line) => setLog((prev) => [line, ...prev].slice(0, 8))

  const checkDistribution = () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    for (let i = 0; i < 60000; i++) counts[rollDiceValue()]++
    setDistribution(counts)
  }

  return (
    <main
      style={{
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        padding: '2.5rem',
        maxWidth: 760,
        margin: '0 auto',
        color: '#1c1d22',
      }}
    >
      <h1 style={{ fontSize: '1.4rem' }}>react-roll-the-dice</h1>
      <p style={{ color: '#5d616e' }}>
        No stylesheet import in this file — the component ships its own CSS.
      </p>

      <section style={{ display: 'flex', alignItems: 'center', gap: '3rem', margin: '3rem 0' }}>
        <Dice
          ref={diceRef}
          size={120}
          onRollStart={(v) => push(`start -> ${v}`)}
          onRollEnd={(v) => push(`end   -> ${v}`)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <button onClick={() => diceRef.current?.roll()}>Roll</button>
          <button onClick={() => push(`rolling = ${diceRef.current?.rolling}`)}>
            Read handle
          </button>
          <button onClick={checkDistribution}>Check fairness (60k)</button>
        </div>
        <pre style={{ fontSize: 12, color: '#5d616e', margin: 0 }}>{log.join('\n')}</pre>
      </section>

      {distribution && (
        <pre style={{ fontSize: 12, background: '#f4f4f6', padding: '1rem', borderRadius: 8 }}>
          {Object.entries(distribution)
            .map(([face, n]) => `${face}: ${n}  (${((n / 60000) * 100).toFixed(2)}%)`)
            .join('\n')}
        </pre>
      )}

      <h2 style={{ fontSize: '1rem' }}>Every face, via handle.set()</h2>
      <p style={{ color: '#5d616e', fontSize: 14 }}>
        The top face must match the label underneath. Opposite faces sum to 7.
      </p>
      <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <FixedFace key={face} face={face} />
        ))}
      </div>

      <h2 style={{ fontSize: '1rem', marginTop: '3rem' }}>Click to roll · custom colors</h2>
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        <Dice rollOnClick size={72} />
        <Dice rollOnClick size={72} faceColor="#1e2130" pipColor="#ffd9a0" />
        <Dice rollOnClick size={72} faceColor="#c8102e" pipColor="#fff" duration={800} />
      </div>

      <h2 style={{ fontSize: '1rem', marginTop: '3rem' }}>Edge cases</h2>
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        <ZeroDuration />
        <Interruptible />
        <ManualStyles />
      </div>
    </main>
  )
}

/**
 * duration={0} takes the same path as prefers-reduced-motion: the transition is
 * zero-length, so `transitionend` never fires and only the fallback timer can
 * deliver onRollEnd.
 */
function ZeroDuration() {
  const ref = useRef(null)
  const [ends, setEnds] = useState(0)
  return (
    <div id="zero-duration" data-ends={ends}>
      <Dice ref={ref} size={72} duration={0} onRollEnd={() => setEnds((n) => n + 1)} />
      <button onClick={() => ref.current?.roll()}>roll instantly</button>
      <div style={{ fontSize: 12, color: '#5d616e' }}>onRollEnd fired: {ends}</div>
    </div>
  )
}

/** Re-rolling mid-flight must not strand `rolling` or double-fire onRollEnd. */
function Interruptible() {
  const ref = useRef(null)
  const [ends, setEnds] = useState(0)
  return (
    <div id="interruptible" data-ends={ends}>
      <Dice ref={ref} size={72} onRollEnd={() => setEnds((n) => n + 1)} />
      <button onClick={() => ref.current?.roll()}>roll</button>
      <div style={{ fontSize: 12, color: '#5d616e' }}>onRollEnd fired: {ends}</div>
    </div>
  )
}

/**
 * The strict-CSP path: no inline <style> from the component, styling comes from
 * the `react-roll-the-dice/styles.css` import at the top of this file.
 */
function ManualStyles() {
  const ref = useRef(null)
  return (
    <div id="manual-styles">
      <Dice ref={ref} size={72} injectStyles={false} defaultValue={4} />
      <button onClick={() => ref.current?.roll()}>roll (no injection)</button>
      <div style={{ fontSize: 12, color: '#5d616e' }}>injectStyles=false</div>
    </div>
  )
}

function FixedFace({ face }) {
  const ref = useRef(null)
  return (
    <div style={{ textAlign: 'center' }}>
      <Dice
        ref={(node) => {
          ref.current = node
          node?.set(face)
        }}
        size={64}
      />
      <div style={{ fontSize: 12, color: '#5d616e', marginTop: '.75rem' }}>{face}</div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
