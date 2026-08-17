import { css } from './styles.generated'

/**
 * Ships the stylesheet with the component so consumers never have to remember
 * an extra import.
 *
 * Rendering a real `<style>` element rather than writing to `document.head` on
 * mount keeps this correct on the server: the rules land in the SSR payload, so
 * there is no flash of unstyled dice before hydration.
 *
 * React 19 uses `href` as a dedupe key and `precedence` as the hoisting signal —
 * many dice on a page still produce one tag in `<head>`. Both attributes need to
 * be present; `precedence` alone does nothing. React 17 and 18 ignore them and
 * render the tag inline, which is harmless because every copy is identical.
 */
export function DiceStyles({ nonce }: { nonce?: string }) {
  return (
    <style href="react-roll-the-dice" precedence="default" nonce={nonce} data-rtd="">
      {css}
    </style>
  )
}
