'use client'
import React, { useMemo, useState } from 'react'
import { Users as ChalkboardTeacher, Plus, Trash2, Calculator } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { Field, SubmitRow, inputCls } from '../../postgraduate/client'
import {
  getInstructors,
  getInstructorWorkLogs,
  createInstructorWorkLog,
  deleteInstructorWorkLog,
  getInstructorFinanceSummary,
  computeInstructorRate,
} from '@services/instructors/instructors'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl nice-shadow border border-gray-100 p-4">
      <p className="text-xs uppercase font-bold tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function InstructorFinanceHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['instructor-worklogs', orgId],
    queryFn: () => getInstructorWorkLogs(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 15_000,
  })
  const { data: summary } = useQuery({
    queryKey: ['instructor-finance-summary', orgId],
    queryFn: () => getInstructorFinanceSummary(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 15_000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['instructor-worklogs', orgId] })
    queryClient.invalidateQueries({ queryKey: ['instructor-finance-summary', orgId] })
  }

  const handleDelete = async (l: any) => {
    if (!window.confirm(t('instructors.confirm_delete_log', 'Delete this work log?'))) return
    try {
      await deleteInstructorWorkLog(l.worklog_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('instructors.title', 'Instructors'),
            href: getUriWithOrg(orgslug, '/dash/instructors'),
            icon: <ChalkboardTeacher size={14} />,
          },
          { label: t('instructors.finance', 'Finance'), href: getUriWithOrg(orgslug, '/dash/instructors/finance') },
        ]}
      />
      <AcademicHeader
        title={t('instructors.finance', 'Finance')}
        subtitle={t('instructors.finance_desc', 'Log delivered hours — cost is Hours × Rate')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('instructors.log_hours', 'Log Hours')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <InstructorTabs orgslug={orgslug} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label={t('instructors.total_hours', 'Total hours')} value={String(summary?.total_hours ?? 0)} />
        <StatCard label={t('instructors.total_cost', 'Total cost')} value={String(summary?.total_amount ?? 0)} />
        <StatCard label={t('instructors.entries', 'Entries')} value={String(summary?.entry_count ?? 0)} />
      </div>

      <div className="bg-white rounded-xl nice-shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-4 py-3 font-bold">{t('instructors.title', 'Instructor')}</th>
              <th className="px-4 py-3 font-bold">{t('instructors.language', 'Language')}</th>
              <th className="px-4 py-3 font-bold text-right">{t('instructors.hours', 'Hours')}</th>
              <th className="px-4 py-3 font-bold text-right">{t('instructors.rate', 'Rate')}</th>
              <th className="px-4 py-3 font-bold text-right">{t('instructors.amount', 'Amount')}</th>
              <th className="px-4 py-3 font-bold">{t('instructors.date', 'Date')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {t('instructors.no_logs', 'No work logs yet.')}
                </td>
              </tr>
            )}
            {logs.map((l: any) => (
              <tr key={l.worklog_uuid} className="border-b border-gray-50 last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{l.instructor_name || '—'}</div>
                  {l.description && <div className="text-xs text-gray-400">{l.description}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{l.language || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{l.hours}</td>
                <td className="px-4 py-3 text-right text-gray-600">{l.rate_applied}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {l.amount} {l.currency || ''}
                </td>
                <td className="px-4 py-3 text-gray-500">{(l.work_date || '').slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(l)}
                    className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={t('instructors.log_hours', 'Log Hours')}
        dialogContent={
          <WorkLogForm
            orgId={orgId!}
            access_token={access_token}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function WorkLogForm({
  orgId,
  access_token,
  onDone,
}: {
  orgId: number
  access_token: string
  onDone: () => void
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
      <Field label={t('instructors.title', 'Instructor')}>
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
        <Field label={t('instructors.hours', 'Hours')}>
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
          <button
            type="button"
            onClick={doPreview}
            disabled={!instructorUuid || hours === ''}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Calculator className="w-4 h-4" /> {t('instructors.preview', 'Preview cost')}
          </button>
        </div>
      </div>

      {preview && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">
              {preview.hours} × {preview.rate_applied}
            </span>
            <span className="font-bold text-gray-900">
              {preview.amount} {preview.currency || ''}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {t('instructors.rate_source', 'Rate source')}: {t(`instructors.source_${preview.rate_source}`, preview.rate_source) as string}
          </div>
        </div>
      )}

      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <SubmitRow saving={saving} />
    </form>
  )
}

export default InstructorFinanceHome
