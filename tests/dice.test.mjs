import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { MessageChannel } from 'node:worker_threads'
import { JSDOM } from 'jsdom'
import FakeTimers from '@sinonjs/fake-timers'
import { React, Dice, DiceStyles, requireReact, major } from './react-environment.mjs'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Track React 17's scheduler ports so they can be closed with the test DOM.
const channels = []
globalThis.MessageChannel = class extends MessageChannel {
  constructor() { super(); channels.push(this) }
}
const ReactDOM = requireReact(major >= 18 ? 'react-dom/client' : 'react-dom')
const act = React.act ?? requireReact('react-dom/test-utils').act
const { renderToString } = requireReact('react-dom/server')
const h = React.createElement
let clock, reduced, listeners, roots

beforeEach(() => {
  clock = FakeTimers.withGlobal(globalThis).install({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
  reduced = false
  listeners = new Set()
  roots = new Set()
  window.matchMedia = () => ({
    get matches() { return reduced },
    addEventListener: (_type, callback) => listeners.add(callback),
    removeEventListener: (_type, callback) => listeners.delete(callback),
  })
})

afterEach(async () => {
  try {
    await act(async () => { for (const root of roots) root.unmount() })
    assert.equal(listeners.size, 0, 'media listeners must be removed on unmount')
    assert.equal(clock.countTimers(), 0, 'roll timers and animation frames must be cancelled')
  } finally {
    clock.uninstall()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  }
})
after(() => {
  dom.window.close()
  for (const channel of channels) { channel.port1.close(); channel.port2.close() }
})

function rootFor(container) {
  const root = major >= 18 ? ReactDOM.createRoot(container) : {
    render: element => ReactDOM.render(element, container),
    unmount: () => ReactDOM.unmountComponentAtNode(container),
  }
  roots.add(root)
  return root
}

async function mount(extra = {}, strict = false) {
  const ref = React.createRef(), starts = [], ends = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = rootFor(container)
  const props = { ref, duration: 100, injectStyles: false, random: () => 0,
    onRollStart: value => starts.push(value), onRollEnd: value => ends.push(value), ...extra }
  const render = () => root.render(strict ? h(React.StrictMode, null, h(Dice, props)) : h(Dice, props))
  await act(async () => render())
  return { ref, starts, ends, container,
    update: async patch => { Object.assign(props, patch); await act(async () => render()) },
    unmount: async () => { await act(async () => root.unmount()); roots.delete(root) },
  }
}

const advance = ms => act(async () => { clock.tick(ms) })
async function preference(matches) {
  await act(async () => { reduced = matches; for (const listener of listeners) listener() })
}
function transition(element, propertyName = 'transform') {
  const event = new window.Event('transitionend', { bubbles: true })
  Object.defineProperty(event, 'propertyName', { value: propertyName })
  element.dispatchEvent(event)
}

test('set cancels the roll, its completion callback, and its throw animation', async () => {
  const x = await mount()
  await act(async () => { assert.equal(x.ref.current.roll(), 1) })
  await advance(30)
  await act(async () => {
    x.ref.current.set(6)
    transition(x.container.querySelector('.rtd-cube'))
  })
  assert.equal(x.ref.current.rolling, false)
  assert.equal(x.ref.current.value, 6)
  await advance(500)
  assert.deepEqual(x.starts, [1])
  assert.deepEqual(x.ends, [])
  assert.equal(x.container.querySelector('.rtd-scene--a, .rtd-scene--b'), null)
  await x.update({ duration: 200 })
  await advance(500)
  assert.deepEqual(x.ends, [])
  await act(async () => { x.ref.current.roll() })
  await advance(280)
  assert.deepEqual(x.ends, [1], 'a roll after set must still complete')
})

test('duration and motion preference changes after completion never create another completion', async () => {
  const x = await mount()
  await act(async () => { x.ref.current.roll() })
  await advance(180)
  await x.update({ duration: 200 })
  await advance(280)
  await preference(true)
  await advance(0)
  await preference(false)
  await advance(500)
  assert.deepEqual(x.ends, [1])
})

for (const motion of [false, true]) {
  test(`${motion ? 'reduced motion' : 'duration zero'} completes asynchronously without the 80ms grace`, async () => {
    reduced = motion
    const x = await mount({ duration: motion ? 1400 : 0 })
    await act(async () => {
      x.ref.current.roll()
      x.ref.current.roll()
      assert.deepEqual(x.ends, [])
    })
    assert.equal(x.ref.current.rolling, true)
    await advance(0)
    assert.equal(x.ref.current.rolling, false)
    assert.deepEqual(x.starts, [1, 1])
    assert.deepEqual(x.ends, [1])
  })
}

test('rerolls only complete the final value, using the latest callback without restarting the timer', async () => {
  let sample = 0
  const x = await mount({ random: () => sample })
  await act(async () => { x.ref.current.roll() })
  await advance(40)
  sample = 0.999
  await act(async () => { x.ref.current.roll() })
  await advance(40)
  const latest = []
  await x.update({ onRollEnd: value => latest.push(value) })
  await advance(100)
  assert.deepEqual(latest, [])
  await advance(40)
  assert.deepEqual(x.starts, [1, 6])
  assert.deepEqual(x.ends, [])
  assert.deepEqual(latest, [6])
})

test('only the cube transform ends the roll, and the fallback cannot finish it twice', async () => {
  const x = await mount()
  await act(async () => { x.ref.current.roll() })
  await advance(100)
  await act(async () => {
    transition(x.container.querySelector('.rtd-face'))
    transition(x.container.querySelector('.rtd-cube'), 'opacity')
  })
  assert.deepEqual(x.ends, [])
  await act(async () => transition(x.container.querySelector('.rtd-cube')))
  await advance(500)
  assert.deepEqual(x.ends, [1])
})

test('duration changes during a roll rearm only that active roll; reduced motion finishes it', async () => {
  const x = await mount()
  await act(async () => { x.ref.current.roll() })
  await advance(40)
  await x.update({ duration: 200 })
  await advance(140)
  assert.deepEqual(x.ends, [])
  await preference(true)
  await advance(0)
  assert.deepEqual(x.ends, [1])
  await advance(500)
  assert.deepEqual(x.ends, [1])
})

test('unmount and synchronous set in onRollStart both cancel pending completion', async () => {
  const x = await mount()
  await act(async () => { x.ref.current.roll() })
  await advance(30)
  await x.unmount()
  await advance(500)
  assert.deepEqual(x.ends, [])
  const y = await mount()
  await y.update({ onRollStart: () => y.ref.current.set(4) })
  await act(async () => { y.ref.current.roll() })
  await advance(500)
  assert.equal(y.ref.current.value, 4)
  assert.equal(y.ref.current.rolling, false)
  assert.deepEqual(y.ends, [])
})

test('StrictMode effect replay retains one active completion', async () => {
  const ends = [], ref = React.createRef()
  function Board() {
    React.useEffect(() => { ref.current.roll() }, [])
    return h(Dice, { ref, duration: 0, injectStyles: false, random: () => 0, onRollEnd: value => ends.push(value) })
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = rootFor(container)
  await act(async () => root.render(h(React.StrictMode, null, h(Board))))
  await advance(0)
  assert.deepEqual(ends, [1])
  assert.equal(ref.current.rolling, false)
})

test('shared nonce styles survive SSR and hydration without duplicate styles', async () => {
  const errors = [], recoverable = [], originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const tree = h(React.Fragment, null, h(DiceStyles, { nonce: 'test-nonce' }),
      h(Dice, { injectStyles: false }), h(Dice, { injectStyles: false, defaultValue: 6 }))
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    await act(async () => {
      const root = major >= 18
        ? ReactDOM.hydrateRoot(container, tree, { onRecoverableError: error => recoverable.push(error) })
        : { unmount: () => ReactDOM.unmountComponentAtNode(container) }
      if (major < 18) ReactDOM.hydrate(tree, container)
      roots.add(root)
    })
    assert.equal(document.querySelectorAll('style').length, 1)
    assert.equal(document.querySelector('style').nonce, 'test-nonce')
    assert.deepEqual(recoverable, [])
    assert.deepEqual(errors, [])
  } finally { console.error = originalError }
})
