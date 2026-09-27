'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { DataTable, GhostButton, Stat, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, SearchBox, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CommunicationTabs, useEventLabel, useNotificationCatalog } from '@components/Dashboard/Pages/Communication/CommunicationTabs'
import { getNotificationLog } from '@services/administration/administration'

const PAGE_SIZE = 50
const STATUSES = ['sent', 'failed', 'skipped', 'queued']

function DeliveryLogPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [eventKey, setEventKey] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const params = { channel: channel || undefined, status: status || undefined, event_key: eventKey || undefined, q: q.trim() || undefined, page, limit: PAGE_SIZE }
  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'log', orgId, params],
    queryFn: () => getNotificationLog(orgId, access_token, params),
    enabled: ready,
  })
  const items = (data?.items || []) as any[]
  const total = data?.total || 0
  const labelFor = (key: string) => eventLabel(catalog.find((e) => e.key === key)) || key

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.communication', 'Communication'), href: '/dash/administration/communication' }, { label: t('communication.tab_log', 'Delivery log') }]}
      />
      <AcademicHeader title={t('communication.tab_log', 'Delivery log')} subtitle={t('communication.log_desc', 'Every email and SMS the academy sent, with failures and their reason.')} />
      <CommunicationTabs orgslug={orgslug} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <Stat key={s} label={String(t(`communication.status_${s}`, s))} value={data?.counts?.[s] ?? 0} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('communication.search_recipient', 'Search by recipient')} />
        </div>
        <select className={`${inputCls} mb-4 w-32`} value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1) }}>
          <option value="">{t('communication.all_channels', 'All channels')}</option>
          <option value="email">{t('communication.email', 'Email')}</option>
          <option value="sms">SMS</option>
        </select>
        <select className={`${inputCls} mb-4 w-36`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">{t('entities.all_statuses', 'All statuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{String(t(`communication.status_${s}`, s))}</option>
          ))}
        </select>
        <select className={`${inputCls} mb-4 w-48`} value={eventKey} onChange={(e) => { setEventKey(e.target.value); setPage(1) }}>
          <option value="">{t('communication.all_events', 'All events')}</option>
          {catalog.map((ev) => (
            <option key={ev.key} value={ev.key}>{eventLabel(ev)}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={[t('communication.when', 'When'), t('communication.event', 'Event'), t('communication.recipient', 'Recipient'), t('communication.subject', 'Subject'), t('administration.common.status', 'Status')]}
        empty={isLoading ? '…' : t('communication.no_log', 'Nothing sent yet.')}
      >
        {items.map((log) => (
          <tr key={log.log_uuid}>
            <td className={`${tdCls} whitespace-nowrap text-xs`}>{String(log.sent_at || log.creation_date).slice(0, 16)}</td>
            <td className={tdCls}>
              <div>{labelFor(log.event_key)}</div>
              <div className="text-xs text-[hsl(var(--dash-muted))]">
                {log.channel === 'sms' ? 'SMS' : t('communication.email', 'Email')}
                {log.template_name ? ` · ${log.template_name}` : ` · ${t('communication.builtin', 'Built-in')}`}
              </div>
            </td>
            <td className={`${tdCls} text-xs`}>{log.recipient || '—'}</td>
            <td className={`${tdCls} text-xs`}>{log.subject || '—'}</td>
            <td className={tdCls}>
              <StatusPill status={log.status === 'sent' ? 'active' : log.status === 'failed' ? 'rejected' : 'pending'} label={String(t(`communication.status_${log.status}`, log.status))} />
              {log.error && <div className="mt-1 max-w-xs text-[11px] text-red-600">{log.error}</div>}
            </td>
          </tr>
        ))}
      </DataTable>
      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <GhostButton disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</GhostButton>
          <span>{page} / {Math.ceil(total / PAGE_SIZE)}</span>
          <GhostButton disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>›</GhostButton>
        </div>
      )}
    </AcademicPageShell>
  )
}

export default DeliveryLogPage
