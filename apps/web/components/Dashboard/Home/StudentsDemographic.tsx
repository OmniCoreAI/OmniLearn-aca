'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnalyticsPipe } from '@components/Dashboard/Analytics/useAnalyticsDashboard'
import { EmptyState, HomeCard, RangeSelect } from './HomeCard'
import { HOME_COLORS } from './homeData'
import { WORLD_COLS, WORLD_LAND_CELLS, WORLD_ROWS, projectToGrid } from './worldDots'

/** Approximate [lat, lon] centroids used to pin countries on the dot map. */
const CENTROIDS: Record<string, [number, number]> = {
  EG: [26.8, 30.8], SA: [23.9, 45.1], AE: [23.4, 53.8], KW: [29.3, 47.5], QA: [25.3, 51.2],
  BH: [26.0, 50.6], OM: [21.5, 55.9], JO: [30.6, 36.2], LB: [33.9, 35.9], SY: [34.8, 39.0],
  IQ: [33.2, 43.7], PS: [31.9, 35.2], LY: [26.3, 17.2], TN: [33.9, 9.5], DZ: [28.0, 1.7],
  MA: [31.8, -7.1], SD: [12.9, 30.2], YE: [15.6, 48.5], TR: [39.0, 35.2], IR: [32.4, 53.7],
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
  CO: [4.6, -74.3], CL: [-35.7, -71.5], PE: [-9.2, -75.0], GB: [54.0, -2.0], IE: [53.4, -8.2],
  FR: [46.2, 2.2], DE: [51.2, 10.4], NL: [52.1, 5.3], BE: [50.5, 4.5], ES: [40.5, -3.7],
  PT: [39.4, -8.2], IT: [41.9, 12.6], CH: [46.8, 8.2], AT: [47.5, 14.6], SE: [60.1, 18.6],
  NO: [60.5, 8.5], DK: [56.3, 9.5], FI: [61.9, 25.7], PL: [51.9, 19.1], UA: [48.4, 31.2],
  RU: [61.5, 105.3], GR: [39.1, 21.8], RO: [45.9, 25.0], NG: [9.1, 8.7], KE: [-0.02, 37.9],
  ET: [9.1, 40.5], ZA: [-30.6, 22.9], GH: [7.9, -1.0], IN: [20.6, 78.9], PK: [30.4, 69.3],
  BD: [23.7, 90.4], CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8], ID: [-0.8, 113.9],
  MY: [4.2, 101.9], SG: [1.35, 103.8], PH: [12.9, 121.8], TH: [15.9, 101.0], VN: [14.1, 108.3],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9],
}

const DOT_COLORS = [HOME_COLORS.red, HOME_COLORS.gold, HOME_COLORS.ink, HOME_COLORS.goldDeep, 'hsl(351 62% 72%)']
const OTHERS_COLOR = HOME_COLORS.stone

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export default function StudentsDemographic() {
  const { t, i18n } = useTranslation()
  const [days, setDays] = useState('30')
  const { data, isLoading, isError } = useAnalyticsPipe('visitors_by_country', { days })

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([i18n.language], { type: 'region' })
    } catch {
      return null
    }
  }, [i18n.language])

  const { top, othersPct } = useMemo(() => {
    const rows: { code: string; users: number }[] = (data?.data ?? [])
      .map((r: any) => ({ code: String(r.country_code || '').toUpperCase(), users: Number(r.unique_users) || 0 }))
      .filter((r: { code: string; users: number }) => r.code && r.users > 0)
    const total = rows.reduce((s, r) => s + r.users, 0)
    const topRows = rows.slice(0, 5).map((r, i) => ({
      ...r,
      pct: total ? Math.round((r.users / total) * 100) : 0,
      color: DOT_COLORS[i % DOT_COLORS.length]!,
    }))
    const shown = topRows.reduce((s, r) => s + r.users, 0)
    return { top: topRows, othersPct: total && total > shown ? Math.round(((total - shown) / total) * 100) : 0 }
  }, [data])

  return (
    <HomeCard
      title={t('dashboard.home.demographic.title', 'Students Demographic')}
      action={
        <RangeSelect
          label={t('dashboard.home.range', 'Range')}
          value={days}
          onChange={setDays}
          options={[
            { value: '7', label: t('dashboard.home.this_week', 'This week') },
            { value: '30', label: t('dashboard.home.last_30_days', 'Last 30 days') },
            { value: '90', label: t('dashboard.home.last_90_days', 'Last 90 days') },
          ]}
        />
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : isError || top.length === 0 ? (
        <div className="grid items-center gap-4 sm:grid-cols-[1.4fr_1fr] fit:min-h-0 fit:flex-1">
          <DotMap pins={[]} />
          <EmptyState className="min-h-[120px] fit:h-full">
            {isError
              ? t(
                  'dashboard.home.demographic.unavailable',
                  'Learner locations appear once website analytics is connected.'
                )
              : t('dashboard.home.demographic.empty', 'No visitor locations recorded in this period.')}
          </EmptyState>
        </div>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[1.4fr_1fr] fit:min-h-0 fit:flex-1">
          <DotMap
            pins={top
              .filter((r) => CENTROIDS[r.code])
              .map((r) => ({ code: r.code, color: r.color, coords: CENTROIDS[r.code]! }))}
          />
          <ul className="space-y-3 fit:space-y-1 fit:text-xs">
            {top.map((r) => (
              <li key={r.code} className="flex items-center gap-2.5 text-sm">
                <span className="text-lg leading-none" aria-hidden="true">
                  {flagEmoji(r.code)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-[hsl(var(--dash-ink))]">
                  {regionNames?.of(r.code) ?? r.code}
                </span>
                <span className="text-xs text-[hsl(var(--dash-muted))]">({r.pct}%)</span>
              </li>
            ))}
            {othersPct > 0 && (
              <li className="flex items-center gap-2.5 text-sm">
                <span className="h-[18px] w-[18px] rounded-full" style={{ background: OTHERS_COLOR }} />
                <span className="flex-1 font-medium text-[hsl(var(--dash-ink))]">
                  {t('dashboard.home.demographic.others', 'Others')}
                </span>
                <span className="text-xs text-[hsl(var(--dash-muted))]">({othersPct}%)</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </HomeCard>
  )
}

function DotMap({ pins }: { pins: { code: string; color: string; coords: [number, number] }[] }) {
  return (
    <svg
      viewBox={`0 0 ${WORLD_COLS} ${WORLD_ROWS}`}
      className="h-auto max-h-full w-full"
      role="img"
      aria-hidden={pins.length === 0}
    >
      {WORLD_LAND_CELLS.map(([c, r]) => (
        <circle key={`${c}-${r}`} cx={c + 0.5} cy={r + 0.5} r={0.36} fill="hsl(43 40% 78%)" />
      ))}
      {pins.map(({ code, color, coords }) => {
        const [x, y] = projectToGrid(coords[0], coords[1])
        return (
          <g key={code} transform={`translate(${x + 0.5} ${y + 0.5})`}>
            <circle r={1.9} fill={color} opacity={0.18} />
            <circle r={1.05} fill={color} stroke="#fff" strokeWidth={0.35} />
          </g>
        )
      })}
    </svg>
  )
}
