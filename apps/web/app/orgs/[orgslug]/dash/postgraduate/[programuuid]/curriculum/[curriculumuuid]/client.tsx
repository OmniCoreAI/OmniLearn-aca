'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Archive, CheckCircle, GraduationCap, ListChecks, Lock, Plus, Trash, Warning } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, IconButton, PostgradTabs, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getProgram } from '@services/academic/academic'
import { addCurriculumItem, getAcademicCourses, getCurriculum, removeCurriculumItem, updateCurriculum } from '@services/academic/core'
import { cn } from '@/lib/utils'

const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

function CurriculumEditor({ orgslug, programuuid, curriculumuuid }: { orgslug: string; programuuid: string; curriculumuuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const curriculum_uuid = `curriculum_${curriculumuuid}`
  const program_uuid = `program_${programuuid}`
  const [addSlot, setAddSlot] = useState<null | { year_no: number; term_no: number }>(null)

  const { data: program } = useQuery({ queryKey: ['academic', 'program', program_uuid], queryFn: () => getProgram(program_uuid, access_token), enabled: !!access_token })
  const { data: curriculum } = useQuery({ queryKey: ['academic', 'curriculum', curriculum_uuid], queryFn: () => getCurriculum(curriculum_uuid, access_token), enabled: !!access_token })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'curriculum', curriculum_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'curricula', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }
  const locked = !!curriculum && (curriculum.cohort_count > 0 || curriculum.status === 'retired')

  // Year → term slots; always show the years spanned by the program duration so empty terms can be filled.
  const years = useMemo(() => {
    const items: any[] = curriculum?.items || []
    const byYear: Record<number, Record<number, any[]>> = {}
    const yearsFromDuration = Math.max(1, Math.ceil((program?.duration_months || 12) / 12))
    const maxYear = Math.max(yearsFromDuration, ...items.map((i) => i.year_no), 1)
    for (let y = 1; y <= maxYear; y++) byYear[y] = { 1: [], 2: [] }
    items.forEach((i) => {
      byYear[i.year_no] = byYear[i.year_no] || { 1: [], 2: [] }
      ;(byYear[i.year_no][i.term_no] ||= []).push(i)
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
  const retire = async () => {
    const ok = await ask({
      title: t('academic.cur.retire_title', 'Retire version {{version}}?', { version: curriculum.version }),
      message: t('academic.confirm_retire', 'Retire this version? It can no longer be assigned to new cohorts.'),
      confirmText: t('academic.retire', 'Retire'),
      tone: 'warning',
    })
    if (ok !== null) setStatus('retired')
  }
  const remove = async (item: any) => {
    const ok = await ask({
      title: t('academic.cur.remove_title', 'Remove {{code}} from the plan?', { code: item.course_code }),
      message: t('academic.cur.remove_message', 'The course stays in the catalog.'),
      confirmText: t('academic.coh.remove', 'Remove'),
      tone: 'danger',
    })
    if (ok === null) return
    try {
      await removeCurriculumItem(curriculum_uuid, item.curriculum_item_uuid, access_token)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  const total = Number(curriculum?.total_credits) || 0
  const required = Number(curriculum?.required_credits) || 0
  const minimum = program?.min_credits != null ? Number(program.min_credits) : null
  const target = Math.max(total, minimum || 0, 1)

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: program?.name || t('academic.program'), href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`) },
          { label: `${t('academic.curriculum', 'Curriculum')} ${curriculum?.version || ''}` },
        ]}
      />
      <PostgradTabs orgslug={orgslug} />

      <section className="dash-card mb-4 mt-2 rounded-[1.25rem] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[12px] text-[hsl(var(--dash-muted))]">
                <ListChecks size={14} /> {t('academic.curriculum', 'Curriculum')}
              </span>
              {curriculum ? <StatusPill status={curriculum.status} /> : null}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{curriculum?.version || '…'}</h1>
            <p className="mt-0.5 text-[13px] text-[hsl(var(--dash-muted))]">
              {[curriculum?.name, program ? <Link key="p" href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`)} className="hover:text-[hsl(var(--dash-ink))]">{program.name}</Link> : null]
                .filter(Boolean)
                .map((part, i) => (
                  <React.Fragment key={i}>
                    {i ? ' · ' : ''}
                    {part}
                  </React.Fragment>
                ))}
              {curriculum ? ` · ${t('academic.prog.used_by', 'Used by {{count}} intakes', { count: curriculum.cohort_count })}` : ''}
            </p>
          </div>
          <div className="min-w-0 lg:w-[360px]">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-[hsl(var(--dash-muted))]">{t('academic.total_credits', 'Total credits')}</span>
              <span>
                <b className="text-lg tabular-nums">{total}</b>
                {minimum != null ? <span className="text-[hsl(var(--dash-muted))]"> / {t('academic.cur.min_n', 'min {{count}}', { count: minimum })}</span> : null}
              </span>
            </div>
            <div className="relative mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
              <span className="h-full bg-sky-500" style={{ width: `${(required / target) * 100}%` }} />
              <span className="h-full bg-violet-400" style={{ width: `${((total - required) / target) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[hsl(var(--dash-muted))]">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> {t('academic.prog.required_credits', 'Required {{count}}', { count: required })}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {t('academic.prog.elective_credits', 'Elective {{count}}', { count: total - required })}
              </span>
            </div>
          </div>
          {curriculum ? (
            <div className="flex shrink-0 items-center gap-2">
              {curriculum.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <CheckCircle size={15} weight="duotone" /> {t('academic.activate', 'Activate')}
                </button>
              ) : null}
              {curriculum.status !== 'retired' ? (
                <GhostButton onClick={retire}>
                  <Archive size={14} /> {t('academic.retire', 'Retire')}
                </GhostButton>
              ) : null}
            </div>
          ) : null}
        </div>
        {minimum != null && total < minimum ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
            <Warning size={16} weight="duotone" /> {t('academic.cur.below_minimum', 'The plan has {{total}} credits, below the program minimum of {{min}}.', { total, min: minimum })}
          </p>
        ) : null}
        {locked ? (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[hsl(var(--dash-canvas))] px-3.5 py-2.5 text-[13px] text-[hsl(var(--dash-ink))]/80">
            <Lock size={16} className="mt-0.5 shrink-0" />
            {curriculum?.status === 'retired'
              ? t('academic.curriculum_retired_note', 'This version is retired and read-only.')
              : t('academic.curriculum_locked_note', 'Cohorts follow this version, so its structure is frozen to protect their academic records. Clone it into a new version to change the plan for future intakes.')}
          </p>
        ) : null}
      </section>

      <div className="space-y-4">
        {Object.entries(years).map(([year, terms]) => {
          const yearCredits = Object.values(terms).flat().reduce((sum: number, i: any) => sum + (i.credits || 0), 0)
          return (
            <section key={year} className="dash-card rounded-[1.25rem] p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-[hsl(var(--dash-ink))]', GOLD)}>{year}</span>
                <h2 className="text-[15px] font-semibold">{t('academic.year_n', { n: year, defaultValue: `Year ${year}` })}</h2>
                <span className="text-[12px] text-[hsl(var(--dash-muted))]">· {t('academic.cur.n_credits', '{{count}} credits', { count: yearCredits })}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.entries(terms).map(([term, items]) => {
                  const list = items as any[]
                  const credits = list.reduce((sum, i) => sum + (i.credits || 0), 0)
                  return (
                    <div key={term} className="flex flex-col rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-[13px] font-semibold">
                          {Number(term) === 3 ? t('academic.term_summer', 'Summer') : t('academic.term_n', { n: term, defaultValue: `Term ${term}` })}
                          <span className="ms-2 text-[11.5px] font-normal text-[hsl(var(--dash-muted))]">{t('academic.cur.n_credits', '{{count}} credits', { count: credits })}</span>
                        </p>
                        {!locked ? (
                          <button
                            type="button"
                            onClick={() => setAddSlot({ year_no: Number(year), term_no: Number(term) })}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-[hsl(var(--dash-ink))]/70 transition-colors hover:bg-white hover:text-[hsl(var(--dash-ink))]"
                          >
                            <Plus size={13} weight="bold" /> {t('academic.add_course', 'Add course')}
                          </button>
                        ) : null}
                      </div>
                      <ul className="space-y-1.5">
                        {list.length === 0 ? (
                          <li className="rounded-xl border border-dashed border-[hsl(var(--dash-border))] py-5 text-center text-xs text-[hsl(var(--dash-muted))]">{t('academic.no_courses_in_term', 'No courses in this term')}</li>
                        ) : null}
                        {list.map((item) => (
                          <li key={item.curriculum_item_uuid} className="group flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_hsl(220_30%_20%/0.05)]">
                            <span className={cn('h-8 w-1 shrink-0 rounded-full', item.requirement === 'elective' ? 'bg-violet-400' : 'bg-sky-500')} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">
                                <span className="me-1.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{item.course_code}</span>
                                {item.course_name}
                              </p>
                              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[hsl(var(--dash-muted))]">
                                <StatusPill status={item.requirement} />
                                <span>{t('academic.cur.n_credits', '{{count}} credits', { count: item.credits })}</span>
                                {item.min_passing_grade ? (
                                  <span>
                                    {t('academic.min_grade', 'Min grade')} {item.min_passing_grade}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            {!locked ? (
                              <IconButton tone="danger" onClick={() => remove(item)} aria-label={t('academic.delete', 'Delete')} className="opacity-60 transition-opacity group-hover:opacity-100">
                                <Trash size={15} />
                              </IconButton>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        {!locked ? (
          <GhostButton onClick={() => setAddSlot({ year_no: Object.keys(years).length + 1, term_no: 1 })}>
            <Plus size={14} /> {t('academic.add_year', 'Add year')}
          </GhostButton>
        ) : null}
      </div>

      <PostgradDrawer
        isDialogOpen={!!addSlot}
        onOpenChange={(open: boolean) => !open && setAddSlot(null)}
        icon={<ListChecks size={20} weight="duotone" />}
        dialogTitle={t('academic.add_course', 'Add course')}
        dialogDescription={curriculum ? `${t('academic.curriculum', 'Curriculum')} ${curriculum.version}` : undefined}
        dialogContent={
          addSlot ? (
            <AddItemForm
              curriculumUuid={curriculum_uuid}
              slot={addSlot}
              existing={(curriculum?.items || []).map((i: any) => i.academic_course_uuid)}
              onDone={() => {
                setAddSlot(null)
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

function AddItemForm({ curriculumUuid, slot, existing, onDone }: { curriculumUuid: string; slot: { year_no: number; term_no: number }; existing: string[]; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [course, setCourse] = useState('')
  const [yearNo, setYearNo] = useState(slot.year_no)
  const [termNo, setTermNo] = useState(slot.term_no)
  const [requirement, setRequirement] = useState('required')
  const [minGrade, setMinGrade] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: courses = [] } = useQuery({ queryKey: ['academic', 'catalog', orgId, ''], queryFn: () => getAcademicCourses(orgId, access_token), enabled: !!orgId && !!access_token })
  const available = (courses as any[]).filter((c) => !existing.includes(c.academic_course_uuid) && c.status !== 'retired')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!course) return
    setSaving(true)
    try {
      await addCurriculumItem(curriculumUuid, { academic_course_uuid: course, year_no: yearNo, term_no: termNo, requirement, min_passing_grade: minGrade || null }, access_token)
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.catalog_course', 'Catalog course')} columns={1}>
        <Field label={t('academic.catalog_course', 'Catalog course')} required hint={available.length === 0 ? t('academic.catalog_empty_hint', 'Create courses in the Course Catalog first.') : undefined}>
          <select className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)} required>
            <option value="">—</option>
            {available.map((c) => (
              <option key={c.academic_course_uuid} value={c.academic_course_uuid}>
                {c.code} · {c.name} ({c.credits} {t('academic.credits', 'Credits').toLowerCase()})
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <FormSection title={t('academic.cur.section_place', 'Place in the plan')}>
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
        <Field label={t('academic.requirement', 'Requirement')} hint={t('academic.cur.requirement_hint', 'Required courses are registered automatically')}>
          <select className={inputCls} value={requirement} onChange={(e) => setRequirement(e.target.value)}>
            <option value="required">{t('academic.state_required', 'Required')}</option>
            <option value="elective">{t('academic.state_elective', 'Elective')}</option>
          </select>
        </Field>
        <Field label={t('academic.min_grade', 'Min grade')}>
          <input className={inputCls} value={minGrade} onChange={(e) => setMinGrade(e.target.value)} placeholder="C" />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={!course} />
    </form>
  )
}

export default CurriculumEditor
