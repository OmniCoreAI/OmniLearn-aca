'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, RefreshCw, Send, CheckCircle2, Undo2, Lock } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
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

  return (
    <>
      <Section
        title={t('academic.gradebook', 'Assessment & gradebook')}
        description={t(
          'academic.gradebook_desc',
          'Weighted assessment scheme for this offering. Scores come from the course’s assignments, quizzes and exams, and can be overridden.'
        )}
        action={
          <>
            <StatusPill status={status} label={String(t(`academic.grades_${status}`, status))} />
            {!locked && (
              <>
                <GhostButton onClick={() => setComponentModal({})}>
                  <Plus className="h-3.5 w-3.5" /> {t('academic.add_component', 'Add component')}
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => syncGradebook(offeringUuid, access_token), t('academic.scores_synced', 'Scores synced'))}
                  disabled={!offering.content_course_uuid}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t('academic.sync_scores', 'Sync from assignments')}
                </GhostButton>
                <GhostButton
                  onClick={() => {
                    const note = window.prompt(t('academic.submit_note', 'Note for the coordinator (optional)')) ?? null
                    run(() => gradeAction(offeringUuid, 'submit', note, access_token), t('academic.grades_submitted_ok', 'Grades submitted for approval'))
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> {t('academic.submit_grades', 'Submit grades')}
                </GhostButton>
              </>
            )}
            {status === 'submitted' && canApprove && (
              <>
                <GhostButton
                  onClick={() =>
                    window.confirm(
                      t('academic.confirm_approve', 'Approve these grades? Results become official and final.')
                    ) && run(() => gradeAction(offeringUuid, 'approve', null, access_token), t('academic.grades_approved_ok', 'Grades approved'))
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('academic.approve_grades', 'Approve')}
                </GhostButton>
                <GhostButton
                  onClick={() => {
                    const note = window.prompt(t('academic.return_note', 'What needs to change?'))
                    if (note) run(() => gradeAction(offeringUuid, 'return', note, access_token), t('academic.grades_returned_ok', 'Grades returned to the instructor'))
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" /> {t('academic.return_grades', 'Return')}
                </GhostButton>
              </>
            )}
          </>
        }
      >
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
            <Lock className="h-3.5 w-3.5" />
            {status === 'approved'
              ? t('academic.grades_locked_approved', 'Results are approved and official.')
              : t('academic.grades_locked_submitted', 'Awaiting approval — scores are locked.')}
          </div>
        )}

        {/* Assessment scheme */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
              {t('academic.assessment_scheme', 'Assessment scheme')}
            </span>
            <span className={weightOk ? 'text-emerald-700' : 'text-amber-700'}>
              {t('academic.total_weight', 'Total weight')}: {book.total_weight}%
              {!weightOk && ` — ${t('academic.weight_must_100', 'must total 100%')}`}
            </span>
          </div>
          <DataTable
            headers={[
              t('academic.component', 'Component'),
              t('academic.course_type', 'Type'),
              t('academic.weight', 'Weight'),
              t('academic.max_score', 'Max'),
              t('academic.linked_assignments', 'Linked assignments'),
              '',
            ]}
            empty={t(
              'academic.no_components_hint',
              'No assessment components yet. For a single final grade, add one component weighted 100%.'
            )}
          >
            {book.components.map((c: any) => (
              <tr key={c.component_uuid}>
                <td className={`${tdCls} font-medium`}>{c.name}</td>
                <td className={`${tdCls} text-xs`}>{String(t(`academic.comp_${c.component_type}`, c.component_type))}</td>
                <td className={tdCls}>{c.weight}%</td>
                <td className={tdCls}>{c.max_score}</td>
                <td className={`${tdCls} text-xs`}>
                  {c.source_assignments.map((a: any) => a.title).join(', ') || t('academic.manual_entry', 'Manual entry')}
                </td>
                <td className={`${tdCls} whitespace-nowrap text-right`}>
                  {!locked && (
                    <>
                      <IconButton onClick={() => setComponentModal({ component: c })} aria-label={t('academic.edit', 'Edit')}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        onClick={() =>
                          window.confirm(t('academic.confirm_delete')) &&
                          run(() => deleteComponent(offeringUuid, c.component_uuid, access_token), t('academic.deleted'))
                        }
                        aria-label={t('academic.delete', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        {/* Gradebook grid */}
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
          {t('academic.scores', 'Scores')} · {book.scale.name}
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
                  <StatusPill status={row.passed ? 'completed' : 'failed'} label={row.passed ? t('academic.pass', 'Pass') : t('academic.fail', 'Fail')} />
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Modal
        isDialogOpen={!!componentModal}
        onOpenChange={(o: boolean) => !o && setComponentModal(null)}
        minWidth="sm"
        dialogTitle={componentModal?.component ? t('academic.edit', 'Edit') : t('academic.add_component', 'Add component')}
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

  const commit = () => {
    const next = draft.trim() === '' ? null : Number(draft)
    if (next === value || (next != null && Number.isNaN(next))) return
    if (next != null && (next < 0 || next > max)) {
      toast.error(t('academic.score_range', { max, defaultValue: `Score must be between 0 and ${max}` }))
      setDraft(value == null ? '' : String(value))
      return
    }
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.name')}>
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
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label={`${t('academic.weight', 'Weight')} (%)`}>
          <input type="number" min={0.5} max={100} step="0.5" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </Field>
        <Field label={t('academic.max_score', 'Max')}>
          <input type="number" min={1} step="0.5" className={inputCls} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} required />
        </Field>
        <Field label={t('academic.due_date', 'Due date')}>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.linked_assignments', 'Linked assignments')}>
        {!offering.content_course_uuid ? (
          <p className="text-xs text-[hsl(var(--dash-muted))]">
            {t('academic.link_needs_content', 'Link a content course to the offering to pull scores from its assignments.')}
          </p>
        ) : (
          <div className="max-h-36 space-y-1 overflow-auto rounded-lg border border-[hsl(var(--dash-border))] p-2">
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
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}
