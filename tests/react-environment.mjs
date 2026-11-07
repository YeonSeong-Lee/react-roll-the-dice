import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after } from 'node:test'

// RTD_REACT_DIR lets the same tests run against an isolated React 17/18
// installation without changing the repository's dependency versions.
const dependencies = createRequire(resolve(process.env.RTD_REACT_DIR ?? '.', 'package.json'))
const fixture = mkdtempSync(join(tmpdir(), 'rtd-react-test-'))
mkdirSync(join(fixture, 'node_modules'))
for (const name of ['react', 'react-dom']) {
  symlinkSync(dirname(dependencies.resolve(`${name}/package.json`)), join(fixture, 'node_modules', name))
}
copyFileSync('dist/index.cjs', join(fixture, 'index.cjs'))
after(() => rmSync(fixture, { recursive: true, force: true }))

export const requireReact = createRequire(join(fixture, 'index.cjs'))
export const React = requireReact('react')
export const { Dice, DiceStyles } = requireReact('./index.cjs')
export const major = Number(React.version.split('.')[0])
