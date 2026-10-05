'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDots, CalendarPlus, GraduationCap, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, IconButton, PostgradTabs, StatusPill, statusDotClass, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { pickCurrentTerm, termProgress } from '@components/Dashboard/Menus/postgradNavItems'
import { createAcademicYear, createTerm, deleteAcademicYear, deleteTerm, getAcademicYears, getTerms, updateAcademicYear, updateTerm } from '@services/academic/core'
import { cn } from '@/lib/utils'

const YEAR_STATUSES = ['planned', 'active', 'closed']
const TERM_TYPES = ['fall', 'spring', 'summer', 'custom']
const TERM_STATUSES = ['planned', 'registration', 'in_progress', 'exams', 'closed']
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'
const day = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).getTime() : NaN)

function useDates() {
  const { i18n } = useTranslation()
  const short = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) : '')
  const long = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const range = (a?: string | null, b?: string | null) => (a || b ? `${short(a) || '…'} – ${short(b) || '…'}` : '')
  return { short, long, range }
}

/** Terms of one academic year as bars across the year, with a line for today. */
function YearTimeline({ year, terms, currentUuid }: { year: any; terms: any[]; currentUuid?: string }) {
  const { i18n } = useTranslation()
  const [now] = useState(() => Date.now())
  const starts = [day(year.start_date), ...terms.map((tm) => day(tm.start_date))].filter(Number.isFinite)
  const ends = [day(year.end_date), ...terms.map((tm) => day(tm.end_date))].filter(Number.isFinite)
  if (!starts.length || !ends.length) return null
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  const span = Math.max(1, max - min)
  const pos = (v: number) => ((v - min) / span) * 100
  const months: { label: string; left: number }[] = []
  const cursor = new Date(min)
  cursor.setDate(1)
  while (cursor.getTime() <= max) {
    if (cursor.getTime() >= min) months.push({ label: cursor.toLocaleDateString(i18n.language, { month: 'short' }), left: pos(cursor.getTime()) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const dated = terms.filter((tm) => Number.isFinite(day(tm.start_date)) && Number.isFinite(day(tm.end_date)))
  return (
    <div className="mb-4 rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-3 pb-3 pt-2">
      <div className="relative mb-1 h-4 text-[10px] text-[hsl(var(--dash-muted))]">
        {months.map((m, i) => (
          <span key={i} className="absolute -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${m.left}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="relative space-y-1.5">
        {dated.map((tm) => {
          const left = pos(day(tm.start_date))
          const width = Math.max(2, pos(day(tm.end_date)) - left)
          const current = tm.term_uuid === currentUuid
          return (
            <div key={tm.term_uuid} className="relative h-6">
              <div
                className={cn('absolute inset-y-0 flex items-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold', current ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-white text-[hsl(var(--dash-ink))]/80 ring-1 ring-[hsl(var(--dash-border))]')}
                style={{ insetInlineStart: `${left}%`, width: `${width}%` }}
                title={tm.name || tm.code}
              >
                <span className={cn('me-1.5 h-1.5 w-1.5 shrink-0 rounded-full', current ? 'bg-[hsl(var(--dash-ink))]' : statusDotClass(tm.status))} />
                <span className="truncate">{tm.name || tm.code}</span>
              </div>
            </div>
          )
        })}
        {now >= min && now <= max ? <div aria-hidden="true" className="absolute -inset-y-1 w-px bg-red-500" style={{ insetInlineStart: `${pos(now)}%` }} /> : null}
      </div>
    </div>
  )
}

function AcademicCalendar({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const { long, range } = useDates()
  const [yearDrawer, setYearDrawer] = useState<null | { year?: any }>(null)
  const [termDrawer, setTermDrawer] = useState<null | { year: any; term?: any }>(null)

  const { data: years = [], isLoading } = useQuery({ queryKey: ['academic', 'years', orgId], queryFn: () => getAcademicYears(orgId, access_token), enabled: ready })
  const { data: terms = [] } = useQuery({ queryKey: ['academic', 'terms', orgId], queryFn: () => getTerms(orgId, access_token), enabled: ready })
  const current = pickCurrentTerm(terms as any[])
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'years', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'terms', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }
  const remove = async (title: string, message: string, fn: () => Promise<any>) => {
    const ok = await ask({ title, message, confirmText: t('academic.delete', 'Delete'), tone: 'danger' })
    if (ok === null) return
    try {
      await fn()
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }
  const sortedYears = [...(years as any[])].sort((a, b) => String(b.code).localeCompare(String(a.code)))

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
        subtitle={t('academic.calendar_desc', 'Organization-wide academic years and terms. Every program schedules its course offerings into these terms.')}
        action={
          <AcademicPrimaryButton onClick={() => setYearDrawer({})}>
            <Plus size={16} weight="bold" /> {t('academic.new_academic_year', 'New academic year')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      {isLoading ? (
        <div className="dash-shimmer h-64 rounded-[1.25rem]" />
      ) : sortedYears.length === 0 ? (
        <div className="dash-card flex flex-col items-center rounded-[1.25rem] px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
            <CalendarDots size={24} weight="duotone" />
          </span>
          <p className="mt-3 text-base font-semibold">{t('academic.no_years', 'No academic years yet')}</p>
          <p className="mt-1 max-w-sm text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_years_desc', 'Create the current academic year (e.g. 2026/2027), then add its terms.')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedYears.map((year) => {
            const yearTerms = (terms as any[]).filter((tm) => tm.academic_year_id === year.id).sort((a, b) => String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')))
            return (
              <section key={year.academic_year_uuid} className="dash-card rounded-[1.25rem] p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold tabular-nums">{year.code}</h2>
                      <StatusPill status={year.status} />
                    </div>
                    <p className="text-xs text-[hsl(var(--dash-muted))]">{[year.name, year.start_date || year.end_date ? `${long(year.start_date) || '…'} – ${long(year.end_date) || '…'}` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GhostButton onClick={() => setTermDrawer({ year })}>
                      <CalendarPlus size={14} /> {t('academic.new_term', 'New term')}
                    </GhostButton>
                    <IconButton onClick={() => setYearDrawer({ year })} aria-label={t('academic.edit', 'Edit')}>
                      <PencilSimple size={16} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      onClick={() =>
                        remove(
                          t('academic.cal.delete_year', 'Delete {{code}}?', { code: year.code }),
                          t('academic.cal.delete_year_message', 'Only years without terms in use can be deleted.'),
                          () => deleteAcademicYear(year.academic_year_uuid, access_token)
                        )
                      }
                      aria-label={t('academic.delete', 'Delete')}
                    >
                      <Trash size={16} />
                    </IconButton>
                  </div>
                </div>

                <YearTimeline year={year} terms={yearTerms} currentUuid={current?.term_uuid} />

                {yearTerms.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-8 text-center text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_terms', 'No terms in this year yet.')}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {yearTerms.map((tm) => {
                      const isCurrent = tm.term_uuid === current?.term_uuid
                      const progress = isCurrent ? termProgress(tm) : null
                      const keyDates = [
                        { label: t('academic.registration', 'Registration'), value: range(tm.registration_start, tm.registration_end) },
                        { label: t('academic.add_drop_end', 'Add/drop deadline'), value: long(tm.add_drop_end) },
                        { label: t('academic.exams', 'Exams'), value: range(tm.exam_start, tm.exam_end) },
                        { label: t('academic.grade_deadline', 'Grade deadline'), value: long(tm.grade_deadline) },
                      ]
                      return (
                        <div key={tm.term_uuid} className={cn('group relative rounded-2xl border bg-white p-4', isCurrent ? 'border-[hsl(var(--dash-accent))]/50 shadow-[0_12px_28px_-20px_hsl(43_80%_40%/0.8)]' : 'border-[hsl(var(--dash-border))]/70')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{tm.code}</span>
                                {isCurrent ? <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-ink))]', GOLD)}>{t('academic.nav.current_term', 'Current term')}</span> : null}
                              </div>
                              <p className="mt-1.5 truncate text-[15px] font-semibold">{tm.name || tm.code}</p>
                              <p className="text-[12px] text-[hsl(var(--dash-muted))]">{range(tm.start_date, tm.end_date) || '—'}</p>
                            </div>
                            <StatusPill status={tm.status} />
                          </div>
                          {progress ? (
                            <div className="mt-3">
                              <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                                <div className={cn('h-full rounded-full', GOLD)} style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                              </div>
                              <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.nav.week_of', 'Week {{week}} of {{total}}', { week: progress.week, total: progress.totalWeeks })}</p>
                            </div>
                          ) : null}
                          <dl className="mt-3 space-y-1 border-t border-[hsl(var(--dash-border))]/60 pt-3 text-[12px]">
                            {keyDates.map((k) => (
                              <div key={k.label} className="flex items-baseline justify-between gap-2">
                                <dt className="text-[hsl(var(--dash-muted))]">{k.label}</dt>
                                <dd className={cn('text-end', k.value ? 'font-medium' : 'text-[hsl(var(--dash-muted))]')}>{k.value || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="absolute end-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <IconButton onClick={() => setTermDrawer({ year, term: tm })} aria-label={t('academic.edit', 'Edit')} className="bg-white">
                              <PencilSimple size={15} />
                            </IconButton>
                            <IconButton
                              tone="danger"
                              className="bg-white"
                              onClick={() =>
                                remove(
                                  t('academic.cal.delete_term', 'Delete {{code}}?', { code: tm.code }),
                                  t('academic.cal.delete_term_message', 'Terms with offerings or intakes cannot be deleted; close them instead.'),
                                  () => deleteTerm(tm.term_uuid, access_token)
                                )
                              }
                              aria-label={t('academic.delete', 'Delete')}
                            >
                              <Trash size={15} />
                            </IconButton>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <PostgradDrawer
        isDialogOpen={!!yearDrawer}
        onOpenChange={(o: boolean) => !o && setYearDrawer(null)}
        icon={<CalendarDots size={20} weight="duotone" />}
        dialogTitle={yearDrawer?.year ? `${t('academic.edit', 'Edit')} ${yearDrawer.year.code}` : t('academic.new_academic_year', 'New academic year')}
        dialogDescription={t('academic.cal.year_desc', 'An academic year groups its terms, e.g. 2026/2027 with Fall and Spring.')}
        dialogContent={
          yearDrawer ? (
            <YearForm
              year={yearDrawer.year}
              onDone={() => {
                setYearDrawer(null)
                refresh()
              }}
            />
          ) : null
        }
      />
      <PostgradDrawer
        isDialogOpen={!!termDrawer}
        onOpenChange={(o: boolean) => !o && setTermDrawer(null)}
        minWidth="md"
        icon={<CalendarPlus size={20} weight="duotone" />}
        dialogTitle={termDrawer?.term ? `${t('academic.edit', 'Edit')} ${termDrawer.term.code}` : `${t('academic.new_term', 'New term')} · ${termDrawer?.year?.code || ''}`}
        dialogDescription={t('academic.cal.term_desc', 'Its dates drive registration, the current-term views and grade deadlines.')}
        dialogContent={
          termDrawer ? (
            <TermForm
              year={termDrawer.year}
              term={termDrawer.term}
              onDone={() => {
                setTermDrawer(null)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function YearForm({ year, onDone }: { year?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [now] = useState(() => new Date().getFullYear())
  const [code, setCode] = useState(year?.code || `${now}/${now + 1}`)
  const [startDate, setStartDate] = useState(year?.start_date || '')
  const [endDate, setEndDate] = useState(year?.end_date || '')
  const [status, setStatus] = useState(year?.status || 'planned')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (startDate && endDate && endDate < startDate) {
      setError(String(t('administration.validation.date_range', 'End date must be on or after the start date')))
      return
    }
    setError('')
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
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('academic.academic_year')}>
        <Field label={t('academic.academic_year')} required hint={t('academic.cal.year_code_hint', 'Format YYYY/YYYY')}>
          <input className={cn(inputCls, 'font-mono')} value={code} onChange={(e) => setCode(e.target.value)} placeholder="2026/2027" required />
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
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')} error={error}>
          <input type="date" className={inputCls} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-invalid={!!error} />
        </Field>
      </FormSection>
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const setDate = (k: string, v: string) => setDates((d) => ({ ...d, [k]: v }))

  const [y1, y2] = String(year.code).split('/')
  const preview = termType === 'custom' ? code.toUpperCase() || '—' : `${termType.toUpperCase()}-${dates.start_date?.slice(0, 4) || (termType === 'fall' ? y1 : y2)}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const order = String(t('administration.validation.date_range', 'End date must be on or after the start date'))
    const next: Record<string, string> = {}
    for (const [a, b] of [
      ['start_date', 'end_date'],
      ['registration_start', 'registration_end'],
      ['exam_start', 'exam_end'],
    ]) {
      if (dates[a] && dates[b] && dates[b] < dates[a]) next[b] = order
    }
    if (termType === 'custom' && !term && !code.trim()) next.code = String(t('administration.validation.required', 'Required'))
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const cleaned = Object.fromEntries(Object.entries(dates).map(([k, v]) => [k, v || null]))
      if (term) {
        await updateTerm(term.term_uuid, { ...cleaned, name: name || null, status }, access_token)
      } else {
        await createTerm(
          orgId,
          { ...cleaned, academic_year_uuid: year.academic_year_uuid, term_type: termType, code: termType === 'custom' ? code : null, name: name || null, status },
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
    <Field label={label} error={errors[key]}>
      <input type="date" className={inputCls} value={dates[key]} onChange={(e) => setDate(key, e.target.value)} aria-invalid={!!errors[key]} />
    </Field>
  )

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('academic.cal.section_term', 'Term')}>
        <Field label={t('academic.term_type', 'Term type')}>
          <select className={inputCls} value={termType} onChange={(e) => setTermType(e.target.value)} disabled={!!term}>
            {TERM_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`academic.term_${tt}`, tt)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.code')} error={errors.code} hint={termType === 'custom' && !term ? undefined : t('academic.code_generated', 'Generated automatically')}>
          {termType === 'custom' && !term ? (
            <input className={cn(inputCls, 'font-mono')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={!!errors.code} />
          ) : (
            <div className="flex h-[38px] items-center rounded-lg border border-dashed border-[hsl(var(--dash-border))] px-3 font-mono text-sm text-[hsl(var(--dash-muted))]">{term?.code || preview}</div>
          )}
        </Field>
        <Field label={t('academic.name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={preview.replace('-', ' ')} />
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
      </FormSection>
      <FormSection title={t('academic.cal.section_teaching', 'Teaching period')}>
        {dateField('start_date', t('academic.start_date'))}
        {dateField('end_date', t('academic.end_date'))}
      </FormSection>
      <FormSection title={t('academic.registration', 'Registration')}>
        {dateField('registration_start', t('academic.registration_start', 'Registration opens'))}
        {dateField('registration_end', t('academic.registration_end', 'Registration closes'))}
        {dateField('add_drop_end', t('academic.add_drop_end', 'Add/drop deadline'))}
      </FormSection>
      <FormSection title={t('academic.cal.section_exams', 'Exams and results')}>
        {dateField('exam_start', t('academic.exam_start', 'Exams start'))}
        {dateField('exam_end', t('academic.exam_end', 'Exams end'))}
        {dateField('grade_deadline', t('academic.grade_deadline', 'Grade deadline'))}
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default AcademicCalendar
