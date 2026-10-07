'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Archive, ChalkboardTeacher, CheckCircle, Exam, GraduationCap, MagicWand, NotePencil, PlayCircle, Plus, SquaresFour, Warning, XCircle } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { LecturerPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { PostgradDrawer } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { PostgradTabs, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { OfferingsTable } from '@components/Dashboard/Pages/Academic/OfferingsTable'
import { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { pickCurrentTerm } from '@components/Dashboard/Menus/postgradNavItems'
import { getPrograms, getProgramCohorts } from '@services/academic/academic'
import { createOffering, displayName, getAcademicCourses, getOfferings, getTerms } from '@services/academic/core'
import { FacilitySelect } from '@components/Dashboard/Pages/Administration/Pickers'
import { cn } from '@/lib/utils'

const LIVE = ['planned', 'open', 'in_progress']
const SEGMENTS: { key: string; labelKey: string; label: string; Icon: React.ElementType }[] = [
  { key: 'all', labelKey: 'academic.off.all', label: 'All offerings', Icon: SquaresFour },
  { key: 'planned', labelKey: 'academic.state_planned', label: 'Planned', Icon: NotePencil },
  { key: 'open', labelKey: 'academic.state_open', label: 'Open', Icon: CheckCircle },
  { key: 'in_progress', labelKey: 'academic.state_in_progress', label: 'In progress', Icon: PlayCircle },
  { key: 'completed', labelKey: 'academic.state_completed', label: 'Completed', Icon: Archive },
  { key: 'cancelled', labelKey: 'academic.state_cancelled', label: 'Cancelled', Icon: XCircle },
]

function OfferingsList({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  // null = follow the current term once terms load; '' = all terms.
  const [termChoice, setTermChoice] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [flag, setFlag] = useState<'' | 'no_lecturer' | 'grades'>('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const { data: terms = [] } = useQuery({ queryKey: ['academic', 'terms', orgId], queryFn: () => getTerms(orgId, access_token), enabled: ready })
  const current = useMemo(() => pickCurrentTerm(terms as any[]), [terms])
  const term = termChoice ?? current?.term_uuid ?? ''
  const { data: offerings = [], isLoading } = useQuery({
    queryKey: ['academic', 'offerings', orgId, term],
    queryFn: () => getOfferings(orgId, access_token, { term_uuid: term || undefined }),
    enabled: ready,
  })

  const all = offerings as any[]
  const noLecturer = all.filter((o) => LIVE.includes(o.status) && !o.instructor)
  const gradesWaiting = all.filter((o) => o.grade_status === 'submitted')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (o) =>
        (status === 'all' || o.status === status) &&
        (flag !== 'no_lecturer' || (LIVE.includes(o.status) && !o.instructor)) &&
        (flag !== 'grades' || o.grade_status === 'submitted') &&
        (!q || `${o.code} ${o.course_code} ${o.course_name} ${o.instructor ? displayName(o.instructor) : ''} ${o.cohort_code || ''}`.toLowerCase().includes(q))
    )
  }, [all, status, flag, query])

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_offerings', 'Course Offerings') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_offerings', 'Course Offerings')}
        subtitle={t('academic.offerings_desc', 'Each offering is one delivery of a catalog course in a term, with its own instructor, schedule, roster and materials.')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={getUriWithOrg(orgslug, '/dash/postgraduate/offerings/auto-schedule')}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
            >
              <MagicWand size={16} weight="bold" /> {t('academic.auto.title', 'Auto-schedule')}
            </Link>
            <AcademicPrimaryButton onClick={() => setOpen(true)}>
              <Plus size={16} weight="bold" /> {t('academic.new_offering', 'New offering')}
            </AcademicPrimaryButton>
          </div>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="dash-card mb-4 grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 sm:grid-cols-3 xl:grid-cols-6" role="tablist">
        {SEGMENTS.map(({ key, labelKey, label, Icon }) => {
          const n = key === 'all' ? all.length : all.filter((o) => o.status === key).length
          const active = status === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(key)}
              className={cn('group flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-start transition-all', active ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_10px_24px_-12px_hsl(0_0%_8%/0.6)]' : 'hover:bg-[hsl(var(--dash-canvas))]')}
            >
              <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-white/10 text-[hsl(43_80%_62%)]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
                <Icon size={18} weight={active ? 'fill' : 'duotone'} />
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>{t(labelKey, label)}</span>
                <span className="block text-lg font-semibold leading-tight tabular-nums">{n}</span>
              </span>
            </button>
          )
        })}
      </div>

      {noLecturer.length || gradesWaiting.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {noLecturer.length ? (
            <button
              type="button"
              onClick={() => setFlag(flag === 'no_lecturer' ? '' : 'no_lecturer')}
              aria-pressed={flag === 'no_lecturer'}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', flag === 'no_lecturer' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100')}
            >
              <Warning size={14} weight="bold" /> {t('academic.off.flag_no_lecturer', '{{count}} without a lecturer', { count: noLecturer.length })}
            </button>
          ) : null}
          {gradesWaiting.length ? (
            <button
              type="button"
              onClick={() => setFlag(flag === 'grades' ? '' : 'grades')}
              aria-pressed={flag === 'grades'}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', flag === 'grades' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-800 hover:bg-violet-100')}
            >
              <Exam size={14} weight="bold" /> {t('academic.off.flag_grades', '{{count}} gradebooks awaiting approval', { count: gradesWaiting.length })}
            </button>
          ) : null}
        </div>
      ) : null}

      <OfferingsTable
        orgslug={orgslug}
        offerings={visible}
        loading={isLoading}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('academic.off.search', 'Course, code or lecturer')} />
            <ToolbarSelect
              label={t('academic.term', 'Term')}
              value={term || 'all'}
              onChange={(v) => setTermChoice(v === 'all' ? '' : v)}
              options={[
                { value: 'all', label: t('academic.all_terms', 'All terms') },
                ...(terms as any[]).map((tm) => ({ value: tm.term_uuid, label: `${tm.code}${tm.term_uuid === current?.term_uuid ? ` · ${t('academic.nav.current_term', 'Current term')}` : ''}` })),
              ]}
            />
          </>
        }
      />

      <PostgradDrawer
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        icon={<ChalkboardTeacher size={20} weight="duotone" />}
        dialogTitle={t('academic.new_offering', 'New offering')}
        dialogDescription={t('academic.off.form_desc', 'Schedule a catalog course in a term. Leave the program empty for an open offering anyone can register for.')}
        dialogContent={
          <OfferingCreateForm
            terms={terms as any[]}
            defaultTerm={term}
            onDone={() => {
              setOpen(false)
              queryClient.invalidateQueries({ queryKey: ['academic', 'offerings', orgId] })
              queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function OfferingCreateForm({ terms, defaultTerm, onDone }: { terms: any[]; defaultTerm?: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [course, setCourse] = useState('')
  const [term, setTerm] = useState(defaultTerm || '')
  const [program, setProgram] = useState('')
  const [cohort, setCohort] = useState('')
  const [section, setSection] = useState('A')
  const [capacity, setCapacity] = useState('')
  const [classroom, setClassroom] = useState('')
  const [facility, setFacility] = useState('')
  const [instructor, setInstructor] = useState<string | null>(null)
  const [instructorLabel, setInstructorLabel] = useState<string | undefined>()
  const [cloneTemplate, setCloneTemplate] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const { data: courses = [] } = useQuery({ queryKey: ['academic', 'catalog', orgId, ''], queryFn: () => getAcademicCourses(orgId, access_token), enabled: !!orgId && !!access_token })
  const { data: programs = [] } = useQuery({ queryKey: ['academic', 'programs', orgId], queryFn: () => getPrograms(orgId, access_token), enabled: !!orgId && !!access_token })
  const { data: cohorts = [] } = useQuery({ queryKey: ['academic', 'cohorts', program], queryFn: () => getProgramCohorts(program, access_token), enabled: !!program && !!access_token })
  const selectedCourse = (courses as any[]).find((c) => c.academic_course_uuid === course)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required = String(t('administration.validation.required', 'Required'))
    const next: Record<string, string> = {}
    if (!course) next.course = required
    if (!term) next.term = required
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await createOffering(
        orgId,
        {
          academic_course_uuid: course,
          term_uuid: term,
          cohort_uuid: cohort || null,
          section,
          capacity: capacity === '' ? null : Number(capacity),
          classroom: classroom || null,
          facility_uuid: facility || null,
          instructor_uuid: instructor,
          clone_template: cloneTemplate,
        },
        access_token
      )
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('academic.off.section_course', 'Course and term')}>
        <Field label={t('academic.catalog_course', 'Catalog course')} required error={errors.course} className="sm:col-span-2">
          <select className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)} aria-invalid={!!errors.course}>
            <option value="">—</option>
            {(courses as any[])
              .filter((c) => c.status !== 'retired')
              .map((c) => (
                <option key={c.academic_course_uuid} value={c.academic_course_uuid}>
                  {c.code} · {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('academic.term', 'Term')} required error={errors.term}>
          <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} aria-invalid={!!errors.term}>
            <option value="">—</option>
            {terms.map((tm: any) => (
              <option key={tm.term_uuid} value={tm.term_uuid}>
                {tm.code} · {tm.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.section', 'Section')} hint={t('academic.off.section_hint', 'A, B… when a course runs more than once')}>
          <input className={inputCls} value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.off.section_audience', 'Who takes it')}>
        <Field label={t('academic.program')}>
          <select
            className={inputCls}
            value={program}
            onChange={(e) => {
              setProgram(e.target.value)
              setCohort('')
            }}
          >
            <option value="">{t('academic.open_offering_opt', 'None (open offering)')}</option>
            {(programs as any[]).map((p) => (
              <option key={p.program_uuid} value={p.program_uuid}>
                {p.code ? `${p.code} · ` : ''}
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.cohort', 'Cohort')}>
          <select className={inputCls} value={cohort} onChange={(e) => setCohort(e.target.value)} disabled={!program}>
            <option value="">—</option>
            {(cohorts as any[]).map((c) => (
              <option key={c.cohort_uuid} value={c.cohort_uuid}>
                {c.code || c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.capacity')} hint={t('training.capacity_hint', 'Leave empty for open seats')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.off.section_delivery', 'Lecturer and room')}>
        <Field label={t('academic.instructor', 'Instructor')} className="sm:col-span-2">
          <LecturerPicker
            orgId={orgId}
            access_token={access_token}
            value={instructor}
            selectedLabel={instructorLabel}
            onChange={(uuid, label) => {
              setInstructor(uuid)
              setInstructorLabel(label)
            }}
          />
        </Field>
        <Field label={t('administration.facilities.default_room', 'Room / facility')}>
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} />
        </Field>
        <Field label={t('academic.classroom')}>
          <input className={inputCls} value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder={t('administration.facilities.free_text_hint', 'Optional free-text note')} />
        </Field>
        {selectedCourse?.template_course_uuid ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={cloneTemplate} onChange={(e) => setCloneTemplate(e.target.checked)} />
            {t('academic.clone_template_label', 'Start the content course from the catalog template')}
          </label>
        ) : null}
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default OfferingsList
