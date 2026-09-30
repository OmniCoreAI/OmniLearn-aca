import React from 'react'
import {
  Buildings,
  Certificate,
  ChalkboardTeacher,
  EnvelopeSimple,
  Door,
  Package,
  SlidersHorizontal,
  SquaresFour,
  UsersThree,
} from '@phosphor-icons/react'

/**
 * Links of the "Administration & Configuration" sidebar section, shared by the
 * desktop (DashLeftMenu) and mobile (DashMobileMenu) menus. `navId` is the
 * portal-visibility item id (lib/dash-nav-items.ts ↔ api nav_items.py).
 */
export interface AdminNavLink {
  navId: string
  href: string
  labelKey: string
  fallback: string
  icon: (_size: number) => React.ReactNode
  /** Only highlight on the exact path (for the section's landing page). */
  exact?: boolean
}

export const ADMIN_NAV_LINKS: AdminNavLink[] = [
  {
    navId: 'administration',
    href: '/dash/administration',
    labelKey: 'administration.nav.overview_short',
    fallback: 'Overview',
    icon: (size) => <SquaresFour size={size} />,
    exact: true,
  },
  {
    navId: 'instructors',
    href: '/dash/instructors',
    labelKey: 'administration.nav.instructors',
    fallback: 'Instructors / Trainers',
    icon: (size) => <ChalkboardTeacher size={size} />,
  },
  {
    navId: 'facilities',
    href: '/dash/administration/facilities',
    labelKey: 'administration.nav.facilities',
    fallback: 'Facilities & Rooms',
    icon: (size) => <Door size={size} />,
  },
  {
    navId: 'addons',
    href: '/dash/administration/add-ons',
    labelKey: 'administration.nav.addons',
    fallback: 'Add-ons',
    icon: (size) => <Package size={size} />,
  },
  {
    navId: 'entities',
    href: '/dash/administration/entities',
    labelKey: 'administration.nav.entities',
    fallback: 'Organizations',
    icon: (size) => <Buildings size={size} />,
  },
  {
    // Same audience as Organizations; the page lists academy-wide and organization groups.
    navId: 'entities',
    href: '/dash/administration/user-groups',
    labelKey: 'administration.nav.user_groups',
    fallback: 'User groups',
    icon: (size) => <UsersThree size={size} />,
  },
  {
    navId: 'communication',
    href: '/dash/administration/communication',
    labelKey: 'administration.nav.communication',
    fallback: 'Communication',
    icon: (size) => <EnvelopeSimple size={size} />,
  },
  {
    navId: 'certificate-templates',
    href: '/dash/administration/certificates',
    labelKey: 'administration.nav.certificates',
    fallback: 'Certificates',
    icon: (size) => <Certificate size={size} />,
  },
  {
    navId: 'administration',
    href: '/dash/administration/settings',
    labelKey: 'administration.nav.settings',
    fallback: 'General Configuration',
    icon: (size) => <SlidersHorizontal size={size} />,
  },
]

export function isAdminLinkActive(link: AdminNavLink, pathname: string): boolean {
  if (link.exact) return pathname === link.href || pathname === `${link.href}/`
  return pathname === link.href || pathname.startsWith(`${link.href}/`)
}
