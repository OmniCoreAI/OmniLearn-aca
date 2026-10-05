'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChalkboardTeacher, Warning } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import DashDataTable from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { displayName, stripPrefix } from '@services/academic/core'
import { cn } from '@/lib/utils'

const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

/** Course offerings (a course taught in a term, possibly for one cohort), shared by the offerings list and the intake page. */
export function OfferingsTable({
  orgslug,
  offerings,
  empty,
  loading = false,
  toolbar,
  showCohort = true,
  hrefFor,
}: {
  orgslug: string
  offerings: any[]
  empty?: React.ReactNode
  loading?: boolean
  toolbar?: React.ReactNode
  showCohort?: boolean
  /** Where a row leads; defaults to the office's offering page. */
  hrefFor?: (_o: any) => string
}) {
  const { t } = useTranslation()
  const live = (o: any) => ['planned', 'open', 'in_progress'].includes(o.status)
  return (
    <DashDataTable
      rows={offerings}
      rowKey={(o: any) => o.offering_uuid}
      rowHref={(o: any) => (hrefFor ? hrefFor(o) : getUriWithOrg(orgslug, `/dash/postgraduate/offerings/${stripPrefix(o.offering_uuid, 'offering')}`))}
      loading={loading}
      toolbar={toolbar}
      initialSort={{ key: 'course', dir: 'asc' }}
      itemLabel={(n) => t('academic.off.count', '{{count}} offerings', { count: n })}
      empty={
        typeof empty === 'string' || !empty ? (
          <AcademicEmptyState compact icon={<ChalkboardTeacher size={24} />} title={(empty as string) || t('academic.no_offerings', 'No course offerings yet.')} />
        ) : (
          empty
        )
      }
      columns={[
        {
          key: 'course',
          header: t('academic.course', 'Course'),
          primary: true,
          sortValue: (o: any) => o.course_code,
          cell: (o: any) => (
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{o.course_code}</span>
                <span className="truncate font-medium">{o.course_name}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[hsl(var(--dash-muted))]">
                <span className="font-mono">{o.code}</span>
                <span>· {t('academic.off.credits', '{{count}} cr', { count: o.credits })}</span>
                {o.requirement ? <StatusPill status={o.requirement} /> : null}
              </div>
            </div>
          ),
        },
        {
          key: 'term',
          header: t('academic.term', 'Term'),
          hideBelow: 'lg',
          sortValue: (o: any) => o.term_code,
          cell: (o: any) => (
            <div className="leading-tight">
              <div className="whitespace-nowrap font-mono text-[11.5px]">{o.term_code}</div>
              {showCohort ? <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{o.cohort_code || o.cohort_name || t('academic.open_offering', 'Open')}</div> : null}
            </div>
          ),
        },
        {
          key: 'lecturer',
          header: t('academic.instructor', 'Instructor'),
          sortValue: (o: any) => (o.instructor ? displayName(o.instructor) : ''),
          cell: (o: any) =>
            o.instructor ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <PersonAvatar name={displayName(o.instructor)} size={24} />
                <span className="truncate text-[12.5px]">{displayName(o.instructor)}</span>
              </span>
            ) : live(o) ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <Warning size={12} weight="bold" /> {t('academic.off.no_lecturer', 'No lecturer')}
              </span>
            ) : (
              <span className="text-[hsl(var(--dash-muted))]">—</span>
            ),
        },
        {
          key: 'enrolled',
          header: t('academic.tab_students', 'Students'),
          align: 'end',
          sortValue: (o: any) => o.enrolled_count + (o.results_count || 0),
          cell: (o: any) => {
            const students = o.enrolled_count + (o.results_count || 0)
            const pct = o.capacity ? Math.min(100, Math.round((students / o.capacity) * 100)) : null
            return (
              <div className="ms-auto w-20 text-end">
                <span className="text-[13px] font-semibold tabular-nums">{students}</span>
                {o.capacity != null ? <span className="text-[11px] text-[hsl(var(--dash-muted))]"> / {o.capacity}</span> : null}
                {pct != null ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                    <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-400' : GOLD)} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
            )
          },
        },
        {
          key: 'grades',
          header: t('academic.off.grades', 'Grades'),
          hideBelow: 'xl',
          sortValue: (o: any) => o.grade_status,
          cell: (o: any) => <StatusPill status={o.grade_status === 'open' ? 'draft' : o.grade_status} label={String(t(`academic.grades_${o.grade_status}`, o.grade_status))} />,
        },
        {
          key: 'status',
          header: t('academic.status'),
          sortValue: (o: any) => o.status,
          cell: (o: any) => <StatusPill status={o.status} />,
        },
      ]}
    />
  )
}
