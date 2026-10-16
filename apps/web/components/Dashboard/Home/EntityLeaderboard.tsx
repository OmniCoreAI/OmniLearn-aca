'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Buildings } from '@phosphor-icons/react'
import { useReport } from '@services/reports/reports'
import { HOME_COLORS } from './homeData'
import { HomeCard } from './HomeCard'
import { CardLink } from './FinanceSnapshot'
import { useHomeRanges } from './homeReports'

const LIMIT = 5

/** Entities ranked by how far their members get: completion rate, then size. */
export default function EntityLeaderboard() {
  const { t, i18n } = useTranslation()
  const { last30 } = useHomeRanges()
  const { data, isLoading, isError } = useReport('people', last30)
  const isArabic = i18n.language.startsWith('ar')
  const rows = useMemo(
    () =>
      [...(data?.entities ?? [])]
        .sort((a, b) => b.completion_rate - a.completion_rate || b.members - a.members)
        .slice(0, LIMIT),
    [data]
  )

  return (
    <HomeCard
      title={t('dashboard.home.entities.title', 'Top entities')}
      subtitle={t('dashboard.home.entities.subtitle', 'By completion rate')}
      action={<CardLink href="/dash/reports/people" label={t('dashboard.home.open_report', 'Report')} />}
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : isError ? (
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('dashboard.stats.load_error', "Couldn't load")}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-6 text-center">
          <Buildings size={22} weight="duotone" className="text-[hsl(var(--dash-muted))]" />
          <p className="text-xs text-[hsl(var(--dash-muted))]">{t('dashboard.home.entities.empty', 'No entities yet.')}</p>
          <Link href="/dash/administration/entities" className="text-xs font-semibold text-[hsl(var(--dash-ink))] underline-offset-2 hover:underline">
            {t('dashboard.home.entities.add', 'Set up entities')}
          </Link>
        </div>
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin]">
          {rows.map((e, i) => (
            <li key={e.entity_uuid} className="flex items-center gap-3">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
                style={
                  i === 0
                    ? { background: `linear-gradient(145deg, ${HOME_COLORS.gold}, ${HOME_COLORS.goldDeep})`, color: HOME_COLORS.ink }
                    : { background: HOME_COLORS.stoneSoft, color: HOME_COLORS.muted }
                }
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-[hsl(var(--dash-ink))]">{(isArabic && e.name_ar) || e.name}</p>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{Math.round(e.completion_rate)}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(2, e.completion_rate)}%`, background: i === 0 ? HOME_COLORS.goldDeep : HOME_COLORS.ink }}
                    />
                  </div>
                  <span className="shrink-0 text-[10.5px] text-[hsl(var(--dash-muted))]">
                    {t('dashboard.home.entities.members', '{{count}} members', { count: e.members })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </HomeCard>
  )
}
