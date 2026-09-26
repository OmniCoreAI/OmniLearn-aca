'use client'

import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { apiFetch } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'

/** Palette lives in the shared dashboard theme; re-exported under the home's name. */
export { DASH_COLORS as HOME_COLORS } from '@components/Dashboard/Shared/dashPalette'

export type HomeUser = {
  user_uuid: string
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  avatar_image?: string | null
}

export type HomeCourse = {
  course_uuid: string
  name: string
  thumbnail_image: string
  published: boolean
  creation_date: string
  lessons: number
  enrollments: number
  completions: number
  learners?: HomeUser[]
}

export type HomeActivity = {
  type: 'enrollment' | 'completion' | 'course_created' | 'member_joined'
  timestamp: string
  user: HomeUser | null
  course: { course_uuid: string; name: string } | null
}

export type HomeOverview = {
  totals: {
    students: number
    members: number
    members_30d: number
    courses: number
    published_courses: number
    courses_30d: number
    enrollments: number
    enrollments_30d: number
    completions: number
  }
  enrollment_trend: { month: string; enrollments: number; completions: number; members: number; courses: number }[]
  activity_heatmap: { day: number; hour: number; count: number }[]
  top_courses: HomeCourse[]
  recent_courses: HomeCourse[]
  recent_activity: HomeActivity[]
}

/** Always fetch 12 months so range pickers can slice client-side without refetching. */
export function useHomeOverview() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgId = org?.id

  return useQuery<HomeOverview>({
    queryKey: ['dashboard-home', orgId],
    queryFn: () => apiFetch(`${getAPIUrl()}analytics/dashboard/home?org_id=${orgId}&months=12`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })
}

export function userDisplayName(user: HomeUser | null | undefined) {
  if (!user) return ''
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return full || user.username || ''
}

export function userAvatarUrl(user: HomeUser | null | undefined) {
  const avatar = user?.avatar_image
  if (!user || !avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  return getUserAvatarMediaDirectory(user.user_uuid, avatar)
}

/** "2026-03" → localized short month name. */
export function monthLabel(key: string, locale?: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString(locale, { month: 'short' })
}

/** Backend timestamps are naive local strings ("2026-09-26 14:33:55.51"). */
export function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}
