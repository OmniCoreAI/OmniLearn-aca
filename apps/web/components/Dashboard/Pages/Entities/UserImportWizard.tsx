'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { DataTable, GhostButton, Section, Stat, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
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
import { useEntityGroups } from './EntityMembersPanel'

const ROW_TONE: Record<string, string> = {
  valid: 'active',
  existing: 'pending',
  created: 'active',
  linked: 'active',
  invalid: 'rejected',
  failed: 'rejected',
}
const PAGE = 100

function RowsTable({ jobUuid, status }: { jobUuid: string; status: string }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const [page, setPage] = useState(1)
  const { data } = useQuery({
    queryKey: ['imports', jobUuid, 'rows', status, page],
    queryFn: () => getImportRows(jobUuid, access_token, { status: status || undefined, page, limit: PAGE }),
    enabled: ready,
  })
  const items = (data?.items || []) as any[]
  return (
    <>
      <DataTable
        headers={['#', t('entities.member', 'Member'), t('entities.contact_email', 'Email'), t('entities.position', 'Position'), t('entities.groups', 'Groups'), t('administration.common.status', 'Status')]}
        empty={t('entities.import.no_rows', 'No rows.')}
      >
        {items.map((r) => (
          <tr key={r.row_number}>
            <td className={`${tdCls} text-xs`}>{r.row_number}</td>
            <td className={tdCls}>
              {`${r.data.first_name || ''} ${r.data.last_name || ''}`.trim() || '—'}
              {r.data.employee_id && <div className="text-xs text-[hsl(var(--dash-muted))]">{r.data.employee_id}</div>}
            </td>
            <td className={`${tdCls} text-xs`}>{r.data.email || '—'}</td>
            <td className={`${tdCls} text-xs`}>{r.data.position || '—'}</td>
            <td className={`${tdCls} text-xs`}>{r.data.groups || '—'}</td>
            <td className={tdCls}>
              <StatusPill status={ROW_TONE[r.status] || 'pending'} label={String(t(`entities.import.row_${r.status}`, r.status))} />
              {r.errors?.length > 0 && <div className="mt-1 max-w-xs text-[11px] text-red-600">{r.errors.join(' · ')}</div>}
            </td>
          </tr>
        ))}
      </DataTable>
      {(data?.total || 0) > PAGE && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
          <GhostButton disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</GhostButton>
          <span>{page} / {Math.ceil((data?.total || 0) / PAGE)}</span>
          <GhostButton disabled={page * PAGE >= (data?.total || 0)} onClick={() => setPage(page + 1)}>›</GhostButton>
        </div>
      )}
    </>
  )
}

export function UserImportWizard({ entityUuid }: { entityUuid: string }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [job, setJob] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState('')
  const [options, setOptions] = useState({ notify: true, group_uuid: '', resource: '' })
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed && g.status === 'active')
  const { data: learning = [] } = useQuery({
    queryKey: ['entities', entityUuid, 'learning'],
    queryFn: () => getEntityLearning(entityUuid, access_token),
    enabled: ready,
  })
  const { data: history = [] } = useQuery({
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
      setFilter(validated.invalid_rows ? 'invalid' : '')
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
      const started = await commitImport(
        job.job_uuid,
        { notify: options.notify, group_uuid: options.group_uuid || undefined, resource_type, resource_uuid },
        access_token
      )
      setJob(started)
      if (started.status === 'completed') queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setBusy(false)
    }
  }

  const download = (fn: () => Promise<any>) => fn().catch((err: any) => toast.error(err?.message || 'Download failed'))
  const finished = job && (job.status === 'completed' || job.status === 'failed')

  return (
    <div className="space-y-6">
      {!job && (
        <Section
          title={t('entities.import.title', 'Import members from Excel')}
          description={t('entities.import.desc', 'Download the template, fill one member per row, then upload it. Nothing is created until you review and confirm.')}
          action={
            <GhostButton onClick={() => download(() => downloadImportTemplate(entityUuid, access_token))}>
              <Download className="h-3.5 w-3.5" /> {t('entities.import.template', 'Download template')}
            </GhostButton>
          }
        >
          <div
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
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))]' : 'border-[hsl(var(--dash-border))]'
            }`}
          >
            <FileSpreadsheet className="h-8 w-8 text-[hsl(var(--dash-muted))]" />
            <div className="text-sm font-medium">{busy ? '…' : t('entities.import.drop', 'Drop an .xlsx or .csv file here, or click to choose')}</div>
            <div className="text-xs text-[hsl(var(--dash-muted))]">{t('entities.import.limits', 'Up to 5 MB and 5,000 rows')}</div>
            <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </Section>
      )}

      {job && (
        <Section
          title={job.file_name}
          description={
            job.status === 'validated'
              ? t('entities.import.review', 'Review the rows. Invalid rows are skipped; fix them in the file and import them again.')
              : job.status === 'processing'
                ? t('entities.import.processing', 'Importing… you can leave this page, it continues in the background.')
                : t('entities.import.done', 'Import finished.')
          }
          action={
            <GhostButton onClick={() => setJob(null)}>
              <RotateCcw className="h-3.5 w-3.5" /> {t('entities.import.another', 'Import another file')}
            </GhostButton>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {finished ? (
              <>
                <Stat label={t('entities.import.created', 'Created')} value={job.created_count} />
                <Stat label={t('entities.import.linked', 'Already had an account')} value={job.existing_count} />
                <Stat label={t('entities.import.invalid', 'Invalid')} value={job.invalid_rows} />
                <Stat label={t('entities.import.failed', 'Failed')} value={job.failed_count} />
              </>
            ) : (
              <>
                <Stat label={t('entities.import.total', 'Rows')} value={job.total_rows} />
                <Stat label={t('entities.import.new_accounts', 'New accounts')} value={job.counts?.valid ?? 0} />
                <Stat label={t('entities.import.linked', 'Already had an account')} value={job.counts?.existing ?? 0} />
                <Stat label={t('entities.import.invalid', 'Invalid')} value={job.invalid_rows} />
              </>
            )}
          </div>

          {job.status === 'validated' && (
            <div className="mb-4 grid grid-cols-1 items-end gap-3 rounded-xl border border-dashed border-[hsl(var(--dash-border))] p-3 sm:grid-cols-3">
              <Field label={t('entities.import.add_to_group', 'Also add everyone to group')}>
                <select className={inputCls} value={options.group_uuid} onChange={(e) => setOptions({ ...options, group_uuid: e.target.value })}>
                  <option value="">—</option>
                  {groups.map((g) => (
                    <option key={g.usergroup_uuid} value={g.usergroup_uuid}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('entities.import.assign', 'Assign training')}>
                <select className={inputCls} value={options.resource} onChange={(e) => setOptions({ ...options, resource: e.target.value })}>
                  <option value="">—</option>
                  {(learning as any[]).map((r) => (
                    <option key={r.resource_uuid} value={`${r.resource_type}|${r.resource_uuid}`}>{r.resource_name}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" checked={options.notify} onChange={(e) => setOptions({ ...options, notify: e.target.checked })} />
                {t('entities.import.notify', 'Email new accounts a link to set their password')}
              </label>
              <div className="flex justify-end sm:col-span-3">
                <GhostButton onClick={commit} disabled={busy || !job.valid_rows}>
                  <Upload className="h-3.5 w-3.5" />
                  {busy ? '…' : `${t('entities.import.confirm', 'Import valid rows')} (${job.valid_rows})`}
                </GhostButton>
              </div>
            </div>
          )}
          {job.status === 'processing' && <div className="dash-shimmer mb-4 h-2 rounded-full" />}
          {job.error && <p className="mb-3 text-sm text-red-600">{job.error}</p>}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {['', 'valid,existing,created,linked', 'invalid,failed'].map((f) => (
              <GhostButton key={f} onClick={() => setFilter(f)} className={filter === f ? 'bg-[hsl(var(--dash-canvas))]' : ''}>
                {f === '' ? t('entities.import.all_rows', 'All rows') : f.startsWith('invalid') ? t('entities.import.problems', 'Problems') : t('entities.import.ok_rows', 'OK')}
              </GhostButton>
            ))}
            {(job.invalid_rows > 0 || job.failed_count > 0) && (
              <GhostButton className="ms-auto" onClick={() => download(() => downloadFailedRows(job.job_uuid, access_token))}>
                <Download className="h-3.5 w-3.5" /> {t('entities.import.download_failed', 'Download rows to fix')}
              </GhostButton>
            )}
          </div>
          <RowsTable key={`${job.job_uuid}:${job.status}:${filter}`} jobUuid={job.job_uuid} status={filter} />
        </Section>
      )}

      {(history as any[]).length > 0 && (
        <Section title={t('entities.import.history', 'Previous imports')}>
          <DataTable
            headers={[t('communication.when', 'When'), t('entities.import.file', 'File'), t('administration.common.status', 'Status'), t('entities.import.created', 'Created'), t('entities.import.linked', 'Already had an account'), t('entities.import.problems', 'Problems'), '']}
          >
            {(history as any[]).map((h) => (
              <tr key={h.job_uuid}>
                <td className={`${tdCls} whitespace-nowrap text-xs`}>{String(h.creation_date).slice(0, 16)}</td>
                <td className={`${tdCls} text-xs`}>
                  <button type="button" className="underline" onClick={() => setJob(h)}>{h.file_name}</button>
                </td>
                <td className={tdCls}>
                  <StatusPill status={h.status === 'completed' ? 'active' : h.status === 'failed' ? 'rejected' : 'pending'} label={String(t(`entities.import.status_${h.status}`, h.status))} />
                </td>
                <td className={tdCls}>{h.created_count}</td>
                <td className={tdCls}>{h.existing_count}</td>
                <td className={tdCls}>{h.invalid_rows + h.failed_count}</td>
                <td className={`${tdCls} text-end`}>
                  {h.invalid_rows + h.failed_count > 0 && (
                    <GhostButton onClick={() => download(() => downloadFailedRows(h.job_uuid, access_token))}>
                      <Download className="h-3.5 w-3.5" />
                    </GhostButton>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>
      )}
    </div>
  )
}
