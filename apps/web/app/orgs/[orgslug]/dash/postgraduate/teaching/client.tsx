'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, ClipboardCheck, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  DataTable,
  GhostButton,
  Section,
  Stat,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { displayName, evaluateInterview, getMyInterviews, getMyOfferings } from '@services/academic/core'

const CURRENT_STATES = ['planned', 'open', 'in_progress']
// Same look as GhostButton, for navigation (a button inside a link is invalid HTML).
const ghostLinkCls =
  'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]'
const RECOMMENDATIONS = ['accept', 'waitlist', 'reject']

/**
 * Lecturer workspace: the offerings the signed-in user teaches (as instructor
 * or teaching assistant), gradebooks that need them, and the admission
 * interviews they sit on.
 */
function MyTeaching({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const [evaluating, setEvaluating] = useState<any>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery({
    queryKey: ['academic', 'my-offerings', orgId],
    queryFn: () => getMyOfferings(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const { data: interviews = [], isLoading: loadingInterviews } = useQuery({
    queryKey: ['academic', 'my-interviews', orgId],
    queryFn: () => getMyInterviews(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })

  const current = (offerings as any[]).filter((o) => CURRENT_STATES.includes(o.status))
  const past = (offerings as any[]).filter((o) => !CURRENT_STATES.includes(o.status))
  const returned = current.filter((o) => o.grade_status === 'returned')
  const toGrade = current.filter((o) => o.status === 'in_progress' && ['open', 'returned'].includes(o.grade_status))
  const toEvaluate = (interviews as any[]).filter((i) => i.can_evaluate && i.status === 'scheduled')
  const students = current.reduce((sum, o) => sum + (o.enrolled_count || 0), 0)
  const loading = loadingOfferings || loadingInterviews
  const nothingAssigned = !loading && offerings.length === 0 && interviews.length === 0

  const offeringHref = (o: any) =>
    getUriWithOrg(orgslug, `/dash/postgraduate/teaching/offerings/${o.offering_uuid.replace('offering_', '')}`)

  const offeringRows = (rows: any[]) =>
    rows.map((o) => (
      <tr key={o.offering_uuid}>
        <td className={tdCls}>
          <Link href={offeringHref(o)} className="font-medium hover:text-[hsl(var(--dash-accent))]">
            {o.course_code} · {o.course_name}
          </Link>
          <div className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{o.code}</div>
        </td>
        <td className={`${tdCls} text-xs`}>{o.term_code}</td>
        <td className={`${tdCls} text-xs`}>{o.cohort_code || o.cohort_name || t('academic.open_offering', 'Open')}</td>
        <td className={`${tdCls} text-xs tabular-nums`}>
          {o.enrolled_count}
          {o.capacity != null ? `/${o.capacity}` : ''}
        </td>
        <td className={tdCls}>
          <StatusPill status={o.status} />
        </td>
        <td className={tdCls}>
          <StatusPill status={o.grade_status} label={String(t(`academic.grades_${o.grade_status}`, o.grade_status))} />
        </td>
        <td className={`${tdCls} text-right`}>
          <Link href={offeringHref(o)} className={ghostLinkCls}>
            {t('academic.open', 'Open')}
          </Link>
        </td>
      </tr>
    ))

  const offeringHeaders = [
    t('academic.course', 'Course'),
    t('academic.term', 'Term'),
    t('academic.cohort', 'Cohort'),
    t('academic.students', 'Students'),
    t('academic.status'),
    t('academic.gradebook_short', 'Grades'),
    '',
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[{ label: t('academic.my_teaching', 'My Teaching'), icon: <GraduationCap size={14} /> }]}
      />
      <AcademicHeader
        title={t('academic.my_teaching', 'My Teaching')}
        subtitle={t('academic.my_teaching_desc', 'The course offerings you teach and the admission interviews you sit on.')}
      />

      {nothingAssigned ? (
        <Section title={t('academic.nothing_assigned', 'Nothing assigned to you yet')}>
          <p className="max-w-2xl text-sm text-[hsl(var(--dash-muted))]">
            {t(
              'academic.nothing_assigned_desc',
              'When the program office makes you the instructor or teaching assistant of a course offering, or puts you on an interview panel, it appears here.'
            )}
          </p>
        </Section>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('academic.teaching_now', 'Teaching now')} value={loading ? '…' : current.length} />
            <Stat label={t('academic.students', 'Students')} value={loading ? '…' : students} />
            <Stat label={t('academic.grades_to_submit', 'Grades to submit')} value={loading ? '…' : toGrade.length} />
            <Stat label={t('academic.interviews_to_evaluate', 'Interviews to evaluate')} value={loading ? '…' : toEvaluate.length} />
          </div>

          {(returned.length > 0 || toEvaluate.length > 0) && (
            <Section title={t('academic.needs_attention', 'Needs your attention')}>
              <ul className="space-y-2">
                {returned.map((o) => (
                  <li
                    key={o.offering_uuid}
                    className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="font-semibold">
                          {o.course_code} · {t('academic.grades_returned_to_you', 'grades returned for changes')}
                        </span>
                        {o.grade_note && <span className="block text-xs">{o.grade_note}</span>}
                      </span>
                    </span>
                    <Link href={offeringHref(o)} className={`${ghostLinkCls} self-start sm:self-auto`}>
                      {t('academic.open_gradebook', 'Open gradebook')}
                    </Link>
                  </li>
                ))}
                {toEvaluate.map((i) => (
                  <li
                    key={i.interview_uuid}
                    className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-start gap-2">
                      <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--dash-accent))]" />
                      <span>
                        <span className="font-semibold">
                          {t('academic.interview_with', 'Interview with')} {displayName(i.applicant)}
                        </span>
                        <span className="block text-xs text-[hsl(var(--dash-muted))]">
                          {i.program_name} · {i.scheduled_at?.replace('T', ' ') || t('academic.time_tbc', 'time to be confirmed')}
                          {i.location ? ` · ${i.location}` : ''}
                        </span>
                      </span>
                    </span>
                    <GhostButton onClick={() => setEvaluating(i)}>{t('academic.evaluate', 'Evaluate')}</GhostButton>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title={t('academic.current_offerings', 'Current offerings')}
            description={t(
              'academic.current_offerings_desc',
              'Open an offering to manage its schedule and gradebook and to submit grades for approval.'
            )}
          >
            <DataTable headers={offeringHeaders} empty={t('academic.no_current_offerings', 'You are not teaching any offering this term.')}>
              {offeringRows(current)}
            </DataTable>
          </Section>

          <Section
            title={t('academic.interview_panels', 'Interview panels')}
            description={t(
              'academic.interview_panels_desc',
              'Record your score, recommendation and notes after each interview. The admissions committee takes the final decision.'
            )}
          >
            <DataTable
              headers={[
                t('academic.applicant', 'Applicant'),
                t('academic.program', 'Program'),
                t('academic.when_where', 'When / where'),
                t('academic.status'),
                t('academic.recommendation', 'Recommendation'),
                '',
              ]}
              empty={t('academic.no_panels', 'You are not on any interview panel.')}
            >
              {(interviews as any[]).map((i) => (
                <tr key={i.interview_uuid}>
                  <td className={tdCls}>
                    <div className="font-medium">{displayName(i.applicant)}</div>
                    <div className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{i.application_number}</div>
                  </td>
                  <td className={`${tdCls} text-xs`}>
                    {i.program_name}
                    <div className="text-[hsl(var(--dash-muted))]">{i.cohort_code || i.cohort_name}</div>
                  </td>
                  <td className={`${tdCls} text-xs`}>
                    {i.scheduled_at?.replace('T', ' ') || '—'}
                    {i.location && <div className="text-[hsl(var(--dash-muted))]">{i.location}</div>}
                  </td>
                  <td className={tdCls}>
                    <StatusPill status={i.status} label={String(t(`academic.interview_${i.status}`, i.status))} />
                  </td>
                  <td className={`${tdCls} text-xs`}>
                    {i.recommendation ? String(t(`academic.rec_${i.recommendation}`, i.recommendation)) : '—'}
                    {i.score != null && <span className="text-[hsl(var(--dash-muted))]"> · {i.score}/100</span>}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {i.can_evaluate && (
                      <GhostButton onClick={() => setEvaluating(i)}>
                        {i.status === 'completed' ? t('academic.edit', 'Edit') : t('academic.evaluate', 'Evaluate')}
                      </GhostButton>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>

          {past.length > 0 && (
            <Section title={t('academic.past_offerings', 'Past offerings')}>
              <DataTable headers={offeringHeaders} empty="">
                {offeringRows(past)}
              </DataTable>
            </Section>
          )}
        </div>
      )}

      <Modal
        isDialogOpen={!!evaluating}
        onOpenChange={(o: boolean) => !o && setEvaluating(null)}
        minWidth="md"
        dialogTitle={t('academic.interview_evaluation', 'Interview evaluation')}
        dialogContent={
          evaluating && (
            <EvaluationForm
              interview={evaluating}
              onDone={() => {
                setEvaluating(null)
                queryClient.invalidateQueries({ queryKey: ['academic', 'my-interviews', orgId] })
              }}
            />
          )
        }
      />
    </AcademicPageShell>
  )
}

function EvaluationForm({ interview, onDone }: { interview: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [score, setScore] = useState(interview.score != null ? String(interview.score) : '')
  const [recommendation, setRecommendation] = useState(interview.recommendation || '')
  const [notes, setNotes] = useState(interview.notes || '')
  const [saving, setSaving] = useState(false)
  const p = interview.profile || {}

  const background: [string, React.ReactNode][] = [
    [t('academic.degree', 'Degree'), p.degree_level ? String(t(`academic.degree_${p.degree_level}`, p.degree_level)) : null],
    [t('academic.degree_field', 'Field of study'), p.degree_field],
    [t('academic.institution', 'Institution'), p.institution],
    ['GPA', p.gpa != null ? `${p.gpa} / ${p.gpa_scale ?? 4}` : null],
    [t('academic.language_test', 'Language test'), p.language_test ? `${p.language_test} ${p.language_score ?? ''}`.trim() : null],
    [t('academic.experience_years', 'Experience (years)'), p.experience_years],
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recommendation) return
    setSaving(true)
    try {
      await evaluateInterview(
        interview.interview_uuid,
        { score: score === '' ? null : Number(score), recommendation, notes: notes.trim() || null },
        access_token
      )
      toast.success(t('academic.evaluation_saved', 'Evaluation saved'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="font-semibold">{displayName(interview.applicant)}</div>
        <div className="text-xs text-[hsl(var(--dash-muted))]">
          {interview.application_number} · {interview.program_name}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-[hsl(var(--dash-canvas))] p-3 text-sm sm:grid-cols-2">
        {background
          .filter(([, v]) => v != null && v !== '')
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-[hsl(var(--dash-muted))]">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>
      {p.statement && (
        <p className="max-h-32 overflow-auto whitespace-pre-line text-xs text-[hsl(var(--dash-muted))]">{p.statement}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.score_out_of_100', 'Score (0–100)')}>
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            className={inputCls}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </Field>
        <Field label={t('academic.recommendation', 'Recommendation')}>
          <select className={selectCls('w-full')} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} required>
            <option value="">{t('academic.choose', 'Choose…')}</option>
            {RECOMMENDATIONS.map((r) => (
              <option key={r} value={r}>
                {String(t(`academic.rec_${r}`, r))}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('academic.notes', 'Notes')}>
        <textarea className={inputCls} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t(
          'academic.evaluation_hint',
          'Saving completes the interview. The admissions committee sees your evaluation when it decides on the application.'
        )}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default MyTeaching
