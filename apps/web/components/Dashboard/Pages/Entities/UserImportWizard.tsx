'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import DashDataTable from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AdminCard, formatAdminDate, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { Switch } from '@components/ui/switch'
import {
  commitImport,
  downloadFailedRows,
  downloadImportTemplate,
  getEntityLearning,
  getImportJob,
  getImportJobs,
  getImportRows,
  validateImportFile,
} from '@services/administration/administration'
import { cn } from '@/lib/utils'
import { useEntityGroups } from './EntityMembersPanel'

const ROW_TONE: Record<string, string> = {
  valid: 'active',
  existing: 'pending',
  created: 'active',
  linked: 'active',
  invalid: 'rejected',
  failed: 'rejected',
}
const PAGE = 50
const FILTERS = ['', 'valid,existing,created,linked', 'invalid,failed'] as const

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3.5 py-3">
      <div className="text-[11px] font-medium text-[hsl(var(--dash-muted))]">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'warn' && value > 0 ? 'text-[hsl(var(--dash-warn))]' : 'text-[hsl(var(--dash-ink))]')}>{value ?? 0}</div>
    </div>
  )
}

function Steps({ current }: { current: 0 | 1 | 2 }) {
  const { t } = useTranslation()
  const steps = [t('entities.import.step_upload', 'Upload file'), t('entities.import.step_review', 'Review rows'), t('entities.import.step_import', 'Import')]
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
              i < current && 'bg-emerald-600 text-white',
              i === current && 'bg-[hsl(var(--dash-ink))] text-white',
              i > current && 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i === current ? 'text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-muted))]'}>{label}</span>
          {i < steps.length - 1 ? <span className="mx-1 h-px w-8 bg-[hsl(var(--dash-border))]" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}

function RowsTable({ jobUuid, status, toolbar }: { jobUuid: string; status: string; toolbar: React.ReactNode }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['imports', jobUuid, 'rows', status, page],
    queryFn: () => getImportRows(jobUuid, access_token, { status: status || undefined, page, limit: PAGE }),
    enabled: ready,
  })
  return (
    <DashDataTable
      rows={(data?.items || []) as any[]}
      rowKey={(r: any) => String(r.row_number)}
      loading={isLoading}
      serverPaging={{ page, pageSize: PAGE, total: data?.total || 0, onChange: setPage }}
      itemLabel={(n) => t('entities.import.rows_count', '{{count}} rows', { count: n })}
      toolbar={toolbar}
      className="shadow-none"
      empty={<AcademicEmptyState compact title={t('entities.import.no_rows', 'No rows')} description={t('entities.import.no_rows_hint', 'Nothing matches this filter.')} />}
      columns={[
        { key: 'row', header: '#', width: '56px', cell: (r: any) => <span className="text-xs tabular-nums text-[hsl(var(--dash-muted))]">{r.row_number}</span> },
        {
          key: 'member',
          header: t('entities.member', 'Member'),
          primary: true,
          cell: (r: any) => (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-medium">{`${r.data.first_name || ''} ${r.data.last_name || ''}`.trim() || '—'}</div>
              <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{[r.data.email, r.data.employee_id].filter(Boolean).join(' · ')}</div>
            </div>
          ),
        },
        { key: 'position', header: t('entities.position', 'Position'), hideBelow: 'lg', hideOnMobile: true, cell: (r: any) => <span className="text-[13px]">{r.data.position || '—'}</span> },
        { key: 'groups', header: t('entities.groups', 'Groups'), hideBelow: 'xl', hideOnMobile: true, cell: (r: any) => <span className="text-[13px]">{r.data.groups || '—'}</span> },
        {
          key: 'status',
          header: t('administration.common.status', 'Status'),
          cell: (r: any) => (
            <div className="min-w-0">
              <StatusPill status={ROW_TONE[r.status] || 'pending'} label={String(t(`entities.import.row_${r.status}`, r.status))} />
              {r.errors?.length > 0 ? <div className="mt-1 max-w-xs text-[11px] text-[hsl(var(--dash-warn))]">{r.errors.join(' · ')}</div> : null}
            </div>
          ),
        },
      ]}
    />
  )
}

export function UserImportWizard({ entityUuid }: { entityUuid: string }) {
  const { t, i18n } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [job, setJob] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [options, setOptions] = useState({ notify: true, group_uuid: '', resource: '' })
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed && g.status === 'active')
  const { data: learning = [] } = useQuery({
    queryKey: ['entities', entityUuid, 'learning'],
    queryFn: () => getEntityLearning(entityUuid, access_token),
    enabled: ready,
  })
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['imports', entityUuid, 'history'],
    queryFn: () => getImportJobs(entityUuid, access_token),
    enabled: ready,
  })

  // Poll while the import runs in the background.
  useEffect(() => {
    if (job?.status !== 'processing') return
    const handle = setInterval(async () => {
      try {
        const fresh = await getImportJob(job.job_uuid, access_token)
        setJob(fresh)
        if (fresh.status !== 'processing') {
          queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
          queryClient.invalidateQueries({ queryKey: ['imports', entityUuid] })
        }
      } catch {
        /* keep polling */
      }
    }, 2000)
    return () => clearInterval(handle)
  }, [job?.status, job?.job_uuid, access_token, entityUuid, queryClient])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const validated = await validateImportFile(entityUuid, file, access_token)
      setJob(validated)
      setFilter(validated.invalid_rows ? 'invalid,failed' : '')
      queryClient.invalidateQueries({ queryKey: ['imports', entityUuid, 'history'] })
    } catch (err: any) {
      toast.error(err?.message || t('entities.import.upload_failed', 'The file could not be read'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const commit = async () => {
    setBusy(true)
    try {
      const [resource_type, resource_uuid] = options.resource ? options.resource.split('|') : [undefined, undefined]
      const started = await commitImport(job.job_uuid, { notify: options.notify, group_uuid: options.group_uuid || undefined, resource_type, resource_uuid }, access_token)
      setJob(started)
      if (started.status === 'completed') queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setBusy(false)
    }
  }

  const download = (fn: () => Promise<any>) => fn().catch((err: any) => toast.error(err?.message || t('entities.import.download_failed_msg', 'Download failed')))
  const finished = job && (job.status === 'completed' || job.status === 'failed')
  const step: 0 | 1 | 2 = !job ? 0 : job.status === 'validated' ? 1 : 2
  const filterLabel = (f: string) => (f === '' ? t('entities.import.all_rows', 'All rows') : f.startsWith('invalid') ? t('entities.import.problems', 'Problems') : t('entities.import.ok_rows', 'OK'))

  return (
    <div className="space-y-5">
      <div className="dash-card flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] px-5 py-3.5">
        <Steps current={step} />
        {job ? (
          <GhostButton onClick={() => setJob(null)}>
            <RotateCcw className="h-3.5 w-3.5" /> {t('entities.import.another', 'Import another file')}
          </GhostButton>
        ) : (
          <GhostButton onClick={() => download(() => downloadImportTemplate(entityUuid, access_token))}>
            <Download className="h-3.5 w-3.5" /> {t('entities.import.template', 'Download template')}
          </GhostButton>
        )}
      </div>

      {!job ? (
        <AdminCard
          title={t('entities.import.title', 'Import members from Excel')}
          description={t('entities.import.desc', 'Download the template, fill one member per row, then upload it. Nothing is created until you review and confirm.')}
        >
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              upload(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
              dragging ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))]' : 'border-[hsl(var(--dash-border))] hover:border-[hsl(var(--dash-muted))]'
            )}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium">{busy ? t('entities.import.reading', 'Reading the file…') : t('entities.import.drop', 'Drop an .xlsx or .csv file here, or click to choose')}</span>
            <span className="text-xs text-[hsl(var(--dash-muted))]">{t('entities.import.limits', 'Up to 5 MB and 5,000 rows')}</span>
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </AdminCard>
      ) : (
        <AdminCard
          title={job.file_name}
          description={
            job.status === 'validated'
              ? t('entities.import.review', 'Review the rows. Invalid rows are skipped; fix them in the file and import them again.')
              : job.status === 'processing'
                ? t('entities.import.processing', 'Importing… you can leave this page, it continues in the background.')
                : t('entities.import.done', 'Import finished.')
          }
        >
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {finished ? (
              <>
                <Tile label={t('entities.import.created', 'Created')} value={job.created_count} />
                <Tile label={t('entities.import.linked', 'Already had an account')} value={job.existing_count} />
                <Tile label={t('entities.import.invalid', 'Invalid')} value={job.invalid_rows} tone="warn" />
                <Tile label={t('entities.import.failed', 'Failed')} value={job.failed_count} tone="warn" />
              </>
            ) : (
              <>
                <Tile label={t('entities.import.total', 'Rows')} value={job.total_rows} />
                <Tile label={t('entities.import.new_accounts', 'New accounts')} value={job.counts?.valid ?? 0} />
                <Tile label={t('entities.import.linked', 'Already had an account')} value={job.counts?.existing ?? 0} />
                <Tile label={t('entities.import.invalid', 'Invalid')} value={job.invalid_rows} tone="warn" />
              </>
            )}
          </div>

          {job.status === 'validated' ? (
            <div className="mb-5 space-y-4 rounded-2xl border border-[hsl(var(--dash-border))] p-4">
              <div className="text-sm font-semibold">{t('entities.import.options', 'When importing')}</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('entities.import.add_to_group', 'Also add everyone to group')}>
                  <select className={inputCls} value={options.group_uuid} onChange={(e) => setOptions({ ...options, group_uuid: e.target.value })}>
                    <option value="">{t('entities.import.no_group', 'No group')}</option>
                    {groups.map((g) => (
                      <option key={g.usergroup_uuid} value={g.usergroup_uuid}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('entities.import.assign', 'Assign training')}>
                  <select className={inputCls} value={options.resource} onChange={(e) => setOptions({ ...options, resource: e.target.value })}>
                    <option value="">{t('entities.import.no_training', 'No training')}</option>
                    {(learning as any[]).map((r) => (
                      <option key={r.resource_uuid} value={`${r.resource_type}|${r.resource_uuid}`}>
                        {r.resource_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5 text-sm">
                {t('entities.import.notify', 'Email new accounts a link to set their password')}
                <Switch
                  className="data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]"
                  checked={options.notify}
                  onCheckedChange={(v) => setOptions({ ...options, notify: v })}
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={commit}
                  disabled={busy || !job.valid_rows}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {busy ? t('entities.import.importing', 'Importing…') : t('entities.import.confirm_n', 'Import {{count}} valid rows', { count: job.valid_rows })}
                </button>
              </div>
            </div>
          ) : null}
          {job.status === 'processing' ? <div className="dash-shimmer mb-4 h-2 rounded-full" /> : null}
          {job.error ? <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{job.error}</p> : null}

          <RowsTable
            key={`${job.job_uuid}:${job.status}:${filter}`}
            jobUuid={job.job_uuid}
            status={filter}
            toolbar={
              <>
                <div className={cn(TAB_TRACK, 'p-0.5 shadow-none')} role="tablist">
                  {FILTERS.map((f) => (
                    <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={tabItemClass(filter === f, 'px-3 py-1 text-xs')}>
                      {filterLabel(f)}
                    </button>
                  ))}
                </div>
                {job.invalid_rows > 0 || job.failed_count > 0 ? (
                  <GhostButton onClick={() => download(() => downloadFailedRows(job.job_uuid, access_token))}>
                    <Download className="h-3.5 w-3.5" /> {t('entities.import.download_failed', 'Download rows to fix')}
                  </GhostButton>
                ) : null}
              </>
            }
          />
        </AdminCard>
      )}

      {(history as any[]).length > 0 ? (
        <DashDataTable
          rows={history as any[]}
          rowKey={(h: any) => h.job_uuid}
          loading={historyLoading}
          onRowClick={setJob}
          pageSize={10}
          initialSort={{ key: 'when', dir: 'desc' }}
          itemLabel={(n) => t('entities.import.imports_count', '{{count}} imports', { count: n })}
          toolbar={<span className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('entities.import.history', 'Previous imports')}</span>}
          columns={[
            {
              key: 'file',
              header: t('entities.import.file', 'File'),
              primary: true,
              cell: (h: any) => (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                    <FileSpreadsheet className="h-4 w-4" />
                  </span>
                  <span className="truncate font-medium">{h.file_name}</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: t('administration.common.status', 'Status'),
              cell: (h: any) => (
                <StatusPill status={h.status === 'completed' ? 'active' : h.status === 'failed' ? 'rejected' : 'pending'} label={String(t(`entities.import.status_${h.status}`, h.status))} />
              ),
            },
            { key: 'created', header: t('entities.import.created', 'Created'), align: 'end', sortValue: (h: any) => h.created_count, cell: (h: any) => <span className="tabular-nums">{h.created_count}</span> },
            {
              key: 'existing',
              header: t('entities.import.linked', 'Already had an account'),
              align: 'end',
              hideBelow: 'lg',
              hideOnMobile: true,
              cell: (h: any) => <span className="tabular-nums">{h.existing_count}</span>,
            },
            {
              key: 'problems',
              header: t('entities.import.problems', 'Problems'),
              align: 'end',
              sortValue: (h: any) => h.invalid_rows + h.failed_count,
              cell: (h: any) => (
                <span className={cn('tabular-nums', h.invalid_rows + h.failed_count > 0 && 'font-medium text-[hsl(var(--dash-warn))]')}>{h.invalid_rows + h.failed_count}</span>
              ),
            },
            {
              key: 'when',
              header: t('communication.when', 'When'),
              hideBelow: 'xl',
              hideOnMobile: true,
              sortValue: (h: any) => h.creation_date,
              cell: (h: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{formatAdminDate(h.creation_date, i18n.language)}</span>,
            },
          ]}
          actions={(h: any) => [
            { label: t('entities.import.open', 'Open'), onSelect: () => setJob(h) },
            ...(h.invalid_rows + h.failed_count > 0
              ? [{ label: t('entities.import.download_failed', 'Download rows to fix'), icon: <Download className="h-3.5 w-3.5" />, onSelect: () => download(() => downloadFailedRows(h.job_uuid, access_token)) }]
              : []),
          ]}
        />
      ) : null}
    </div>
  )
}
