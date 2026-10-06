'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, AdminCard } from '@components/Dashboard/Pages/Administration/AdminUI'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Switch } from '@components/ui/switch'
import { getPortalNavigation, updatePortalNavigation } from '@services/portal-navigation/portal-navigation'
import { DASH_NAV_ITEMS, SECTION_LABELS, DashNavSection } from '@/lib/dash-nav-items'
import { cn } from '@/lib/utils'

const SECTION_ORDER: DashNavSection[] = ['overview', 'academic', 'teaching', 'manage', 'administration']

type RoleInfo = {
  uuid: string
  labelKey: string
  label: string
  landing: string
  homeKey: string
  home: string
  extraKey?: string
  extra?: string
}

// Keep in sync with DashboardHome (homes), lib/auth/landing.ts (landing) and OrgMenuLinks (learner header).
const ROLES: RoleInfo[] = [
  {
    uuid: 'role_global_admin',
    labelKey: 'roles_page.role_admin',
    label: 'Academy Admin',
    landing: '/dash',
    homeKey: 'roles_page.home_admin',
    home: 'Academy dashboard: KPIs, performance, top courses and instructors, activity and items that need attention.',
  },
  {
    uuid: 'role_global_maintainer',
    labelKey: 'roles_page.role_coordinator',
    label: 'Entity Coordinator',
    landing: '/dash',
    homeKey: 'roles_page.home_coordinator',
    home: 'My organization: learners, learning now, completion rate, training to assign, quick actions and who hasn’t started.',
  },
  {
    uuid: 'role_global_instructor',
    labelKey: 'roles_page.role_instructor',
    label: 'Instructor',
    landing: '/dash',
    homeKey: 'roles_page.home_instructor',
    home: 'My work: grades to submit, interviews, offerings they teach, their courses and training programs, and their calendar.',
  },
  {
    uuid: 'role_global_user',
    labelKey: 'roles_page.role_trainee',
    label: 'Trainee',
    landing: '/',
    homeKey: 'roles_page.home_trainee',
    home: 'Learner home: continue learning, what’s coming up, and the courses and programs open to them.',
    extraKey: 'roles_page.header_trainee',
    extra: 'Header: Courses · Programs · My learning · My calendar · My academics · Library (Programs and My academics only when there is something to show).',
  },
]

// Sidebar entries added by assignment, whatever the role's toggles.
const ASSIGNMENT_ITEMS = [
  { id: 'training-programs', key: 'roles_page.when_programs', fallback: 'when they coordinate or train a training program' },
  { id: 'postgraduate-teaching', key: 'roles_page.when_teaching', fallback: 'when they teach or assist a course offering' },
  { id: 'postgraduate', key: 'roles_page.when_program', fallback: 'when they coordinate a postgraduate program or cohort' },
]

/**
 * What each role sees: where they land, their home page and their sidebar.
 * Academy admins can look; only superadmins can change the sidebar toggles
 * (they are platform-wide).
 */
function RolesAndPortals({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token: string = session?.data?.tokens?.access_token
  const isSuperadmin = session?.data?.user?.is_superadmin === true
  const [roleUuid, setRoleUuid] = useState(ROLES[2].uuid)
  const [saving, setSaving] = useState(false)

  const { data: raw, isLoading, mutate } = useSWR(access_token ? ['portal-navigation'] : null, () =>
    getPortalNavigation(access_token)
  )
  const visibilityMap: Record<string, string[]> = (raw?.data ?? raw)?.visibility || {}
  const visible = new Set(visibilityMap[roleUuid] || [])
  const role = ROLES.find((r) => r.uuid === roleUuid)!
  const viaAssignment = ASSIGNMENT_ITEMS.filter((a) => !visible.has(a.id))

  const toggle = async (itemId: string, on: boolean) => {
    const next = new Set(visible)
    if (on) next.add(itemId)
    else next.delete(itemId)
    setSaving(true)
    try {
      await updatePortalNavigation(roleUuid, Array.from(next), access_token)
      await mutate()
      toast.success(t('administration.common.updated', 'Saved'))
    } catch {
      toast.error(t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.roles', 'Roles & portals') }]} />
      <AcademicHeader
        title={t('administration.nav.roles', 'Roles & portals')}
        subtitle={t('roles_page.subtitle', 'See exactly what each role gets: where they land, their home page and their sidebar.')}
      />

      <div role="tablist" className="mb-6 inline-flex flex-wrap gap-1 rounded-full bg-[hsl(var(--dash-canvas))] p-1">
        {ROLES.map((r) => (
          <button
            key={r.uuid}
            type="button"
            role="tab"
            aria-selected={roleUuid === r.uuid}
            onClick={() => setRoleUuid(r.uuid)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              roleUuid === r.uuid ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {t(r.labelKey, r.label)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <AdminCard title={t('roles_page.after_sign_in', 'After sign-in')}>
            <p className="font-mono text-sm">{role.landing}</p>
          </AdminCard>
          <AdminCard title={t('roles_page.home', 'Home page')}>
            <p className="text-sm text-[hsl(var(--dash-ink))]/80">{t(role.homeKey, role.home)}</p>
            {role.extra ? (
              <p className="mt-3 text-sm text-[hsl(var(--dash-muted))]">{t(role.extraKey!, role.extra)}</p>
            ) : null}
          </AdminCard>
          <AdminCard
            title={t('roles_page.sidebar_items', 'Sidebar items')}
            description={
              isSuperadmin
                ? t('roles_page.edit_hint', 'Changes apply to this role in every academy on the platform.')
                : t('roles_page.readonly_hint', 'Only a platform superadmin can change these.')
            }
          >
            {isLoading ? (
              <div className="dash-shimmer h-40 rounded-xl" />
            ) : (
              <div className="space-y-4">
                {SECTION_ORDER.map((section) => (
                  <div key={section}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]">
                      {t(SECTION_LABELS[section].key, SECTION_LABELS[section].fallback)}
                    </p>
                    <ul className="divide-y divide-[hsl(var(--dash-border))]">
                      {DASH_NAV_ITEMS.filter((i) => i.section === section).map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span>{t(item.labelKey, item.fallbackLabel)}</span>
                          <Switch
                            checked={visible.has(item.id)}
                            disabled={!isSuperadmin || saving}
                            onCheckedChange={(on) => toggle(item.id, on)}
                            aria-label={t(item.labelKey, item.fallbackLabel)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AdminCard title={t('roles_page.preview', 'Sidebar preview')}>
            {visible.size === 0 ? (
              <p className="text-sm text-[hsl(var(--dash-muted))]">
                {t('roles_page.no_sidebar', 'No dashboard sidebar — this role only uses the learner site.')}
              </p>
            ) : (
              <div className="space-y-3">
                {SECTION_ORDER.map((section) => {
                  const items = DASH_NAV_ITEMS.filter((i) => i.section === section && visible.has(i.id))
                  if (!items.length) return null
                  return (
                    <div key={section}>
                      <p className="px-2 text-[11px] font-semibold text-[hsl(var(--dash-muted))]">
                        {t(SECTION_LABELS[section].key, SECTION_LABELS[section].fallback)}
                      </p>
                      {items.map((i) => (
                        <p key={i.id} className="rounded-lg px-2 py-1 text-sm">
                          {t(i.labelKey, i.fallbackLabel)}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
            {viaAssignment.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-[hsl(var(--dash-border))] pt-3">
                {viaAssignment.map((a) => (
                  <p key={a.id} className="text-xs text-[hsl(var(--dash-muted))]">
                    +{' '}
                    {t(
                      DASH_NAV_ITEMS.find((i) => i.id === a.id)!.labelKey,
                      DASH_NAV_ITEMS.find((i) => i.id === a.id)!.fallbackLabel
                    )}{' '}
                    {t(a.key, a.fallback)}
                  </p>
                ))}
              </div>
            )}
          </AdminCard>
        </aside>
      </div>
    </AcademicPageShell>
  )
}

export default RolesAndPortals
