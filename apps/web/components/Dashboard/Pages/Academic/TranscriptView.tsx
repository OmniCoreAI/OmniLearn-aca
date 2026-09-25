'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { DataTable, GhostButton, Stat, StatusPill, tdCls, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getStudentTranscript } from '@services/academic/core'

/** Academic transcript of one student record (approved results only). */
export function TranscriptView({ membershipUuid }: { membershipUuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const { data: tr, error, isLoading } = useQuery({
    queryKey: ['academic', 'transcript', membershipUuid],
    queryFn: () => getStudentTranscript(membershipUuid, access_token),
    enabled: !!access_token,
    retry: false,
  })

  if (isLoading) return <div className="py-6 text-center text-sm text-[hsl(var(--dash-muted))]">…</div>
  if (error || !tr) return <p className="text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>

  return (
    <div className="space-y-4 print:text-black" id="academic-transcript">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{tr.student_name}</div>
          <div className="text-xs text-[hsl(var(--dash-muted))]">
            <span className="font-mono">{tr.student_number}</span> · {tr.program_name} · {tr.cohort_code}
          </div>
        </div>
        <GhostButton onClick={() => window.print()} className="print:hidden">
          <Printer className="h-3.5 w-3.5" /> {t('academic.print', 'Print')}
        </GhostButton>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={t('academic.status')} value={<StatusPill status={tr.status} />} />
        <Stat label={t('academic.cgpa', 'CGPA')} value={tr.cgpa ?? '—'} />
        <Stat label={t('academic.credits_attempted', 'Credits attempted')} value={tr.credits_attempted} />
        <Stat label={t('academic.credits_earned', 'Credits earned')} value={tr.credits_earned} />
        <Stat
          label={t('academic.credits_remaining', 'Credits remaining')}
          value={tr.credits_remaining != null ? tr.credits_remaining : '—'}
        />
      </div>

      {tr.terms.length === 0 && (
        <p className="text-sm text-[hsl(var(--dash-muted))]">
          {t('academic.no_results', 'No approved results yet.')}
        </p>
      )}
      {tr.terms.map((term: any) => (
        <div key={term.term_code}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-semibold">
              <span className="font-mono">{term.term_code}</span>
              {term.term_name && <span className="ms-2 font-normal text-[hsl(var(--dash-muted))]">{term.term_name}</span>}
            </div>
            <div className="text-xs text-[hsl(var(--dash-muted))]">
              {t('academic.term_gpa', 'Term GPA')} <b>{term.term_gpa ?? '—'}</b> · {t('academic.cgpa', 'CGPA')}{' '}
              <b>{term.cumulative_gpa ?? '—'}</b> · {t('academic.credits_earned', 'Credits earned')} {term.credits_earned}/
              {term.credits_attempted}
            </div>
          </div>
          <DataTable
            headers={[
              t('academic.code'),
              t('academic.course', 'Course'),
              t('academic.credits', 'Credits'),
              t('academic.score', 'Score'),
              t('academic.grade', 'Grade'),
              t('academic.grade_points', 'Points'),
              t('academic.status'),
            ]}
          >
            {term.courses.map((c: any) => (
              <tr key={c.offering_uuid} className={c.counted_in_gpa ? '' : 'opacity-60'}>
                <td className={`${tdCls} font-mono text-xs`}>{c.course_code}</td>
                <td className={tdCls}>
                  {c.course_name}
                  {!c.counted_in_gpa && (
                    <span className="ms-2 text-[10px] font-semibold uppercase text-[hsl(var(--dash-muted))]">
                      {t('academic.superseded', 'retaken')}
                    </span>
                  )}
                </td>
                <td className={tdCls}>{c.credits}</td>
                <td className={tdCls}>{c.final_score ?? '—'}</td>
                <td className={`${tdCls} font-semibold`}>{c.letter_grade}</td>
                <td className={tdCls}>{c.grade_points}</td>
                <td className={tdCls}>
                  <StatusPill status={c.status} />
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ))}
    </div>
  )
}
