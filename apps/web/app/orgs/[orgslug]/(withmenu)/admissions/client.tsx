'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, CheckCircle2, ChevronDown } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'
import {
  createApplication,
  getAdmissionRequirements,
  getMyApplications,
  getOpenIntakes,
  stripPrefix,
} from '@services/academic/core'

function Requirements({ programUuid }: { programUuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['portal', 'requirements', programUuid],
    queryFn: () => getAdmissionRequirements(programUuid, access_token),
    enabled: !!access_token,
  })
  if (isLoading) return <div className="text-xs text-[hsl(var(--dash-muted))]">…</div>
  if (!requirements.length)
    return <div className="text-xs text-[hsl(var(--dash-muted))]">{t('academic.no_requirements_listed', 'No specific requirements listed.')}</div>
  return (
    <ul className="space-y-1">
      {requirements.map((r: any) => (
        <li key={r.requirement_uuid} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--dash-accent))]" />
          <span>
            {r.label}
            {!r.mandatory && <span className="text-xs text-[hsl(var(--dash-muted))]"> ({t('academic.optional', 'optional')})</span>}
            {r.description && <span className="block text-xs text-[hsl(var(--dash-muted))]">{r.description}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ApplyPortal({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { orgId, access_token, ready } = useAcademicContext()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const { data: intakes = [], isLoading } = useQuery({
    queryKey: ['portal', 'intakes', orgId],
    queryFn: () => getOpenIntakes(orgId, access_token),
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
        <PortalHeader title={t('academic.postgraduate_admissions', 'Postgraduate admissions')} />
        <SignInPrompt orgslug={orgslug} />
      </GeneralWrapperStyled>
    )
  }

  const existing = (cohortUuid: string) => applications.find((a: any) => a.cohort_uuid === cohortUuid)
  const goTo = (a: any) =>
    router.push(getUriWithOrg(orgslug, `/admissions/${stripPrefix(a.application_uuid, 'application')}`))

  const apply = async (cohortUuid: string) => {
    setBusy(cohortUuid)
    try {
      const app = await createApplication({ cohort_uuid: cohortUuid }, access_token)
      queryClient.invalidateQueries({ queryKey: ['portal', 'applications', orgId] })
      toast.success(t('academic.application_started', 'Application started — complete it and submit'))
      goTo(app)
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <GeneralWrapperStyled>
      <PortalHeader
        title={t('academic.postgraduate_admissions', 'Postgraduate admissions')}
        subtitle={t('academic.admissions_portal_desc', 'Programs currently accepting applications.')}
        action={
          <Link href={getUriWithOrg(orgslug, '/academics')} className="text-sm font-semibold text-[hsl(var(--dash-accent))]">
            {t('academic.my_academics', 'My academics')} →
          </Link>
        }
      />

      {isLoading && <div className="py-10 text-center text-sm text-[hsl(var(--dash-muted))]">…</div>}
      {!isLoading && intakes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] p-10 text-center text-sm text-[hsl(var(--dash-muted))]">
          {t('academic.no_open_intakes', 'No program is accepting applications right now.')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {intakes.map((intake: any) => {
          const mine = existing(intake.cohort_uuid)
          const isOpen = expanded === intake.cohort_uuid
          return (
            <div key={intake.cohort_uuid} className="rounded-2xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
                    {String(t(`academic.level_${intake.program_level}`, intake.program_level))}
                    {intake.program_code && ` · ${intake.program_code}`}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{intake.program_name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-[hsl(var(--dash-muted))]">
                    <CalendarDays className="h-4 w-4" />
                    {intake.cohort_code || intake.cohort_name}
                    {intake.start_date && ` · ${t('academic.starts', 'Starts')} ${intake.start_date}`}
                  </div>
                </div>
                {mine && <StatusPill status={mine.status} label={String(t(`academic.app_${mine.status}`, mine.status))} />}
              </div>

              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : intake.cohort_uuid)}
                className="mt-4 flex items-center gap-1 text-sm font-medium text-[hsl(var(--dash-ink))]"
              >
                {t('academic.admission_requirements', 'Admission requirements')}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-2">
                  <Requirements programUuid={intake.program_uuid} />
                </div>
              )}

              <div className="mt-4">
                {mine ? (
                  <button
                    onClick={() => goTo(mine)}
                    className="rounded-full border border-[hsl(var(--dash-border))] px-5 py-2 text-sm font-semibold"
                  >
                    {mine.status === 'draft'
                      ? t('academic.continue_application', 'Continue application')
                      : t('academic.view_application', 'View application')}
                  </button>
                ) : (
                  <button
                    disabled={busy === intake.cohort_uuid}
                    onClick={() => apply(intake.cohort_uuid)}
                    className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy === intake.cohort_uuid ? '…' : t('academic.apply_now', 'Apply now')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </GeneralWrapperStyled>
  )
}

export default ApplyPortal
