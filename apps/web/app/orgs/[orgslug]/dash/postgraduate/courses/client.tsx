'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Books, Flask, GraduationCap, MagnifyingGlass, PencilSimple, Plus, Scroll, SquaresFour, Star, Trash } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { PostgradTabs, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { createAcademicCourse, deleteAcademicCourse, getAcademicCourses, getOrgLmsCourses, setCoursePrerequisites, updateAcademicCourse } from '@services/academic/core'
import { cn } from '@/lib/utils'

const COURSE_TYPES = ['core', 'elective', 'research', 'thesis']
const COURSE_STATUSES = ['draft', 'active', 'retired']
const TYPE_ICON: Record<string, React.ElementType> = { core: Books, elective: Star, research: Flask, thesis: Scroll }
const TYPE_TONE: Record<string, string> = {
  core: 'bg-sky-50 text-sky-700',
  elective: 'bg-violet-50 text-violet-700',
  research: 'bg-emerald-50 text-emerald-700',
  thesis: 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]',
}

function CourseCatalog({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const { data: courses = [], isLoading } = useQuery({ queryKey: ['academic', 'catalog', orgId, ''], queryFn: () => getAcademicCourses(orgId, access_token), enabled: ready })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'catalog', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }
  const all = courses as any[]
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (c) => (type === 'all' || c.course_type === type) && (status === 'all' || c.status === status) && (!q || `${c.code} ${c.name} ${c.department || ''}`.toLowerCase().includes(q))
    )
  }, [all, type, status, query])
  const openForm = (c: any) => {
    setEditing(c)
    setOpen(true)
  }
  const remove = async (c: any) => {
    const ok = await ask({
      title: t('academic.cat.delete_title', 'Delete {{code}}?', { code: c.code }),
      message: t('academic.cat.delete_message', 'Courses used by a curriculum or an offering cannot be deleted; retire them instead.'),
      confirmText: t('academic.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok === null) return
    try {
      await deleteAcademicCourse(c.academic_course_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  const newButton = (
    <AcademicPrimaryButton onClick={() => openForm(null)}>
      <Plus size={16} weight="bold" /> {t('academic.new_course', 'New course')}
    </AcademicPrimaryButton>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_catalog', 'Course Catalog') },
        ]}
      />
      <AcademicHeader title={t('academic.tab_catalog', 'Course Catalog')} subtitle={t('academic.catalog_desc', 'Every academic course is defined once here and reused by curricula and course offerings.')} action={newButton} />
      <PostgradTabs orgslug={orgslug} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ key: 'all', count: all.length }, ...COURSE_TYPES.map((k) => ({ key: k, count: all.filter((c) => c.course_type === k).length }))].map(({ key, count }) => {
          const Icon = key === 'all' ? SquaresFour : TYPE_ICON[key]
          const active = type === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                active ? 'bg-[hsl(var(--dash-ink))] text-white' : 'border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-ink))]/75 hover:-translate-y-0.5 hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              <Icon size={13} weight={active ? 'fill' : 'duotone'} />
              {key === 'all' ? t('academic.cat.all_types', 'All courses') : String(t(`academic.ctype_${key}`, key))}
              <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>{count}</span>
            </button>
          )
        })}
      </div>

      <DashDataTable
        rows={visible}
        rowKey={(c: any) => c.academic_course_uuid}
        loading={isLoading}
        onRowClick={openForm}
        initialSort={{ key: 'course', dir: 'asc' }}
        itemLabel={(n) => t('academic.cat.count', '{{count}} courses', { count: n })}
        actions={(c: any) => [
          { label: t('academic.edit', 'Edit'), icon: <PencilSimple size={14} />, onSelect: () => openForm(c) },
          { label: t('academic.delete', 'Delete'), icon: <Trash size={14} />, tone: 'danger', onSelect: () => remove(c) },
        ]}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('academic.search_code_name', 'Search by code or name')} />
            <ToolbarSelect
              label={t('academic.status')}
              value={status}
              onChange={setStatus}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...COURSE_STATUSES.map((s) => ({ value: s, label: String(t(`academic.state_${s}`, s)) }))]}
            />
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<Books size={24} />}
            title={query || type !== 'all' || status !== 'all' ? t('administration.common.no_matches', 'No matches') : t('academic.catalog_empty', 'No courses in the catalog yet.')}
            description={t('academic.cat.empty_hint', 'Add each course once — code, credits and prerequisites — then use it in curricula and offerings.')}
            action={query || type !== 'all' || status !== 'all' ? undefined : newButton}
          />
        }
        columns={[
          {
            key: 'course',
            header: t('academic.course', 'Course'),
            primary: true,
            sortValue: (c: any) => c.code,
            cell: (c: any) => (
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{c.code}</span>
                  <span className="truncate font-medium">{c.name}</span>
                </div>
                {c.department ? <div className="mt-1 truncate text-[11px] text-[hsl(var(--dash-muted))]">{c.department}</div> : null}
              </div>
            ),
          },
          {
            key: 'type',
            header: t('academic.course_type', 'Type'),
            sortValue: (c: any) => c.course_type,
            cell: (c: any) => {
              const Icon = TYPE_ICON[c.course_type] || Books
              return (
                <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE_TONE[c.course_type] || 'bg-slate-50 text-slate-600')}>
                  <Icon size={12} weight="duotone" /> {String(t(`academic.ctype_${c.course_type}`, c.course_type))}
                </span>
              )
            },
          },
          {
            key: 'credits',
            header: t('academic.credits', 'Credits'),
            align: 'end',
            sortValue: (c: any) => c.credits,
            cell: (c: any) => (
              <div className="text-end leading-tight">
                <div className="font-semibold tabular-nums">{c.credits}</div>
                {c.contact_hours != null ? <div className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.cat.hours', '{{count}} h', { count: c.contact_hours })}</div> : null}
              </div>
            ),
          },
          {
            key: 'prereqs',
            header: t('academic.prerequisites', 'Prerequisites'),
            hideBelow: 'lg',
            cell: (c: any) =>
              c.prerequisites.length ? (
                <div className="flex flex-wrap gap-1">
                  {c.prerequisites.map((p: any) => (
                    <span key={p.academic_course_uuid} className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px]">
                      {p.code}
                      {p.min_grade ? <span className="text-[hsl(var(--dash-muted))]"> ≥{p.min_grade}</span> : null}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[hsl(var(--dash-muted))]">—</span>
              ),
          },
          { key: 'offerings', header: t('academic.offerings_count', 'Offerings'), align: 'end', hideBelow: 'xl', sortValue: (c: any) => c.offering_count, cell: (c: any) => <span className="tabular-nums">{c.offering_count}</span> },
          { key: 'status', header: t('academic.status'), sortValue: (c: any) => c.status, cell: (c: any) => <StatusPill status={c.status} /> },
        ]}
      />

      <PostgradDrawer
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        icon={<Books size={20} weight="duotone" />}
        dialogTitle={editing ? `${t('academic.edit', 'Edit')} ${editing.code}` : t('academic.new_course', 'New course')}
        dialogDescription={t('academic.cat.form_desc', 'Defined once and reused by every curriculum and offering that includes it.')}
        dialogContent={
          <CourseForm
            orgslug={orgslug}
            course={editing}
            allCourses={all}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function CourseForm({ orgslug, course, allCourses, onDone }: { orgslug: string; course: any; allCourses: any[]; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [code, setCode] = useState(course?.code || '')
  const [name, setName] = useState(course?.name || '')
  const [description, setDescription] = useState(course?.description || '')
  const [credits, setCredits] = useState<string>(course ? String(course.credits) : '3')
  const [contactHours, setContactHours] = useState<string>(course?.contact_hours != null ? String(course.contact_hours) : '')
  const [level, setLevel] = useState<string>(course?.level != null ? String(course.level) : '')
  const [courseType, setCourseType] = useState(course?.course_type || 'core')
  const [department, setDepartment] = useState(course?.department || '')
  const [status, setStatus] = useState(course?.status || 'active')
  const [template, setTemplate] = useState<string>(course?.template_course_uuid || '')
  const [outcomes, setOutcomes] = useState<string>((course?.learning_outcomes || []).join('\n'))
  const [prereqs, setPrereqs] = useState<string[]>((course?.prerequisites || []).map((p: any) => p.academic_course_uuid))
  const [prereqQuery, setPrereqQuery] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const { data: lmsCourses = [] } = useQuery({ queryKey: ['academic', 'org-courses', orgslug], queryFn: () => getOrgLmsCourses(orgslug, access_token), enabled: !!access_token })
  const candidates = allCourses.filter(
    (c) => c.academic_course_uuid !== course?.academic_course_uuid && (!prereqQuery || `${c.code} ${c.name}`.toLowerCase().includes(prereqQuery.toLowerCase()))
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required = String(t('administration.validation.required', 'Required'))
    const next: Record<string, string> = {}
    if (!code.trim()) next.code = required
    if (!name.trim()) next.name = required
    if (credits === '' || Number(credits) < 0) next.credits = String(t('administration.validation.non_negative', 'Enter a number of 0 or more'))
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const payload = {
        code,
        name,
        description: description || null,
        credits: Number(credits || 0),
        contact_hours: contactHours === '' ? null : Number(contactHours),
        level: level === '' ? null : Number(level),
        course_type: courseType,
        department: department || null,
        status,
        template_course_uuid: template || null,
        learning_outcomes: outcomes
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean),
      }
      const saved = course ? await updateAcademicCourse(course.academic_course_uuid, payload, access_token) : await createAcademicCourse(orgId, payload, access_token)
      const before = (course?.prerequisites || []).map((p: any) => p.academic_course_uuid).sort().join()
      if (prereqs.slice().sort().join() !== before) {
        await setCoursePrerequisites(saved.academic_course_uuid, prereqs.map((uuid) => ({ prerequisite_uuid: uuid })), access_token)
      }
      toast.success(course ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.code')} required error={errors.code} hint={t('academic.cat.code_hint', 'Short and unique, e.g. AI-501')}>
          <input className={cn(inputCls, 'font-mono')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AI-501" aria-invalid={!!errors.code} />
        </Field>
        <Field label={t('academic.course_type', 'Type')}>
          <select className={inputCls} value={courseType} onChange={(e) => setCourseType(e.target.value)}>
            {COURSE_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {t(`academic.ctype_${ct}`, ct)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.name')} required error={errors.name} className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('academic.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {COURSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.state_${s}`, s)}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <FormSection title={t('academic.cat.section_load', 'Credits and level')} columns={3}>
        <Field label={t('academic.credits', 'Credits')} required error={errors.credits}>
          <input type="number" min={0} step="0.5" className={inputCls} value={credits} onChange={(e) => setCredits(e.target.value)} aria-invalid={!!errors.credits} />
        </Field>
        <Field label={t('academic.contact_hours', 'Contact hours')}>
          <input type="number" min={0} className={inputCls} value={contactHours} onChange={(e) => setContactHours(e.target.value)} />
        </Field>
        <Field label={t('academic.level')}>
          <input type="number" min={0} className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="500" />
        </Field>
      </FormSection>
      <FormSection title={t('academic.prerequisites', 'Prerequisites')} description={t('academic.cat.prereq_hint', 'Students must have passed these before registering.')} columns={1}>
        {prereqs.length ? (
          <div className="flex flex-wrap gap-1.5">
            {prereqs.map((uuid) => {
              const c = allCourses.find((x) => x.academic_course_uuid === uuid)
              return (
                <button key={uuid} type="button" onClick={() => setPrereqs((prev) => prev.filter((p) => p !== uuid))} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-ink))] px-2.5 py-1 font-mono text-[11px] text-white">
                  {c?.code || uuid} ×
                </button>
              )
            })}
          </div>
        ) : null}
        <label className="flex items-center gap-2 rounded-xl border border-[hsl(var(--dash-border))] bg-white px-3 py-2">
          <MagnifyingGlass size={15} className="text-[hsl(var(--dash-muted))]" />
          <input className="flex-1 bg-transparent text-sm focus:outline-none" value={prereqQuery} onChange={(e) => setPrereqQuery(e.target.value)} placeholder={t('academic.search_code_name', 'Search by code or name')} />
        </label>
        <div className="max-h-48 space-y-0.5 overflow-auto rounded-2xl border border-[hsl(var(--dash-border))] bg-white p-1.5">
          {candidates.length === 0 ? <div className="px-2 py-2 text-xs text-[hsl(var(--dash-muted))]">—</div> : null}
          {candidates.map((c) => (
            <label key={c.academic_course_uuid} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[hsl(var(--dash-canvas))]">
              <input
                type="checkbox"
                checked={prereqs.includes(c.academic_course_uuid)}
                onChange={(e) => setPrereqs((prev) => (e.target.checked ? [...prev, c.academic_course_uuid] : prev.filter((p) => p !== c.academic_course_uuid)))}
              />
              <span className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{c.code}</span> <span className="truncate">{c.name}</span>
            </label>
          ))}
        </div>
      </FormSection>
      <FormSection title={t('academic.cat.section_content', 'Content and outcomes')} columns={1}>
        <Field label={t('academic.template_course', 'Reusable materials (template LMS course)')} hint={t('academic.template_course_hint', 'Syllabus, references and standard lecture notes. Each new offering starts from a copy, so term-specific material never leaks between cohorts.')}>
          <select className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="">—</option>
            {(lmsCourses as any[]).map((c) => (
              <option key={c.course_uuid} value={c.course_uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.learning_outcomes', 'Learning outcomes (one per line)')}>
          <textarea className={inputCls} rows={4} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
        </Field>
        <Field label={t('academic.description')}>
          <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default CourseCatalog
