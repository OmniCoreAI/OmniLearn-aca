'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, CheckCircle, ClockCountdown, Exam, Medal, Target, TrendUp } from '@phosphor-icons/react'
import type { LearnerDay, LearnerTotals } from '@/hooks/queries/useLearnerOverview'
import { cn } from '@/lib/utils'
import { Delta, GOLD, MiniBars, Ring, Sparkline, useDuration, useFormats } from './ui'

/**
 * The learner's own headline numbers — one card each, every card with a
 * micro-visual that explains the number. No academy-wide figures.
 */
export default function PersonalStats({ totals, days, loading }: { totals: LearnerTotals | undefined; days: LearnerDay[] | undefined; loading: boolean }) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const duration = useDuration()

  if (loading || !totals) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-shimmer h-[140px] rounded-[1.25rem]" />
        ))}
      </div>
    )
  }

  const s = totals
  const last14 = (days ?? []).slice(-14)
  const last7 = (days ?? []).slice(-7)
  const completion = s.lessons_total > 0 ? Math.round((s.lessons_completed / s.lessons_total) * 100) : 0
  const hours = Math.round((s.learning_minutes / 60) * 10) / 10
  const inProgressPct = s.courses ? (s.in_progress / s.courses) * 100 : 0

  return (
    <section aria-label={t('student_portal.stats.title', 'My progress')} className="@container">
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-4">
        {/* My courses */}
        <Kpi
          label={t('student_portal.stats.my_courses', 'My courses')}
          icon={<BookOpenText size={19} weight="duotone" />}
          tint="bg-[hsl(43_85%_92%)] text-[hsl(38_80%_34%)]"
          value={fmt.number(s.courses)}
        >
          <div className="flex h-2 overflow-hidden rounded-full bg-[hsl(220_14%_93%)]" aria-hidden="true">
            {s.courses ? (
              <>
                <span className="h-full bg-[hsl(43_88%_55%)]" style={{ width: `${inProgressPct}%` }} />
                <span className="h-full bg-[hsl(152_55%_42%)]" style={{ width: `${100 - inProgressPct}%` }} />
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[hsl(var(--dash-muted))]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(43_88%_55%)]" />
              {t('student_portal.stats.in_progress_n', '{{count}} in progress', { count: s.in_progress })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(152_55%_42%)]" />
              {t('student_portal.stats.completed_n', '{{count}} completed', { count: s.completed_courses })}
            </span>
          </div>
        </Kpi>

        {/* Lessons completed */}
        <Kpi
          label={t('student_portal.stats.lessons_completed', 'Lessons completed')}
          icon={<CheckCircle size={19} weight="duotone" />}
          tint="bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]"
          value={fmt.number(s.lessons_completed)}
          suffix={<span className="text-[13px] font-semibold text-[hsl(var(--dash-muted))]">/ {fmt.number(s.lessons_total)}</span>}
          badge={<Delta now={s.lessons_this_week} before={s.lessons_last_week} format={fmt.number} />}
        >
          <Sparkline values={last14.map((d) => d.lessons)} height={30} />
          <p className="mt-1 truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{t('student_portal.stats.last_14_days', 'Lessons per day · last 14 days')}</p>
        </Kpi>

        {/* Learning hours */}
        <Kpi
          label={t('student_portal.stats.learning_hours', 'Learning hours')}
          icon={<ClockCountdown size={19} weight="duotone" />}
          tint="bg-[hsl(212_75%_94%)] text-[hsl(212_65%_36%)]"
          value={fmt.number(hours)}
          suffix={<span className="text-[13px] font-semibold text-[hsl(var(--dash-muted))]">{t('student_portal.stats.hours_unit', 'hrs')}</span>}
          badge={<Delta now={s.minutes_this_week} before={s.minutes_last_week} format={(n) => duration(n)} />}
        >
          <MiniBars
            height={24}
            values={last7.map((d) => d.minutes)}
            titles={last7.map((d) => `${fmt.date(new Date(`${d.date}T00:00:00`), { weekday: 'long' })}: ${duration(d.minutes)}`)}
          />
          <p className="mt-1 truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{t('student_portal.stats.hours_context', 'Estimated from the lessons you completed')}</p>
        </Kpi>

        {/* Completion and achievements */}
        <Kpi
          label={t('student_portal.stats.completion', 'Completion of my courses')}
          icon={<Target size={19} weight="duotone" />}
          tint="bg-[hsl(268_60%_95%)] text-[hsl(268_45%_42%)]"
        >
          <div className="flex items-center gap-3">
            <Ring value={completion} size={66} stroke={8} color={GOLD} label={`${completion}%`}>
              <span className="text-[16px] font-bold leading-none tabular-nums">{fmt.number(completion)}%</span>
            </Ring>
            <dl className="min-w-0 flex-1 space-y-1 text-[11.5px]">
              {[
                { key: 'cert', Icon: Medal, label: t('student_portal.stats.certificates_short', 'Certificates'), value: fmt.number(s.certificates), tone: 'text-[hsl(268_45%_45%)]' },
                { key: 'asmt', Icon: Exam, label: t('student_portal.stats.assessments_short', 'Assessments'), value: `${fmt.number(s.assessments_completed)}/${fmt.number(s.assessments_total)}`, tone: 'text-[hsl(212_65%_40%)]' },
                { key: 'score', Icon: TrendUp, label: t('student_portal.stats.score_short', 'Avg. score'), value: s.average_score === null ? '—' : `${fmt.number(s.average_score)}%`, tone: 'text-[hsl(152_60%_30%)]' },
              ].map(({ key, Icon, label, value, tone }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon size={13} weight="duotone" className={cn('shrink-0', tone)} />
                  <dt className="min-w-0 flex-1 truncate text-[hsl(var(--dash-muted))]">{label}</dt>
                  <dd className="shrink-0 font-bold tabular-nums text-[hsl(var(--dash-ink))]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Kpi>
      </div>
    </section>
  )
}

function Kpi({
  label,
  icon,
  tint,
  value,
  suffix,
  badge,
  children,
}: {
  label: string
  icon: React.ReactNode
  tint: string
  value?: string
  suffix?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-3.5 shadow-[0_1px_2px_hsl(220_30%_10%/0.04),0_12px_32px_-20px_hsl(220_30%_10%/0.14)] transition-shadow hover:shadow-[0_1px_2px_hsl(220_30%_10%/0.04),0_18px_36px_-18px_hsl(220_30%_10%/0.2)]">
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tint)}>{icon}</span>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[hsl(var(--dash-ink))]/75" title={label}>{label}</h3>
      </div>
      {value !== undefined ? (
        <p className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-[hsl(var(--dash-ink))]">{value}</span>
          {suffix}
          {badge ? <span className="ms-auto self-center">{badge}</span> : null}
        </p>
      ) : null}
      <div className="mt-auto pt-2.5">{children}</div>
    </div>
  )
}
