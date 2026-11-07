import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { build } from 'esbuild'
import ts from 'typescript'
import { rollDiceValue } from 'react-roll-the-dice/random'

const require = createRequire(import.meta.url)
test('the random subpath supports ESM and CJS without changing injected RNG behavior', () => {
  const cjs = require('react-roll-the-dice/random')
  for (const sample of [0, 0.2, 0.5, 0.999, 1]) {
    assert.equal(rollDiceValue(() => sample), cjs.rollDiceValue(() => sample))
  }
  assert.equal(rollDiceValue(() => 0), 1)
  assert.equal(rollDiceValue(() => 1), 6)
})

for (const path of ['react-roll-the-dice', 'react-roll-the-dice/random']) {
  test(`unused UI is eliminated when importing only RNG from ${path}`, async () => {
    const result = await build({
      stdin: { contents: `export { rollDiceValue } from '${path}'`, resolveDir: process.cwd() },
      bundle: true, platform: 'browser', format: 'esm', minify: true, write: false,
      external: ['react', 'react/jsx-runtime'],
    })
    const code = result.outputFiles[0].text
    // The legacy root may retain external React imports; the UI and CSS must
    // be removed. The dedicated subpath also removes the React dependency.
    assert.doesNotMatch(code, /rtd-scene|Dice showing|data-rolling/)
    if (path.endsWith('/random')) assert.doesNotMatch(code, /['"]react(?:\/jsx-runtime)?['"]|use client/)
  })
}

test('random runtime and declarations have no client boundary or React dependency', () => {
  for (const file of ['dist/random.js', 'dist/random.cjs']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /use client|['"]react(?:\/jsx-runtime)?['"]|rtd-scene/)
  }
  for (const file of ['dist/index.js', 'dist/index.cjs']) {
    assert.match(readFileSync(file, 'utf8'), /^"use client";/)
  }
  const program = ts.createProgram(['dist/random.d.ts', 'dist/random.d.cts'], { types: [] })
  assert.equal(program.getSourceFiles().some(file => file.fileName.includes('/@types/react/')), false)
  execFileSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e',
    "import { rollDiceValue } from 'react-roll-the-dice/random'; if (rollDiceValue(() => 0) !== 1) process.exit(1)"], { cwd: process.cwd() })
})
