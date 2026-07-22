'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { apiFetch } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import { useAdminOrgCourses } from '@/hooks/queries/useCourses'
import { useAnalyticsPipe } from '@components/Dashboard/Analytics/useAnalyticsDashboard'
import { CheckCircle, UsersThree } from '@phosphor-icons/react'
import { CountUp, ProgressRing, Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'

function Sparkline({ values }: { values: number[] }) {
  const w = 84
  const h = 34
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke="hsl(var(--dash-accent))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.85}
      />
    </svg>
  )
}

export default function QuezStatCards() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug
  const orgId = org?.id

  const { data: coursesData, isLoading: coursesLoading } = useAdminOrgCourses(orgslug)

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 'quez-stats'],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=1`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  // Real activity series for the members sparkline (hidden when empty)
  const { data: dauData } = useAnalyticsPipe('daily_active_users', { days: '14' })
  const dauSeries: number[] = (dauData?.data ?? []).map((r: any) => Number(r.dau) || 0)

  const courses: any[] = coursesData ?? []
  const totalMembers = membersData?.total ?? 0
  const published = courses.filter((c: any) => c.published).length
  const total = courses.length
  const publishedPercent = total > 0 ? Math.round((published / total) * 100) : 0

  if (coursesLoading || membersLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="dash-shimmer h-[150px] rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))]"
          />
        ))}
      </div>
    )
  }

  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* Courses published card */}
      <StaggerItem>
        <Link
          href="/dash/courses"
          className="dash-lift flex h-full flex-col justify-between rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]">
              <CheckCircle size={22} weight="fill" />
            </span>
            <p className="text-sm font-medium text-[hsl(var(--dash-muted))]">
              {t('dashboard.home.courses')}
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              <CountUp value={published} />
              <span className="text-lg font-medium text-[hsl(var(--dash-muted))]">/{total}</span>
            </p>
            <span className="pb-1 text-xs font-medium text-[hsl(var(--dash-muted))]">
              {t('dashboard.home.published')}
            </span>
          </div>
        </Link>
      </StaggerItem>

      {/* Members card */}
      <StaggerItem>
        <Link
          href="/dash/users/settings/users"
          className="dash-lift flex h-full flex-col justify-between rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]">
              <UsersThree size={22} weight="fill" />
            </span>
            <p className="text-sm font-medium text-[hsl(var(--dash-muted))]">
              {t('dashboard.home.members')}
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              <CountUp value={totalMembers} />
            </p>
            <Sparkline values={dauSeries} />
          </div>
        </Link>
      </StaggerItem>

      {/* Progress ring card */}
      <StaggerItem className="sm:col-span-2 xl:col-span-1">
        <div className="dash-lift flex h-full items-center justify-between gap-4 rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--dash-muted))]">
              {t('dashboard.home.progress', 'Progress')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">
              {t('dashboard.home.progress_hint', 'Share of courses published')}
            </p>
          </div>
          <ProgressRing percent={publishedPercent} size={110} strokeWidth={10} />
        </div>
      </StaggerItem>
    </Stagger>
  )
}
