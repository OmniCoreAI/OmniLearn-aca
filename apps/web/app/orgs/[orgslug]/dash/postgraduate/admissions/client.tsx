'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import {
  DataTable,
  PostgradTabs,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getPrograms, getProgramCohorts } from '@services/academic/academic'
import { createApplication, displayName, getApplications, stripPrefix } from '@services/academic/core'

const STATUSES = ['submitted', 'under_review', 'waitlisted', 'accepted', 'rejected', 'enrolled', 'withdrawn', 'draft']

export function EligibilityBadge({ eligible, pending }: { eligible: boolean | null; pending: number }) {
  const { t } = useTranslation()
  if (eligible === true) return <StatusPill status="met" label={t('academic.eligible', 'Eligible')} />
  if (eligible === false) return <StatusPill status="not_met" label={t('academic.not_eligible', 'Not eligible')} />
  return (
    <StatusPill
      status="pending"
      label={t('academic.checks_pending', { count: pending, defaultValue: `${pending} pending` })}
    />
  )
}

function AdmissionsList({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const [program, setProgram] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const { data: programs = [] } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId, access_token),
    enabled: ready,
  })
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ['academic', 'applications', orgId, program, status, query],
    queryFn: () => getApplications(orgId, access_token, { program_uuid: program, status, q: query }),
    enabled: ready,
    retry: false,
  })

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_admissions', 'Admissions') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_admissions', 'Admissions')}
        subtitle={t(
          'academic.admissions_desc',
          'Applications to program intakes: document verification, eligibility, entrance tests, interviews and decisions.'
        )}
        action={
          <AcademicPrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t('academic.new_application', 'New application')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5">
          <Search className="h-4 w-4 text-[hsl(var(--dash-muted))]" />
          <input
            className="w-56 bg-transparent text-sm focus:outline-none"
            placeholder={t('academic.search_applications', 'Name, email or application no.')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className={selectCls()} value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">{t('academic.all_programs', 'All programs')}</option>
          {programs.map((p: any) => (
            <option key={p.program_uuid} value={p.program_uuid}>
              {p.code ? `${p.code} · ` : ''}
              {p.name}
            </option>
          ))}
        </select>
        <select className={selectCls()} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('academic.all_submitted', 'All submitted')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {String(t(`academic.app_${s}`, s))}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      ) : (
        <DataTable
          headers={[
            t('academic.application_no', 'Application no.'),
            t('academic.applicant', 'Applicant'),
            t('academic.program'),
            t('academic.intake', 'Intake'),
            t('academic.submitted_at', 'Submitted'),
            t('academic.eligibility', 'Eligibility'),
            t('academic.status'),
          ]}
          empty={isLoading ? '…' : t('academic.no_applications', 'No applications yet.')}
        >
          {applications.map((a: any) => (
            <tr key={a.application_uuid}>
              <td className={`${tdCls} font-mono text-xs`}>
                <Link
                  className="font-semibold hover:text-[hsl(var(--dash-accent))]"
                  href={getUriWithOrg(orgslug, `/dash/postgraduate/admissions/${stripPrefix(a.application_uuid, 'application')}`)}
                >
                  {a.application_number}
                </Link>
              </td>
              <td className={tdCls}>
                <div className="font-medium">{displayName(a.applicant)}</div>
                <div className="text-xs text-[hsl(var(--dash-muted))]">{a.applicant.email}</div>
              </td>
              <td className={`${tdCls} text-xs`}>{a.program_name}</td>
              <td className={`${tdCls} text-xs`}>{a.cohort_code || a.cohort_name}</td>
              <td className={`${tdCls} text-xs`}>{a.submitted_at?.slice(0, 10) || '—'}</td>
              <td className={tdCls}>
                <EligibilityBadge eligible={a.eligible} pending={a.pending_checks} />
              </td>
              <td className={tdCls}>
                <StatusPill status={a.status} label={String(t(`academic.app_${a.status}`, a.status))} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="sm"
        dialogTitle={t('academic.new_application', 'New application')}
        dialogContent={open && <NewApplicationForm orgslug={orgslug} programs={programs} onDone={() => setOpen(false)} />}
      />
    </AcademicPageShell>
  )
}

function NewApplicationForm({ orgslug, programs, onDone }: { orgslug: string; programs: any[]; onDone: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { orgId, access_token } = useAcademicContext()
  const [program, setProgram] = useState('')
  const [cohort, setCohort] = useState('')
  const [applicant, setApplicant] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const { data: cohorts = [] } = useQuery({
    queryKey: ['academic', 'cohorts', program],
    queryFn: () => getProgramCohorts(program, access_token),
    enabled: !!program && !!access_token,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cohort || !applicant) return
    setSaving(true)
    try {
      const app = await createApplication({ cohort_uuid: cohort, applicant_uuid: applicant }, access_token)
      toast.success(t('academic.created'))
      onDone()
      router.push(getUriWithOrg(orgslug, `/dash/postgraduate/admissions/${stripPrefix(app.application_uuid, 'application')}`))
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.program')}>
        <select
          className={inputCls}
          value={program}
          onChange={(e) => {
            setProgram(e.target.value)
            setCohort('')
          }}
          required
        >
          <option value="">—</option>
          {programs.map((p: any) => (
            <option key={p.program_uuid} value={p.program_uuid}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.intake', 'Intake')}>
        <select className={inputCls} value={cohort} onChange={(e) => setCohort(e.target.value)} required disabled={!program}>
          <option value="">—</option>
          {cohorts.map((c: any) => (
            <option key={c.cohort_uuid} value={c.cohort_uuid}>
              {c.code || c.name} {c.admission_status === 'open' ? '' : `(${t('academic.admissions_closed', 'admissions closed')})`}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.applicant', 'Applicant')}>
        <CoordinatorPicker
          orgId={orgId}
          access_token={access_token}
          value={applicant}
          selectedLabel={label}
          onlyRoles={['role_global_user']}
          placeholder={t('academic.search_students', 'Search trainees…')}
          onChange={(uuid, l) => {
            setApplicant(uuid)
            setLabel(l)
          }}
        />
      </Field>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('academic.new_application_hint', 'Creates a draft on behalf of the applicant. Complete the academic background, then submit it.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default AdmissionsList
