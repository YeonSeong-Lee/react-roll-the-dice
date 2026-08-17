# react-roll-the-dice

A 3D dice roller for React with **no runtime dependencies**. The die is a real CSS
cube — six positioned faces under `transform-style: preserve-3d` — and the throw is
plain CSS motion. No canvas, no WebGL, no physics engine, no animation library.

```bash
npm install react-roll-the-dice
```

```tsx
import { useRef } from 'react'
import { Dice, type DiceHandle } from 'react-roll-the-dice'

function Board() {
  const dice = useRef<DiceHandle>(null)

  return (
    <>
      <Dice ref={dice} size={120} onRollEnd={(value) => console.log(value)} />
      <button onClick={() => dice.current?.roll()}>Roll</button>
    </>
  )
}
```

No stylesheet import required — the component renders its own `<style>` tag.

## Why it has no dependencies

`dependencies` is empty, and `react` is the only peer. Even `react-dom` is absent,
because nothing here reaches for a DOM renderer API. Installing this adds exactly
one package to your tree, and about **6 kB gzipped** to your bundle — component
and stylesheet together.

## API

### `<Dice />`

| Prop | Type | Default | |
|---|---|---|---|
| `size` | `number \| string` | `80` | Edge length. Numbers mean pixels. |
| `defaultValue` | `DiceValue` | `1` | Face shown before the first roll. |
| `duration` | `number` | `1400` | Roll length in ms. |
| `faceColor` | `string` | `#fdfdfb` | Any CSS color. |
| `pipColor` | `string` | `#16181d` | Any CSS color. |
| `rollOnClick` | `boolean` | `false` | Makes the die clickable and keyboard-operable. |
| `injectStyles` | `boolean` | `true` | Set `false` to supply the CSS yourself. |
| `nonce` | `string` | — | Forwarded to the injected `<style>` tag for CSP. |
| `random` | `() => number` | — | Custom RNG in `[0, 1)`, for seeded or reproducible rolls. |
| `onRollStart` | `(value) => void` | — | Fires with the value the roll will land on. |
| `onRollEnd` | `(value) => void` | — | Fires when the die settles. |

Any other `div` prop (`className`, `style`, `id`, `aria-label`, …) is forwarded.

### Ref handle

```ts
interface DiceHandle {
  roll(): DiceValue        // starts a roll, returns the result synchronously
  set(value: DiceValue): void  // jump to a face with no animation
  readonly value: DiceValue
  readonly rolling: boolean
}
```

`roll()` returns the result immediately, so you can update game state without
waiting for the animation. Use `onRollEnd` when you want to reveal it only once
the die has settled.

Rolling again mid-animation is fine — the die re-targets from wherever it is.
`onRollStart` fires once per call, but `onRollEnd` fires once per *landing*, so
a burst of rolls produces a single settle event carrying the final value.

### `rollDiceValue(random?)`

The generator on its own, if you want to roll without rendering. Uses
`crypto.getRandomValues` with rejection sampling — folding the leftover byte
values in with a plain modulo would make 1–4 come up slightly more often than
5–6, which is a loaded die.

## Styling

Every visual is a CSS custom property on the `.rtd-scene` element, so you can
theme it without touching props:

```css
.rtd-scene {
  --rtd-face-color: #1e2130;
  --rtd-pip-color: #ffd9a0;
  --rtd-view-x: -16deg;   /* camera pitch */
  --rtd-view-y: 22deg;    /* camera yaw   */
  --rtd-ease: cubic-bezier(0.18, 0.9, 0.24, 1.04);
}
```

### Content Security Policy

The inline `<style>` needs `style-src`. Either pass a nonce:

```tsx
<Dice nonce={cspNonce} />
```

…or turn injection off and import the stylesheet yourself:

```tsx
import 'react-roll-the-dice/styles.css'

<Dice injectStyles={false} />
```

## Notes

- **Server rendering.** The stylesheet is part of the rendered output, so there
  is no flash of unstyled dice. The component is marked `"use client"` and works
  as a client component in the Next.js App Router.
- **React 19.** The `<style>` tag carries `href` and `precedence`, so React
  hoists and de-duplicates it — many dice on a page produce one tag in `<head>`.
  React 17 and 18 render it inline instead, which is harmless.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the tumble is
  skipped and the result appears immediately. `onRollEnd` still fires.
- **Fair and physical.** Opposite faces sum to 7 and the die is right-handed, the
  Western convention. Each throw picks its own spin counts and landing angle, so
  no two rolls trace the same arc.

## License

MIT
