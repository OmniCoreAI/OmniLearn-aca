import React from 'react'
import {
  Books,
  CalendarDots,
  ChalkboardTeacher,
  ClipboardText,
  Gauge,
  GraduationCap,
  SlidersHorizontal,
  Student,
} from '@phosphor-icons/react'

/**
 * Pages of the Postgraduate Studies section, grouped the way a university's
 * graduate school is run: academic affairs, student affairs and the registrar.
 * Shared by the sidebar section (DashLeftMenu) and the in-page tabs (PostgradTabs).
 */
export const POSTGRAD_BASE = '/dash/postgraduate'

const SUB_PAGES = ['/overview', '/admissions', '/courses', '/offerings', '/students', '/calendar', '/settings', '/teaching']

/** The part of the path after /dash/postgraduate ('' on the programs home). */
function restOf(pathname: string): string | null {
  const at = pathname.indexOf(POSTGRAD_BASE)
  if (at === -1) return null
  const rest = pathname.slice(at + POSTGRAD_BASE.length)
  return rest === '' || rest.startsWith('/') ? rest : null
}

/** Programs own the section root and every program / cohort / curriculum page under it. */
export function isPostgradProgramsPath(pathname: string): boolean {
  const rest = restOf(pathname)
  return rest !== null && !SUB_PAGES.some((sub) => rest === sub || rest.startsWith(`${sub}/`))
}

export interface PostgradNavLink {
  key: string
  href: string
  labelKey: string
  fallback: string
  Icon: React.ElementType
  isActive: (_pathname: string) => boolean
}

export interface PostgradNavGroup {
  key: string
  /** Empty for the unlabelled group at the top (the office overview). */
  labelKey: string
  fallback: string
  links: PostgradNavLink[]
}

const subPage = (key: string, sub: string, labelKey: string, fallback: string, Icon: React.ElementType): PostgradNavLink => ({
  key,
  href: `${POSTGRAD_BASE}${sub}`,
  labelKey,
  fallback,
  Icon,
  isActive: (pathname) => {
    const rest = restOf(pathname)
    return rest !== null && (rest === sub || rest.startsWith(`${sub}/`))
  },
})

export const POSTGRAD_NAV_GROUPS: PostgradNavGroup[] = [
  {
    key: 'office',
    labelKey: '',
    fallback: '',
    links: [subPage('overview', '/overview', 'academic.nav.overview', 'Overview', Gauge)],
  },
  {
    key: 'academic',
    labelKey: 'academic.nav.academic_affairs',
    fallback: 'Academic affairs',
    links: [
      { key: 'programs', href: POSTGRAD_BASE, labelKey: 'academic.tab_programs', fallback: 'Programs', Icon: GraduationCap, isActive: isPostgradProgramsPath },
      subPage('courses', '/courses', 'academic.tab_catalog', 'Course Catalog', Books),
      subPage('offerings', '/offerings', 'academic.tab_offerings', 'Course Offerings', ChalkboardTeacher),
    ],
  },
  {
    key: 'students',
    labelKey: 'academic.nav.student_affairs',
    fallback: 'Student affairs',
    links: [
      subPage('admissions', '/admissions', 'academic.tab_admissions', 'Admissions', ClipboardText),
      subPage('students', '/students', 'academic.tab_students', 'Students', Student),
    ],
  },
  {
    key: 'registrar',
    labelKey: 'academic.nav.registrar',
    fallback: 'Registrar',
    links: [
      subPage('calendar', '/calendar', 'academic.tab_calendar', 'Academic Calendar', CalendarDots),
      subPage('settings', '/settings', 'academic.nav.grading_settings', 'Grading & settings', SlidersHorizontal),
    ],
  },
]

export const POSTGRAD_NAV_LINKS: PostgradNavLink[] = POSTGRAD_NAV_GROUPS.flatMap((group) => group.links)

/** Today's term: the most specific dated term that contains today (named terms before catch-all ones). */
export function pickCurrentTerm(terms: any[], today = new Date()): any | null {
  const day = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).getTime() : NaN)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const current = (terms || []).filter((term) => {
    const start = day(term.start_date)
    const end = day(term.end_date)
    return Number.isFinite(start) && Number.isFinite(end) ? start <= now && now <= end : term.status === 'in_progress'
  })
  const span = (term: any) => day(term.end_date) - day(term.start_date) || Number.MAX_SAFE_INTEGER
  return current.sort((a, b) => Number(a.term_type === 'custom') - Number(b.term_type === 'custom') || span(a) - span(b))[0] || null
}

/** "Week 6 of 16" numbers and how far through the term today is (0–1). */
export function termProgress(term: any, today = new Date()) {
  const start = new Date(`${String(term?.start_date).slice(0, 10)}T00:00:00`).getTime()
  const end = new Date(`${String(term?.end_date).slice(0, 10)}T00:00:00`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const DAY = 86_400_000
  const totalWeeks = Math.max(1, Math.ceil((end - start + DAY) / (7 * DAY)))
  const week = Math.min(totalWeeks, Math.max(1, Math.floor((now - start) / (7 * DAY)) + 1))
  return { week, totalWeeks, ratio: Math.min(1, Math.max(0, (now - start) / Math.max(DAY, end - start))) }
}
