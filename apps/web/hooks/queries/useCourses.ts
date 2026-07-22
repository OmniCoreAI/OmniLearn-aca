'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getOrgCourses, getCourseMetadata } from '@services/courses/courses'

export function useCourses(orgSlug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.list(orgSlug),
    queryFn: () => getOrgCourses(orgSlug, {}, accessToken),
    enabled: !!orgSlug,
    staleTime: 60_000,
  })
}

/**
 * Admin-facing org courses (includes unpublished).
 * Shared by all dashboard home widgets so the course list
 * is fetched exactly once per page load.
 */
export function useAdminOrgCourses(orgSlug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: [...queryKeys.courses.list(orgSlug), 'admin'],
    queryFn: () => getOrgCourses(orgSlug, null, accessToken, true),
    enabled: !!orgSlug && !!accessToken,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
  })
}

export function useCourseMeta(courseUuid: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.meta(courseUuid),
    queryFn: () => getCourseMetadata(courseUuid, {}, accessToken, { slim: true }),
    enabled: !!courseUuid,
    staleTime: 60_000,
  })
}
