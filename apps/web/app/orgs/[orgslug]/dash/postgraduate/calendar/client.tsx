'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  DataTable,
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  createAcademicYear,
  createTerm,
  deleteAcademicYear,
  deleteTerm,
  getAcademicYears,
  getTerms,
  updateAcademicYear,
  updateTerm,
} from '@services/academic/core'

const YEAR_STATUSES = ['planned', 'active', 'closed']
const TERM_TYPES = ['fall', 'spring', 'summer', 'custom']
const TERM_STATUSES = ['planned', 'registration', 'in_progress', 'exams', 'closed']

function range(a?: string | null, b?: string | null) {
  if (!a && !b) return '—'
  return `${a || '…'} → ${b || '…'}`
}

function AcademicCalendar({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const [yearModal, setYearModal] = useState<null | { year?: any }>(null)
  const [termModal, setTermModal] = useState<null | { year: any; term?: any }>(null)

  const { data: years = [] } = useQuery({
    queryKey: ['academic', 'years', orgId],
    queryFn: () => getAcademicYears(orgId, access_token),
    enabled: ready,
  })
  const { data: terms = [] } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'years', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'terms', orgId] })
  }

  const confirmRemove = async (fn: () => Promise<any>) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await fn()
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_calendar', 'Academic Calendar') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_calendar', 'Academic Calendar')}
        subtitle={t(
          'academic.calendar_desc',
          'Organization-wide academic years and terms. Every program schedules its course offerings into these terms.'
        )}
        action={
          <AcademicPrimaryButton onClick={() => setYearModal({})}>
            <Plus className="h-4 w-4" /> {t('academic.new_academic_year', 'New academic year')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="space-y-6">
        {years.length === 0 && (
          <Section title={t('academic.no_years', 'No academic years yet')}>
            <p className="text-sm text-[hsl(var(--dash-muted))]">
              {t('academic.no_years_desc', 'Create the current academic year (e.g. 2026/2027), then add its terms.')}
            </p>
          </Section>
        )}
        {years.map((year: any) => {
          const yearTerms = terms.filter((tm: any) => tm.academic_year_id === year.id)
          return (
            <Section
              key={year.academic_year_uuid}
              title={year.code}
              description={`${year.name || ''} · ${range(year.start_date, year.end_date)}`}
              action={
                <>
                  <StatusPill status={year.status} />
                  <GhostButton onClick={() => setTermModal({ year })}>
                    <Plus className="h-3.5 w-3.5" /> {t('academic.new_term', 'New term')}
                  </GhostButton>
                  <IconButton onClick={() => setYearModal({ year })} aria-label={t('academic.edit', 'Edit')}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    tone="danger"
                    onClick={() => confirmRemove(() => deleteAcademicYear(year.academic_year_uuid, access_token))}
                    aria-label={t('academic.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </>
              }
            >
              <DataTable
                headers={[
                  t('academic.code'),
                  t('academic.name'),
                  t('academic.dates', 'Dates'),
                  t('academic.registration', 'Registration'),
                  t('academic.exams', 'Exams'),
                  t('academic.grade_deadline', 'Grade deadline'),
                  t('academic.status'),
                  '',
                ]}
                empty={t('academic.no_terms', 'No terms in this year yet.')}
              >
                {yearTerms.map((tm: any) => (
                  <tr key={tm.term_uuid}>
                    <td className={`${tdCls} font-mono text-xs font-semibold`}>{tm.code}</td>
                    <td className={tdCls}>{tm.name}</td>
                    <td className={`${tdCls} text-xs`}>{range(tm.start_date, tm.end_date)}</td>
                    <td className={`${tdCls} text-xs`}>{range(tm.registration_start, tm.registration_end)}</td>
                    <td className={`${tdCls} text-xs`}>{range(tm.exam_start, tm.exam_end)}</td>
                    <td className={`${tdCls} text-xs`}>{tm.grade_deadline || '—'}</td>
                    <td className={tdCls}>
                      <StatusPill status={tm.status} />
                    </td>
                    <td className={`${tdCls} whitespace-nowrap text-right`}>
                      <IconButton onClick={() => setTermModal({ year, term: tm })} aria-label={t('academic.edit', 'Edit')}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        onClick={() => confirmRemove(() => deleteTerm(tm.term_uuid, access_token))}
                        aria-label={t('academic.delete', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </Section>
          )
        })}
      </div>

      <Modal
        isDialogOpen={!!yearModal}
        onOpenChange={(o: boolean) => !o && setYearModal(null)}
        minWidth="sm"
        dialogTitle={yearModal?.year ? yearModal.year.code : t('academic.new_academic_year', 'New academic year')}
        dialogContent={
          yearModal && (
            <YearForm
              year={yearModal.year}
              onDone={() => {
                setYearModal(null)
                refresh()
              }}
            />
          )
        }
      />
      <Modal
        isDialogOpen={!!termModal}
        onOpenChange={(o: boolean) => !o && setTermModal(null)}
        minWidth="md"
        dialogTitle={termModal?.term ? termModal.term.code : `${t('academic.new_term', 'New term')} · ${termModal?.year?.code || ''}`}
        dialogContent={
          termModal && (
            <TermForm
              year={termModal.year}
              term={termModal.term}
              onDone={() => {
                setTermModal(null)
                refresh()
              }}
            />
          )
        }
      />
    </AcademicPageShell>
  )
}

function YearForm({ year, onDone }: { year?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const now = new Date().getFullYear()
  const [code, setCode] = useState(year?.code || `${now}/${now + 1}`)
  const [startDate, setStartDate] = useState(year?.start_date || '')
  const [endDate, setEndDate] = useState(year?.end_date || '')
  const [status, setStatus] = useState(year?.status || 'planned')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { code, start_date: startDate || null, end_date: endDate || null, status }
      if (year) await updateAcademicYear(year.academic_year_uuid, payload, access_token)
      else await createAcademicYear(orgId, payload, access_token)
      toast.success(year ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.academic_year')}>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="2026/2027" required />
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {YEAR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.state_${s}`, s)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')}>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <SubmitRow saving={saving} />
    </form>
  )
}

function TermForm({ year, term, onDone }: { year: any; term?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [termType, setTermType] = useState(term?.term_type || 'fall')
  const [code, setCode] = useState('')
  const [name, setName] = useState(term?.name || '')
  const [status, setStatus] = useState(term?.status || 'planned')
  const [dates, setDates] = useState<Record<string, string>>({
    start_date: term?.start_date || '',
    end_date: term?.end_date || '',
    registration_start: term?.registration_start || '',
    registration_end: term?.registration_end || '',
    add_drop_end: term?.add_drop_end || '',
    exam_start: term?.exam_start || '',
    exam_end: term?.exam_end || '',
    grade_deadline: term?.grade_deadline || '',
  })
  const [saving, setSaving] = useState(false)
  const setDate = (k: string, v: string) => setDates((d) => ({ ...d, [k]: v }))

  const [y1, y2] = String(year.code).split('/')
  const preview =
    termType === 'custom'
      ? code.toUpperCase() || '—'
      : `${termType.toUpperCase()}-${dates.start_date?.slice(0, 4) || (termType === 'fall' ? y1 : y2)}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const cleaned = Object.fromEntries(Object.entries(dates).map(([k, v]) => [k, v || null]))
      if (term) {
        await updateTerm(term.term_uuid, { ...cleaned, name: name || null, status }, access_token)
      } else {
        await createTerm(
          orgId,
          {
            ...cleaned,
            academic_year_uuid: year.academic_year_uuid,
            term_type: termType,
            code: termType === 'custom' ? code : null,
            name: name || null,
            status,
          },
          access_token
        )
      }
      toast.success(term ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  const dateField = (key: string, label: string) => (
    <Field label={label}>
      <input type="date" className={inputCls} value={dates[key]} onChange={(e) => setDate(key, e.target.value)} />
    </Field>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.term_type', 'Term type')}>
          <select className={inputCls} value={termType} onChange={(e) => setTermType(e.target.value)} disabled={!!term}>
            {TERM_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`academic.term_${tt}`, tt)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.code')}>
          {termType === 'custom' && !term ? (
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          ) : (
            <div className="flex h-[38px] items-center rounded-lg border border-dashed border-[hsl(var(--dash-border))] px-3 font-mono text-sm text-[hsl(var(--dash-muted))]">
              {term?.code || preview}
            </div>
          )}
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {TERM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.state_${s}`, s.replace('_', ' '))}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('academic.name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={preview.replace('-', ' ')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {dateField('start_date', t('academic.start_date'))}
        {dateField('end_date', t('academic.end_date'))}
        {dateField('registration_start', t('academic.registration_start', 'Registration opens'))}
        {dateField('registration_end', t('academic.registration_end', 'Registration closes'))}
        {dateField('add_drop_end', t('academic.add_drop_end', 'Add/drop deadline'))}
        {dateField('grade_deadline', t('academic.grade_deadline', 'Grade deadline'))}
        {dateField('exam_start', t('academic.exam_start', 'Exams start'))}
        {dateField('exam_end', t('academic.exam_end', 'Exams end'))}
      </div>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default AcademicCalendar
