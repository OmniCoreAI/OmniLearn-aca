'use client'
import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowsClockwise, ArrowUUpLeft, Check, CheckCircle, Exam, Lock, PaperPlaneTilt, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { cn } from '@/lib/utils'
import {
  DataTable,
  GhostButton,
  IconButton,
  Section,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  createComponent,
  deleteComponent,
  getCourseAssignments,
  getGradebook,
  gradeAction,
  setScores,
  syncGradebook,
  updateComponent,
} from '@services/academic/core'

const COMPONENT_TYPES = [
  'assignment',
  'quiz',
  'midterm',
  'final_exam',
  'project',
  'practical',
  'research_paper',
  'presentation',
  'participation',
  'other',
]

/**
 * Assessment scheme + gradebook for one course offering.
 * Scores are pulled from the offering's content-course assignments and can be
 * overridden; the instructor submits, a coordinator approves or returns.
 */
export function GradebookPanel({ offering }: { offering: any }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const offeringUuid = offering.offering_uuid
  const [componentModal, setComponentModal] = useState<null | { component?: any }>(null)
  const { ask, dialog } = useActionDialog()
  const key = ['academic', 'gradebook', offeringUuid]

  const { data: book, error } = useQuery({
    queryKey: key,
    queryFn: () => getGradebook(offeringUuid, access_token),
    enabled: !!access_token,
    retry: false,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering', offeringUuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering-roster', offeringUuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }

  const run = async (fn: () => Promise<any>, ok: string) => {
    try {
      const result = await fn()
      if (result?.rows) queryClient.setQueryData(key, result)
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  if (error) {
    return (
      <Section title={t('academic.gradebook', 'Assessment & gradebook')}>
        <p className="text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      </Section>
    )
  }
  if (!book) return null

  const status: string = book.grade_status
  const locked = status === 'submitted' || status === 'approved'
  // Approval is for the program office, never for the offering's own teaching staff.
  const canApprove = !!offering.viewer_can_manage && !offering.viewer_teaches
  const weightOk = Math.abs(book.total_weight - 100) < 1e-6
  const incomplete = book.rows.filter((r: any) => r.enrollment_status === 'registered' && r.passed == null).length

  const submitGrades = async () => {
    const note = await ask({
      title: t('academic.gb.submit_title', 'Submit grades for approval?'),
      message: incomplete
        ? t('academic.gb.submit_incomplete', '{{count}} students still have missing scores. The coordinator will see them as incomplete.', { count: incomplete })
        : t('academic.gb.submit_message', 'Scores lock until the coordinator approves them or returns them to you.'),
      confirmText: t('academic.submit_grades', 'Submit grades'),
      tone: incomplete ? 'warning' : 'info',
      noteLabel: t('academic.submit_note', 'Note for the coordinator (optional)'),
    })
    if (note !== null) run(() => gradeAction(offeringUuid, 'submit', note || null, access_token), t('academic.grades_submitted_ok', 'Grades submitted for approval'))
  }
  const approveGrades = async () => {
    const ok = await ask({
      title: t('academic.gb.approve_title', 'Approve these grades?'),
      message: t('academic.gb.approve_message', 'Results become official and final, and students are notified.'),
      confirmText: t('academic.approve_grades', 'Approve'),
      tone: 'success',
    })
    if (ok !== null) run(() => gradeAction(offeringUuid, 'approve', null, access_token), t('academic.grades_approved_ok', 'Grades approved'))
  }
  const returnGrades = async () => {
    const note = await ask({
      title: t('academic.gb.return_title', 'Return grades to the lecturer?'),
      message: t('academic.gb.return_message', 'Scores unlock so the lecturer can correct them and submit again.'),
      confirmText: t('academic.return_grades', 'Return'),
      tone: 'warning',
      noteLabel: t('academic.return_note', 'What needs to change?'),
      noteRequired: true,
    })
    if (note) run(() => gradeAction(offeringUuid, 'return', note, access_token), t('academic.grades_returned_ok', 'Grades returned to the instructor'))
  }
  const removeComponent = async (c: any) => {
    const ok = await ask({
      title: t('academic.gb.delete_component', 'Delete “{{name}}”?', { name: c.name }),
      message: t('academic.gb.delete_component_message', 'Its scores are removed and totals are recalculated.'),
      confirmText: t('academic.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok !== null) run(() => deleteComponent(offeringUuid, c.component_uuid, access_token), t('academic.deleted'))
  }
  const flow = [
    { key: 'open', label: t('academic.gb.step_grading', 'Grading'), who: t('academic.gb.who_lecturer', 'Lecturer') },
    { key: 'submitted', label: t('academic.gb.step_submitted', 'Submitted'), who: t('academic.gb.who_coordinator', 'Coordinator reviews') },
    { key: 'approved', label: t('academic.gb.step_approved', 'Approved'), who: t('academic.gb.who_official', 'Official results') },
  ]
  const flowIndex = status === 'approved' ? 2 : status === 'submitted' ? 1 : 0

  return (
    <>
      <Section
        title={t('academic.gradebook', 'Assessment & gradebook')}
        description={t(
          'academic.gradebook_desc',
          'Weighted assessment scheme for this offering. Scores come from the course’s assignments, quizzes and exams, and can be overridden.'
        )}
        icon={<Exam size={18} weight="duotone" />}
        action={
          <>
            {!locked && (
              <>
                <GhostButton onClick={() => setComponentModal({})}>
                  <Plus size={14} /> {t('academic.add_component', 'Add component')}
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => syncGradebook(offeringUuid, access_token), t('academic.scores_synced', 'Scores synced'))}
                  disabled={!offering.content_course_uuid}
                >
                  <ArrowsClockwise size={14} /> {t('academic.sync_scores', 'Sync from assignments')}
                </GhostButton>
                <GhostButton onClick={submitGrades} disabled={!weightOk || book.rows.length === 0} className="border-[hsl(var(--dash-ink))] bg-[hsl(var(--dash-ink))] text-white hover:bg-[hsl(var(--dash-ink))]/90">
                  <PaperPlaneTilt size={14} /> {t('academic.submit_grades', 'Submit grades')}
                </GhostButton>
              </>
            )}
            {status === 'submitted' && canApprove && (
              <>
                <GhostButton onClick={returnGrades}>
                  <ArrowUUpLeft size={14} /> {t('academic.return_grades', 'Return')}
                </GhostButton>
                <GhostButton onClick={approveGrades} className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90">
                  <CheckCircle size={14} /> {t('academic.approve_grades', 'Approve')}
                </GhostButton>
              </>
            )}
          </>
        }
      >
        <ol className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-[hsl(var(--dash-canvas))]/60 p-1">
          {flow.map((step, i) => {
            const done = i < flowIndex || (i === flowIndex && status === 'approved')
            const current = i === flowIndex && status !== 'approved'
            return (
              <li key={step.key} className={cn('flex items-center gap-2 rounded-xl px-2.5 py-2', current && 'bg-white shadow-[0_1px_2px_hsl(220_30%_20%/0.06)]')}>
                <span
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    done ? 'bg-emerald-500 text-white' : current ? (status === 'returned' ? 'bg-orange-500 text-white' : 'bg-[hsl(var(--dash-ink))] text-white') : 'bg-white text-[hsl(var(--dash-muted))]'
                  )}
                >
                  {done ? <Check size={12} weight="bold" /> : i + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[12px] font-semibold">{i === 0 && status === 'returned' ? t('academic.grades_returned', 'Returned') : step.label}</span>
                  <span className="block truncate text-[10.5px] text-[hsl(var(--dash-muted))]">{step.who}</span>
                </span>
              </li>
            )
          })}
        </ol>
        {book.grade_note &&
          (status === 'returned' ? (
            <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
              <span className="font-semibold">{t('academic.returned_for_changes', 'Returned for changes')}:</span>{' '}
              {book.grade_note}
            </div>
          ) : (
            <div className="mb-3 rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-2 text-xs text-[hsl(var(--dash-muted))]">
              {t('academic.note', 'Note')}: {book.grade_note}
            </div>
          ))}
        {locked && (
          <div className="mb-3 flex items-center gap-2 text-xs text-[hsl(var(--dash-muted))]">
            <Lock size={14} />
            {status === 'approved'
              ? t('academic.grades_locked_approved', 'Results are approved and official.')
              : t('academic.grades_locked_submitted', 'Awaiting approval — scores are locked.')}
          </div>
        )}

        {/* Assessment scheme */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[hsl(var(--dash-ink))]">{t('academic.assessment_scheme', 'Assessment scheme')}</span>
            <span className={cn('font-semibold tabular-nums', weightOk ? 'text-emerald-700' : 'text-amber-700')}>
              {book.total_weight}% / 100%
              {!weightOk && ` — ${t('academic.weight_must_100', 'must total 100%')}`}
            </span>
          </div>
          <div className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
            {book.components.map((c: any, i: number) => (
              <span key={c.component_uuid} title={`${c.name} · ${c.weight}%`} className={cn('h-full', ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-teal-500'][i % 6])} style={{ width: `${Math.min(100, c.weight)}%` }} />
            ))}
          </div>
          {book.components.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-6 text-center text-sm text-[hsl(var(--dash-muted))]">
              {t('academic.no_components_hint', 'No assessment components yet. For a single final grade, add one component weighted 100%.')}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {book.components.map((c: any, i: number) => (
                <li key={c.component_uuid} className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-3 py-2.5">
                  <span className={cn('h-8 w-1.5 shrink-0 rounded-full', ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-teal-500'][i % 6])} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{c.name}</p>
                    <p className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      {String(t(`academic.comp_${c.component_type}`, c.component_type))} · /{c.max_score} · {c.source_assignments.map((a: any) => a.title).join(', ') || t('academic.manual_entry', 'Manual entry')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{c.weight}%</span>
                  {!locked ? (
                    <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
                      <IconButton onClick={() => setComponentModal({ component: c })} aria-label={t('academic.edit', 'Edit')}>
                        <PencilSimple size={15} />
                      </IconButton>
                      <IconButton tone="danger" onClick={() => removeComponent(c)} aria-label={t('academic.delete', 'Delete')}>
                        <Trash size={15} />
                      </IconButton>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Gradebook grid */}
        <div className="mb-2 text-xs font-semibold text-[hsl(var(--dash-ink))]">
          {t('academic.scores', 'Scores')} <span className="font-normal text-[hsl(var(--dash-muted))]">· {book.scale.name}</span>
          {book.scale.pass_mark != null && ` · ${t('academic.pass_mark', 'pass mark')} ${book.scale.pass_mark}`}
        </div>
        <DataTable
          headers={[
            t('academic.student', 'Student'),
            ...book.components.map((c: any) => `${c.name} /${c.max_score}`),
            t('academic.total', 'Total'),
            t('academic.grade', 'Grade'),
            t('academic.result', 'Result'),
          ]}
          empty={t('academic.no_enrollments', 'No students registered.')}
        >
          {book.rows.map((row: any) => (
            <tr key={row.enrollment_uuid}>
              <td className={tdCls}>
                <div className="font-medium">{row.name}</div>
                <div className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{row.student_number || row.email}</div>
              </td>
              {row.cells.map((cell: any, i: number) => (
                <td key={cell.component_uuid} className={tdCls}>
                  <ScoreCell
                    key={`${cell.component_uuid}:${cell.score ?? ''}`}
                    value={cell.score}
                    source={cell.source}
                    max={book.components[i].max_score}
                    disabled={locked || row.enrollment_status !== 'registered'}
                    onSave={(score) =>
                      run(
                        () =>
                          setScores(
                            offeringUuid,
                            [{ enrollment_uuid: row.enrollment_uuid, component_uuid: cell.component_uuid, score }],
                            access_token
                          ),
                        t('academic.saved', 'Saved')
                      )
                    }
                  />
                </td>
              ))}
              <td className={`${tdCls} font-semibold`}>{row.weighted_total ?? '—'}</td>
              <td className={`${tdCls} font-semibold`}>
                {row.letter_grade ? `${row.letter_grade} (${row.grade_points})` : '—'}
              </td>
              <td className={tdCls}>
                {row.enrollment_status !== 'registered' ? (
                  <StatusPill status={row.enrollment_status} />
                ) : row.passed == null ? (
                  <span className="text-xs text-[hsl(var(--dash-muted))]">{t('academic.incomplete', 'Incomplete')}</span>
                ) : (
                  <StatusPill status={row.passed ? 'passed' : 'failed'} label={row.passed ? t('academic.pass', 'Pass') : t('academic.fail', 'Fail')} />
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <PostgradDrawer
        isDialogOpen={!!componentModal}
        onOpenChange={(o: boolean) => !o && setComponentModal(null)}
        icon={<Exam size={20} weight="duotone" />}
        dialogTitle={componentModal?.component ? `${t('academic.edit', 'Edit')} ${componentModal.component.name}` : t('academic.add_component', 'Add component')}
        dialogDescription={t('academic.gb.component_desc', 'Part of the final grade, e.g. a midterm worth 30%. Weights must total 100% before grades can be submitted.')}
        dialogContent={
          componentModal && (
            <ComponentForm
              offering={offering}
              component={componentModal.component}
              remaining={100 - book.total_weight + (componentModal.component?.weight || 0)}
              onDone={() => {
                setComponentModal(null)
                refresh()
              }}
            />
          )
        }
      />
      {dialog}
    </>
  )
}

function ScoreCell({
  value,
  source,
  max,
  disabled,
  onSave,
}: {
  value: number | null
  source: string | null
  max: number
  disabled: boolean
  onSave: (_score: number | null) => void
}) {
  const { t } = useTranslation()
  // Re-mounted (via key) whenever the stored value changes, so the draft
  // always starts from the saved score.
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))
  // The last value sent: a second blur before the save returns must not resend it.
  const sent = useRef<number | null | undefined>(undefined)

  const commit = () => {
    const next = draft.trim() === '' ? null : Number(draft)
    if (next === value || next === sent.current || (next != null && Number.isNaN(next))) return
    if (next != null && (next < 0 || next > max)) {
      toast.error(t('academic.score_range', { max, defaultValue: `Score must be between 0 and ${max}` }))
      setDraft(value == null ? '' : String(value))
      return
    }
    sent.current = next
    onSave(next)
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={max}
        step="0.5"
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-16 rounded-md border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-2 py-1 text-sm disabled:bg-transparent disabled:border-transparent"
      />
      {source === 'manual' && (
        <span title={t('academic.manual_override', 'Manually entered / overridden')} className="text-[10px] font-bold text-amber-600">
          M
        </span>
      )}
    </div>
  )
}

function ComponentForm({
  offering,
  component,
  remaining,
  onDone,
}: {
  offering: any
  component?: any
  remaining: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [name, setName] = useState(component?.name || '')
  const [type, setType] = useState(component?.component_type || 'assignment')
  const [weight, setWeight] = useState<string>(component ? String(component.weight) : String(Math.max(remaining, 0)))
  const [maxScore, setMaxScore] = useState<string>(component ? String(component.max_score) : '100')
  const [dueDate, setDueDate] = useState(component?.due_date || '')
  const [linked, setLinked] = useState<string[]>((component?.source_assignments || []).map((a: any) => a.assignment_uuid))
  const [saving, setSaving] = useState(false)

  const { data: assignments = [] } = useQuery({
    queryKey: ['academic', 'content-assignments', offering.content_course_uuid],
    queryFn: () => getCourseAssignments(offering.content_course_uuid, access_token),
    enabled: !!offering.content_course_uuid && !!access_token,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        component_type: type,
        weight: Number(weight),
        max_score: Number(maxScore),
        due_date: dueDate || null,
        source_assignments: linked,
      }
      if (component) await updateComponent(offering.offering_uuid, component.component_uuid, payload, access_token)
      else await createComponent(offering.offering_uuid, payload, access_token)
      toast.success(component ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.component', 'Component')}>
        <Field label={t('academic.name')} required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Midterm" />
        </Field>
        <Field label={t('academic.course_type', 'Type')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {COMPONENT_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {String(t(`academic.comp_${ct}`, ct))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t('academic.weight', 'Weight')} (%)`} hint={t('academic.gb.remaining', '{{count}}% left to assign', { count: Math.max(0, remaining) })}>
          <input type="number" min={0.5} max={100} step="0.5" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </Field>
        <Field label={t('academic.max_score', 'Max')}>
          <input type="number" min={1} step="0.5" className={inputCls} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} required />
        </Field>
        <Field label={t('academic.due_date', 'Due date')}>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.linked_assignments', 'Linked assignments')} description={t('academic.gb.linked_hint', 'Scores sync from these assignments of the content course; leave empty to enter scores by hand.')} columns={1}>
        {!offering.content_course_uuid ? (
          <p className="text-xs text-[hsl(var(--dash-muted))]">
            {t('academic.link_needs_content', 'Link a content course to the offering to pull scores from its assignments.')}
          </p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-auto rounded-2xl border border-[hsl(var(--dash-border))] bg-white p-2">
            {(assignments as any[]).length === 0 && (
              <div className="text-xs text-[hsl(var(--dash-muted))]">
                {t('academic.no_course_assignments', 'The content course has no assignments yet — scores can be entered manually.')}
              </div>
            )}
            {(assignments as any[]).map((a) => (
              <label key={a.assignment_uuid} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linked.includes(a.assignment_uuid)}
                  onChange={(e) =>
                    setLinked((prev) =>
                      e.target.checked ? [...prev, a.assignment_uuid] : prev.filter((u) => u !== a.assignment_uuid)
                    )
                  }
                />
                {a.title}
              </label>
            ))}
          </div>
        )}
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}
