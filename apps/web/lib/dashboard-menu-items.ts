import {
  House,
  Files,
  Users,
  CurrencyCircleDollar,
  Buildings,
  ChalkboardSimple,
  Cube,
  GraduationCap,
  Certificate,
  ChalkboardTeacher,
} from '@phosphor-icons/react'

export interface DashboardMenuItem {
  id: string
  href: string
  icon: typeof House
  labelKey: string
  /** Feature key used for plan-based gating. If undefined, item is always shown. */
  featureKey?: string
  /** If true, the feature defaults to disabled (must be explicitly enabled). */
  defaultDisabled?: boolean
}

export const DASHBOARD_MENU_ITEMS: DashboardMenuItem[] = [
  {
    id: 'home',
    href: '/dash',
    icon: House,
    labelKey: 'common.home',
  },
  {
    id: 'postgraduate',
    href: '/dash/postgraduate',
    icon: GraduationCap,
    labelKey: 'academic.postgraduate_studies',
  },
  {
    id: 'training-programs',
    href: '/dash/training-programs',
    icon: Certificate,
    labelKey: 'academic.training_programs',
  },
  {
    id: 'instructors',
    href: '/dash/instructors',
    icon: ChalkboardTeacher,
    labelKey: 'instructors.title',
  },
  {
    id: 'assignments',
    href: '/dash/assignments',
    icon: Files,
    labelKey: 'common.assignments',
  },
  {
    id: 'boards',
    href: '/dash/boards',
    icon: ChalkboardSimple,
    labelKey: 'common.boards',
    featureKey: 'boards',
    defaultDisabled: true,
  },
  {
    id: 'playgrounds',
    href: '/dash/playgrounds',
    icon: Cube,
    labelKey: 'common.playgrounds',
    featureKey: 'playgrounds',
    defaultDisabled: true,
  },
  {
    id: 'users',
    href: '/dash/users/settings/users',
    icon: Users,
    labelKey: 'common.users',
  },
  {
    id: 'payments',
    href: '/dash/payments/overview',
    icon: CurrencyCircleDollar,
    labelKey: 'common.payments',
    featureKey: 'payments',
  },
  {
    id: 'organization',
    href: '/dash/org/settings/general',
    icon: Buildings,
    labelKey: 'common.organization',
  },
]
