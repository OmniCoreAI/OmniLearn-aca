'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  CaretRight,
  CheckCircle,
  ClipboardText,
  Exam,
  IdentificationCard,
  PencilSimpleLine,
  SealCheck,
} from '@phosphor-icons/react'
import { HomeCard } from './HomeCard'
import { HomeOverview, useHomeOverview } from './homeData'

type AttentionKey = keyof NonNullable<HomeOverview['attention']>

/** Each kind of waiting work: where to act on it and how it looks. */
const ITEMS: { key: AttentionKey; href: string; icon: React.ElementType; tint: string; color: string }[] = [
  { key: 'submissions_to_grade', href: '/dash/assignments', icon: ClipboardText, tint: 'hsl(43 80% 93%)', color: 'hsl(38 75% 36%)' },
  {
    key: 'applications_to_review',
    href: '/dash/postgraduate/admissions',
    icon: IdentificationCard,
    tint: 'hsl(351 72% 95%)',
    color: 'hsl(351 80% 42%)',
  },
  { key: 'tests_to_review', href: '/dash/postgraduate/admissions', icon: Exam, tint: 'hsl(222 45% 94%)', color: 'hsl(222 45% 38%)' },
  { key: 'grades_to_approve', href: '/dash/postgraduate/offerings', icon: SealCheck, tint: 'hsl(160 35% 92%)', color: 'hsl(160 45% 28%)' },
  { key: 'draft_courses', href: '/dash/courses', icon: PencilSimpleLine, tint: 'hsl(220 14% 94%)', color: 'hsl(0 0% 20%)' },
]

/**
 * The admin's to-do list: counts of work waiting on staff, busiest first,
 * each row a shortcut to where it gets done.
 */
export default function NeedsAttention() {
  const { t } = useTranslation()
  const { data, isLoading } = useHomeOverview()

  const labels: Record<AttentionKey, string> = {
    submissions_to_grade: t('dashboard.home.attention.submissions_to_grade', 'Submissions to grade'),
    applications_to_review: t('dashboard.home.attention.applications_to_review', 'Applications to review'),
    tests_to_review: t('dashboard.home.attention.tests_to_review', 'Entrance tests to review'),
    grades_to_approve: t('dashboard.home.attention.grades_to_approve', 'Grades to approve'),
    draft_courses: t('dashboard.home.attention.draft_courses', 'Draft courses'),
  }

  // Only what actually waits gets a row (busiest first); the rest collapse
  // into one "all clear" line so the card never fills up with zeros.
  const { rows, clearKeys } = useMemo(() => {
    const counts = data?.attention
    const all = ITEMS.map((item) => ({ ...item, count: counts?.[item.key] ?? 0 }))
    return {
      rows: all.filter((r) => r.count > 0).sort((a, b) => b.count - a.count),
      clearKeys: all.filter((r) => r.count === 0).map((r) => r.key),
    }
  }, [data])
  const clear = clearKeys.map((key) => labels[key])
  const waiting = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <HomeCard
      title={t('dashboard.home.attention.title', 'Needs Attention')}
      subtitle={
        isLoading
          ? undefined
          : waiting
            ? t('dashboard.home.attention.waiting', '{{count}} items waiting on your team', { count: waiting })
            : t('dashboard.home.attention.all_clear', "You're all caught up")
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[200px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : rows.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-500/[0.06] px-4 text-center fit:h-auto fit:min-h-0 fit:flex-1">
          <CheckCircle size={32} weight="duotone" className="text-emerald-600" />
          <p className="text-[13px] font-medium text-[hsl(var(--dash-ink))]">
            {t('dashboard.home.attention.all_clear', "You're all caught up")}
          </p>
          <p className="text-[11px] leading-snug text-[hsl(var(--dash-muted))]">
            {t('dashboard.home.attention.all_clear_hint', 'No submissions, applications, tests or grades are waiting.')}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-0.5 [overflow-anchor:none] [scrollbar-width:thin] fit:-me-1.5 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pe-1.5">
            {rows.map(({ key, href, icon: Icon, tint, color, count }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: tint, color }}
                  >
                    <Icon size={16} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]">
                    {labels[key]}
                  </span>
                  <span className="inline-flex min-w-6 shrink-0 justify-center rounded-full bg-[hsl(var(--dash-ink))] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                    {count.toLocaleString()}
                  </span>
                  <CaretRight
                    size={11}
                    weight="bold"
                    className="-ms-1 shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {clear.length ? (
            <p
              className="mt-2 flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-800"
              title={clear.join(' · ')}
            >
              <CheckCircle size={15} weight="fill" className="shrink-0 text-emerald-500" />
              <span className="min-w-0 truncate">
                {t('dashboard.home.attention.others_clear', 'Nothing else waiting: {{list}}', { list: clear.join(', ') })}
              </span>
            </p>
          ) : null}
        </>
      )}
    </HomeCard>
  )
}
