'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const SEGMENT_COLORS = [HOME_COLORS.gold, HOME_COLORS.red, HOME_COLORS.ink]
const REST_COLOR = HOME_COLORS.stone
const SIZE = 180
const R = 70
const STROKE = 20
// Round caps extend STROKE/2 past each dash end; trim that (plus a small gap)
// so neighbouring segments never overlap.
const CAP_PAD = STROKE / 2 + 3
const CIRC = 2 * Math.PI * R

type Segment = { key: string; name: string; value: number; color: string; pct: number; lessons?: number }

/**
 * SVG donut (lighter than a chart library and fully controllable): each
 * segment is a dashed circle arc; the hovered/focused one thickens and the
 * center shows its name and share.
 */
function Donut({
  segments,
  active,
  onActive,
  centerTop,
  centerBottom,
}: {
  segments: Segment[]
  active: string | null
  onActive: (_key: string | null) => void
  centerTop: string
  centerBottom: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const single = segments.length === 1
  // Arc start of each segment = sum of the arcs before it.
  const arcs = segments.map((seg) => (seg.value / total) * CIRC)
  const starts = arcs.map((_, i) => arcs.slice(0, i).reduce((s, x) => s + x, 0))
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label={centerBottom}>
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="hsl(40 16% 94% / 0.8)" strokeWidth={STROKE} />
        {segments.map((seg, i) => {
          const len = single ? CIRC : Math.max(0.01, arcs[i]! - 2 * CAP_PAD)
          return (
            <circle
              key={seg.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={active === seg.key ? STROKE + 6 : STROKE}
              strokeDasharray={`${len} ${CIRC - len}`}
              strokeDashoffset={single ? 0 : -(starts[i]! + CAP_PAD)}
              strokeLinecap={single ? 'butt' : 'round'}
              opacity={active && active !== seg.key ? 0.35 : 1}
              style={{ transition: 'stroke-width 180ms ease, opacity 180ms ease', cursor: 'pointer' }}
              onMouseEnter={() => onActive(seg.key)}
              onMouseLeave={() => onActive(null)}
            />
          )
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" className="fill-[hsl(var(--dash-ink))] text-[26px] font-semibold tabular-nums">
        {centerTop}
      </text>
      <text x="50%" y="60%" textAnchor="middle" className="fill-[hsl(var(--dash-muted))] text-[10px]">
        {centerBottom.length > 22 ? `${centerBottom.slice(0, 21)}…` : centerBottom}
      </text>
    </svg>
  )
}

export default function TopCoursesDonut() {
  const { t } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const [active, setActive] = useState<string | null>(null)

  const { segments, hasTop, total } = useMemo(() => {
    const totalEnroll = data?.totals.enrollments ?? 0
    const topCourses = (data?.top_courses ?? []).slice(0, 3).filter((c) => c.enrollments > 0)
    const segs: Segment[] = topCourses.map((c, i) => ({
      key: c.course_uuid,
      name: c.name,
      value: c.enrollments,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]!,
      pct: totalEnroll ? Math.round((c.enrollments / totalEnroll) * 100) : 0,
      lessons: c.lessons,
    }))
    const rest = totalEnroll - topCourses.reduce((s, c) => s + c.enrollments, 0)
    if (rest > 0) {
      segs.push({
        key: 'rest',
        name: t('dashboard.home.top_courses.others', 'Other courses'),
        value: rest,
        color: REST_COLOR,
        pct: Math.round((rest / totalEnroll) * 100),
      })
    }
    return { segments: segs, hasTop: topCourses.length > 0, total: totalEnroll }
  }, [data, t])

  const focused = segments.find((s) => s.key === active)

  return (
    <HomeCard
      title={t('dashboard.home.top_courses.title', 'Top Courses')}
      subtitle={total ? t('dashboard.home.top_courses.subtitle', 'Share of {{count}} enrollments', { count: total }) : undefined}
      action={
        <Link
          href="/dash/courses"
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-white/70 hover:text-[hsl(var(--dash-ink))]"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : !hasTop ? (
        <EmptyState className="h-[220px]">
          {t('dashboard.home.top_courses.empty', 'Your most popular courses will be ranked here.')}
        </EmptyState>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
          <div className="mx-auto aspect-square h-[180px] fit:h-full fit:max-h-[180px]">
            <Donut
              segments={segments}
              active={active}
              onActive={setActive}
              centerTop={`${focused ? focused.pct : 100}%`}
              centerBottom={focused ? focused.name : t('dashboard.home.top_courses.all', 'All enrollments')}
            />
          </div>
          <ul className="min-w-0 space-y-1 fit:space-y-0.5">
            {segments.map((seg) => (
              <li key={seg.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(seg.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(seg.key)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-start transition-colors fit:py-1',
                    active === seg.key ? 'bg-white/70' : 'hover:bg-white/50'
                  )}
                >
                  <span className="h-8 w-1.5 shrink-0 rounded-full fit:h-5" style={{ background: seg.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]" title={seg.name}>
                      {seg.name}
                    </span>
                    <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))] fit:hidden">
                      {t('dashboard.home.top_courses.students', '{{count}} students', { count: seg.value })}
                      {seg.lessons !== undefined
                        ? ` · ${t('dashboard.home.new_courses.lessons', '{{count}} lessons', { count: seg.lessons })}`
                        : ''}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{seg.pct}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HomeCard>
  )
}
