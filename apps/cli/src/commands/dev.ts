import { spawn, spawnSync, execSync, type ChildProcess } from 'node:child_process'
import * as p from '../utils/prompt.js'
import pc from 'picocolors'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { isDockerInstalled, isDockerRunning } from '../services/docker.js'
import { checkDevEnv } from '../services/env-check.js'

const PROJECT_NAME = 'omnilearn-dev'

const DEV_COMPOSE = `name: omnilearn-dev

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: omnilearn-db-dev
    restart: unless-stopped
    environment:
      - POSTGRES_USER=omnilearn
      - POSTGRES_PASSWORD=omnilearn
      - POSTGRES_DB=omnilearn
    ports:
      - "5433:5432"
    volumes:
      - omnilearn_db_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnilearn"]
      interval: 5s
      timeout: 4s
      retries: 5

  redis:
    image: redis:8.6.1-alpine
    container_name: omnilearn-redis-dev
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - omnilearn_redis_dev_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 4s
      retries: 5

volumes:
  omnilearn_db_dev_data:
  omnilearn_redis_dev_data:
`

function findProjectRoot(): string | null {
  let dir = process.cwd()
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'apps', 'api')) &&
      fs.existsSync(path.join(dir, 'apps', 'web'))
    ) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function getDevComposePath(root: string): string {
  const dotDir = path.join(root, '.omnilearn')
  if (!fs.existsSync(dotDir)) fs.mkdirSync(dotDir, { recursive: true })
  const composePath = path.join(dotDir, 'docker-compose.dev.yml')
  fs.writeFileSync(composePath, DEV_COMPOSE)
  return composePath
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth(label: string, command: string, args: string[], maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync([command, ...args].join(' '), { stdio: 'pipe', timeout: 5000 })
      return true
    } catch {
      await sleep(1000)
    }
  }
  p.log.warn(`${label} did not become ready in time`)
  return false
}

function isRemoteSqlHost(host: string | undefined): boolean {
  if (!host) return false
  const normalized = host.toLowerCase()
  return !(
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === 'db' ||
    normalized === 'postgres' ||
    normalized.endsWith('.local')
  )
}

function readApiSqlConnectionString(root: string): string | undefined {
  const fromEnv = process.env.OMNILEARN_SQL_CONNECTION_STRING
  if (fromEnv) return fromEnv
  try {
    const envPath = path.join(root, 'apps', 'api', '.env')
    if (!fs.existsSync(envPath)) return undefined
    const match = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('OMNILEARN_SQL_CONNECTION_STRING='))
    if (!match) return undefined
    return match.slice('OMNILEARN_SQL_CONNECTION_STRING='.length).replace(/^['"]|['"]$/g, '')
  } catch {
    return undefined
  }
}

function sqlHostFromUrl(sqlUrl: string | undefined): string | undefined {
  if (!sqlUrl) return undefined
  try {
    return new URL(sqlUrl.replace(/^postgres(ql)?(\+[^:]+)?:\/\//, 'postgresql://')).hostname
  } catch {
    return undefined
  }
}

function defaultApiReadyAttempts(root = process.cwd()): number {
  // Uvicorn reload + Windows spawn is already slow; remote managed Postgres
  // (DigitalOcean / Neon / Supabase) is slower still because connect_to_db +
  // auto_install must finish before the first HTTP response.
  const remote = isRemoteSqlHost(sqlHostFromUrl(readApiSqlConnectionString(root)))
  if (remote) return process.platform === 'win32' ? 420 : 300
  return process.platform === 'win32' ? 240 : 90
}

async function waitForHttp(label: string, url: string, maxAttempts?: number): Promise<boolean> {
  const attempts = maxAttempts ?? defaultApiReadyAttempts()
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // not ready yet
    }
    await sleep(1000)
  }
  p.log.warn(`${label} did not become ready in time (${url})`)
  return false
}

const CONTROLS_BAR = pc.dim('─'.repeat(60)) + '\n' +
  pc.dim('  ') + pc.bold('ra') + pc.dim(' restart api  ') +
  pc.bold('rw') + pc.dim(' restart web  ') +
  pc.bold('rc') + pc.dim(' restart collab  ') +
  pc.bold('rb') + pc.dim(' restart all  ') +
  pc.bold('q') + pc.dim(' quit') + '\n' +
  pc.dim('─'.repeat(60))

let lineCount = 0
const CONTROLS_INTERVAL = 50

function printControls() {
  process.stdout.write('\n' + CONTROLS_BAR + '\n\n')
  lineCount = 0
}

function prefixStream(proc: ChildProcess, label: string, color: (s: string) => string) {
  const prefix = color(`[${label}]`)
  const handleData = (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.length > 0) {
        process.stdout.write(`${prefix} ${line}\n`)
        lineCount++
        if (lineCount >= CONTROLS_INTERVAL) {
          printControls()
        }
      }
    }
  }
  proc.stdout?.on('data', handleData)
  proc.stderr?.on('data', handleData)
}

function isContainerRunning(name: string): boolean {
  try {
    const state = execSync(
      `docker inspect --format '{{.State.Running}}' ${name}`,
      { stdio: 'pipe' }
    ).toString().trim()
    return state === 'true'
  } catch {
    return false
  }
}

function isInfraRunning(): boolean {
  return isContainerRunning('omnilearn-db-dev') && isContainerRunning('omnilearn-redis-dev')
}

let serviceEnv: Record<string, string> = {}

function spawnService(command: string, args: string[], cwd: string, label: string, color: (s: string) => string): ChildProcess {
  const localBin = path.join(cwd, 'node_modules', '.bin')
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...serviceEnv,
      PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  })
  prefixStream(child, label, color)
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(color(`[${label}]`) + ` exited with code ${code}`)
    }
  })
  return child
}

function killProcess(child: ChildProcess | null): Promise<void> {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve()
      return
    }

    const pid = child.pid
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }

    child.once('exit', done)

    // On Windows, services are spawned with `shell: true`, so `child.kill()`
    // only stops the cmd.exe wrapper and leaves uv/python/next/tsx orphans
    // holding ports 1338/3000/4000. Kill the whole process tree instead.
    if (process.platform === 'win32' && pid) {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
      } catch {
        // Process may already be gone
      }
      // Give Windows a moment to release listeners, then resolve either way
      setTimeout(done, 500)
      return
    }

    child.kill('SIGTERM')
    setTimeout(() => {
      if (!child.killed && child.exitCode === null) {
        child.kill('SIGKILL')
      }
      setTimeout(done, 500)
    }, 5000)
  })
}

export async function devCommand(opts: { ee?: boolean; adminEmail?: string; adminPassword?: string }) {
  const root = findProjectRoot()
  if (!root) {
    p.log.error('Not inside a OmniLearn project.')
    p.log.info('Run this command from within the omnilearn monorepo (must contain dev/docker-compose.yml, apps/api/, and apps/web/).')
    process.exit(1)
  }

  p.intro(pc.cyan('OmniLearn Dev Mode'))

  // Check env files before anything else
  const envOk = await checkDevEnv(root)
  if (!envOk) process.exit(1)

  // EE mode — set up ee/ symlink when --ee is passed
  const eePath = path.join(root, 'apps', 'api', 'ee')
  if (opts.ee) {
    if (!fs.existsSync(eePath)) {
      // Try the sibling `ee` repo (parent-dir/ee/apps/api/ee)
      const parentDir = path.dirname(root)
      const eeRepoPath = path.join(parentDir, 'ee', 'apps', 'api', 'ee')
      if (fs.existsSync(eeRepoPath)) {
        try {
          fs.symlinkSync(eeRepoPath, eePath)
          p.log.success(`Linked EE folder → ${eeRepoPath}`)
        } catch (err: any) {
          p.log.warning(`Could not create EE symlink: ${err.message}`)
        }
      } else {
        p.log.warning(`--ee passed but no ee/ folder found at ${eeRepoPath} — running in OSS mode`)
      }
    }

    if (fs.existsSync(eePath)) {
      p.log.info(`Running in ${pc.bold('EE')} mode`)
    }
  }

  if (!isDockerInstalled()) {
    p.log.error('Docker is not installed. Please install Docker and try again.')
    process.exit(1)
  }

  if (!isDockerRunning()) {
    p.log.error('Docker is not running. Please start Docker and try again.')
    process.exit(1)
  }
  console.log()

  const composePath = getDevComposePath(root)

  // Check if infrastructure is already running
  const alreadyRunning = isInfraRunning()

  if (alreadyRunning) {
    p.log.success('Existing DB and Redis containers detected — reusing them')
  }

  // Resolve admin credentials: CLI flags take priority, then interactive prompts (first setup only)
  let adminEmail = opts.adminEmail
  let adminPassword = opts.adminPassword

  if (!alreadyRunning) {
    if (!adminEmail) {
      const emailInput = await p.text({
        message: 'Admin email',
        placeholder: 'admin@school.dev',
        defaultValue: 'admin@school.dev',
      })
      if (p.isCancel(emailInput)) process.exit(0)
      adminEmail = emailInput
    }

    if (!adminPassword) {
      const passwordInput = await p.password({
        message: 'Admin password',
      })
      if (p.isCancel(passwordInput)) process.exit(0)
      adminPassword = passwordInput as string
    }

    if (!adminPassword) {
      p.log.error('Password is required.')
      process.exit(1)
    }

    // Start infrastructure
    const infraSpinner = p.spinner()
    infraSpinner.start('Starting DB and Redis containers...')
    try {
      execSync(`docker compose -f ${composePath} -p ${PROJECT_NAME} up -d`, {
        cwd: root,
        stdio: 'pipe',
      })
      infraSpinner.stop('Containers started')
    } catch (e: any) {
      infraSpinner.stop('Failed to start containers')
      p.log.error(e.stderr?.toString() || 'docker compose up failed')
      process.exit(1)
    }
  }

  serviceEnv = {
    FORCE_COLOR: '1',
    OMNILEARN_DEVELOPMENT_MODE: 'true',
    ...(adminEmail && { OMNILEARN_INITIAL_ADMIN_EMAIL: adminEmail }),
    ...(adminPassword && { OMNILEARN_INITIAL_ADMIN_PASSWORD: adminPassword }),
    ...(!opts.ee && { OMNILEARN_DISABLE_EE: '1' }),
    // Bypass license verification for local dev when --ee is active
    ...(opts.ee && { OMNILEARN_FORCE_EE: '1' }),
  }

  // Health checks
  const healthSpinner = p.spinner()
  healthSpinner.start('Waiting for DB and Redis to be healthy...')

  const [dbReady, redisReady] = await Promise.all([
    waitForHealth('DB', 'docker', ['exec', 'omnilearn-db-dev', 'pg_isready', '-U', 'omnilearn']),
    waitForHealth('Redis', 'docker', ['exec', 'omnilearn-redis-dev', 'redis-cli', 'ping']),
  ])

  if (!dbReady || !redisReady) {
    healthSpinner.stop('Health checks failed')
    if (!dbReady) p.log.error('Database did not become ready in time.')
    if (!redisReady) p.log.error('Redis did not become ready in time.')
    process.exit(1)
  }
  healthSpinner.stop('DB and Redis are healthy')

  const webDir = path.join(root, 'apps', 'web')
  const collabDir = path.join(root, 'apps', 'collab')
  const apiDir = path.join(root, 'apps', 'api')

  // Auto-install missing dependencies
  const bunProjects = [
    { label: 'web', dir: webDir },
    { label: 'collab', dir: collabDir },
  ]

  for (const { label, dir } of bunProjects) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) {
      p.log.info(`Installing ${label} dependencies...`)
      const result = spawnSync('bun', ['install'], { cwd: dir, stdio: 'inherit', shell: true })
      if (result.status !== 0) {
        p.log.error(`Failed to install ${label} dependencies`)
        process.exit(1)
      }
    }
  }

  if (!fs.existsSync(path.join(apiDir, '.venv'))) {
    p.log.info('Installing API dependencies...')
    const result = spawnSync('uv', ['sync'], { cwd: apiDir, stdio: 'inherit', shell: true })
    if (result.status !== 0) {
      p.log.error('Failed to install API dependencies')
      process.exit(1)
    }
  }

  // Start local services
  let apiProc: ChildProcess | null = null
  let webProc: ChildProcess | null = null
  let collabProc: ChildProcess | null = null

  const startApi = () => {
    return spawnService('uv', ['run', 'python', 'app.py'], path.join(root, 'apps', 'api'), 'api', pc.magenta)
  }

  const startWeb = () => {
    return spawnService('next', ['dev', '--turbopack'], path.join(root, 'apps', 'web'), 'web', pc.cyan)
  }

  const startCollab = () => {
    return spawnService('tsx', ['watch', 'src/index.ts'], path.join(root, 'apps', 'collab'), 'collab', pc.yellow)
  }

  // Start API first and wait until it accepts requests.
  // Web proxies to the API; starting them together caused "fetch failed"
  // while uvicorn was still booting (especially with reload on Windows).
  apiProc = startApi()

  const apiReadySpinner = p.spinner()
  const apiReadyAttempts = defaultApiReadyAttempts(root)
  const remoteSql = isRemoteSqlHost(sqlHostFromUrl(readApiSqlConnectionString(root)))
  apiReadySpinner.start(
    remoteSql
      ? `Waiting for API on :1338 (remote DB — up to ${apiReadyAttempts}s)...`
      : 'Waiting for API to be ready on :1338...'
  )
  const apiReady = await waitForHttp('API', 'http://127.0.0.1:1338/', apiReadyAttempts)
  if (!apiReady) {
    apiReadySpinner.stop('API did not become ready')
    p.log.error('API failed to start. Check the [api] logs above.')
    if (remoteSql) {
      p.log.warn(
        'Remote Postgres startups can exceed several minutes. Re-run after confirming the DB is reachable, or temporarily use the local DB.'
      )
    }
    await Promise.all([killProcess(apiProc)])
    process.exit(1)
  }
  apiReadySpinner.stop('API is ready')

  webProc = startWeb()
  collabProc = startCollab()

  p.log.success('API, Web, and Collab servers started')
  console.log()
  console.log(pc.dim('  Thank you for contributing to OmniLearn!'))
  console.log()

  printControls()

  // Graceful shutdown — keep containers running for reuse
  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log('\n' + pc.dim('Shutting down dev servers...'))

    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()

    await Promise.all([killProcess(apiProc), killProcess(webProc), killProcess(collabProc)])

    console.log(pc.dim('DB and Redis containers are still running for next session.'))
    console.log(pc.dim('To stop them: docker compose -f .omnilearn/docker-compose.dev.yml -p omnilearn-dev down'))
    console.log(pc.dim('Thanks for building with OmniLearn!'))
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Interactive key handling
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    let pendingR = false

    process.stdin.on('data', async (key: string) => {
      if (key === '\x03') {
        await shutdown()
        return
      }

      if (key === 'q') {
        await shutdown()
        return
      }

      if (key === 'r') {
        pendingR = true
        setTimeout(() => { pendingR = false }, 1000)
        return
      }

      if (pendingR) {
        pendingR = false

        if (key === 'a') {
          console.log(pc.magenta('\n  Restarting API...\n'))
          await killProcess(apiProc)
          apiProc = startApi()
          await waitForHttp('API', 'http://127.0.0.1:1338/')
          printControls()
        } else if (key === 'w') {
          console.log(pc.cyan('\n  Restarting Web...\n'))
          await killProcess(webProc)
          webProc = startWeb()
          printControls()
        } else if (key === 'c') {
          console.log(pc.yellow('\n  Restarting Collab...\n'))
          await killProcess(collabProc)
          collabProc = startCollab()
          printControls()
        } else if (key === 'b') {
          console.log(pc.yellow('\n  Restarting all...\n'))
          await Promise.all([killProcess(apiProc), killProcess(webProc), killProcess(collabProc)])
          apiProc = startApi()
          await waitForHttp('API', 'http://127.0.0.1:1338/')
          webProc = startWeb()
          collabProc = startCollab()
          printControls()
        }
      }
    })
  }

  // Keep process alive
  await new Promise(() => {})
}
