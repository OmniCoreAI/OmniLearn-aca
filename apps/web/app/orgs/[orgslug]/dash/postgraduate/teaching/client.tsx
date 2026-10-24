'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowUUpLeft, ChalkboardTeacher, Exam, GraduationCap, Hourglass, SealCheck, Student, VideoCamera, XCircle } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { OfferingsTable } from '@components/Dashboard/Pages/Academic/OfferingsTable'
import { Section, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import { displayName, evaluateInterview, getMyInterviews, getMyOfferings } from '@services/academic/core'
import { cn } from '@/lib/utils'

const CURRENT_STATES = ['planned', 'open', 'in_progress']
const RECOMMENDATIONS = [
  { key: 'accept', Icon: SealCheck, cls: 'peer-checked:border-emerald-400 peer-checked:bg-emerald-50', iconCls: 'text-emerald-600' },
  { key: 'waitlist', Icon: Hourglass, cls: 'peer-checked:border-amber-400 peer-checked:bg-amber-50', iconCls: 'text-amber-600' },
  { key: 'reject', Icon: XCircle, cls: 'peer-checked:border-red-400 peer-checked:bg-red-50', iconCls: 'text-red-600' },
] as const

function useWhen() {
  const { i18n } = useTranslation()
  return (v?: string | null) => (v ? new Date(v).toLocaleString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
}

/**
 * Lecturer workspace: the offerings the signed-in user teaches (as instructor
 * or teaching assistant), gradebooks that need them, and the admission
 * interviews they sit on.
 */
function MyTeaching({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const when = useWhen()
  const [evaluating, setEvaluating] = useState<any>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery({ queryKey: ['academic', 'my-offerings', orgId], queryFn: () => getMyOfferings(orgId, access_token), enabled: !!orgId && !!access_token })
  const { data: interviews = [], isLoading: loadingInterviews } = useQuery({ queryKey: ['academic', 'my-interviews', orgId], queryFn: () => getMyInterviews(orgId, access_token), enabled: !!orgId && !!access_token })

  const all = offerings as any[]
  const current = all.filter((o) => CURRENT_STATES.includes(o.status))
  const past = all.filter((o) => !CURRENT_STATES.includes(o.status))
  const returned = current.filter((o) => o.grade_status === 'returned')
  const toGrade = current.filter((o) => o.status === 'in_progress' && ['open', 'returned'].includes(o.grade_status))
  const toEvaluate = (interviews as any[]).filter((i) => i.can_evaluate && i.status === 'scheduled')
  const students = current.reduce((sum, o) => sum + (o.enrolled_count || 0), 0)
  const loading = loadingOfferings || loadingInterviews
  const nothingAssigned = !loading && all.length === 0 && (interviews as any[]).length === 0
  const offeringHref = (o: any) => getUriWithOrg(orgslug, `/dash/postgraduate/teaching/offerings/${o.offering_uuid.replace('offering_', '')}`)

  const kpis = [
    { label: t('academic.teaching_now', 'Teaching now'), value: current.length, Icon: ChalkboardTeacher },
    { label: t('academic.students', 'Students'), value: students, Icon: Student },
    { label: t('academic.grades_to_submit', 'Grades to submit'), value: toGrade.length, Icon: Exam, urgent: toGrade.length > 0 },
    { label: t('academic.interviews_to_evaluate', 'Interviews to evaluate'), value: toEvaluate.length, Icon: VideoCamera, urgent: toEvaluate.length > 0 },
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs items={[{ label: t('academic.my_teaching', 'My Teaching'), icon: <GraduationCap size={14} /> }]} />
      <AcademicHeader title={t('academic.my_teaching', 'My Teaching')} subtitle={t('academic.my_teaching_desc', 'The course offerings you teach and the admission interviews you sit on.')} />

      {nothingAssigned ? (
        <div className="dash-card flex flex-col items-center rounded-[1.25rem] px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
            <ChalkboardTeacher size={24} weight="duotone" />
          </span>
          <p className="mt-3 text-base font-semibold">{t('academic.nothing_assigned', 'Nothing assigned to you yet')}</p>
          <p className="mt-1 max-w-md text-sm text-[hsl(var(--dash-muted))]">
            {t('academic.nothing_assigned_desc', 'When the program office makes you the instructor or teaching assistant of a course offering, or puts you on an interview panel, it appears here.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="dash-card grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 lg:grid-cols-4">
            {kpis.map(({ label, value, Icon, urgent }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', urgent ? 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))] text-[hsl(var(--dash-ink))]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
                  <Icon size={19} weight="duotone" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-[hsl(var(--dash-muted))]">{label}</span>
                  <span className="block text-xl font-semibold leading-tight tabular-nums">{loading ? '…' : value}</span>
                </span>
              </div>
            ))}
          </div>

          {returned.length > 0 || toEvaluate.length > 0 ? (
            <Section title={t('academic.needs_attention', 'Needs your attention')} count={returned.length + toEvaluate.length}>
              <ul className="space-y-1.5">
                {returned.map((o) => (
                  <li key={o.offering_uuid}>
                    <Link href={offeringHref(o)} className="group flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 px-3 py-2.5 transition-colors hover:bg-orange-50">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600">
                        <ArrowUUpLeft size={18} weight="duotone" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-orange-900">
                          {o.course_code} · {t('academic.grades_returned_to_you', 'grades returned for changes')}
                        </span>
                        {o.grade_note ? <span className="block truncate text-[12px] text-orange-900/80">{o.grade_note}</span> : null}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-orange-800">
                        {t('academic.open_gradebook', 'Open gradebook')} <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
                      </span>
                    </Link>
                  </li>
                ))}
                {toEvaluate.map((i) => (
                  <li key={i.interview_uuid}>
                    <button type="button" onClick={() => setEvaluating(i)} className="group flex w-full items-center gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
                        <VideoCamera size={18} weight="duotone" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">
                          {t('academic.interview_with', 'Interview with')} {displayName(i.applicant)}
                        </span>
                        <span className="block truncate text-[12px] text-[hsl(var(--dash-muted))]">
                          {[i.program_name, when(i.scheduled_at) || t('academic.time_tbc', 'time to be confirmed'), i.location].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[hsl(var(--dash-ink))] px-3 py-1 text-xs font-semibold text-white">
                        {t('academic.evaluate', 'Evaluate')} <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section
            icon={<ChalkboardTeacher size={18} weight="duotone" />}
            title={t('academic.current_offerings', 'Current offerings')}
            count={current.length}
            description={t('academic.current_offerings_desc', 'Open an offering to manage its schedule and gradebook and to submit grades for approval.')}
          >
            <OfferingsTable orgslug={orgslug} offerings={current} loading={loadingOfferings} hrefFor={offeringHref} empty={t('academic.no_current_offerings', 'You are not teaching any offering this term.')} />
          </Section>

          <Section
            icon={<VideoCamera size={18} weight="duotone" />}
            title={t('academic.interview_panels', 'Interview panels')}
            count={(interviews as any[]).length}
            description={t('academic.interview_panels_desc', 'Record your score, recommendation and notes after each interview. The admissions committee takes the final decision.')}
          >
            {(interviews as any[]).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-8 text-center text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_panels', 'You are not on any interview panel.')}</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {(interviews as any[]).map((i) => (
                  <li key={i.interview_uuid} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-3 py-2.5">
                    <PersonAvatar name={displayName(i.applicant)} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{displayName(i.applicant)}</p>
                      <p className="truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{[i.program_name, when(i.scheduled_at), i.location].filter(Boolean).join(' · ')}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusPill status={i.status} label={String(t(`academic.interview_${i.status}`, i.status))} />
                        {i.recommendation ? (
                          <span className="text-[11.5px] font-semibold">
                            {String(t(`academic.rec_${i.recommendation}`, i.recommendation))}
                            {i.score != null ? <span className="font-normal text-[hsl(var(--dash-muted))]"> · {i.score}/100</span> : null}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {i.can_evaluate ? (
                      <button type="button" onClick={() => setEvaluating(i)} className="shrink-0 rounded-full border border-[hsl(var(--dash-border))] px-3 py-1 text-xs font-semibold transition-colors hover:bg-[hsl(var(--dash-canvas))]">
                        {i.status === 'completed' ? t('academic.edit', 'Edit') : t('academic.evaluate', 'Evaluate')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {past.length > 0 ? (
            <Section title={t('academic.past_offerings', 'Past offerings')} count={past.length}>
              <OfferingsTable orgslug={orgslug} offerings={past} hrefFor={offeringHref} />
            </Section>
          ) : null}
        </div>
      )}

      <PostgradDrawer
        isDialogOpen={!!evaluating}
        onOpenChange={(o: boolean) => !o && setEvaluating(null)}
        minWidth="md"
        icon={<VideoCamera size={20} weight="duotone" />}
        dialogTitle={t('academic.interview_evaluation', 'Interview evaluation')}
        dialogDescription={evaluating ? `${displayName(evaluating.applicant)} · ${evaluating.application_number} · ${evaluating.program_name}` : undefined}
        dialogContent={
          evaluating ? (
            <EvaluationForm
              interview={evaluating}
              onDone={() => {
                setEvaluating(null)
                queryClient.invalidateQueries({ queryKey: ['academic', 'my-interviews', orgId] })
              }}
            />
          ) : null
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
      await evaluateInterview(interview.interview_uuid, { score: score === '' ? null : Number(score), recommendation, notes: notes.trim() || null }, access_token)
      toast.success(t('academic.evaluation_saved', 'Evaluation saved'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.academic_background', 'Academic background')} columns={1}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3 text-[13px] sm:grid-cols-2">
          {background
            .filter(([, v]) => v != null && v !== '')
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-[hsl(var(--dash-muted))]">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
        </dl>
        {p.statement ? <p className="max-h-40 overflow-auto whitespace-pre-line rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3 text-[12.5px] leading-relaxed text-[hsl(var(--dash-ink))]/80">{p.statement}</p> : null}
      </FormSection>
      <FormSection title={t('academic.tch.your_evaluation', 'Your evaluation')} description={t('academic.evaluation_hint', 'Saving completes the interview. The admissions committee sees your evaluation when it decides on the application.')} columns={1}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {RECOMMENDATIONS.map(({ key, Icon, cls, iconCls }) => (
            <label key={key} className="cursor-pointer">
              <input type="radio" name="rec" className="peer sr-only" checked={recommendation === key} onChange={() => setRecommendation(key)} />
              <span className={cn('flex items-center gap-2 rounded-2xl border border-[hsl(var(--dash-border))] bg-white px-3 py-2.5 text-sm font-semibold transition-all hover:border-[hsl(var(--dash-ink))]/30', cls)}>
                <Icon size={20} weight="duotone" className={iconCls} /> {String(t(`academic.rec_${key}`, key))}
              </span>
            </label>
          ))}
        </div>
        <Field label={t('academic.score_out_of_100', 'Score (0–100)')}>
          <input type="number" min={0} max={100} step="0.5" className={inputCls} value={score} onChange={(e) => setScore(e.target.value)} />
        </Field>
        <Field label={t('academic.notes', 'Notes')}>
          <textarea className={inputCls} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={!recommendation} submitLabel={t('academic.tch.save_evaluation', 'Save evaluation')} />
    </form>
  )
}

export default MyTeaching
