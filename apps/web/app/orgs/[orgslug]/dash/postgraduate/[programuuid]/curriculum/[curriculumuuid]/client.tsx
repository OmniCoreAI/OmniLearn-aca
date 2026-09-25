'use client'
import React, { useMemo, useState } from 'react'
import { GraduationCap, Plus, Trash2, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  Stat,
  StatusPill,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getProgram } from '@services/academic/academic'
import {
  addCurriculumItem,
  getAcademicCourses,
  getCurriculum,
  removeCurriculumItem,
  updateCurriculum,
} from '@services/academic/core'

function CurriculumEditor({
  orgslug,
  programuuid,
  curriculumuuid,
}: {
  orgslug: string
  programuuid: string
  curriculumuuid: string
}) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const curriculum_uuid = `curriculum_${curriculumuuid}`
  const program_uuid = `program_${programuuid}`
  const [addSlot, setAddSlot] = useState<null | { year_no: number; term_no: number }>(null)

  const { data: program } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: curriculum } = useQuery({
    queryKey: ['academic', 'curriculum', curriculum_uuid],
    queryFn: () => getCurriculum(curriculum_uuid, access_token),
    enabled: !!access_token,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'curriculum', curriculum_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'curricula', program_uuid] })
  }

  const locked = !!curriculum && (curriculum.cohort_count > 0 || curriculum.status === 'retired')

  // Group items into Year -> Term slots; always show at least the years spanned
  // by the program duration so empty terms can be filled in.
  const years = useMemo(() => {
    const items: any[] = curriculum?.items || []
    const byYear: Record<number, Record<number, any[]>> = {}
    const yearsFromDuration = Math.max(1, Math.ceil((program?.duration_months || 12) / 12))
    const maxYear = Math.max(yearsFromDuration, ...items.map((i) => i.year_no), 1)
    for (let y = 1; y <= maxYear; y++) byYear[y] = { 1: [], 2: [] }
    items.forEach((i) => {
      byYear[i.year_no] = byYear[i.year_no] || { 1: [], 2: [] }
      byYear[i.year_no][i.term_no] = byYear[i.year_no][i.term_no] || []
      byYear[i.year_no][i.term_no].push(i)
    })
    return byYear
  }, [curriculum, program])

  const setStatus = async (status: string) => {
    try {
      await updateCurriculum(curriculum_uuid, { status }, access_token)
      toast.success(t('academic.updated'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  const remove = async (item: any) => {
    try {
      await removeCurriculumItem(curriculum_uuid, item.curriculum_item_uuid, access_token)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('academic.postgraduate_studies'),
            href: getUriWithOrg(orgslug, '/dash/postgraduate'),
            icon: <GraduationCap size={14} />,
          },
          { label: program?.name || t('academic.program'), href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`) },
          { label: `${t('academic.curriculum', 'Curriculum')} ${curriculum?.version || ''}` },
        ]}
      />
      <AcademicHeader
        title={`${t('academic.curriculum', 'Curriculum')} ${curriculum?.version || ''}`}
        subtitle={curriculum?.name}
        action={
          curriculum && (
            <>
              {curriculum.status === 'draft' && (
                <GhostButton onClick={() => setStatus('active')}>{t('academic.activate', 'Activate')}</GhostButton>
              )}
              {curriculum.status !== 'retired' && (
                <GhostButton onClick={() => window.confirm(t('academic.confirm_retire', 'Retire this version? It can no longer be assigned to new cohorts.')) && setStatus('retired')}>
                  {t('academic.retire', 'Retire')}
                </GhostButton>
              )}
            </>
          )
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label={t('academic.status')} value={<StatusPill status={curriculum?.status} />} />
          <Stat label={t('academic.total_credits', 'Total credits')} value={curriculum?.total_credits} />
          <Stat label={t('academic.required_credits', 'Required credits')} value={curriculum?.required_credits} />
          <Stat label={t('academic.elective_credits', 'Elective credits')} value={curriculum?.elective_credits} />
          <Stat
            label={t('academic.program_minimum', 'Program minimum')}
            value={program?.min_credits != null ? program.min_credits : '—'}
          />
        </div>

        {locked && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {curriculum?.status === 'retired'
              ? t('academic.curriculum_retired_note', 'This version is retired and read-only.')
              : t(
                  'academic.curriculum_locked_note',
                  'Cohorts follow this version, so its structure is frozen to protect their academic records. Clone it into a new version to change the plan for future intakes.'
                )}
          </div>
        )}

        {Object.entries(years).map(([year, terms]) => (
          <Section key={year} title={t('academic.year_n', { n: year, defaultValue: `Year ${year}` })}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(terms).map(([term, items]) => {
                const credits = (items as any[]).reduce((sum, i) => sum + (i.credits || 0), 0)
                return (
                  <div key={term} className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {t('academic.term_n', { n: term, defaultValue: `Term ${term}` })}
                        <span className="ms-2 text-xs font-normal text-[hsl(var(--dash-muted))]">
                          {credits} {t('academic.credits', 'Credits').toLowerCase()}
                        </span>
                      </div>
                      {!locked && (
                        <GhostButton onClick={() => setAddSlot({ year_no: Number(year), term_no: Number(term) })}>
                          <Plus className="h-3.5 w-3.5" /> {t('academic.add_course', 'Add course')}
                        </GhostButton>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {(items as any[]).length === 0 && (
                        <li className="py-3 text-center text-xs text-[hsl(var(--dash-muted))]">
                          {t('academic.no_courses_in_term', 'No courses in this term')}
                        </li>
                      )}
                      {(items as any[]).map((item) => (
                        <li
                          key={item.curriculum_item_uuid}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[hsl(var(--dash-surface))] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              <span className="font-mono text-xs text-[hsl(var(--dash-muted))]">{item.course_code}</span>{' '}
                              {item.course_name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[hsl(var(--dash-muted))]">
                              <StatusPill status={item.requirement} />
                              <span>
                                {item.credits} {t('academic.credits', 'Credits').toLowerCase()}
                              </span>
                              {item.min_passing_grade && (
                                <span>
                                  {t('academic.min_grade', 'Min grade')} {item.min_passing_grade}
                                </span>
                              )}
                            </div>
                          </div>
                          {!locked && (
                            <IconButton tone="danger" onClick={() => remove(item)} aria-label={t('academic.delete', 'Delete')}>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </Section>
        ))}

        {!locked && (
          <GhostButton
            onClick={() => setAddSlot({ year_no: Object.keys(years).length + 1, term_no: 1 })}
          >
            <Plus className="h-3.5 w-3.5" /> {t('academic.add_year', 'Add year')}
          </GhostButton>
        )}
      </div>

      <Modal
        isDialogOpen={!!addSlot}
        onOpenChange={(open: boolean) => !open && setAddSlot(null)}
        minWidth="sm"
        dialogTitle={t('academic.add_course', 'Add course')}
        dialogContent={
          addSlot && (
            <AddItemForm
              curriculumUuid={curriculum_uuid}
              slot={addSlot}
              existing={(curriculum?.items || []).map((i: any) => i.academic_course_uuid)}
              onDone={() => {
                setAddSlot(null)
                refresh()
              }}
            />
          )
        }
      />
    </AcademicPageShell>
  )
}

function AddItemForm({
  curriculumUuid,
  slot,
  existing,
  onDone,
}: {
  curriculumUuid: string
  slot: { year_no: number; term_no: number }
  existing: string[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [course, setCourse] = useState('')
  const [yearNo, setYearNo] = useState(slot.year_no)
  const [termNo, setTermNo] = useState(slot.term_no)
  const [requirement, setRequirement] = useState('required')
  const [minGrade, setMinGrade] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: courses = [] } = useQuery({
    queryKey: ['academic', 'catalog', orgId, ''],
    queryFn: () => getAcademicCourses(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const available = courses.filter((c: any) => !existing.includes(c.academic_course_uuid) && c.status !== 'retired')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!course) return
    setSaving(true)
    try {
      await addCurriculumItem(
        curriculumUuid,
        {
          academic_course_uuid: course,
          year_no: yearNo,
          term_no: termNo,
          requirement,
          min_passing_grade: minGrade || null,
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
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.catalog_course', 'Catalog course')}>
        <select className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)} required>
          <option value="">—</option>
          {available.map((c: any) => (
            <option key={c.academic_course_uuid} value={c.academic_course_uuid}>
              {c.code} · {c.name} ({c.credits} {t('academic.credits', 'Credits').toLowerCase()})
            </option>
          ))}
        </select>
        {available.length === 0 && (
          <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">
            {t('academic.catalog_empty_hint', 'Create courses in the Course Catalog first.')}
          </p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.year', 'Year')}>
          <input type="number" min={1} max={10} className={inputCls} value={yearNo} onChange={(e) => setYearNo(Number(e.target.value))} />
        </Field>
        <Field label={t('academic.term', 'Term')}>
          <select className={inputCls} value={termNo} onChange={(e) => setTermNo(Number(e.target.value))}>
            <option value={1}>{t('academic.term_n', { n: 1, defaultValue: 'Term 1' })}</option>
            <option value={2}>{t('academic.term_n', { n: 2, defaultValue: 'Term 2' })}</option>
            <option value={3}>{t('academic.term_summer', 'Summer')}</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.requirement', 'Requirement')}>
          <select className={inputCls} value={requirement} onChange={(e) => setRequirement(e.target.value)}>
            <option value="required">{t('academic.state_required', 'Required')}</option>
            <option value="elective">{t('academic.state_elective', 'Elective')}</option>
          </select>
        </Field>
        <Field label={t('academic.min_grade', 'Min grade')}>
          <input className={inputCls} value={minGrade} onChange={(e) => setMinGrade(e.target.value)} placeholder="C" />
        </Field>
      </div>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default CurriculumEditor
