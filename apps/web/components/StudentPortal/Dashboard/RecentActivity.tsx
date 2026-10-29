'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Check, ClockCounterClockwise, FileText, PaperPlaneTilt, Play, SealCheck, Trophy } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import type { LearnerEvent } from '@/hooks/queries/useLearnerOverview'
import { EmptyState, Panel, PanelHeader, coursePath, lessonPath, useFormats } from './ui'

const VISIBLE = 12

// Semantic tints: green = done, blue = learning/info, purple = achievement.
const KIND: Record<LearnerEvent['kind'], { Icon: React.ElementType; tint: string }> = {
  lesson_completed: { Icon: Check, tint: 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]' },
  course_started: { Icon: Play, tint: 'bg-[hsl(212_70%_94%)] text-[hsl(212_65%_38%)]' },
  course_update: { Icon: FileText, tint: 'bg-[hsl(212_70%_94%)] text-[hsl(212_65%_38%)]' },
  assessment_submitted: { Icon: PaperPlaneTilt, tint: 'bg-[hsl(212_70%_94%)] text-[hsl(212_65%_38%)]' },
  assessment_graded: { Icon: SealCheck, tint: 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]' },
  certificate: { Icon: Trophy, tint: 'bg-[hsl(268_60%_95%)] text-[hsl(268_45%_42%)]' },
}

/** Only the learner's own activity: lessons, starts, grades, certificates, course news. */
export default function RecentActivity({ orgslug, events, loading }: { orgslug: string; events: LearnerEvent[] | undefined; loading: boolean }) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const list = (events ?? []).slice(0, VISIBLE)

  const sentence = (e: LearnerEvent) => {
    // First-strong isolates keep an Arabic title readable inside an English sentence and vice versa.
    const iso = (s: string | null) => `\u2068${s ?? ''}\u2069`
    const q = (s: string | null) => `“${iso(s)}”`
    switch (e.kind) {
      case 'lesson_completed':
        return t('student_portal.recent.lesson_completed', 'You completed the lesson {{title}}', { title: q(e.title) })
      case 'course_started':
        return t('student_portal.recent.course_started', 'You started the course {{title}}', { title: q(e.title) })
      case 'course_update':
        return t('student_portal.recent.course_update', 'New in {{course}}: {{title}}', { course: iso(e.course_name), title: iso(e.title) })
      case 'assessment_submitted':
        return t('student_portal.recent.assessment_submitted', 'You submitted {{title}}', { title: q(e.title) })
      case 'assessment_graded':
        return e.grade !== null
          ? t('student_portal.recent.assessment_graded_score', '{{title}} was graded: {{grade}}%', { title: q(e.title), grade: fmt.number(e.grade) })
          : t('student_portal.recent.assessment_graded', '{{title}} was graded', { title: q(e.title) })
      case 'certificate':
        return t('student_portal.recent.certificate', 'You earned the certificate for {{title}}', { title: q(e.title) })
    }
  }

  const hrefOf = (e: LearnerEvent) => {
    if (e.kind === 'certificate' && e.ref) return getUriWithOrg(orgslug, `/certificates/${e.ref}/verify`)
    if (e.course_uuid && e.activity_uuid) return getUriWithOrg(orgslug, lessonPath(e.course_uuid, e.activity_uuid))
    if (e.course_uuid) return getUriWithOrg(orgslug, coursePath(e.course_uuid))
    return null
  }

  return (
    <Panel aria-labelledby="recent-title" className="flex flex-col p-4 fit:h-full fit:min-h-0 fit:overflow-hidden">
      <PanelHeader id="recent-title" title={t('student_portal.recent.title', 'My recent activity')} icon={<ClockCounterClockwise size={18} weight="duotone" />} />
      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-12 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="my-auto py-5"
          icon={<ClockCounterClockwise size={22} weight="duotone" />}
          title={t('student_portal.empty.no_activity_title', 'No activity yet')}
          description={t('student_portal.empty.no_activity_desc', 'Your lessons, grades and certificates will appear here.')}
        />
      ) : (
        <ul className="-mx-1 mt-2 divide-y divide-[hsl(var(--dash-border))]/70 px-1 fit:min-h-0 fit:flex-1 fit:overflow-y-auto [scrollbar-width:thin]">
          {list.map((e, i) => {
            const { Icon, tint } = KIND[e.kind]
            const href = hrefOf(e)
            const body = (
              <>
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                  <Icon size={16} weight="bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug text-[hsl(var(--dash-ink))]">{sentence(e)}</span>
                  <span className="mt-0.5 block text-[12px] text-[hsl(var(--dash-muted))]" suppressHydrationWarning>
                    {fmt.ago(e.at)}
                  </span>
                </span>
              </>
            )
            return (
              <li key={`${e.kind}-${e.at}-${i}`}>
                {href ? (
                  <Link href={href} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-[hsl(var(--dash-canvas))]">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-1.5 py-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
