'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { removeCourse, startCourse } from '@services/courses/activity'
import { getOffersByResource } from '@services/payments/offers'
import { getUriWithOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg, useOrgMembership } from '@components/Contexts/OrgContext'
import { queryKeys } from '@/lib/query/keys'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

/** The learner's run for a course in the trail, if they have started it. */
export function findCourseRun(trailData: any, courseUuid: string | undefined) {
  const clean = courseUuid?.replace('course_', '')
  if (!clean || !Array.isArray(trailData?.runs)) return undefined
  return trailData.runs.find((run: any) => run.course?.course_uuid?.replace('course_', '') === clean)
}

/**
 * Start / leave a course, plus the paid offers linked to it. Shared by the
 * course page hero and the course actions card so both behave the same.
 */
export function useCourseEnrollment({
  course,
  courseuuid,
  orgslug,
  trailData,
}: {
  course: any
  courseuuid: string
  orgslug: string
  trailData?: any
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useLHSession() as any
  const org = useOrg() as any
  const { isUserPartOfTheOrg } = useOrgMembership()
  const queryClient = useQueryClient()
  const { track } = useOmniLearnAnalytics('learner')
  const [isActionLoading, setIsActionLoading] = useState(false)

  const cleanCourseUuid = course?.course_uuid?.replace('course_', '')
  const resourceUuid = cleanCourseUuid ? `course_${cleanCourseUuid}` : null
  const run = findCourseRun(trailData, course?.course_uuid)
  const isStarted = !!run

  // Public endpoint — no auth needed, works for unauthenticated visitors too
  const { data: offersResult, isLoading: offersLoading } = useQuery({
    queryKey: ['offers', 'by-resource', org?.id, resourceUuid],
    queryFn: () => getOffersByResource(org.id, resourceUuid!),
    enabled: !!org && !!resourceUuid,
    staleTime: 60_000,
  })
  const linkedOffers: any[] = offersResult?.data ?? []

  const handleCourseAction = async () => {
    if (!session.data?.user) {
      track(AnalyticsEvent.CourseSignupPrompted, {
        reason: 'unauthenticated',
        intended_action: isStarted ? 'leave_course' : 'start_course',
      })
      router.push(getUriWithOrg(orgslug, '/signup'))
      return
    }

    if (!isUserPartOfTheOrg) {
      router.push(getUriWithOrg(orgslug, '/signup'))
      return
    }

    setIsActionLoading(true)
    const loadingToast = toast.loading(isStarted ? t('courses.leave_course') + '...' : t('courses.start_course') + '...')

    try {
      if (isStarted) {
        await removeCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
        if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
        track(AnalyticsEvent.CourseLeft, { course_uuid: cleanCourseUuid })
        toast.success(t('courses.leave_course_success'), { id: loadingToast })
      } else {
        await startCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
        if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
        track(AnalyticsEvent.CourseStarted, {
          course_uuid: cleanCourseUuid,
          total_activities: course?.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 0,
          has_offers: linkedOffers.length > 0,
        })
        toast.success(t('courses.start_course_success'), { id: loadingToast })

        // Go straight to the first lesson.
        const firstActivity = course?.chapters?.[0]?.activities?.[0]
        if (firstActivity) {
          router.push(
            getUriWithOrg(orgslug, '') + `/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`
          )
        }
      }
    } catch (error) {
      console.error('Failed to perform course action:', error)
      toast.error(isStarted ? t('courses.leave_course_error') : t('courses.start_course_error'), { id: loadingToast })
    } finally {
      setIsActionLoading(false)
    }
  }

  return {
    run,
    isStarted,
    linkedOffers,
    offersLoading,
    isActionLoading,
    handleCourseAction,
    isSignedIn: !!session.data?.user,
    isUserPartOfTheOrg,
  }
}
