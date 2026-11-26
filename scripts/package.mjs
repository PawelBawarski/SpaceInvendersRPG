import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const frontendDirectory = fileURLToPath(new URL('../frontend/', import.meta.url))
const backendTarget = fileURLToPath(new URL('../backend/target/', import.meta.url))
const packageDirectory = fileURLToPath(new URL('../artifacts/neon-void/', import.meta.url))
const frontendPackage = JSON.parse(readFileSync(fileURLToPath(new URL('../frontend/package.json', import.meta.url)), 'utf8'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(npm, ['run', 'build', '--workspace', 'frontend'])
run(process.execPath, ['scripts/backend.mjs', 'package', '-DskipTests'])

const backendJar = readdirSync(backendTarget).find(file => /^neon-void-backend-.*\.jar$/.test(file) && !file.endsWith('.jar.original'))
if (!backendJar) throw new Error('Backend package was not created.')
if (!existsSync(fileURLToPath(new URL('../frontend/dist/', import.meta.url)))) throw new Error('Frontend bundle was not created.')

rmSync(packageDirectory, { recursive: true, force: true })
mkdirSync(packageDirectory, { recursive: true })
cpSync(fileURLToPath(new URL('../frontend/dist/', import.meta.url)), join(packageDirectory, 'frontend'), { recursive: true })
cpSync(fileURLToPath(new URL(`../backend/target/${backendJar}`, import.meta.url)), join(packageDirectory, 'neon-void-backend.jar'))
writeFileSync(join(packageDirectory, 'manifest.json'), `${JSON.stringify({
  name: 'neon-void', frontendVersion: frontendPackage.version, backendJar, builtAt: new Date().toISOString(),
  files: { frontend: 'frontend/', backend: 'neon-void-backend.jar' },
}, null, 2)}\n`)
console.log(`Package prepared in ${packageDirectory}`)
