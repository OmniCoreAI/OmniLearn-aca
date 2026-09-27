/**
 * Registry of the dashboard sidebar (DashLeftMenu) sections/items.
 *
 * These `id`s are the shared vocabulary between the super-admin
 * portal-visibility toggles and the frontend sidebar/route-guard — keep
 * them in sync with `apps/api/src/security/rbac/nav_items.py`.
 */

export type DashNavSection = 'overview' | 'academic' | 'teaching' | 'manage' | 'administration'

export interface DashNavItemDef {
  id: string
  section: DashNavSection
  labelKey: string
  fallbackLabel: string
  /** Path prefix(es) this item covers, used for route guarding. */
  pathPrefixes: string[]
}

export const DASH_NAV_ITEMS: DashNavItemDef[] = [
  { id: 'home', section: 'overview', labelKey: 'common.home', fallbackLabel: 'Home', pathPrefixes: ['/dash'] },
  { id: 'calendar', section: 'overview', labelKey: 'calendar.title', fallbackLabel: 'Calendar', pathPrefixes: ['/dash/calendar'] },
  { id: 'postgraduate', section: 'academic', labelKey: 'academic.postgraduate_studies', fallbackLabel: 'Postgraduate Studies', pathPrefixes: ['/dash/postgraduate'] },
  { id: 'training-programs', section: 'academic', labelKey: 'academic.training_programs', fallbackLabel: 'Training Programs', pathPrefixes: ['/dash/training-programs'] },
  { id: 'finance', section: 'academic', labelKey: 'common.finance', fallbackLabel: 'Finance', pathPrefixes: ['/dash/finance'] },
  { id: 'cms-news', section: 'academic', labelKey: 'cms.news.title', fallbackLabel: 'News', pathPrefixes: ['/dash/cms/news'] },
  { id: 'postgraduate-teaching', section: 'teaching', labelKey: 'academic.my_teaching', fallbackLabel: 'My Teaching', pathPrefixes: ['/dash/postgraduate/teaching'] },
  { id: 'assignments', section: 'teaching', labelKey: 'common.assignments', fallbackLabel: 'Assignments', pathPrefixes: ['/dash/assignments'] },
  { id: 'library', section: 'teaching', labelKey: 'library.library', fallbackLabel: 'Library', pathPrefixes: ['/dash/library'] },
  { id: 'boards', section: 'teaching', labelKey: 'boards.boards', fallbackLabel: 'Boards', pathPrefixes: ['/dash/boards'] },
  { id: 'playgrounds', section: 'teaching', labelKey: 'common.playgrounds', fallbackLabel: 'Playgrounds', pathPrefixes: ['/dash/playgrounds'] },
  { id: 'users', section: 'manage', labelKey: 'common.users', fallbackLabel: 'Users', pathPrefixes: ['/dash/users'] },
  { id: 'payments', section: 'manage', labelKey: 'common.payments', fallbackLabel: 'Payments', pathPrefixes: ['/dash/payments'] },
  { id: 'organization', section: 'manage', labelKey: 'common.organization', fallbackLabel: 'Organization', pathPrefixes: ['/dash/org'] },
  { id: 'analytics', section: 'manage', labelKey: 'common.analytics', fallbackLabel: 'Analytics', pathPrefixes: ['/dash/analytics'] },
  // Administration & Configuration — reusable entities and settings.
  { id: 'administration', section: 'administration', labelKey: 'administration.nav.overview', fallbackLabel: 'Administration overview & settings', pathPrefixes: ['/dash/administration'] },
  { id: 'instructors', section: 'administration', labelKey: 'instructors.title', fallbackLabel: 'Instructors', pathPrefixes: ['/dash/instructors'] },
  { id: 'facilities', section: 'administration', labelKey: 'administration.nav.facilities', fallbackLabel: 'Facilities & Rooms', pathPrefixes: ['/dash/administration/facilities'] },
  { id: 'addons', section: 'administration', labelKey: 'administration.nav.addons', fallbackLabel: 'Add-ons', pathPrefixes: ['/dash/administration/add-ons'] },
]

export const DASH_NAV_ITEM_IDS = DASH_NAV_ITEMS.map((item) => item.id)

export const SECTION_LABELS: Record<DashNavSection, { key: string; fallback: string }> = {
  overview: { key: 'dashboard.home.nav.overview', fallback: 'Overview' },
  academic: { key: 'dashboard.home.nav.academic', fallback: 'Academic' },
  teaching: { key: 'dashboard.home.nav.teaching', fallback: 'Teaching' },
  manage: { key: 'dashboard.home.nav.manage', fallback: 'Manage' },
  administration: { key: 'dashboard.home.nav.administration', fallback: 'Administration & Configuration' },
}

/** Given a pathname, return the nav item id whose pathPrefixes matches it, if any. */
export function findNavItemForPath(pathname: string): DashNavItemDef | undefined {
  // Sort by prefix length descending so the most specific match wins
  // (e.g. '/dash/org' before the bare '/dash' item).
  const sorted = [...DASH_NAV_ITEMS].sort(
    (a, b) => Math.max(...b.pathPrefixes.map((p) => p.length)) - Math.max(...a.pathPrefixes.map((p) => p.length))
  )
  return sorted.find((item) =>
    item.pathPrefixes.some((prefix) => {
      if (prefix === '/dash') {
        return pathname === '/dash' || pathname === '/dash/'
      }
      return pathname === prefix || pathname.startsWith(prefix + '/')
    })
  )
}
