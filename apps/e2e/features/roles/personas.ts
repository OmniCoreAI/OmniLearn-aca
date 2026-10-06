/**
 * QA personas for the role-portal checks: one account per role, created by
 * apps/api/scripts/seed_qa_personas.py, which writes their credentials to
 * .env.test.local at the repo root (override with E2E_QA_ENV_FILE).
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Page, expect } from '@playwright/test'

export const ROLES_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3002'
export const ROLES_API_URL = process.env.E2E_API_URL || 'http://localhost:1338/api/v1'

const ENV_FILE = process.env.E2E_QA_ENV_FILE || fileURLToPath(new URL('../../../../.env.test.local', import.meta.url))

function readEnv(): Record<string, string> {
  const values: Record<string, string> = {}
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const i = line.indexOf('=')
      if (i > 0 && !line.trimStart().startsWith('#')) values[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
  return { ...values, ...process.env } as Record<string, string>
}

export type Persona = 'admin' | 'instructor' | 'coordinator' | 'trainee'

export function persona(role: Persona): { email: string; password: string } {
  const env = readEnv()
  const email = env[`QA_${role.toUpperCase()}_EMAIL`]
  const password = env.QA_PASSWORD
  if (!email || !password) {
    throw new Error(`Missing QA_${role.toUpperCase()}_EMAIL / QA_PASSWORD — run apps/api/scripts/seed_qa_personas.py --yes first (reads ${ENV_FILE}).`)
  }
  return { email, password }
}

/** Sign in through the real login form and wait until the app leaves /login. */
export async function signIn(page: Page, role: Persona): Promise<void> {
  const { email, password } = persona(role)
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').first().click()
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 })
}

/** API token for seeding (form login, like the web app). */
export async function apiToken(role: Persona): Promise<string> {
  const { email, password } = persona(role)
  const res = await fetch(`${ROLES_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })
  if (!res.ok) throw new Error(`API login failed for ${email}: ${res.status}`)
  const data: any = await res.json()
  return data?.tokens?.access_token || data?.access_token
}

export async function api<T = any>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ROLES_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: ROLES_BASE_URL,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}
