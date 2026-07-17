'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '../../../client'
import { EnrollmentPanel } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import {
  getProgram,
  getCohort,
  getCohortSemesters,
  createSemester,
  updateSemester,
  deleteSemester,
} from '@services/academic/academic'

function CohortDetail({
  orgslug,
  programuuid,
  cohortuuid,
}: {
  orgslug: string
  programuuid: string
  cohortuuid: string
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const program_uuid = `program_${programuuid}`
  const cohort_uuid = `cohort_${cohortuuid}`

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)

  const { data: program } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: cohort } = useQuery({
    queryKey: ['academic', 'cohort', cohort_uuid],
    queryFn: () => getCohort(cohort_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: semesters = [], isLoading } = useQuery({
    queryKey: ['academic', 'semesters', cohort_uuid],
    queryFn: () => getCohortSemesters(cohort_uuid, access_token),
    enabled: !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'semesters', cohort_uuid] })

  const handleDelete = async (s: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteSemester(s.semester_uuid, access_token)
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
            label: t('academic.postgraduate_studies'),
            href: getUriWithOrg(orgslug, '/dash/postgraduate'),
            icon: <GraduationCap size={14} />,
          },
          {
            label: program?.name || t('academic.program'),
            href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`),
          },
          { label: cohort?.name || t('academic.cohort') },
        ]}
      />
      <AcademicHeader
        title={cohort?.name || t('academic.cohort')}
        subtitle={t('academic.semesters')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
            <button
              onClick={() => setEnrollOpen(true)}
              className="rounded-lg bg-white text-black border border-gray-200 text-xs font-bold px-5 py-2 flex items-center gap-2 nice-shadow hover:scale-105 transition-all"
            >
              <Users className="w-4 h-4" /> {t('academic.manage_enrollment')}
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.new_semester')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <AcademicGrid>
        {!isLoading && semesters.length === 0 && (
          <AcademicEmptyState title={t('academic.no_semesters')} description={t('academic.no_semesters_desc')} />
        )}
        {semesters.map((s: any) => (
          <AcademicCard
            key={s.semester_uuid}
            orgslug={orgslug}
            href={`/dash/postgraduate/${programuuid}/cohort/${cohortuuid}/semester/${s.semester_uuid.replace('semester_', '')}`}
            title={s.name}
            subtitle={s.description}
            badges={[{ label: `#${s.order}`, className: 'bg-slate-100 text-slate-600' }]}
            onEdit={() => {
              setEditing(s)
              setModalOpen(true)
            }}
            onDelete={() => handleDelete(s)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="sm"
        dialogTitle={editing ? t('academic.edit') : t('academic.create_semester')}
        dialogContent={
          <SemesterForm
            cohortUuid={cohort_uuid}
            access_token={access_token}
            semester={editing}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
        }
      />

      <Modal
        isDialogOpen={enrollOpen}
        onOpenChange={setEnrollOpen}
        minWidth="sm"
        dialogTitle={t('academic.manage_enrollment')}
        dialogContent={
          <EnrollmentPanel
            cohortUuid={cohort_uuid}
            orgId={orgId!}
            access_token={access_token}
            capacity={cohort?.capacity}
          />
        }
      />
    </AcademicPageShell>
  )
}

function SemesterForm({
  cohortUuid,
  access_token,
  semester,
  onDone,
}: {
  cohortUuid: string
  access_token: string
  semester: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(semester?.name || '')
  const [description, setDescription] = useState(semester?.description || '')
  const [order, setOrder] = useState<number>(semester?.order ?? 0)
  const [startDate, setStartDate] = useState(semester?.start_date || '')
  const [endDate, setEndDate] = useState(semester?.end_date || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name, description, order: Number(order), start_date: startDate || null, end_date: endDate || null }
      if (semester) {
        await updateSemester(semester.semester_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createSemester(cohortUuid, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch {
      toast.error(semester ? t('academic.update_failed') : t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t('academic.order')}>
        <input type="number" className={inputCls} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')}>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default CohortDetail
