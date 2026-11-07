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
 * render a copy inline for each instance. Render DiceStyles once and disable
 * injectStyles on the dice to share one stylesheet across all React versions.
 *
 * Hoisted styles take their nonce from the server renderer, not this prop.
 * A nonce therefore opts into a regular inline style so it survives SSR even
 * when the consumer cannot configure the framework's streaming renderer.
 */
export function DiceStyles({ nonce }: { nonce?: string }) {
  // This is only the build-generated stylesheet, never consumer input. Raw
  // text avoids React 17/18 HTML-escaping quotes inside CSS on the server.
  const content = { __html: css }
  if (nonce !== undefined) {
    return <style nonce={nonce} data-rtd="" dangerouslySetInnerHTML={content} />
  }

  return (
    <style
      href="react-roll-the-dice"
      precedence="default"
      data-rtd=""
      dangerouslySetInnerHTML={content}
    />
  )
}
