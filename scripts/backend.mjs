import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const backendDir = fileURLToPath(new URL('../backend/', import.meta.url))
const windows = process.platform === 'win32'
const args = process.argv.slice(2)
const command = windows ? 'cmd.exe' : 'sh'
const commandArgs = windows ? ['/d', '/c', '.\\mvnw.cmd', ...args] : ['./mvnw', ...args]
const child = spawn(command, commandArgs, {
  cwd: backendDir,
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(`Cannot start Maven Wrapper: ${error.message}`)
  process.exitCode = 1
})

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
