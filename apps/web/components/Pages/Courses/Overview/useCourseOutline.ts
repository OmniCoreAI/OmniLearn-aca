'use client'

import { useMemo } from 'react'
import { Article, ClipboardText, FileText, PlayCircle, BookOpenText } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { findCourseRun } from '@components/Objects/Courses/CourseActions/useCourseEnrollment'

export type LessonState = 'done' | 'next' | 'todo' | 'locked'

export type OutlineLesson = {
  activity: any
  uuid: string
  /** "2.3": chapter and lesson number. */
  number: string
  href: string
  state: LessonState
  isCurrent: boolean
}

export type OutlineChapter = {
  chapter: any
  key: string
  number: number
  lessons: OutlineLesson[]
  done: number
  total: number
  locked: boolean
  containsNext: boolean
}

/** Icon and label key for each activity type. */
export const ACTIVITY_TYPES: Record<string, { icon: typeof PlayCircle; labelKey: string }> = {
  TYPE_VIDEO: { icon: PlayCircle, labelKey: 'activities.video' },
  TYPE_DOCUMENT: { icon: FileText, labelKey: 'activities.document' },
  TYPE_DYNAMIC: { icon: Article, labelKey: 'activities.page' },
  TYPE_ASSIGNMENT: { icon: ClipboardText, labelKey: 'activities.assignment' },
}
export const activityType = (type: string) =>
  ACTIVITY_TYPES[type] ?? { icon: BookOpenText, labelKey: 'activities.learning_material' }

/**
 * Chapters and lessons with the learner's state for each lesson: done,
 * next up (the first unfinished lesson they can open), still to do, or locked.
 */
export function useCourseOutline({
  course,
  courseuuid,
  orgslug,
  trailData,
  currentActivity,
}: {
  course: any
  courseuuid: string
  orgslug: string
  trailData?: any
  currentActivity?: string
}) {
  return useMemo(
    () => buildCourseOutline(course, courseuuid, orgslug, trailData, currentActivity),
    [course, courseuuid, orgslug, trailData, currentActivity]
  )
}

function buildCourseOutline(course: any, courseuuid: string, orgslug: string, trailData: any, currentActivity?: string) {
  const run = findCourseRun(trailData, course?.course_uuid)
  const doneIds = new Set<string>(
    (Array.isArray(run?.steps) ? run.steps : [])
      .filter((step: any) => step.complete !== false)
      .map((step: any) => String(step.activity_id))
  )
  const base = getUriWithOrg(orgslug, '')
  let nextFound = false

  const chapters: OutlineChapter[] = (course?.chapters ?? []).map((chapter: any, ci: number) => {
    let containsNext = false
    const lessons: OutlineLesson[] = (chapter.activities ?? []).map((activity: any, ai: number) => {
      const uuid = String(activity.activity_uuid ?? '').replace('activity_', '')
      const locked = !!activity.is_locked
      let state: LessonState = locked ? 'locked' : doneIds.has(String(activity.id)) ? 'done' : 'todo'
      if (state === 'todo' && !nextFound) {
        state = 'next'
        nextFound = true
        containsNext = true
      }
      return {
        activity,
        uuid,
        number: `${ci + 1}.${ai + 1}`,
        href: `${base}/course/${courseuuid}/activity/${uuid}`,
        state,
        isCurrent: !!currentActivity && currentActivity === uuid,
      }
    })
    return {
      chapter,
      key: chapter.chapter_uuid || `chapter-${ci}`,
      number: ci + 1,
      lessons,
      done: lessons.filter((l) => doneIds.has(String(l.activity.id))).length,
      total: lessons.length,
      locked: !!chapter.is_locked,
      containsNext,
    }
  })

  const all = chapters.flatMap((c) => c.lessons)
  const total = all.length
  const done = chapters.reduce((sum, c) => sum + c.done, 0)
  const next = all.find((l) => l.state === 'next') ?? null
  return {
    run,
    isStarted: !!run,
    chapters,
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    isComplete: total > 0 && done >= total,
    chaptersDone: chapters.filter((c) => c.total > 0 && c.done >= c.total).length,
    next,
    nextChapter: next ? chapters.find((c) => c.lessons.includes(next)) ?? null : null,
    firstOpen: all.find((l) => l.state !== 'locked') ?? null,
  }
}

export type CourseOutline = ReturnType<typeof buildCourseOutline>
