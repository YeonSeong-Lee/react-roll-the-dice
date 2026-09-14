// Runs @arethetypeswrong/cli against a freshly packed tarball.
//
// Not `attw --pack`: that spawns its own `npm pack`, and under
// `npm publish --dry-run` npm exports npm_config_dry_run, which the child
// inherits — so it writes no tarball and attw dies on ENOENT. The flag is
// stripped here so the check behaves the same whether or not it was reached
// through a dry run.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = { ...process.env }
delete env.npm_config_dry_run

const out = mkdtempSync(join(tmpdir(), 'rtd-attw-'))
try {
  const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], {
    env,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .pop()

  execFileSync('npx', ['attw', join(out, tarball), '--exclude-entrypoints', 'styles.css'], {
    env,
    stdio: 'inherit',
  })
} finally {
  rmSync(out, { recursive: true, force: true })
}
