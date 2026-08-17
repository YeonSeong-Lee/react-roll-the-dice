import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const DIRECTIVE = '"use client";'

/**
 * Puts the client boundary marker back on line 1.
 *
 * Neither a source-level directive nor tsup's `banner` survives the bundle —
 * the treeshake pass strips module-level directives from the output and warns
 * that it did. Without the marker, importing this package from a Next.js App
 * Router server component fails outright, so it gets written back afterwards.
 *
 * Prepending a line would desync the source maps, so each map's `mappings`
 * gains a leading `;` — one empty line group, which shifts every entry down by
 * exactly the line that was added.
 */
function addClientDirective(jsPath: string) {
  const code = readFileSync(jsPath, 'utf8')
  if (code.startsWith(DIRECTIVE)) return
  writeFileSync(jsPath, `${DIRECTIVE}\n${code}`, 'utf8')

  const mapPath = `${jsPath}.map`
  try {
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { mappings: string }
    map.mappings = `;${map.mappings}`
    writeFileSync(mapPath, JSON.stringify(map), 'utf8')
  } catch {
    // No source map for this bundle; nothing to realign.
  }
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.js' : '.cjs' }),
  external: ['react', 'react/jsx-runtime'],
  clean: true,
  treeshake: true,
  sourcemap: true,
  async onSuccess() {
    addClientDirective('dist/index.js')
    addClientDirective('dist/index.cjs')
    // Ship the same CSS that was inlined into styles.generated.ts, so the
    // `react-roll-the-dice/styles.css` subpath stays identical to the
    // auto-injected copy.
    copyFileSync('src/styles.css', 'dist/styles.css')
  },
})
