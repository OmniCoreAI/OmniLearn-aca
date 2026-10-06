/**
 * Smoke-crawl every section as each role and record what breaks: server
 * errors (5xx), unexpected API failures, uncaught page errors, console errors
 * and error screens. Detail pages use real ids from the running instance.
 *
 * Writes test-results/sweep-report.json; fails when any page has a 5xx or a
 * crash. Set SWEEP_STRICT=1 to also fail on 4xx / console errors.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { test, expect, Page } from '@playwright/test'
import { api, apiToken, Persona, signIn } from '../personas'

type Issue = { role: Persona; path: string; kind: string; detail: string }

const strip = (uuid: string | undefined, prefix: string) => (uuid || '').replace(`${prefix}_`, '')

async function ids() {
  const token = await apiToken('admin')
  const session = await api<any>('GET', '/users/session', token)
  const orgId: number = session.roles[0].org.id
  const slug: string = session.roles[0].org.slug
  const first = async (path: string) => {
    try {
      const data = await api<any>('GET', path, token)
      return Array.isArray(data) ? data[0] : (data?.items ?? data?.courses ?? [])[0]
    } catch {
      return undefined
    }
  }
  const course = await first(`/courses/org_slug/${slug}/page/1/limit/5?include_unpublished=true`)
  const program = await first(`/programs/org/${orgId}/page/1/limit/5`)
  const cohort = program ? await first(`/programs/${program.program_uuid}/cohorts`) : undefined
  const offering = await first(`/offerings?org_id=${orgId}`)
  const tp = await first(`/training-programs/org/${orgId}/page/1/limit/5`)
  const entity = await first(`/entities/org/${orgId}`)
  const instructor = await first(`/instructors/org/${orgId}`)
  const application = await first(`/admissions/applications?org_id=${orgId}`)
  const template = await first(`/certificate-templates/org/${orgId}`)
  return { course, program, cohort, offering, tp, entity, instructor, application, template, username: session.user.username }
}

function adminPaths(x: Awaited<ReturnType<typeof ids>>): string[] {
  const paths = [
    '/dash', '/dash/calendar', '/dash/courses', '/dash/assignments', '/dash/library', '/dash/boards', '/dash/playgrounds',
    '/dash/analytics', '/dash/finance', '/dash/cms/news', '/dash/training-programs', '/dash/my-entity',
    '/dash/postgraduate', '/dash/postgraduate/overview', '/dash/postgraduate/courses', '/dash/postgraduate/offerings',
    '/dash/postgraduate/admissions', '/dash/postgraduate/students', '/dash/postgraduate/calendar', '/dash/postgraduate/settings',
    '/dash/postgraduate/teaching',
    '/dash/administration', '/dash/administration/settings', '/dash/administration/settings/finance', '/dash/administration/roles',
    '/dash/administration/entities', '/dash/administration/entities/positions', '/dash/administration/entities/types',
    '/dash/administration/user-groups', '/dash/administration/facilities', '/dash/administration/facilities/locations',
    '/dash/administration/facilities/types', '/dash/administration/facilities/equipment', '/dash/administration/add-ons',
    '/dash/administration/add-ons/categories', '/dash/administration/add-ons/selections', '/dash/administration/communication',
    '/dash/administration/communication/sms', '/dash/administration/communication/settings', '/dash/administration/communication/log',
    '/dash/administration/certificates', '/dash/instructors', '/dash/instructors/categories', '/dash/instructors/finance',
    '/dash/users/settings/users', '/dash/users/settings/usergroups', '/dash/users/settings/roles', '/dash/users/settings/add',
    '/dash/org/settings/general', '/dash/org/settings/branding', '/dash/payments/customers',
  ]
  if (x.course) {
    for (const sub of ['general', 'content', 'access', 'delivery', 'contributors', 'certification', 'analytics']) {
      paths.push(`/dash/courses/course/${strip(x.course.course_uuid, 'course')}/${sub}`)
    }
  }
  if (x.program) paths.push(`/dash/postgraduate/${strip(x.program.program_uuid, 'program')}`)
  if (x.program && x.cohort) paths.push(`/dash/postgraduate/${strip(x.program.program_uuid, 'program')}/cohort/${strip(x.cohort.cohort_uuid, 'cohort')}`)
  if (x.offering) paths.push(`/dash/postgraduate/offerings/${strip(x.offering.offering_uuid, 'offering')}`)
  if (x.application) paths.push(`/dash/postgraduate/admissions/${strip(x.application.application_uuid, 'application')}`)
  if (x.tp) paths.push(`/dash/training-programs/${strip(x.tp.trainingprogram_uuid, 'trainingprogram')}`)
  if (x.entity) paths.push(`/dash/administration/entities/${x.entity.entity_uuid}`)
  if (x.instructor) for (const tab of ['', '?tab=courses', '?tab=assignments', '?tab=availability', '?tab=activity']) paths.push(`/dash/instructors/${x.instructor.instructor_uuid}${tab}`)
  if (x.template) paths.push(`/dash/administration/certificates/${x.template.template_uuid}`)
  return paths
}

const LEARNER_PATHS = [
  '/', '/courses', '/programs', '/trail', '/calendar', '/academics', '/admissions', '/library', '/search?q=a',
  '/account/general', '/account/profile', '/account/security', '/account/purchases', '/boards', '/playgrounds',
]

async function crawl(page: Page, role: Persona, paths: string[], issues: Issue[]) {
  let current = ''
  page.on('response', (res) => {
    const url = res.url()
    if (!url.includes('/api/v1/')) return
    const status = res.status()
    if (status >= 500) issues.push({ role, path: current, kind: '5xx', detail: `${status} ${res.request().method()} ${url.replace(/^.*\/api\/v1/, '')}` })
    else if (status >= 400 && status !== 401) issues.push({ role, path: current, kind: `${status}`, detail: `${res.request().method()} ${url.replace(/^.*\/api\/v1/, '')}` })
  })
  page.on('pageerror', (err) => issues.push({ role, path: current, kind: 'crash', detail: err.message.slice(0, 300) }))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Failed to load resource|favicon|React DevTools|Download the React/.test(text)) return
    issues.push({ role, path: current, kind: 'console', detail: text.slice(0, 300) })
  })
  for (const path of paths) {
    current = path
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
      const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
      if (/Unhandled Runtime Error|Application error|Something went wrong|This page could not be found|Page not found/i.test(body)) {
        issues.push({ role, path, kind: 'error-screen', detail: body.split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 200) })
      }
    } catch (e) {
      issues.push({ role, path, kind: 'navigation', detail: (e as Error).message.slice(0, 200) })
    }
  }
}

test('sweep every section as each role', async ({ browser }) => {
  test.setTimeout(30 * 60_000)
  const x = await ids()
  const plan: Record<Persona, string[]> = {
    admin: [...adminPaths(x), ...LEARNER_PATHS, x.course ? `/course/${strip(x.course.course_uuid, 'course')}` : '/', `/user/${x.username}`],
    instructor: ['/dash', '/dash/calendar', '/dash/postgraduate/teaching', '/dash/training-programs', '/dash/assignments', '/dash/library', ...LEARNER_PATHS],
    coordinator: ['/dash', '/dash/my-entity', '/dash/my-entity?tab=members', '/dash/my-entity?tab=groups', '/dash/my-entity?tab=training',
      '/dash/my-entity?tab=progress', '/dash/my-entity?tab=import', ...LEARNER_PATHS],
    trainee: [...LEARNER_PATHS, x.course ? `/course/${strip(x.course.course_uuid, 'course')}` : '/'],
  }
  const issues: Issue[] = []
  for (const role of Object.keys(plan) as Persona[]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await signIn(page, role)
    await crawl(page, role, plan[role], issues)
    await context.close()
  }
  const unique = issues.filter((v, i, all) => all.findIndex((o) => o.role === v.role && o.path === v.path && o.detail === v.detail) === i)
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/sweep-report.json', JSON.stringify(unique, null, 2))
  console.log(`Sweep: ${unique.length} issue(s) across ${Object.values(plan).flat().length} page visits — see test-results/sweep-report.json`)
  const blocking = unique.filter((i) => ['5xx', 'crash', 'error-screen'].includes(i.kind) || (process.env.SWEEP_STRICT && true))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})
