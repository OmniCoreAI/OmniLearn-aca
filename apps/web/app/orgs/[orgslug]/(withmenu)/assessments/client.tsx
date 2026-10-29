'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarBlank, Exam } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'
import { Segmented } from '@components/Dashboard/Home/HomeCard'
import { getUriWithOrg } from '@services/config/config'
import { useLearnerOverview, type LearnerAssessment } from '@/hooks/queries/useLearnerOverview'
import { EmptyState, Panel, coursePath, lessonPath, useFormats } from '@components/StudentPortal/Dashboard/ui'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'open' | 'submitted' | 'graded'

const isOpen = (a: LearnerAssessment) => a.status === 'PENDING' || a.status === 'NOT_SUBMITTED' || a.status === 'LATE'

/** The assessments in the learner's courses: what's open, what's submitted, and their grades. */
export default function MyAssessments({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const signedIn = !!session?.data?.tokens?.access_token
  const fmt = useFormats()
  const { data, isLoading } = useLearnerOverview(signedIn ? org?.id : undefined)
  const [filter, setFilter] = useState<Filter>('all')

  const all = useMemo(() => data?.assessments ?? [], [data])
  const counts = {
    open: all.filter(isOpen).length,
    submitted: all.filter((a) => a.status === 'SUBMITTED').length,
    graded: all.filter((a) => a.status === 'GRADED').length,
  }
  const shown = all.filter((a) =>
    filter === 'all' ? true : filter === 'open' ? isOpen(a) : filter === 'submitted' ? a.status === 'SUBMITTED' : a.status === 'GRADED'
  )

  const statusChip = (a: LearnerAssessment) => {
    const overdue = isOpen(a) && !!a.due_date && new Date(a.due_date) < new Date()
    if (a.status === 'GRADED') return { label: t('student_portal.assessments.graded', 'Graded'), cls: 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_26%)]' }
    if (a.status === 'SUBMITTED') return { label: t('student_portal.assessments.submitted', 'Submitted'), cls: 'bg-[hsl(212_70%_94%)] text-[hsl(212_65%_36%)]' }
    if (overdue || a.status === 'LATE') return { label: t('student_portal.assessments.overdue', 'Overdue'), cls: 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]' }
    return { label: t('student_portal.assessments.open', 'To do'), cls: 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(36_80%_28%)]' }
  }

  if (!signedIn) {
    return (
      <GeneralWrapperStyled>
        <PortalHeader title={t('student_portal.assessments.title', 'My assessments')} />
        <SignInPrompt orgslug={orgslug} />
      </GeneralWrapperStyled>
    )
  }

  return (
    <GeneralWrapperStyled>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--dash-ink))]">{t('student_portal.assessments.title', 'My assessments')}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--dash-muted))]">
            {t('student_portal.assessments.subtitle', 'Assignments and tests in the courses you are enrolled in.')}
          </p>
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          label={t('student_portal.assessments.filter', 'Filter')}
          options={[
            { value: 'all', label: `${t('student_portal.assessments.all', 'All')} · ${fmt.number(all.length)}` },
            { value: 'open', label: `${t('student_portal.assessments.open', 'To do')} · ${fmt.number(counts.open)}` },
            { value: 'submitted', label: `${t('student_portal.assessments.submitted', 'Submitted')} · ${fmt.number(counts.submitted)}` },
            { value: 'graded', label: `${t('student_portal.assessments.graded', 'Graded')} · ${fmt.number(counts.graded)}` },
          ]}
        />
      </div>

      <Panel className="p-2 sm:p-3">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="dash-shimmer h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Exam size={22} weight="duotone" />}
            title={
              all.length === 0
                ? t('student_portal.assessments.empty_title', 'No assessments yet')
                : t('student_portal.assessments.empty_filter', 'Nothing here')
            }
            description={
              all.length === 0
                ? t('student_portal.assessments.empty_desc', 'Assignments and tests from your courses will appear here.')
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[hsl(var(--dash-border))]/70">
            {shown.map((a) => {
              const chip = statusChip(a)
              const href = getUriWithOrg(orgslug, a.activity_uuid ? lessonPath(a.course_uuid, a.activity_uuid) : coursePath(a.course_uuid))
              const due = a.due_date ? new Date(a.due_date) : null
              return (
                <li key={a.assignment_uuid}>
                  <Link href={href} className="group flex flex-col gap-3 rounded-2xl p-3 transition-colors hover:bg-[hsl(var(--dash-canvas))] sm:flex-row sm:items-center">
                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70 sm:inline-flex">
                      <Exam size={20} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold text-[hsl(var(--dash-ink))]" dir="auto">{a.title}</span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', chip.cls)}>{chip.label}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[hsl(var(--dash-muted))]">
                        <span className="truncate" dir="auto">{a.course_name}</span>
                        {due && !Number.isNaN(due.getTime()) ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarBlank size={13} />
                            {t('student_portal.assessments.due', 'Due {{date}}', { date: fmt.date(due, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                      {a.grade !== null ? (
                        <span className="text-end">
                          <span className="block text-[18px] font-bold leading-none tabular-nums text-[hsl(var(--dash-ink))]">
                            {a.grading_type === 'PERCENTAGE' ? `${fmt.number(a.grade)}%` : fmt.number(a.grade)}
                          </span>
                          <span className="text-[11px] text-[hsl(var(--dash-muted))]">{t('student_portal.assessments.grade', 'Grade')}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[hsl(var(--dash-ink))]">
                        {isOpen(a) ? t('student_portal.assessments.start', 'Open') : t('student_portal.assessments.view', 'View')}
                        <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </GeneralWrapperStyled>
  )
}
