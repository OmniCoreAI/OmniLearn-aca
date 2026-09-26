'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CardMenuLink, EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const BUCKET_HOURS = 4
// Latest bucket on top, like a clock read bottom-up (matches the design).
const BUCKETS = Array.from({ length: 24 / BUCKET_HOURS }, (_, i) => i * BUCKET_HOURS).reverse()
// Backend weekday: Monday = 0 … Sunday = 6. Columns run Sunday → Saturday.
const COLUMNS = [6, 0, 1, 2, 3, 4, 5]
const LEVEL_COLORS = [HOME_COLORS.stoneSoft, HOME_COLORS.roseFaint, HOME_COLORS.rose, 'hsl(351 62% 72%)', HOME_COLORS.gold]

export default function LearningActivityHeatmap() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()

  const { grid, max } = useMemo(() => {
    const g: Record<string, number> = {}
    let m = 0
    for (const cell of data?.activity_heatmap ?? []) {
      const key = `${cell.day}:${cell.hour - (cell.hour % BUCKET_HOURS)}`
      g[key] = (g[key] ?? 0) + cell.count
      m = Math.max(m, g[key]!)
    }
    return { grid: g, max: m }
  }, [data])

  const step = Math.max(1, Math.ceil(max / 4))
  const level = (count: number) => (count <= 0 ? 0 : Math.min(4, Math.ceil(count / step)))
  const legend = [1, 2, 3, 4].map((l) => `${(l - 1) * step + 1}${l === 4 ? '+' : `–${l * step}`}`)

  const dayName = (weekday: number) =>
    // 2024-01-01 was a Monday, so Monday-based index + 1 = day of month.
    new Date(2024, 0, weekday + 1).toLocaleDateString(i18n.language, { weekday: 'short' })
  const hourName = (hour: number) =>
    new Date(2024, 0, 1, hour).toLocaleTimeString(i18n.language, { hour: 'numeric' })

  return (
    <HomeCard
      title={t('dashboard.home.learning_activity.title', 'Learning Activity')}
      action={
        <div className="flex items-center gap-2">
          {max > 0 && (
            <div className="hidden items-center gap-2 text-[10px] text-[hsl(var(--dash-muted))] sm:flex">
              {legend.map((label, i) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: LEVEL_COLORS[i + 1] }} />
                  {label}
                </span>
              ))}
            </div>
          )}
          <CardMenuLink href="/dash/analytics" label={t('dashboard.home.full_analytics', 'Full analytics')} />
        </div>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[230px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : max === 0 ? (
        <EmptyState className="h-[230px]">
          {t(
            'dashboard.home.learning_activity.empty',
            'When learners complete lessons, their busiest days and hours show up here.'
          )}
        </EmptyState>
      ) : (
        <div
          className="grid gap-1.5 fit:min-h-0 fit:flex-1"
          style={{
            gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${BUCKETS.length}, minmax(0, 1fr)) auto`,
          }}
          role="table"
          aria-label={t('dashboard.home.learning_activity.title', 'Learning Activity')}
        >
          {BUCKETS.map((hour) => (
            <React.Fragment key={hour}>
              <span className="self-center pe-1 text-end text-[11px] text-[hsl(var(--dash-muted))]">
                {hourName(hour)}
              </span>
              {COLUMNS.map((day) => {
                const count = grid[`${day}:${hour}`] ?? 0
                return (
                  <span
                    key={day}
                    role="cell"
                    title={`${dayName(day)} ${hourName(hour)} · ${count}`}
                    className="h-7 rounded-md transition-transform hover:scale-110 fit:h-auto fit:min-h-2"
                    style={{ background: LEVEL_COLORS[level(count)] }}
                  />
                )
              })}
            </React.Fragment>
          ))}
          <span />
          {COLUMNS.map((day) => (
            <span key={day} className="text-center text-[11px] text-[hsl(var(--dash-muted))]">
              {dayName(day)}
            </span>
          ))}
        </div>
      )}
    </HomeCard>
  )
}
