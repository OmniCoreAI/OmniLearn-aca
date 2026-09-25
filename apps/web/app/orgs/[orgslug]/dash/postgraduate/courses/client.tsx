'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2, Search } from 'lucide-react'
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
  IconButton,
  PostgradTabs,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  createAcademicCourse,
  deleteAcademicCourse,
  getAcademicCourses,
  getOrgLmsCourses,
  setCoursePrerequisites,
  updateAcademicCourse,
} from '@services/academic/core'

const COURSE_TYPES = ['core', 'elective', 'research', 'thesis']
const COURSE_STATUSES = ['draft', 'active', 'retired']

function CourseCatalog({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['academic', 'catalog', orgId, query],
    queryFn: () => getAcademicCourses(orgId, access_token, query),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'catalog', orgId] })

  const remove = async (c: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteAcademicCourse(c.academic_course_uuid, access_token)
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
          { label: t('academic.tab_catalog', 'Course Catalog') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_catalog', 'Course Catalog')}
        subtitle={t(
          'academic.catalog_desc',
          'Every academic course is defined once here and reused by curricula and course offerings.'
        )}
        action={
          <AcademicPrimaryButton
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> {t('academic.new_course', 'New course')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5">
        <Search className="h-4 w-4 text-[hsl(var(--dash-muted))]" />
        <input
          className="flex-1 bg-transparent text-sm focus:outline-none"
          placeholder={t('academic.search_code_name', 'Search by code or name')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        headers={[
          t('academic.code'),
          t('academic.name'),
          t('academic.credits', 'Credits'),
          t('academic.course_type', 'Type'),
          t('academic.level'),
          t('academic.prerequisites', 'Prerequisites'),
          t('academic.offerings_count', 'Offerings'),
          t('academic.status'),
          '',
        ]}
        empty={isLoading ? '…' : t('academic.catalog_empty', 'No courses in the catalog yet.')}
      >
        {courses.map((c: any) => (
          <tr key={c.academic_course_uuid}>
            <td className={`${tdCls} font-mono text-xs font-semibold`}>{c.code}</td>
            <td className={tdCls}>
              <div className="font-medium">{c.name}</div>
              {c.department && <div className="text-xs text-[hsl(var(--dash-muted))]">{c.department}</div>}
            </td>
            <td className={tdCls}>{c.credits}</td>
            <td className={tdCls}>{String(t(`academic.ctype_${c.course_type}`, c.course_type))}</td>
            <td className={tdCls}>{c.level ?? '—'}</td>
            <td className={`${tdCls} text-xs`}>{c.prerequisites.map((p: any) => p.code).join(', ') || '—'}</td>
            <td className={tdCls}>{c.offering_count}</td>
            <td className={tdCls}>
              <StatusPill status={c.status} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-right`}>
              <IconButton
                onClick={() => {
                  setEditing(c)
                  setOpen(true)
                }}
                aria-label={t('academic.edit', 'Edit')}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" onClick={() => remove(c)} aria-label={t('academic.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={editing ? `${t('academic.edit', 'Edit')} ${editing.code}` : t('academic.new_course', 'New course')}
        dialogContent={
          <CourseForm
            orgslug={orgslug}
            course={editing}
            allCourses={courses}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function CourseForm({
  orgslug,
  course,
  allCourses,
  onDone,
}: {
  orgslug: string
  course: any
  allCourses: any[]
  onDone: () => void
}) {
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
  const [saving, setSaving] = useState(false)

  const { data: lmsCourses = [] } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: () => getOrgLmsCourses(orgslug, access_token),
    enabled: !!access_token,
  })

  const candidates = allCourses.filter((c) => c.academic_course_uuid !== course?.academic_course_uuid)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const saved = course
        ? await updateAcademicCourse(course.academic_course_uuid, payload, access_token)
        : await createAcademicCourse(orgId, payload, access_token)
      const before = (course?.prerequisites || []).map((p: any) => p.academic_course_uuid).sort().join()
      if (prereqs.slice().sort().join() !== before) {
        await setCoursePrerequisites(
          saved.academic_course_uuid,
          prereqs.map((uuid) => ({ prerequisite_uuid: uuid })),
          access_token
        )
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.code')}>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AI-501" required />
        </Field>
        <div className="col-span-2">
          <Field label={t('academic.name')}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label={t('academic.credits', 'Credits')}>
          <input type="number" min={0} step="0.5" className={inputCls} value={credits} onChange={(e) => setCredits(e.target.value)} />
        </Field>
        <Field label={t('academic.contact_hours', 'Contact hours')}>
          <input type="number" min={0} className={inputCls} value={contactHours} onChange={(e) => setContactHours(e.target.value)} />
        </Field>
        <Field label={t('academic.level')}>
          <input type="number" min={0} className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="500" />
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
      </div>
      <div className="grid grid-cols-2 gap-3">
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
      </div>
      <Field label={t('academic.template_course', 'Reusable materials (template LMS course)')}>
        <select className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">—</option>
          {(lmsCourses as any[]).map((c) => (
            <option key={c.course_uuid} value={c.course_uuid}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">
          {t(
            'academic.template_course_hint',
            'Syllabus, references and standard lecture notes. Each new offering starts from a copy, so term-specific material never leaks between cohorts.'
          )}
        </p>
      </Field>
      <Field label={t('academic.prerequisites', 'Prerequisites')}>
        <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-[hsl(var(--dash-border))] p-2">
          {candidates.length === 0 && <div className="text-xs text-[hsl(var(--dash-muted))]">—</div>}
          {candidates.map((c) => (
            <label key={c.academic_course_uuid} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prereqs.includes(c.academic_course_uuid)}
                onChange={(e) =>
                  setPrereqs((prev) =>
                    e.target.checked ? [...prev, c.academic_course_uuid] : prev.filter((p) => p !== c.academic_course_uuid)
                  )
                }
              />
              <span className="font-mono text-xs">{c.code}</span> {c.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label={t('academic.learning_outcomes', 'Learning outcomes (one per line)')}>
        <textarea className={inputCls} rows={3} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
      </Field>
      <Field label={t('academic.description')}>
        <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default CourseCatalog
