import { defineConfig, devices } from '@playwright/test'
import { ROLES_BASE_URL } from './features/roles/personas'

/**
 * Role-portal checks against an already-running instance (local dev or
 * staging) seeded with apps/api/scripts/seed_qa_personas.py. Unlike the main
 * suite there is no self-host boot and no global setup.
 *
 *   uv run python scripts/seed_qa_personas.py --yes        # in apps/api
 *   E2E_BASE_URL=http://localhost:3002 E2E_API_URL=http://localhost:1338/api/v1 \
 *     bunx playwright test -c playwright.roles.config.ts   # in apps/e2e
 */
export default defineConfig({
  testDir: './features/roles/tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-roles' }]],
  use: {
    baseURL: ROLES_BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
