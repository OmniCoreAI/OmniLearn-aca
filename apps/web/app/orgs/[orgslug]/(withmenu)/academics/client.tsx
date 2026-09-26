'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, ArrowRight } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { DataTable, Section, Stat, StatusPill, tdCls, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { TranscriptView } from '@components/Dashboard/Pages/Academic/TranscriptView'
import { getMyAcademicRecord, getMyApplications, stripPrefix } from '@services/academic/core'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'

function MyAcademics({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()

  const { data: record, isLoading } = useQuery({
    queryKey: ['portal', 'record', orgId],
    queryFn: () => getMyAcademicRecord(orgId, access_token),
    enabled: ready,
  })
  const { data: applications = [] } = useQuery({
    queryKey: ['portal', 'applications', orgId],
    queryFn: () => getMyApplications(orgId, access_token),
    enabled: ready,
  })

  if (!access_token) {
    return (
      <GeneralWrapperStyled>
        <PortalHeader title={t('academic.my_academics', 'My academics')} />
        <SignInPrompt orgslug={orgslug} />
      </GeneralWrapperStyled>
    )
  }

  const memberships: any[] = record?.memberships || []
  const offerings: any[] = record?.offerings || []
  const statusOf = (o: any) => record?.enrollment_status?.[o.offering_uuid]
  const current = offerings.filter((o) => statusOf(o) === 'registered')

  return (
    <GeneralWrapperStyled>
      <PortalHeader
        title={t('academic.my_academics', 'My academics')}
        subtitle={t('academic.my_academics_desc', 'Your programs, current courses, results and applications.')}
        action={
          <Link
            href={getUriWithOrg(orgslug, '/admissions')}
            className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))]"
          >
            {t('academic.apply_to_program', 'Apply to a program')} <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="space-y-6">
        {isLoading && <div className="py-10 text-center text-sm text-[hsl(var(--dash-muted))]">…</div>}

        {!isLoading && memberships.length === 0 && applications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] p-10 text-center text-sm text-[hsl(var(--dash-muted))]">
            {t('academic.portal_empty', 'You are not enrolled in a postgraduate program yet. Browse open intakes to apply.')}
          </div>
        )}

        {memberships.map((m) => (
          <Section key={m.membership_uuid} title={m.program_name || ''} description={`${m.cohort_code || m.cohort_name}`}>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t('academic.student_number', 'Student no.')} value={<span className="font-mono">{m.student_number}</span>} />
              <Stat label={t('academic.status')} value={<StatusPill status={m.status} />} />
              <Stat label={t('academic.admitted', 'Admitted')} value={m.admitted_at?.slice(0, 10)} />
              <Stat label={t('academic.current_courses', 'Current courses')} value={m.enrolled_offerings} />
            </div>
            <details className="group rounded-xl border border-[hsl(var(--dash-border))] p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" /> {t('academic.results_transcript', 'Results & transcript')}
              </summary>
              <div className="mt-3">
                <TranscriptView membershipUuid={m.membership_uuid} />
              </div>
            </details>
          </Section>
        ))}

        {current.length > 0 && (
          <Section title={t('academic.current_courses', 'Current courses')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {current.map((o) => (
                <div key={o.offering_uuid} className="rounded-xl border border-[hsl(var(--dash-border))] p-4">
                  <div className="font-mono text-xs text-[hsl(var(--dash-muted))]">
                    {o.course_code} · {o.term_code}
                  </div>
                  <div className="mt-1 font-semibold">{o.course_name}</div>
                  <div className="mt-1 text-xs text-[hsl(var(--dash-muted))]">
                    {o.credits} {t('academic.credits', 'Credits').toLowerCase()}
                    {o.instructor && ` · ${[o.instructor.first_name, o.instructor.last_name].filter(Boolean).join(' ') || o.instructor.username}`}
                  </div>
                  {o.content_course_uuid ? (
                    <Link
                      href={getUriWithOrg(orgslug, `/course/${stripPrefix(o.content_course_uuid, 'course')}`)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--dash-accent))]"
                    >
                      <BookOpen className="h-4 w-4" /> {t('academic.open_course', 'Open course')}
                    </Link>
                  ) : (
                    <div className="mt-3 text-xs text-[hsl(var(--dash-muted))]">
                      {t('academic.materials_soon', 'Course materials are not available yet.')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {applications.length > 0 && (
          <Section title={t('academic.my_applications', 'My applications')}>
            <DataTable
              headers={[t('academic.application_no', 'Application no.'), t('academic.program'), t('academic.intake', 'Intake'), t('academic.status')]}
            >
              {applications.map((a: any) => (
                <tr key={a.application_uuid}>
                  <td className={`${tdCls} font-mono text-xs`}>
                    <Link
                      className="font-semibold hover:text-[hsl(var(--dash-accent))]"
                      href={getUriWithOrg(orgslug, `/admissions/${stripPrefix(a.application_uuid, 'application')}`)}
                    >
                      {a.application_number}
                    </Link>
                  </td>
                  <td className={tdCls}>{a.program_name}</td>
                  <td className={`${tdCls} text-xs`}>{a.cohort_code || a.cohort_name}</td>
                  <td className={tdCls}>
                    <StatusPill status={a.status} label={String(t(`academic.app_${a.status}`, a.status))} />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>
        )}
      </div>
    </GeneralWrapperStyled>
  )
}

export default MyAcademics
