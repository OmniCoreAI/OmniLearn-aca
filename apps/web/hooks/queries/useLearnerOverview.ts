'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'

export type LearnerNextLesson = {
  activity_uuid: string
  name: string
  activity_type: string
  chapter_name: string | null
  est_minutes: number
}

export type LearnerCourse = {
  course_uuid: string
  name: string
  thumbnail_image: string | null
  code: string | null
  total_lessons: number
  completed_lessons: number
  progress: number
  completed: boolean
  started_at: string | null
  last_activity_at: string | null
  next_lesson: LearnerNextLesson | null
}

export type LearnerDay = { date: string; lessons: number; minutes: number }

export type LearnerEvent = {
  kind: 'lesson_completed' | 'course_started' | 'certificate' | 'assessment_graded' | 'assessment_submitted' | 'course_update'
  title: string
  course_uuid: string | null
  course_name: string | null
  activity_uuid: string | null
  ref: string | null
  grade: number | null
  at: string
}

export type LearnerAssessment = {
  assignment_uuid: string
  title: string
  course_uuid: string
  course_name: string
  activity_uuid: string | null
  due_date: string | null
  status: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE' | 'NOT_SUBMITTED'
  grade: number | null
  grading_type: string
  attempt_number: number
  updated_at: string | null
}

export type LearnerTotals = {
  courses: number
  in_progress: number
  completed_courses: number
  lessons_completed: number
  lessons_total: number
  learning_minutes: number
  minutes_estimated: boolean
  streak_days: number
  best_streak_days: number
  active_days_30: number
  certificates: number
  assessments_total: number
  assessments_completed: number
  average_score: number | null
  lessons_this_week: number
  lessons_last_week: number
  minutes_this_week: number
  minutes_last_week: number
}

export type LearnerOverview = {
  today: string
  totals: LearnerTotals
  courses: LearnerCourse[]
  days: LearnerDay[]
  recent: LearnerEvent[]
  assessments: LearnerAssessment[]
}

/**
 * The signed-in learner's own dashboard data. Keyed under the trail query so
 * everything that refreshes trail progress (finishing a lesson, enrolling)
 * refreshes this too.
 */
export function useLearnerOverview(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<LearnerOverview>({
    queryKey: [...queryKeys.trail.org(orgId!), 'overview'],
    queryFn: () => apiFetch(`${getAPIUrl()}trail/org/${orgId}/overview`, accessToken),
    enabled: !!orgId && !!accessToken,
    staleTime: 30_000,
  })
}
