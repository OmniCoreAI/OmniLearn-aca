import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { Books, FolderSimple, Cube, ShoppingBag, GraduationCap, CalendarBlank } from '@phosphor-icons/react'
import { menuIcon } from '@components/Objects/Menus/menuIcons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'

type Builtin = { feature: string; link: string; labelKey: string; Icon: any }

const BUILTIN: Record<string, Builtin> = {
  courses: { feature: 'courses', link: '/courses', labelKey: 'courses.courses', Icon: Books },
  library: { feature: 'folders', link: '/library', labelKey: 'library.library', Icon: FolderSimple },
  playgrounds: { feature: 'playgrounds', link: '/playgrounds', labelKey: 'common.playgrounds', Icon: Cube },
  store: { feature: 'payments', link: '/store', labelKey: 'common.store', Icon: ShoppingBag },
  // Postgraduate student/applicant portal; shown to signed-in users only.
  academics: { feature: '', link: '/academics', labelKey: 'academic.my_academics', Icon: GraduationCap },
  // Role-aware events calendar (lectures, deadlines, exams); signed-in users only.
  calendar: { feature: '', link: '/calendar', labelKey: 'calendar.my_calendar', Icon: CalendarBlank },
}

// Default order when an org has no custom menu config.
const DEFAULT_ORDER = ['courses', 'library', 'playgrounds', 'store', 'academics', 'calendar']

function MenuLinks(props: { orgslug: string; primaryColor?: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const signedIn = session?.status === 'authenticated' || !!session?.data?.tokens?.access_token
  const colors = getMenuColorClasses(props.primaryColor || '')
  const branded = !!props.primaryColor
  const pathname = usePathname() || ''

  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const configItems: any[] | undefined =
    org?.config?.config?.customization?.menu?.items ?? org?.config?.config?.general?.menu?.items

  // Build the items to render (config-driven, else feature-driven defaults)
  const source =
    configItems && configItems.length
      ? [...configItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
