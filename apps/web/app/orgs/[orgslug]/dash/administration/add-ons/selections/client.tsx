'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { DataTable, GhostButton, Stat, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { AddOnsTabs } from '@components/Dashboard/Pages/Administration/AddOnsTabs'
import { getAddOnSelections, getAddOns } from '@services/administration/administration'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

const person = (u: any) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username : '—')

function AddOnSelectionsPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const [addonUuid, setAddonUuid] = useState('')
  const [includeCancelled, setIncludeCancelled] = useState(false)

  const { data: addons = [] } = useQuery({
    queryKey: ['administration', 'addons', orgId],
    queryFn: () => getAddOns(orgId, access_token),
    enabled: ready,
  })
  const { data: report, isLoading } = useQuery({
    queryKey: ['administration', 'addon-selections', orgId, addonUuid, includeCancelled],
    queryFn: () => getAddOnSelections(orgId, access_token, { addon_uuid: addonUuid || undefined, include_cancelled: includeCancelled }),
    enabled: ready,
  })
  const selections = (report?.selections || []) as any[]

  const exportCsv = () => {
    // Neutralize spreadsheet formulas in participant-provided text.
    const safe = (v: any) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)
    const headers = ['participant', 'email', 'add_on', 'for', 'quantity', 'unit_price', 'tax', 'total', 'currency', 'status', 'date']
    const rows = selections.map((s) =>
      [
        person(s.user),
        s.user?.email || '',
        s.addon_name,
        s.target_name || s.target_uuid,
        s.quantity,
        s.unit_price,
        s.tax_amount,
        s.total,
        s.currency || '',
        s.status,
        s.update_date,
      ].map(safe)
    )
    downloadCsv('addon-selections.csv', toCsv(headers, rows))
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.addons', 'Add-ons'), href: '/dash/administration/add-ons' },
          { label: t('administration.addons.tab_selections', 'Participant selections') },
        ]}
      />
      <AcademicHeader
        title={t('administration.addons.tab_selections', 'Participant selections')}
        subtitle={t('administration.addons.selections_desc', 'What participants chose, with the price and tax at the time of choosing.')}
        action={
          <GhostButton onClick={exportCsv} disabled={!selections.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </GhostButton>
        }
      />
      <AddOnsTabs orgslug={orgslug} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${inputCls} w-64`} value={addonUuid} onChange={(e) => setAddonUuid(e.target.value)}>
          <option value="">{t('administration.addons.all_addons', 'All add-ons')}</option>
          {(addons as any[]).map((a) => (
            <option key={a.addon_uuid} value={a.addon_uuid}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
          {t('administration.addons.include_cancelled', 'Include cancelled')}
        </label>
        <div className="ms-auto grid grid-cols-2 gap-2">
          <Stat label={t('administration.addons.total_quantity', 'Quantity')} value={report?.total_quantity ?? 0} />
          <Stat label={t('administration.addons.total', 'Total')} value={report?.total_amount ?? 0} />
        </div>
      </div>
      <DataTable
        headers={[
          t('administration.addons.participant', 'Participant'),
          t('administration.nav.addons', 'Add-ons'),
          t('administration.addons.for', 'For'),
          t('administration.addons.quantity', 'Qty'),
          t('administration.addons.total', 'Total'),
          t('administration.common.status', 'Status'),
        ]}
        empty={isLoading ? '…' : t('administration.addons.no_selections', 'No selections yet.')}
      >
        {selections.map((s) => (
          <tr key={s.selection_uuid}>
            <td className={tdCls}>
              <div className="font-medium">{person(s.user)}</div>
              <div className="text-xs text-[hsl(var(--dash-muted))]">{s.user?.email}</div>
            </td>
            <td className={tdCls}>{s.addon_name}</td>
            <td className={`${tdCls} text-xs`}>{s.target_name || s.target_uuid}</td>
            <td className={tdCls}>{s.quantity}</td>
            <td className={`${tdCls} whitespace-nowrap`}>
              {s.total} {s.currency || ''}
            </td>
            <td className={tdCls}>
              <StatusPill status={s.status === 'selected' ? 'active' : 'cancelled'} label={String(t(`administration.addons.status_${s.status}`, s.status))} />
            </td>
          </tr>
        ))}
      </DataTable>
    </AcademicPageShell>
  )
}

export default AddOnSelectionsPage
