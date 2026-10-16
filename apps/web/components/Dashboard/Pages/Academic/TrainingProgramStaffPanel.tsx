'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, UserRound } from 'lucide-react'
import { Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { InstructorSelect } from '@components/Dashboard/Pages/Administration/Pickers'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { setTrainingProgramCoordinator, upsertCourseAcademicProfile } from '@services/academic/academic'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

function personName(u: any): string {
  if (!u) return ''
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || ''
}

function nextSession(sessions: any[]): any | null {
  const today = new Date().toISOString().slice(0, 10)
  return (
    [...(sessions || [])]
      .filter((s) => s.start_date && s.start_date.slice(0, 10) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] || null
  )
}

/**
 * Who runs and teaches a training program: its coordinator and the trainer of
 * each course (the course instructor, picked from the Instructors registry).
 */
export function TrainingProgramStaffPanel({
  orgslug,
  orgId,
  access_token,
  program,
  courses,
  onScheduleCourse,
}: {
  orgslug: string
  orgId: number
  access_token: string
  program: any
  courses: any[]
  onScheduleCourse: (_course: any) => void
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { rights } = useAdminStatus() as any
  const canEditProgram = rights?.training_programs?.action_update === true
  const canEditCourses = rights?.courses?.action_update === true
  const tp_uuid: string = program?.trainingprogram_uuid

  const refreshCourses = () =>
    queryClient.invalidateQueries({ queryKey: ['academic', 'training-program-courses', tp_uuid] })

  const saveCoordinator = async (uuid: string | null) => {
    try {
      await setTrainingProgramCoordinator(tp_uuid, uuid, access_token)
      queryClient.invalidateQueries({ queryKey: ['academic', 'training-program', tp_uuid] })
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const saveTrainer = async (course: any, instructor_uuid: string) => {
    try {
      await upsertCourseAcademicProfile(course.course_uuid, { instructor_uuid }, access_token)
      refreshCourses()
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const unstaffed = courses.filter((c) => !c.academic_profile?.instructor).length
  const when = (value: string) =>
    new Date(value).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: value.length > 10 ? '2-digit' : undefined, minute: value.length > 10 ? '2-digit' : undefined })

  return (
    <Section
      title={t('training.staff', 'Staff')}
      description={t('training.staff_desc', 'Who runs this program and who teaches each course. Trainers come from Administration → Instructors.')}
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))]">{t('training.coordinator', 'Coordinator')}</p>
          {canEditProgram ? (
            <CoordinatorPicker
              orgId={orgId}
              access_token={access_token}
              value={program?.coordinator?.user_uuid || null}
              selectedLabel={personName(program?.coordinator)}
              onChange={(uuid) => saveCoordinator(uuid)}
            />
          ) : (
            <p className="text-sm">{personName(program?.coordinator) || t('training.no_coordinator', 'No coordinator')}</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[hsl(var(--dash-muted))]">{t('training.trainers', 'Trainers by course')}</p>
            {unstaffed > 0 && (
              <span className="rounded-full bg-[hsl(var(--dash-warn-soft))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-warn))]">
                {t('training.courses_without_trainer', '{{count}} without a trainer', { count: unstaffed })}
              </span>
            )}
          </div>
          {courses.length === 0 ? (
            <p className="text-sm text-[hsl(var(--dash-muted))]">{t('training.add_courses_first', 'Add courses to assign their trainers.')}</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--dash-border))] rounded-xl border border-[hsl(var(--dash-border))]">
              {courses.map((course) => {
                const profile = course.academic_profile
                const trainer = profile?.instructor
                const sessions: any[] = profile?.sessions || []
                const next = nextSession(sessions)
                const guests = sessions.filter((s) => s.instructor).length
                return (
                  <li key={course.course_uuid} className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <div className="min-w-0">
                      <Link
                        href={getUriWithOrg(orgslug, `/dash/courses/course/${course.course_uuid.replace('course_', '')}/delivery`)}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {course.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => onScheduleCourse(course)}
                        className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        {sessions.length === 0
                          ? t('training.no_sessions', 'No sessions scheduled')
                          : [
                              t('training.n_sessions', '{{count}} sessions', { count: sessions.length }),
                              next ? t('training.next_session', 'next {{when}}', { when: when(next.start_date) }) : null,
                              guests ? t('training.n_guest_sessions', '{{count}} with a guest trainer', { count: guests }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                      </button>
                    </div>
                    {canEditCourses ? (
                      <InstructorSelect
                        className={cn(
                          'w-full rounded-lg border bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm',
                          trainer ? 'border-[hsl(var(--dash-border))]' : 'border-[hsl(var(--dash-warn))]/40'
                        )}
                        value={trainer?.user_uuid || ''}
                        onChange={(uuid) => saveTrainer(course, uuid)}
                        current={trainer ? { user_uuid: trainer.user_uuid, name: personName(trainer) } : null}
                        emptyLabel={t('training.no_trainer', 'No trainer yet')}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <UserRound className="h-4 w-4 text-[hsl(var(--dash-muted))]" />
                        {personName(trainer) || t('training.no_trainer', 'No trainer yet')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Section>
  )
}
