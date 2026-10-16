'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AdminCard } from '@components/Dashboard/Pages/Administration/AdminUI'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getInstructorAssignments } from '@services/instructors/instructors'
import { getUriWithOrg } from '@services/config/config'

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[hsl(var(--dash-muted))]">{children}</p>
}

function Row({ href, title, meta, badge }: { href: string; title: string; meta?: string; badge?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          {meta ? <span className="block truncate text-[12px] text-[hsl(var(--dash-muted))]">{meta}</span> : null}
        </span>
        {badge}
      </Link>
    </li>
  )
}

/**
 * Everything an instructor teaches or runs beyond their courses: offerings
 * (lecturer / assistant), training programs (coordinator / trainer) and the
 * sessions coming up, including guest slots in other people's courses.
 */
export function InstructorAssignmentsPanel({
  orgslug,
  instructorUuid,
  access_token,
}: {
  orgslug: string
  instructorUuid: string
  access_token: string
}) {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['instructor', instructorUuid, 'assignments'],
    queryFn: () => getInstructorAssignments(instructorUuid, access_token),
    enabled: !!access_token,
  })
  const offerings: any[] = data?.offerings ?? []
  const programs: any[] = data?.training_programs ?? []
  const sessions: any[] = data?.upcoming_sessions ?? []
  const href = (path: string) => getUriWithOrg(orgslug, path)
  const date = (v?: string | null) =>
    v ? new Date(v).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const programRole: Record<string, string> = {
    coordinator: t('workspace.role_coordinator', 'Coordinator'),
    trainer: t('workspace.role_trainer', 'Trainer'),
    staff: t('workspace.role_staff', 'Team'),
  }

  if (isLoading) return <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <AdminCard
        title={t('instructors.assigned_offerings', 'Postgraduate offerings')}
        description={t('instructors.assigned_offerings_desc', 'Set from the offering page (Teaching staff).')}
      >
        {offerings.length === 0 ? (
          <EmptyLine>{t('instructors.no_offerings', 'Not teaching any offering.')}</EmptyLine>
        ) : (
          <ul className="-mx-3">
            {offerings.map((o) => (
              <Row
                key={o.offering_uuid}
                href={href(`/dash/postgraduate/offerings/${o.offering_uuid.replace('offering_', '')}`)}
                title={`${o.course_code} · ${o.course_name}`}
                meta={[o.code, o.term_code].filter(Boolean).join(' · ')}
                badge={<StatusPill status={o.status} />}
              />
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        title={t('instructors.assigned_programs', 'Training programs')}
        description={t('instructors.assigned_programs_desc', 'Coordinator, or trainer of one of the program’s courses.')}
      >
        {programs.length === 0 ? (
          <EmptyLine>{t('instructors.no_programs', 'No training programs assigned.')}</EmptyLine>
        ) : (
          <ul className="-mx-3">
            {programs.map((p) => (
              <Row
                key={p.trainingprogram_uuid}
                href={href(`/dash/training-programs/${p.trainingprogram_uuid.replace('trainingprogram_', '')}`)}
                title={p.name}
                meta={[date(p.start_date), date(p.end_date)].filter(Boolean).join(' – ') || t('workspace.no_dates', 'No dates yet')}
                badge={
                  <span className="shrink-0 rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-muted))]">
                    {programRole[p.role] || p.role}
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        className="lg:col-span-2"
        title={t('instructors.upcoming_sessions', 'Upcoming sessions')}
        description={t('instructors.upcoming_sessions_desc', 'Course sessions they teach, including guest sessions in other courses.')}
      >
        {sessions.length === 0 ? (
          <EmptyLine>{t('instructors.no_upcoming_sessions', 'Nothing scheduled.')}</EmptyLine>
        ) : (
          <ul className="-mx-3">
            {sessions.map((s) => (
              <Row
                key={s.session_uuid}
                href={href(`/dash/courses/course/${s.course_uuid.replace('course_', '')}/delivery`)}
                title={`${s.title} · ${s.course_name}`}
                meta={[date(s.start_date), s.location].filter(Boolean).join(' · ')}
                badge={
                  s.role === 'guest' ? (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-tile-mint-fg))]">
                      {t('instructors.guest_session', 'Guest session')}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  )
}
