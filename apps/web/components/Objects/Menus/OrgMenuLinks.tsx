import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { Books, FolderSimple, Cube, ShoppingBag, GraduationCap, CalendarBlank, Signpost } from '@phosphor-icons/react'
import { menuIcon } from '@components/Objects/Menus/menuIcons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMyAcademicRecord, getMyApplications, getOpenIntakes } from '@services/academic/core'
import { useTranslation } from 'react-i18next'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'

type Builtin = { feature: string; link: string; labelKey: string; Icon: any }

const BUILTIN: Record<string, Builtin> = {
  courses: { feature: 'courses', link: '/courses', labelKey: 'courses.courses', Icon: Books },
  // The learner's progress and certificates; signed-in users only.
  learning: { feature: '', link: '/trail', labelKey: 'workspace.my_learning', Icon: Signpost },
  library: { feature: 'folders', link: '/library', labelKey: 'library.library', Icon: FolderSimple },
  playgrounds: { feature: 'playgrounds', link: '/playgrounds', labelKey: 'common.playgrounds', Icon: Cube },
  store: { feature: 'payments', link: '/store', labelKey: 'common.store', Icon: ShoppingBag },
  // Postgraduate student/applicant portal; shown to signed-in users only.
  academics: { feature: '', link: '/academics', labelKey: 'academic.my_academics', Icon: GraduationCap },
  // Role-aware events calendar (lectures, deadlines, exams); signed-in users only.
  calendar: { feature: '', link: '/calendar', labelKey: 'calendar.my_calendar', Icon: CalendarBlank },
}

// Default order when an org has no custom menu config.
const DEFAULT_ORDER = ['courses', 'learning', 'calendar', 'academics', 'library', 'playgrounds', 'store']
// Signed-in pages added after an org saved its menu: appended unless the
// saved menu lists them (enabled or not).
const SIGNED_IN_ITEMS = ['learning', 'calendar', 'academics']

function MenuLinks(props: { orgslug: string; primaryColor?: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const signedIn = session?.status === 'authenticated' || !!session?.data?.tokens?.access_token
  const colors = getMenuColorClasses(props.primaryColor || '')
  const branded = !!props.primaryColor
  const pathname = usePathname() || ''

  // "My academics" only for postgraduate students, applicants, or while admissions are open.
  const orgId: number | undefined = org?.id
  const token: string | undefined = session?.data?.tokens?.access_token
  const portalReady = signedIn && !!orgId && !!token
  const portalQuery = { enabled: portalReady, staleTime: 5 * 60 * 1000, retry: false }
  const { data: record } = useQuery({ queryKey: ['portal', 'record', orgId], queryFn: () => getMyAcademicRecord(orgId!, token!), ...portalQuery })
  const { data: applications } = useQuery({ queryKey: ['portal', 'applications', orgId], queryFn: () => getMyApplications(orgId!, token!), ...portalQuery })
  const { data: intakes } = useQuery({ queryKey: ['portal', 'intakes', orgId], queryFn: () => getOpenIntakes(orgId!, token!), ...portalQuery })
  const listed = (v: any) => (Array.isArray(v) ? v.length > 0 : false)
  const showAcademics = listed(record?.memberships) || listed(applications) || listed(intakes)

  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const configItems: any[] | undefined =
    org?.config?.config?.customization?.menu?.items ?? org?.config?.config?.general?.menu?.items

  // Build the items to render (config-driven, else feature-driven defaults)
  const source =
    configItems && configItems.length
      ? [
          ...[...configItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
          ...SIGNED_IN_ITEMS.filter((type) => !configItems.some((c) => c.type === type)).map((type) => ({
            type,
            enabled: true,
            label: '',
            url: '',
          })),
        ]
      : DEFAULT_ORDER.map((type, i) => ({ type, enabled: true, order: i, label: '', url: '' }))

  const rendered = source
    .map((item: any) => {
      if (item.type === 'custom') {
        if (!item.enabled || !item.url) return null
        const external = /^https?:\/\//i.test(item.url)
        return {
          key: `custom-${item.url}`,
          label: item.label || item.url,
          Icon: menuIcon(item.icon),
          href: external ? item.url : getUriWithOrg(props.orgslug, item.url),
          external,
        }
      }
      const meta = BUILTIN[item.type]
      if (!meta) return null
      if (!item.enabled) return null
      if (meta.feature ? !isEnabled(meta.feature) : !signedIn) return null // plan/feature (or sign-in) gating
      if (item.type === 'academics' && !showAcademics) return null
      return {
        key: item.type,
        label: item.label || t(meta.labelKey),
        Icon: meta.Icon,
        href: getUriWithOrg(props.orgslug, meta.link),
        external: false,
      }
    })
    .filter(Boolean) as any[]

  const isActive = (href: string) => {
    const path = href.replace(/^https?:\/\/[^/]+/, '')
    return path !== '/' && (pathname === path || pathname.startsWith(path + '/'))
  }

  return (
    <div className="ps-1">
      <ul className="flex items-center gap-1">
        {rendered.map((it) => {
          const active = !it.external && isActive(it.href)
          const content = (
            <li
              className={
                branded
                  ? `flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${colors.text} ${colors.hoverBg} ${active ? 'bg-black/10' : ''}`
                  : `flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-ink))]'
                        : 'text-[hsl(var(--dash-ink))]/70 hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
                    }`
              }
            >
              <it.Icon
                size={18}
                weight={active ? 'fill' : 'regular'}
                className={!branded && active ? 'text-[hsl(var(--dash-accent))]' : undefined}
              />
              <span>{it.label}</span>
            </li>
          )
          return it.external ? (
            <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer">{content}</a>
          ) : (
            <Link key={it.key} href={it.href}>{content}</Link>
          )
        })}
      </ul>
    </div>
  )
}

export default MenuLinks
