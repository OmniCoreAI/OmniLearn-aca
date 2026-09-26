'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, GraduationCap, PlayCircle } from '@phosphor-icons/react'
import { CountUp, Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'
import { CardMenuLink } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const CARD_STYLES = {
  rose: { bg: HOME_COLORS.roseSoft, icon: HOME_COLORS.red },
  stone: { bg: HOME_COLORS.stone, icon: HOME_COLORS.ink },
  gold: { bg: HOME_COLORS.gold, icon: HOME_COLORS.goldDeep },
}

export default function HomeStatCards() {
  const { t } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const totals = data?.totals

  const cards = [
    {
      key: 'students',
      label: t('dashboard.home.stats.total_students', 'Total Students'),
      value: totals?.students ?? 0,
      hint: t('dashboard.home.stats.members_hint', '{{count}} members in total', {
        count: totals?.members ?? 0,
      }),
      icon: GraduationCap,
      href: '/dash/users/settings/users',
      style: CARD_STYLES.rose,
    },
    {
      key: 'courses',
      label: t('dashboard.home.stats.total_courses', 'Total Courses'),
      value: totals?.courses ?? 0,
      hint: t('dashboard.home.stats.published_hint', '{{count}} published', {
        count: totals?.published_courses ?? 0,
      }),
      icon: PlayCircle,
      href: '/dash/courses',
      style: CARD_STYLES.stone,
    },
    {
      key: 'enrollments',
      label: t('dashboard.home.stats.total_enrollments', 'Total Enrollments'),
      value: totals?.enrollments ?? 0,
      hint: t('dashboard.home.stats.last_30_days_hint', '+{{count}} in the last 30 days', {
        count: totals?.enrollments_30d ?? 0,
      }),
      icon: CheckSquare,
      href: '/dash/analytics',
      style: CARD_STYLES.gold,
    },
  ]

  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3" staggerDelay={0.05}>
      {cards.map(({ key, label, value, hint, icon: Icon, href, style }) => (
        <StaggerItem key={key}>
          {isLoading ? (
            <div className="dash-shimmer h-[112px] rounded-[var(--dash-radius)] fit:h-[66px]" />
          ) : (
            <div
              className="relative flex h-full items-center gap-4 rounded-[var(--dash-radius)] p-5 fit:gap-3 fit:px-4 fit:py-2.5"
              style={{ background: style.bg }}
            >
              <span className="inline-flex h-14 w-14 fit:h-10 fit:w-10 fit:rounded-xl shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_hsl(0_0%_8%/0.06)]">
                <Icon size={24} weight="regular" style={{ color: style.icon }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[hsl(var(--dash-ink))]/80">{label}</p>
                <p className="mt-0.5 text-[1.75rem] fit:text-[1.35rem] fit:mt-0 font-semibold leading-tight tracking-tight text-[hsl(var(--dash-ink))]">
                  <CountUp value={value} />
                </p>
                <p className="truncate text-[11px] text-[hsl(var(--dash-ink))]/60">{hint}</p>
              </div>
              <div className="absolute end-3 top-3 rounded-lg bg-white/80 fit:top-2.5">
                <CardMenuLink href={href} label={t('dashboard.home.view_all', 'View All')} />
              </div>
            </div>
          )}
        </StaggerItem>
      ))}
    </Stagger>
  )
}
