'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { UserPlus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, HomeUser, useHomeOverview, userAvatarUrl, userDisplayName } from './homeData'

/** Below this many ranked lecturers, the card suggests adding more. */
const FEW = 3

function Avatar({ user, leader }: { user: HomeUser; leader: boolean }) {
  const url = userAvatarUrl(user)
  const name = userDisplayName(user)
  const ring = leader ? 'ring-2 ring-[hsl(var(--dash-accent))] ring-offset-2 ring-offset-white' : ''
  return url ? (
    <img src={url} alt="" className={cn('h-9 w-9 shrink-0 rounded-full object-cover', ring)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase', ring)}
      style={{ background: leader ? HOME_COLORS.goldSoft : HOME_COLORS.stoneSoft, color: leader ? HOME_COLORS.goldDeep : HOME_COLORS.ink }}
    >
      {name.slice(0, 2)}
    </span>
  )
}

/** Lecturers ranked by the enrollments across the courses they teach. */
export default function TopInstructors() {
  const { t } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const instructors = data?.top_instructors ?? []

  return (
    <HomeCard
      title={t('dashboard.home.top_instructors.title', 'Top Instructors')}
      subtitle={t('dashboard.home.top_instructors.subtitle', 'By enrollments in their courses')}
      action={
        <Link
          href="/dash/instructors"
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[200px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : instructors.length === 0 ? (
        <EmptyState className="h-[200px]">
          {t('dashboard.home.top_instructors.empty', 'Instructors appear here once they teach a course.')}
        </EmptyState>
      ) : (
        <>
        <ol className="space-y-1 fit:-me-1.5 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pe-1.5 [scrollbar-width:thin]">
          {instructors.map((ins, i) => {
            const pct = ins.enrollments ? Math.round((ins.completions / ins.enrollments) * 100) : 0
            const meta = [
              t('dashboard.home.top_instructors.courses', '{{count}} courses', { count: ins.courses }),
              ins.department,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li
                key={ins.user.user_uuid}
                className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
              >
                <Avatar user={ins.user} leader={i === 0 && ins.enrollments > 0} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]">
                    {userDisplayName(ins.user)}
                  </span>
                  <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">{meta}</span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block text-[13px] font-semibold tabular-nums text-[hsl(var(--dash-ink))]">
                    {ins.enrollments.toLocaleString()}
                  </span>
                  <span className="block text-[10px] tabular-nums text-[hsl(var(--dash-muted))]">
                    {t('dashboard.home.top_courses.done', '{{pct}}% done', { pct })}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        {instructors.length < FEW ? (
          <Link
            href="/dash/instructors"
            className="mt-2 flex shrink-0 items-center gap-2.5 rounded-xl border border-dashed border-[hsl(var(--dash-border))] px-3 py-2 text-[11px] text-[hsl(var(--dash-muted))] transition-colors hover:border-[hsl(var(--dash-accent))]/50 hover:text-[hsl(var(--dash-ink))]"
          >
            <UserPlus size={16} weight="duotone" className="shrink-0 text-[hsl(var(--dash-accent))]" />
            <span className="min-w-0 flex-1 leading-snug">
              {t('dashboard.home.top_instructors.add_more', 'Add instructor profiles to rank more of your lecturers.')}
            </span>
          </Link>
        ) : null}
        </>
      )}
    </HomeCard>
  )
}
