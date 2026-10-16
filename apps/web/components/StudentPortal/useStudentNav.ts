'use client'

import type React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePathname } from 'next/navigation'
import {
  BookOpenText,
  Books,
  CalendarBlank,
  Certificate,
  Compass,
  Exam,
  Gear,
  GraduationCap,
  House,
  Medal,
  UserCircle,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getMyAcademicRecord, getMyApplications, getOpenIntakes } from '@services/academic/core'
import { getTrainingProgramCatalog } from '@services/academic/academic'
import { useModules } from '@/lib/modules'

export type StudentNavItem = {
  key: string
  href: string
  label: string
  Icon: React.ElementType
  active: boolean
}

/**
 * The student portal's navigation — only the learner's own pages, never
 * academy administration. Programs and My academics appear when the learner
 * has something there (same rule as the learner header).
 */
export default function useStudentNav(orgslug: string) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''

  const orgId: number | undefined = org?.id
  const token: string | undefined = session?.data?.tokens?.access_token
  const { isModuleEnabled } = useModules()
  const ready = !!orgId && !!token
  const query = { enabled: ready, staleTime: 5 * 60 * 1000, retry: false }
  // Sections switched off in the .env file: don't ask, don't show.
  const academicQuery = { ...query, enabled: ready && isModuleEnabled('postgraduate') }
  const { data: record } = useQuery({ queryKey: ['portal', 'record', orgId], queryFn: () => getMyAcademicRecord(orgId!, token!), ...academicQuery })
  const { data: applications } = useQuery({ queryKey: ['portal', 'applications', orgId], queryFn: () => getMyApplications(orgId!, token!), ...academicQuery })
  const { data: intakes } = useQuery({ queryKey: ['portal', 'intakes', orgId], queryFn: () => getOpenIntakes(orgId!, token!), ...academicQuery })
  const { data: programs } = useQuery({ queryKey: ['portal', 'training-programs', orgId], queryFn: () => getTrainingProgramCatalog(orgId!, token!), ...query, enabled: ready && isModuleEnabled('training_programs') })
  const listed = (v: any) => (Array.isArray(v) ? v.length > 0 : false)

  const rf = org?.config?.config?.resolved_features
  const libraryOn = rf?.folders?.enabled !== false

  // Paths without the org prefix (custom domains drop it; dev keeps /orgslug).
  const path = pathname.replace(new RegExp(`^/${orgslug}(?=/|$)`), '') || '/'
  const under = (...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + '/'))
  const href = (p: string) => getUriWithOrg(orgslug, p)

  const main: StudentNavItem[] = [
    { key: 'home', href: href('/'), label: t('student_portal.nav.home', 'Home'), Icon: House, active: path === '/' },
    { key: 'courses', href: href('/trail'), label: t('student_portal.nav.my_courses', 'My courses'), Icon: BookOpenText, active: under('/trail', '/course') },
    { key: 'calendar', href: href('/calendar'), label: t('student_portal.nav.calendar', 'Calendar'), Icon: CalendarBlank, active: under('/calendar') },
    { key: 'assessments', href: href('/assessments'), label: t('student_portal.nav.assessments', 'Assessments'), Icon: Exam, active: under('/assessments') },
    { key: 'certificates', href: href('/certificates'), label: t('student_portal.nav.certificates', 'Certificates'), Icon: Medal, active: under('/certificates') },
    ...(libraryOn
      ? [{ key: 'library', href: href('/library'), label: t('student_portal.nav.library', 'Library'), Icon: Books, active: under('/library') }]
      : []),
  ]

  const explore: StudentNavItem[] = [
    { key: 'browse', href: href('/courses'), label: t('student_portal.nav.browse', 'Browse courses'), Icon: Compass, active: under('/courses') },
    ...(listed(programs)
      ? [{ key: 'programs', href: href('/programs'), label: t('portal.programs.nav', 'Programs'), Icon: Certificate, active: under('/programs') }]
      : []),
    ...(listed(record?.memberships) || listed(applications) || listed(intakes)
      ? [{ key: 'academics', href: href('/academics'), label: t('academic.my_academics', 'My academics'), Icon: GraduationCap, active: under('/academics', '/admissions') }]
      : []),
  ]

  const account: StudentNavItem[] = [
    { key: 'profile', href: href('/account/general'), label: t('student_portal.nav.profile', 'Profile'), Icon: UserCircle, active: under('/account/general', '/account/profile', '/user') },
    { key: 'settings', href: href('/account/security'), label: t('student_portal.nav.settings', 'Settings'), Icon: Gear, active: under('/account/security', '/account/purchases') },
  ]

  return { main, explore, account }
}
