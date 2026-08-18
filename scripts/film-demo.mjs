// Renders assets/demo.gif frame by frame through one Chrome session over CDP.
//
// The demo page freezes its roll and exposes window.__scrub(ms), so every frame
// comes from a single page load — re-running the animation per frame meant a
// fresh browser each time, which took ~100s a frame instead of ~50ms.
//
//   cd examples/vite-react && npm run dev
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
//     --disable-gpu --hide-scrollbars --remote-debugging-port=9222 \
//     --user-data-dir=/tmp/rtd-film about:blank &
//   VW=520 VH=390 node scripts/film-demo.mjs \
//     'http://localhost:5177/demo.html?film' /tmp/frames 20 2500
//   ffmpeg -y -framerate 20 -i /tmp/frames/f%03d.png \
//     -vf "scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
//     -loop 0 assets/demo.gif
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
const [url, outDir, fpsArg, totalArg] = process.argv.slice(2)
const fps = Number(fpsArg), total = Number(totalArg), step = 1000 / fps

const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
const page = targets.find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))

let id = 0
const pending = new Map()
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise(res => {
  const n = ++id
  pending.set(n, res)
  ws.send(JSON.stringify({ id: n, method, params }))
})

await send('Page.enable')
await send('Runtime.enable')
// --window-size is unreliable headless; pin the viewport explicitly.
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(process.env.VW || 520),
  height: Number(process.env.VH || 390),
  deviceScaleFactor: 2,
  mobile: false,
})
await send('Page.navigate', { url })

// Wait for the film hook the demo installs once it has triggered its roll.
for (let i = 0; i < 200; i++) {
  const r = await send('Runtime.evaluate', { expression: 'window.__filmReady === true' })
  if (r.result?.result?.value === true) break
  await new Promise(r => setTimeout(r, 100))
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

let n = 0
for (let t = 0; t < total; t += step) {
  await send('Runtime.evaluate', { expression: `window.__scrub(${Math.round(t)})`, awaitPromise: false })
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(`${outDir}/f${String(n).padStart(3, '0')}.png`, Buffer.from(shot.result.data, 'base64'))
  n++
}
console.log('frames:', n)
ws.close()
process.exit(0)
