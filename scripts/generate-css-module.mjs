// Generates src/styles.generated.ts from src/styles.css so the stylesheet has a
// single source of truth: the component inlines this string into a <style> tag,
// and tsup copies the same file to dist/styles.css for manual imports.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'src/styles.css')
const target = resolve(root, 'src/styles.generated.ts')

const css = readFileSync(source, 'utf8')
  // Strip comments and collapse whitespace — this string ends up in every
  // consumer's bundle, so it is worth the few hundred bytes.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim()

writeFileSync(
  target,
  `// AUTO-GENERATED from src/styles.css by scripts/generate-css-module.mjs.\n` +
    `// Do not edit directly — edit src/styles.css instead.\n` +
    `export const css = ${JSON.stringify(css)}\n`,
  'utf8',
)

console.log(`generate-css-module: wrote ${target} (${css.length} bytes)`)
