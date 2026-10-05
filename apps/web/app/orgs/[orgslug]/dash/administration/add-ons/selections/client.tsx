'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Coins, Package, ShoppingCart, Users } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminBreadcrumbs, PersonAvatar, formatAdminDate, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { AddOnsTabs } from '@components/Dashboard/Pages/Administration/AddOnsTabs'
import { getAddOnSelections, getAddOns } from '@services/administration/administration'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

const person = (u: any) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username : '—')

function AddOnSelectionsPage({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const [addonUuid, setAddonUuid] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'selected' | 'all'>('selected')
  const [query, setQuery] = useState('')
  const includeCancelled = statusFilter === 'all'

  const { data: addons = [] } = useQuery({
    queryKey: ['administration', 'addons', orgId],
    queryFn: () => getAddOns(orgId, access_token),
    enabled: ready,
  })
  const { data: report, isLoading } = useQuery({
    queryKey: ['administration', 'addon-selections', orgId, addonUuid, includeCancelled],
    queryFn: () => getAddOnSelections(orgId, access_token, { addon_uuid: addonUuid === 'all' ? undefined : addonUuid, include_cancelled: includeCancelled }),
    enabled: ready,
  })
  const selections = useMemo(() => (report?.selections || []) as any[], [report])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return selections
    return selections.filter((s) => `${person(s.user)} ${s.user?.email || ''} ${s.addon_name} ${s.target_name || ''}`.toLowerCase().includes(q))
  }, [selections, query])
  const participants = new Set(selections.filter((s) => s.status === 'selected').map((s) => s.user?.id ?? s.user?.email)).size
  const currency = selections.find((s) => s.currency)?.currency || ''
  const money = (v: number | null | undefined, cur?: string) => `${Number(v || 0).toLocaleString(i18n.language, { maximumFractionDigits: 2 })} ${cur ?? currency}`.trim()

  const exportCsv = () => {
    // Neutralize spreadsheet formulas in participant-provided text.
    const safe = (v: any) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)
    const headers = ['participant', 'email', 'add_on', 'for', 'quantity', 'unit_price', 'tax', 'total', 'currency', 'status', 'date']
    const rows = visible.map((s) =>
      [person(s.user), s.user?.email || '', s.addon_name, s.target_name || s.target_uuid, s.quantity, s.unit_price, s.tax_amount, s.total, s.currency || '', s.status, s.update_date].map(safe)
    )
    downloadCsv('addon-selections.csv', toCsv(headers, rows))
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.addons', 'Add-ons'), href: '/dash/administration/add-ons' }, { label: t('administration.addons.tab_selections', 'Participant selections') }]}
      />
      <AcademicHeader
        title={t('administration.addons.tab_selections', 'Participant selections')}
        subtitle={t('administration.addons.selections_desc', 'What participants chose, with the price and tax at the time of choosing.')}
        action={
          <GhostButton onClick={exportCsv} disabled={!visible.length}>
            <Download className="h-3.5 w-3.5" /> {t('administration.common.export_csv', 'Export CSV')}
          </GhostButton>
        }
      />
      <AddOnsTabs orgslug={orgslug} />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'selections', label: t('administration.addons.stats.selections', 'Selections'), value: selections.filter((s) => s.status === 'selected').length, icon: ShoppingCart, tone: 'gold' },
          { key: 'participants', label: t('administration.addons.stats.participants', 'Participants'), value: participants, icon: Users, tone: 'stone' },
          { key: 'quantity', label: t('administration.addons.total_quantity', 'Quantity'), value: report?.total_quantity ?? 0, icon: Package, tone: 'sand' },
          { key: 'total', label: t('administration.addons.total', 'Total'), value: money(report?.total_amount), icon: Coins, tone: 'rose' },
        ]}
      />

      <DashDataTable
        rows={visible}
        rowKey={(s: any) => s.selection_uuid}
        loading={isLoading}
        initialSort={{ key: 'date', dir: 'desc' }}
        itemLabel={(n) => t('administration.addons.selections_count', '{{count}} selections', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('administration.addons.search_selections', 'Search participant or add-on')} />
            <ToolbarSelect
              label={t('administration.nav.addons', 'Add-on')}
              value={addonUuid}
              onChange={setAddonUuid}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...(addons as any[]).map((a) => ({ value: a.addon_uuid, label: a.name }))]}
            />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'selected' | 'all')}
              options={[
                { value: 'selected', label: t('administration.addons.status_selected', 'Selected') },
                { value: 'all', label: t('administration.addons.include_cancelled', 'Include cancelled') },
              ]}
            />
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<ShoppingCart size={24} />}
            title={query || addonUuid !== 'all' ? t('administration.common.no_matches', 'No matches') : t('administration.addons.no_selections', 'No selections yet')}
            description={t('administration.addons.no_selections_hint', 'Selections appear when participants pick optional add-ons for a course or program.')}
          />
        }
        columns={[
          {
            key: 'participant',
            header: t('administration.addons.participant', 'Participant'),
            primary: true,
            sortValue: (s: any) => person(s.user),
            cell: (s: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={person(s.user)} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-medium">{person(s.user)}</div>
                  <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{s.user?.email}</div>
                </div>
              </div>
            ),
          },
          {
            key: 'addon',
            header: t('administration.addons.addon', 'Add-on'),
            sortValue: (s: any) => s.addon_name,
            cell: (s: any) => (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-medium">{s.addon_name}</div>
                <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{s.target_name || s.target_uuid}</div>
              </div>
            ),
          },
          { key: 'qty', header: t('administration.addons.quantity', 'Qty'), align: 'end', sortValue: (s: any) => s.quantity, cell: (s: any) => <span className="tabular-nums">{s.quantity}</span> },
          {
            key: 'total',
            header: t('administration.addons.total', 'Total'),
            align: 'end',
            sortValue: (s: any) => s.total,
            cell: (s: any) => (
              <div className="leading-tight">
                <div className="whitespace-nowrap font-medium tabular-nums">{money(s.total, s.currency || '')}</div>
                {s.tax_amount ? (
                  <div className="whitespace-nowrap text-[11px] text-[hsl(var(--dash-muted))]">
                    {t('administration.addons.incl_tax', 'incl. {{amount}} tax', { amount: money(s.tax_amount, '') })}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (s: any) => s.status,
            cell: (s: any) => <StatusPill status={s.status === 'selected' ? 'active' : 'cancelled'} label={String(t(`administration.addons.status_${s.status}`, s.status))} />,
          },
          {
            key: 'date',
            header: t('administration.addons.date', 'Date'),
            hideBelow: 'lg',
            hideOnMobile: true,
            sortValue: (s: any) => s.update_date,
            cell: (s: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{formatAdminDate(s.update_date, i18n.language)}</span>,
          },
        ]}
      />
    </AcademicPageShell>
  )
}

export default AddOnSelectionsPage
