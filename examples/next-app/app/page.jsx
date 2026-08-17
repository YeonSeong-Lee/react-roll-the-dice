// No "use client" here on purpose. This file is a server component, and it
// imports <Dice /> directly — which only works if the published bundle carries
// its own "use client" directive on line 1.
import { Dice } from 'react-roll-the-dice'

export default function Page() {
  return (
    <main>
      <h1 style={{ fontSize: '1.3rem' }}>Server component importing &lt;Dice /&gt;</h1>
      <p style={{ color: '#5d616e' }}>
        Rendered from a server component with no client boundary of its own, and
        with no stylesheet import anywhere in this app.
      </p>
      <div style={{ display: 'flex', gap: '2.5rem', marginTop: '2.5rem' }}>
        <Dice rollOnClick size={110} />
        <Dice rollOnClick size={110} defaultValue={6} faceColor="#1e2130" pipColor="#ffd9a0" />
      </div>
    </main>
  )
}
