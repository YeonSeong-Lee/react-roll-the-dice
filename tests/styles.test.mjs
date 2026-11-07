import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import { React, Dice, DiceStyles, requireReact, major } from './react-environment.mjs'

const { renderToString, renderToPipeableStream } = requireReact('react-dom/server')
const h = React.createElement
const countStyles = html => (html.match(/<style\b/g) ?? []).length
const dice = props => Array.from({ length: 100 }, (_, key) => h(Dice, { key, ...props }))

test(`React ${React.version}: default auto-injection preserves version-specific style behavior`, () => {
  assert.equal(countStyles(renderToString(h(React.Fragment, null, ...dice()))), major >= 19 ? 1 : 100)
})

for (const nonce of [undefined, 'request-one', 'request-two']) {
  test(`100 dice share a single stylesheet (nonce=${nonce ?? 'none'})`, () => {
    const html = renderToString(h(React.Fragment, null, h(DiceStyles, { nonce }), ...dice({ injectStyles: false })))
    assert.equal(countStyles(html), 1)
    assert.match(html, /\.rtd-scene/)
    assert.match(html, /content:''/)
    assert.doesNotMatch(html, /&#x27;|&quot;/)
    if (nonce) assert.match(html, new RegExp(`<style nonce="${nonce}"`))
  })
}

test('nonce on the existing Dice API reaches its SSR style element', () => {
  const html = renderToString(h(Dice, { nonce: 'dice-nonce' }))
  assert.match(html, /<style nonce="dice-nonce" data-rtd="">/)
  assert.equal(countStyles(html), 1)
})

test('external CSS mode emits no style element', () => {
  assert.equal(countStyles(renderToString(h(React.Fragment, null, ...dice({ injectStyles: false })))), 0)
})

test('streaming SSR preserves the component nonce without renderer configuration', { skip: major < 18 }, async () => {
  const html = await new Promise((resolve, reject) => {
    let output = ''
    const sink = new Writable({ write(chunk, _encoding, done) { output += chunk; done() } })
    sink.on('finish', () => resolve(output))
    sink.on('error', reject)
    const stream = renderToPipeableStream(h(Dice, { nonce: 'stream-nonce' }), {
      onAllReady() { stream.pipe(sink) }, onError: reject,
    })
  })
  assert.match(html, /<style nonce="stream-nonce" data-rtd="">/)
})
