/**
 * What each role gets after signing in: where they land, their home page,
 * their navigation, and what stays out of reach.
 */
import { test, expect } from '@playwright/test'
import { api, apiToken, persona, signIn } from '../personas'

test.describe('Academy admin', () => {
  test('lands on the academy dashboard with full administration', async ({ page }) => {
    await signIn(page, 'admin')
    await expect(page).toHaveURL(/\/dash$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    // The generic SaaS onboarding is gone.
    await expect(page.getByText('Getting Started')).toHaveCount(0)

    await page.goto('/dash/administration/roles')
    await expect(page.getByRole('heading', { level: 1, name: 'Roles & portals' })).toBeVisible()
    // Only a platform superadmin can change the sidebar toggles.
    await expect(page.getByText('Only a platform superadmin can change these.')).toBeVisible()
  })
})

test.describe('Instructor', () => {
  test('lands on "My work" and only sees their own work', async ({ page }) => {
    await signIn(page, 'instructor')
    await expect(page).toHaveURL(/\/dash$/)
    await expect(page.getByRole('heading', { level: 1, name: 'My work' })).toBeVisible()
    for (const card of ['Needs your attention', 'Teaching now', 'My courses', 'My training programs']) {
      await expect(page.getByRole('heading', { name: card })).toBeVisible()
    }
    // Creating courses is academy-admin only.
    await expect(page.locator('a[href*="courses?new=true"]')).toHaveCount(0)

    // Administration is out of reach: the route guard sends them back.
    await page.goto('/dash/administration')
    await expect(page).not.toHaveURL(/\/dash\/administration/)
  })
})

test.describe('Entity coordinator', () => {
  test('lands on their entity snapshot', async ({ page }) => {
    await signIn(page, 'coordinator')
    await expect(page).toHaveURL(/\/dash$/)
    await expect(page.getByRole('heading', { level: 1, name: 'My entity' })).toBeVisible()
    await expect(page.getByText('QA Ministry of Health').first()).toBeVisible()
    for (const action of ['Assign training', 'Progress & activity']) {
      await expect(page.getByRole('link', { name: action }).first()).toBeVisible()
    }
    await page.getByRole('link', { name: 'Assign training' }).first().click()
    await expect(page).toHaveURL(/\/dash\/my-entity\?tab=training/)

    await page.goto('/dash/administration/entities')
    await expect(page).not.toHaveURL(/\/dash\/administration/)
  })
})

test.describe('Trainee', () => {
  test('lands on the learner home with their learning links', async ({ page }) => {
    await signIn(page, 'trainee')
    await expect(page).toHaveURL(/\/$/)
    for (const link of ['My learning', 'My calendar']) {
      await expect(page.getByRole('link', { name: link }).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible()

    // No dashboard for learners: they're sent back to the learner home.
    await page.goto('/dash')
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Assignment notifications', () => {
  test('a new training-program coordinator is told in their bell', async ({ page }) => {
    const admin = await apiToken('admin')
    const instructorToken = await apiToken('instructor')
    const session = await api<any>('GET', '/users/session', instructorToken)
    const orgId: number = session.roles[0].org.id
    const before = await api<any>('GET', `/inbox/org/${orgId}`, instructorToken)

    const tp = await api<any>('POST', `/training-programs/?org_id=${orgId}`, admin, {
      name: `E2E bell ${Date.now().toString(36)}`,
    })
    try {
      await api('PUT', `/training-programs/${tp.trainingprogram_uuid}/coordinator`, admin, {
        coordinator_uuid: session.user.user_uuid,
      })
      const after = await api<any>('GET', `/inbox/org/${orgId}`, instructorToken)
      expect(after.unread).toBe(before.unread + 1)
      expect(after.items[0]).toMatchObject({
        type: 'coordination_assigned',
        payload: { role: 'training_coordinator', name: tp.name },
      })

      await signIn(page, 'instructor')
      const bell = page.getByRole('button', { name: /^Notifications/ })
      await expect(bell).toHaveAccessibleName(/unread/)
      await bell.click()
      await page.getByText(`You are now coordinator of ${tp.name}`).click()
      await expect(page).toHaveURL(new RegExp(`/dash/training-programs/${tp.trainingprogram_uuid.replace('trainingprogram_', '')}`))
    } finally {
      await api('DELETE', `/training-programs/${tp.trainingprogram_uuid}`, admin)
    }
  })

  test('nobody is told about their own change', async () => {
    const { email } = persona('admin')
    const admin = await apiToken('admin')
    const session = await api<any>('GET', '/users/session', admin)
    const orgId: number = session.roles[0].org.id
    const before = await api<any>('GET', `/inbox/org/${orgId}`, admin)
    const tp = await api<any>('POST', `/training-programs/?org_id=${orgId}`, admin, { name: `E2E self ${Date.now().toString(36)}` })
    try {
      await api('PUT', `/training-programs/${tp.trainingprogram_uuid}/coordinator`, admin, { coordinator_uuid: session.user.user_uuid })
      const after = await api<any>('GET', `/inbox/org/${orgId}`, admin)
      expect(after.unread, `${email} should not be notified about assigning themselves`).toBe(before.unread)
    } finally {
      await api('DELETE', `/training-programs/${tp.trainingprogram_uuid}`, admin)
    }
  })
})
