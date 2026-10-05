'use client'
import React, { useMemo, useState } from 'react'
import { Users as ChalkboardTeacher, Plus, Trash2, Calculator } from 'lucide-react'
import { ClockCountdown, Coins, ListChecks, UsersThree } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { Field, FormActions, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { PersonAvatar, formatAdminDate, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  getInstructors,
  getInstructorWorkLogs,
  createInstructorWorkLog,
  deleteInstructorWorkLog,
  getInstructorFinanceSummary,
  computeInstructorRate,
} from '@services/instructors/instructors'

function InstructorFinanceHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [instructor, setInstructor] = useState('all')
  const [language, setLanguage] = useState('all')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['instructor-worklogs', orgId],
    queryFn: () => getInstructorWorkLogs(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 15_000,
  })
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['instructor-finance-summary', orgId],
    queryFn: () => getInstructorFinanceSummary(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 15_000,
  })
  const all = logs as any[]

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['instructor-worklogs', orgId] })
    queryClient.invalidateQueries({ queryKey: ['instructor-finance-summary', orgId] })
  }

  const handleDelete = async (l: any) => {
    const ok = await confirm({
      title: t('instructors.delete_log_title', 'Delete this work log?'),
      message: t('instructors.delete_log_message', '{{hours}} h by {{name}} — the cost is removed from the finance totals.', { hours: l.hours, name: l.instructor_name || '—' }),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteInstructorWorkLog(l.worklog_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  const instructorOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of all) if (l.instructor_uuid) seen.set(l.instructor_uuid, l.instructor_name || l.instructor_uuid)
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [all])
  const languageOptions = useMemo(() => [...new Set(all.map((l) => l.language).filter(Boolean))].map((l) => ({ value: l as string, label: l as string })), [all])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (l) =>
        (instructor === 'all' || l.instructor_uuid === instructor) &&
        (language === 'all' || l.language === language) &&
        (!q || `${l.instructor_name || ''} ${l.description || ''}`.toLowerCase().includes(q))
    )
  }, [all, query, instructor, language])
  const filtering = !!query || instructor !== 'all' || language !== 'all'
  const currency = all.find((l) => l.currency)?.currency || ''
  const money = (v: number | null | undefined, cur = currency) => `${Number(v || 0).toLocaleString(i18n.language, { maximumFractionDigits: 2 })} ${cur}`.trim()

  const logButton = (
    <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
      <AcademicPrimaryButton onClick={() => setModalOpen(true)}>
        <Plus className="h-4 w-4" /> {t('instructors.log_hours', 'Log Hours')}
      </AcademicPrimaryButton>
    </AuthenticatedClientElement>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('instructors.title', 'Instructors'), href: getUriWithOrg(orgslug, '/dash/instructors'), icon: <ChalkboardTeacher size={14} /> },
          { label: t('instructors.finance', 'Finance'), href: getUriWithOrg(orgslug, '/dash/instructors/finance') },
        ]}
      />
      <AcademicHeader title={t('instructors.finance', 'Finance')} subtitle={t('instructors.finance_desc', 'Log delivered hours — cost is Hours × Rate')} action={logButton} />
      <InstructorTabs orgslug={orgslug} />

      <DashStatCards
        className="mb-6"
        loading={summaryLoading}
        stats={[
          { key: 'hours', label: t('instructors.total_hours', 'Total hours'), value: Number(summary?.total_hours ?? 0), icon: ClockCountdown, tone: 'gold' },
          { key: 'cost', label: t('instructors.total_cost', 'Total cost'), value: money(summary?.total_amount), icon: Coins, tone: 'rose' },
          { key: 'entries', label: t('instructors.entries', 'Entries'), value: Number(summary?.entry_count ?? 0), icon: ListChecks, tone: 'stone' },
          { key: 'instructors', label: t('instructors.paid_instructors', 'Instructors with hours'), value: instructorOptions.length, icon: UsersThree, tone: 'sand' },
        ]}
      />

      <DashDataTable
        rows={visible}
        rowKey={(l: any) => l.worklog_uuid}
        loading={isLoading}
        initialSort={{ key: 'date', dir: 'desc' }}
        itemLabel={(n) => t('instructors.worklogs_count', '{{count}} work logs', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('instructors.search_logs', 'Search instructor or note')} />
            <ToolbarSelect
              label={t('instructors.instructor', 'Instructor')}
              value={instructor}
              onChange={setInstructor}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...instructorOptions]}
            />
            {languageOptions.length ? (
              <ToolbarSelect
                label={t('instructors.language', 'Language')}
                value={language}
                onChange={setLanguage}
                options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...languageOptions]}
              />
            ) : null}
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<ClockCountdown size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('instructors.no_logs_title', 'No work logs yet')}
            description={
              filtering ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.') : t('instructors.no_logs_hint', 'Log delivered hours to track what each instructor is owed.')
            }
            action={filtering ? undefined : logButton}
          />
        }
        columns={[
          {
            key: 'instructor',
            header: t('instructors.instructor', 'Instructor'),
            primary: true,
            sortValue: (l: any) => l.instructor_name || '',
            cell: (l: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={l.instructor_name || '—'} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-medium">{l.instructor_name || '—'}</div>
                  {l.description ? <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{l.description}</div> : null}
                </div>
              </div>
            ),
          },
          { key: 'language', header: t('instructors.language', 'Language'), hideBelow: 'lg', hideOnMobile: true, cell: (l: any) => <span className="text-[13px]">{l.language || '—'}</span> },
          { key: 'hours', header: t('instructors.hours', 'Hours'), align: 'end', sortValue: (l: any) => Number(l.hours), cell: (l: any) => <span className="tabular-nums">{l.hours}</span> },
          {
            key: 'rate',
            header: t('instructors.rate', 'Rate'),
            align: 'end',
            hideBelow: 'lg',
            hideOnMobile: true,
            sortValue: (l: any) => Number(l.rate_applied),
            cell: (l: any) => <span className="whitespace-nowrap tabular-nums text-[hsl(var(--dash-muted))]">{money(l.rate_applied, l.currency || '')}</span>,
          },
          {
            key: 'amount',
            header: t('instructors.amount', 'Amount'),
            align: 'end',
            sortValue: (l: any) => Number(l.amount),
            cell: (l: any) => <span className="whitespace-nowrap font-semibold tabular-nums">{money(l.amount, l.currency || '')}</span>,
          },
          {
            key: 'date',
            header: t('instructors.date', 'Date'),
            sortValue: (l: any) => l.work_date || '',
            cell: (l: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{l.work_date ? formatAdminDate(l.work_date, i18n.language) : '—'}</span>,
          },
        ]}
        actions={(l: any) => [{ label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => handleDelete(l) }]}
      />

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="sm"
        dialogTitle={t('instructors.log_hours', 'Log Hours')}
        dialogContent={
          modalOpen ? (
            <WorkLogForm
              orgId={orgId!}
              access_token={access_token}
              onCancel={() => setModalOpen(false)}
              onDone={() => {
                setModalOpen(false)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function WorkLogForm({
  orgId,
  access_token,
  onDone,
  onCancel,
}: {
  orgId: number
  access_token: string
  onDone: () => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors', orgId],
    queryFn: () => getInstructors(orgId, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const [instructorUuid, setInstructorUuid] = useState('')
  const [hours, setHours] = useState('')
  const [language, setLanguage] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const nameOf = (i: any) =>
    `${i.user?.first_name || ''} ${i.user?.last_name || ''}`.trim() || i.user?.username || i.instructor_uuid

  const selected = useMemo(
    () => instructors.find((i: any) => i.instructor_uuid === instructorUuid),
    [instructors, instructorUuid]
  )
  const languageOptions: string[] = selected?.languages || []

  const doPreview = async () => {
    if (!instructorUuid || hours === '') return
    try {
      const res = await computeInstructorRate(
        { instructor_uuid: instructorUuid, hours: Number(hours), language: language || null },
        access_token
      )
      setPreview(res)
    } catch (err: any) {
      setPreview(null)
      toast.error(err?.message || t('instructors.rate_error', 'Could not resolve a rate'))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createInstructorWorkLog(
        orgId,
        {
          instructor_uuid: instructorUuid,
          hours: Number(hours),
          language: language || null,
          work_date: workDate || null,
          description: description || null,
        },
        access_token
      )
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('instructors.instructor', 'Instructor')} required>
        <select
          className={inputCls}
          value={instructorUuid}
          onChange={(e) => {
            setInstructorUuid(e.target.value)
            setPreview(null)
          }}
          required
        >
          <option value="">{t('instructors.select_instructor', 'Select an instructor')}</option>
          {instructors.map((i: any) => (
            <option key={i.instructor_uuid} value={i.instructor_uuid}>
              {nameOf(i)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('instructors.hours', 'Hours')} required>
          <input
            type="number"
            min={0}
            step="0.25"
            className={inputCls}
            value={hours}
            onChange={(e) => {
              setHours(e.target.value)
              setPreview(null)
            }}
            required
          />
        </Field>
        <Field label={t('instructors.language', 'Delivery language')}>
          {languageOptions.length > 0 ? (
            <select
              className={inputCls}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setPreview(null)
              }}
            >
              <option value="">{t('instructors.default_rate', 'Default')}</option>
              {languageOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={inputCls}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setPreview(null)
              }}
              placeholder="English"
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('instructors.date', 'Work date')}>
          <input type="date" className={inputCls} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <GhostButton type="button" onClick={doPreview} disabled={!instructorUuid || hours === ''} className="w-full justify-center py-2">
            <Calculator className="h-4 w-4" /> {t('instructors.preview', 'Preview cost')}
          </GhostButton>
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--dash-muted))]">
              {preview.hours} × {preview.rate_applied}
            </span>
            <span className="font-bold text-[hsl(var(--dash-ink))]">
              {preview.amount} {preview.currency || ''}
            </span>
          </div>
          <div className="text-xs text-[hsl(var(--dash-muted))] mt-1">
            {t('instructors.rate_source', 'Rate source')}: {t(`instructors.source_${preview.rate_source}`, preview.rate_source) as string}
          </div>
        </div>
      )}

      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export default InstructorFinanceHome
