'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUUpLeft,
  BookOpen,
  Certificate,
  ChalkboardTeacher,
  Exam,
  Student,
  VideoCamera,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import { getMyInterviews, getMyOfferings, displayName } from '@services/academic/core'
import { getMyAssignments } from '@services/instructors/instructors'
import { getUriWithOrg } from '@services/config/config'
import { HomeCard, EmptyState } from './HomeCard'
import { ViewAllLink, WorkBadge, WorkListSkeleton, WorkRow, shortDate } from './WorkspaceUI'

const CURRENT_STATES = ['planned', 'open', 'in_progress']

/** Dashboard home for the Instructor role: their own teaching, not academy-wide analytics. */
export default function InstructorHome() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const orgId: number | undefined = org?.id
  const orgslug: string = org?.slug
  const token: string = session?.data?.tokens?.access_token
  const ready = !!orgId && !!token

  const offeringsQ = useQuery({
    queryKey: ['academic', 'my-offerings', orgId],
    queryFn: () => getMyOfferings(orgId!, token),
    enabled: ready,
  })
  const interviewsQ = useQuery({
    queryKey: ['academic', 'my-interviews', orgId],
    queryFn: () => getMyInterviews(orgId!, token),
    enabled: ready,
  })
  const assignmentsQ = useQuery({
    queryKey: ['instructors', 'my-assignments', orgId],
    queryFn: () => getMyAssignments(orgId!, token),
    enabled: ready,
  })

  const offerings = (Array.isArray(offeringsQ.data) ? offeringsQ.data : []) as any[]
  const interviews = (Array.isArray(interviewsQ.data) ? interviewsQ.data : []) as any[]
  const courses = (assignmentsQ.data?.courses ?? []) as any[]
  const programs = (assignmentsQ.data?.training_programs ?? []) as any[]

  const current = offerings.filter((o) => CURRENT_STATES.includes(o.status))
  const returned = current.filter((o) => o.grade_status === 'returned')
  const toGrade = current.filter((o) => o.status === 'in_progress' && o.grade_status === 'open')
  const toEvaluate = interviews.filter((i) => i.can_evaluate && i.status === 'scheduled')
  const students = current.reduce((sum, o) => sum + (o.enrolled_count || 0), 0)
  const loading = offeringsQ.isLoading || interviewsQ.isLoading || assignmentsQ.isLoading

  const href = (path: string) => getUriWithOrg(orgslug, path)
  const offeringHref = (o: any) => href(`/dash/postgraduate/teaching/offerings/${o.offering_uuid.replace('offering_', '')}`)
  const sourceLabel: Record<string, string> = {
    profile: t('workspace.source_profile', 'Instructor'),
    offering: t('workspace.source_offering', 'Offering'),
    author: t('workspace.source_author', 'Co-author'),
  }
  const attention = returned.length + toGrade.length + toEvaluate.length

  return (
    <div className="flex flex-col gap-5">
      <DashStatCards
        loading={loading}
        stats={[
          { key: 'teaching', label: t('academic.teaching_now', 'Teaching now'), value: current.length, icon: ChalkboardTeacher, tone: 'rose', href: href('/dash/postgraduate/teaching') },
          { key: 'students', label: t('academic.students', 'Students'), value: students, icon: Student, tone: 'stone' },
          { key: 'grades', label: t('academic.grades_to_submit', 'Grades to submit'), value: toGrade.length + returned.length, icon: Exam, tone: 'gold' },
          { key: 'interviews', label: t('academic.interviews_to_evaluate', 'Interviews to evaluate'), value: toEvaluate.length, icon: VideoCamera, tone: 'sand' },
        ]}
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 @3xl:col-span-7">
          <HomeCard
            title={t('academic.needs_attention', 'Needs your attention')}
            subtitle={attention ? t('workspace.items_waiting', '{{count}} waiting for you', { count: attention }) : undefined}
          >
            {loading ? (
              <WorkListSkeleton />
            ) : attention === 0 ? (
              <EmptyState>{t('workspace.all_caught_up', "You're all caught up. Nothing is waiting for you.")}</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {returned.map((o) => (
                  <WorkRow
                    key={`r-${o.offering_uuid}`}
                    href={offeringHref(o)}
                    icon={ArrowUUpLeft}
                    tone="urgent"
                    title={`${o.course_code} · ${t('academic.grades_returned_to_you', 'grades returned for changes')}`}
                    meta={o.grade_note || undefined}
                    action={t('academic.open_gradebook', 'Open gradebook')}
                  />
                ))}
                {toGrade.map((o) => (
                  <WorkRow
                    key={`g-${o.offering_uuid}`}
                    href={offeringHref(o)}
                    icon={Exam}
                    title={`${o.course_code} · ${t('workspace.submit_grades', 'submit grades for approval')}`}
                    meta={[o.course_name, o.term_code].filter(Boolean).join(' · ')}
                    action={t('academic.open_gradebook', 'Open gradebook')}
                  />
                ))}
                {toEvaluate.map((i) => (
                  <WorkRow
                    key={i.interview_uuid}
                    href={href('/dash/postgraduate/teaching')}
                    icon={VideoCamera}
                    title={`${t('academic.interview_with', 'Interview with')} ${displayName(i.applicant)}`}
                    meta={[i.program_name, i.location].filter(Boolean).join(' · ')}
                    action={t('academic.evaluate', 'Evaluate')}
                  />
                ))}
              </ul>
            )}
          </HomeCard>
        </div>

        <div className="col-span-12 @3xl:col-span-5">
          <HomeCard
            title={t('academic.teaching_now', 'Teaching now')}
            action={<ViewAllLink href={href('/dash/postgraduate/teaching')} label={t('academic.my_teaching', 'My Teaching')} />}
          >
            {loading ? (
              <WorkListSkeleton />
            ) : current.length === 0 ? (
              <EmptyState>{t('workspace.no_offerings', 'No course offerings assigned to you this term.')}</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {current.map((o) => (
                  <WorkRow
                    key={o.offering_uuid}
                    href={offeringHref(o)}
                    icon={ChalkboardTeacher}
                    title={`${o.course_code} · ${o.course_name}`}
                    meta={[o.term_code, t('workspace.n_students', '{{count}} students', { count: o.enrolled_count || 0 })].join(' · ')}
                  />
                ))}
              </ul>
            )}
          </HomeCard>
        </div>

        <div className="col-span-12 @2xl:col-span-6">
          <HomeCard title={t('workspace.my_courses', 'My courses')} subtitle={t('workspace.my_courses_desc', 'Courses you teach or help write')}>
            {loading ? (
              <WorkListSkeleton />
            ) : courses.length === 0 ? (
              <EmptyState>{t('workspace.no_courses', 'When the academy adds you to a course, it shows up here.')}</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {courses.map((c) => (
                  <WorkRow
                    key={c.course_uuid}
                    href={href(`/dash/courses/course/${c.course_uuid.replace('course_', '')}/content`)}
                    icon={BookOpen}
                    title={c.name}
                    meta={c.published ? t('workspace.published', 'Published') : t('workspace.draft', 'Draft')}
                    badge={<WorkBadge>{sourceLabel[c.source] || c.source}</WorkBadge>}
                  />
                ))}
              </ul>
            )}
          </HomeCard>
        </div>

        <div className="col-span-12 @2xl:col-span-6">
          <HomeCard title={t('workspace.my_programs', 'My training programs')} subtitle={t('workspace.my_programs_desc', 'Programs you coordinate or deliver')}>
            {loading ? (
              <WorkListSkeleton />
            ) : programs.length === 0 ? (
              <EmptyState>{t('workspace.no_programs', 'No training programs assigned to you yet.')}</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {programs.map((p) => {
                  const dates = [shortDate(p.start_date, i18n.language), shortDate(p.end_date, i18n.language)].filter(Boolean).join(' – ')
                  return (
                    <WorkRow
                      key={p.trainingprogram_uuid}
                      href={href(`/dash/training-programs/${p.trainingprogram_uuid.replace('trainingprogram_', '')}`)}
                      icon={Certificate}
                      title={p.name}
                      meta={dates || t('workspace.no_dates', 'No dates yet')}
                      badge={
                        <WorkBadge tone={p.role === 'coordinator' ? 'accent' : 'muted'}>
                          {p.role === 'coordinator' ? t('workspace.role_coordinator', 'Coordinator') : t('workspace.role_staff', 'Team')}
                        </WorkBadge>
                      }
                    />
                  )
                })}
              </ul>
            )}
          </HomeCard>
        </div>
      </div>
    </div>
  )
}
