'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useReport } from '@services/reports/reports'
import { ProgressRing } from '@components/Dashboard/Shared/DashMotion'
import { DeltaChip } from '@components/Dashboard/Shared/DashStatCards'
import { HOME_COLORS } from './homeData'
import { HomeCard } from './HomeCard'
import { CardLink } from './FinanceSnapshot'
import { useHomeRanges } from './homeReports'

const ROLE_COLORS = [HOME_COLORS.ink, HOME_COLORS.gold, HOME_COLORS.red, 'hsl(222 38% 50%)', HOME_COLORS.stone]

/** Who the academy reaches: sign-in coverage, activity and the role mix. */
export default function PeoplePulse() {
  const { t, i18n } = useTranslation()
  const { last30 } = useHomeRanges()
  const { data, isLoading, isError } = useReport('people', last30)
  const num = new Intl.NumberFormat(`${i18n.language.split('-')[0]}-u-nu-latn`)
  const totals = data?.totals
  const reach = totals?.members ? Math.round((totals.signed_in / totals.members) * 100) : 0
  // Top four roles; the rest fold into "Other".
  const roles = data?.by_role ?? []
  const top = roles.slice(0, 4)
  const restShare = roles.slice(4).reduce((s, r) => s + r.share_pct, 0)
  const bars = restShare > 0 ? [...top, { role: t('dashboard.home.people.other', 'Other'), role_uuid: 'other', count: 0, share_pct: restShare }] : top

  return (
    <HomeCard
      title={t('dashboard.home.people.title', 'People')}
      subtitle={t('dashboard.home.people.subtitle', 'Reach and roles · last 30 days')}
      action={<CardLink href="/dash/reports/people" label={t('dashboard.home.open_report', 'Report')} />}
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : isError || !totals ? (
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('dashboard.stats.load_error', "Couldn't load")}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-4">
            <ProgressRing
              percent={reach}
              size={96}
              strokeWidth={9}
              label={
                <span className="flex flex-col items-center leading-none">
                  <span className="text-lg font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{reach}%</span>
                  <span className="mt-1 text-[9.5px] font-medium uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                    {t('dashboard.home.people.signed_in', 'signed in')}
                  </span>
                </span>
              }
            />
            <dl className="grid min-w-0 flex-1 gap-2 text-xs">
              {[
                {
                  label: t('dashboard.home.people.active', 'Active learners'),
                  value: totals.active_learners,
                  chip: <DeltaChip current={totals.active_learners} previous={data!.previous.active_learners} />,
                },
                {
                  label: t('dashboard.home.people.new', 'New members'),
                  value: totals.new_members,
                  chip: <DeltaChip current={totals.new_members} previous={data!.previous.new_members} />,
                },
                { label: t('dashboard.home.people.never', 'Never signed in'), value: totals.never_signed_in, chip: null },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="truncate text-[hsl(var(--dash-muted))]">{row.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-[hsl(var(--dash-ink))]">
                    {row.chip}
                    {num.format(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {bars.length ? (
            <div className="mt-auto pt-4">
              <p className="mb-2 text-[11px] font-medium text-[hsl(var(--dash-muted))]">{t('dashboard.home.people.roles', 'Members by role')}</p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                {bars.map((r, i) => (
                  <span key={r.role_uuid} style={{ width: `${r.share_pct}%`, background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {bars.map((r, i) => (
                  <li key={r.role_uuid} className="flex min-w-0 items-center gap-1.5 text-[11px] text-[hsl(var(--dash-ink))]/75">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                    <span className="truncate">{r.role}</span>
                    <span className="tabular-nums text-[hsl(var(--dash-muted))]">{Math.round(r.share_pct)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </HomeCard>
  )
}
