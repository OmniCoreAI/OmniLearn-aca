'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { CardMenuLink, HomeCard, POP_SURFACE } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const BUCKET_HOURS = 4
// Latest bucket on top, like a clock read bottom-up (matches the design).
const BUCKETS = Array.from({ length: 24 / BUCKET_HOURS }, (_, i) => i * BUCKET_HOURS).reverse()
// Backend weekday: Monday = 0 … Sunday = 6. Columns run Sunday → Saturday.
const COLUMNS = [6, 0, 1, 2, 3, 4, 5]
const LEVEL_COLORS = [HOME_COLORS.stoneSoft, HOME_COLORS.roseFaint, HOME_COLORS.rose, 'hsl(351 62% 72%)', HOME_COLORS.gold]

type HoverCell = { day: number; hour: number; count: number; x: number; y: number }

export default function LearningActivityHeatmap() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const [hover, setHover] = useState<HoverCell | null>(null)

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
      subtitle={t('dashboard.home.learning_activity.subtitle', 'Completed lessons, last 30 days')}
      action={<CardMenuLink href="/dash/analytics" label={t('dashboard.home.full_analytics', 'Full analytics')} />}
    >
      {isLoading ? (
        <div className="dash-shimmer h-[230px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : (
        <>
        <div
          className="relative grid h-[200px] gap-1 fit:h-auto fit:min-h-0 fit:flex-1"
          onMouseLeave={() => setHover(null)}
          style={{
            gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${BUCKETS.length}, minmax(0, 1fr)) auto`,
          }}
          role="table"
          aria-label={t('dashboard.home.learning_activity.title', 'Learning Activity')}
        >
          {BUCKETS.map((hour) => (
            <React.Fragment key={hour}>
              <span className="self-center pe-1 text-end text-[10px] text-[hsl(var(--dash-muted))]">
                {hourName(hour)}
              </span>
              {COLUMNS.map((day) => {
                const count = grid[`${day}:${hour}`] ?? 0
                const show = (el: HTMLElement) =>
                  setHover({ day, hour, count, x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop })
                const active = hover?.day === day && hover?.hour === hour
                return (
                  <span
                    key={day}
                    role="cell"
                    tabIndex={0}
                    aria-label={`${dayName(day)} ${hourName(hour)}: ${count}`}
                    onMouseEnter={(e) => show(e.currentTarget)}
                    onFocus={(e) => show(e.currentTarget)}
                    onBlur={() => setHover(null)}
                    className={`min-h-2 rounded-[5px] outline-none transition-all focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-ink))]/40 ${
                      active ? 'scale-110 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)]' : ''
                    }`}
                    style={{ background: LEVEL_COLORS[level(count)] }}
                  />
                )
              })}
            </React.Fragment>
          ))}
          <span />
          {COLUMNS.map((day) => (
            <span key={day} className="truncate text-center text-[10px] text-[hsl(var(--dash-muted))]">
              {dayName(day)}
            </span>
          ))}
          {hover ? (
            <div
              role="tooltip"
              className={cn(
                POP_SURFACE,
                'pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px]'
              )}
              style={{ left: hover.x, top: hover.y - 6 }}
            >
              <span className="font-semibold text-[hsl(var(--dash-ink))]">
                {dayName(hover.day)}, {hourName(hover.hour)}–{hourName((hover.hour + BUCKET_HOURS) % 24)}
              </span>
              <span className="ms-1.5 text-[hsl(var(--dash-muted))]">
                {t('dashboard.home.learning_activity.count', '{{count}} activities', { count: hover.count })}
              </span>
            </div>
          ) : null}
          {max === 0 ? (
            <p className="pointer-events-none absolute inset-x-0 top-[42%] mx-auto w-fit max-w-[85%] -translate-y-1/2 rounded-xl border border-[hsl(var(--dash-border))] bg-white px-3 py-1.5 text-center text-[11px] leading-snug text-[hsl(var(--dash-muted))] shadow-sm">
              {t(
                'dashboard.home.learning_activity.empty',
                'When learners complete lessons, their busiest days and hours show up here.'
              )}
            </p>
          ) : null}
        </div>
        <div className="mt-2 flex shrink-0 items-center justify-end gap-1 text-[10px] text-[hsl(var(--dash-muted))]" title={legend.join(' · ')}>
          {t('dashboard.home.learning_activity.less', 'Less')}
          {LEVEL_COLORS.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
          ))}
          {t('dashboard.home.learning_activity.more', 'More')}
        </div>
        </>
      )}
    </HomeCard>
  )
}
