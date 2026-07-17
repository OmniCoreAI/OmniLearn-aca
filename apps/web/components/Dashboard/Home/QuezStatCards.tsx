'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { apiFetch } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import { getOrgCourses } from '@services/courses/courses'
import { cn } from '@/lib/utils'

function MiniBars({ values, tone = 'teal' }: { values: number[]; tone?: 'teal' | 'coral' }) {
  const max = Math.max(...values, 1)
  const fill = tone === 'teal' ? 'bg-[hsl(var(--dash-accent))]' : 'bg-rose-400'
  return (
    <div className="flex h-10 items-end gap-0.5">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-sm opacity-80', fill)}
          style={{ height: `${Math.max(18, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function MiniLine({ values, tone = 'teal' }: { values: number[]; tone?: 'teal' | 'coral' }) {
  const w = 72
  const h = 36
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
  const stroke = tone === 'teal' ? 'hsl(var(--dash-accent))' : '#fb7185'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
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

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'quez-stats'],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 'quez-stats'],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=1`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const courses: any[] = coursesData ?? []
  const totalMembers = membersData?.total ?? 0
  const published = courses.filter((c: any) => c.published).length
  const drafts = courses.length - published

  const cards = [
    {
      label: t('dashboard.home.courses'),
      value: String(courses.length),
      trend: published > drafts ? '+15%' : '+5%',
      trendUp: true,
      href: '/dash/courses',
      action: t('dashboard.home.view_details', 'View details'),
      chart: <MiniBars values={[3, 5, 4, 7, 6, 8, 9]} />,
    },
    {
      label: t('dashboard.home.members'),
      value: String(totalMembers),
      trend: '+10%',
      trendUp: true,
      href: '/dash/users/settings/users',
      action: t('dashboard.home.view_details', 'View details'),
      chart: <MiniLine values={[12, 14, 13, 18, 16, 20, 22]} />,
    },
    {
      label: t('dashboard.home.published'),
      value: String(published),
      trend: drafts > published ? '↓10%' : '+8%',
      trendUp: drafts <= published,
      href: '/dash/courses',
      action: t('dashboard.home.export', 'Export'),
      chart: <MiniBars values={[8, 6, 7, 4, 5, 3, 4]} tone={drafts > published ? 'coral' : 'teal'} />,
    },
    {
      label: t('dashboard.home.draft'),
      value: String(Math.max(drafts, 0)),
      trend: '+25%',
      trendUp: true,
      href: '/dash/courses',
      action: t('dashboard.home.export', 'Export'),
      chart: <MiniLine values={[4, 6, 5, 9, 8, 11, 14]} tone="coral" />,
    },
  ]

  if (coursesLoading || membersLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[132px] animate-pulse rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))]"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 shadow-[0_1px_2px_hsl(220_18%_14%/0.04)]"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[hsl(var(--dash-muted))]">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
                {card.value}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                card.trendUp
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-500'
              )}
            >
              {card.trend}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            {card.chart}
            <Link
              href={card.href}
              className="text-[11px] font-medium text-[hsl(var(--dash-accent))] hover:underline"
            >
              {card.action}
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
