'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus, Send } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  AssignmentOptions,
  AssignmentRows,
  AudienceChoice,
  AudiencePicker,
} from '@components/Dashboard/Pages/Administration/AudiencePanel'
import {
  AudienceResourceType,
  createAudienceAssignment,
  deleteAudienceAssignment,
  getEntityLearning,
} from '@services/administration/administration'
import { getOrgCourses } from '@services/courses/courses'
import { getTrainingPrograms } from '@services/academic/academic'

function AssignForm({
  entityUuid,
  resource,
  onDone,
}: {
  entityUuid: string
  resource: { resource_type: AudienceResourceType; resource_uuid: string }
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const [choice, setChoice] = useState<AudienceChoice | null>(null)
  const [opts, setOpts] = useState({ auto_enroll: false, due_date: '', notify: true })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!choice) return
    setSaving(true)
    try {
      await createAudienceAssignment(
        {
          ...resource,
          audience_type: choice.audience_type,
          audience_uuid: choice.audience_uuid,
          entity_uuid: entityUuid,
          mode: 'assigned',
          auto_enroll: opts.auto_enroll,
          due_date: opts.due_date || undefined,
          notify: opts.notify,
        },
        access_token
      )
      toast.success(t('entities.audience.added', 'Assigned'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-4">
      <AudiencePicker value={choice} onChange={setChoice} entityUuid={entityUuid} />
      {choice && <AssignmentOptions value={opts} onChange={setOpts} />}
      <div className="flex justify-end">
        <GhostButton onClick={save} disabled={!choice || saving}>
          {saving ? '…' : t('entities.audience.assign', 'Assign')}
        </GhostButton>
      </div>
    </div>
  )
}

function MakeAvailableForm({ entityUuid, onDone }: { entityUuid: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const [type, setType] = useState<AudienceResourceType>('course')
  const [uuid, setUuid] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: courses = [] } = useQuery({
    queryKey: ['entities', 'pick-courses', org?.slug],
    queryFn: () => getOrgCourses(org.slug, null, access_token, true),
    enabled: ready && !!org?.slug && type === 'course',
  })
  const { data: programs = [] } = useQuery({
    queryKey: ['academic', 'training-programs', orgId],
    queryFn: () => getTrainingPrograms(orgId, access_token),
    enabled: ready && type === 'training_program',
  })
  const list: { uuid: string; name: string }[] =
    type === 'course'
      ? ((courses as any[]) || []).map((c) => ({ uuid: c.course_uuid, name: c.name }))
      : ((programs as any[]) || []).map((p) => ({ uuid: p.trainingprogram_uuid, name: p.name }))

  const save = async () => {
    if (!uuid) return
    setSaving(true)
    try {
      await createAudienceAssignment(
        { resource_type: type, resource_uuid: uuid, audience_type: 'entity', audience_uuid: entityUuid, mode: 'available', notify: false },
        access_token
      )
      toast.success(t('entities.learning.made_available', 'Made available'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('entities.learning.kind', 'Kind')}>
          <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as AudienceResourceType); setUuid('') }}>
            <option value="course">{t('entities.learning.course', 'Course')}</option>
            <option value="training_program">{t('entities.learning.training_program', 'Training program')}</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('entities.learning.which', 'Which one')}>
            <select className={inputCls} value={uuid} onChange={(e) => setUuid(e.target.value)}>
              <option value="">—</option>
              {list.map((r) => (
                <option key={r.uuid} value={r.uuid}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('entities.learning.available_hint', 'Available learning is not visible to members until a coordinator (or you) assigns it to them.')}
      </p>
      <div className="flex justify-end">
        <GhostButton onClick={save} disabled={!uuid || saving}>
          {saving ? '…' : t('entities.learning.make_available', 'Make available')}
        </GhostButton>
      </div>
    </div>
  )
}

/** Courses / programs the academy made available to an entity, and who they are assigned to. */
export function EntityLearningPanel({
  entityUuid,
  isAcademy,
  canAssign,
}: {
  entityUuid: string
  isAcademy: boolean
  canAssign: boolean
}) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [assignTo, setAssignTo] = useState<any>(null)
  const [availableOpen, setAvailableOpen] = useState(false)
  const { data: learning = [], isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'learning'],
    queryFn: () => getEntityLearning(entityUuid, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })

  const remove = async (a: any) => {
    if (!window.confirm(t('entities.audience.confirm_remove', 'Remove this assignment? Its members lose access unless another assignment covers them.'))) return
    try {
      await deleteAudienceAssignment(a.assignment_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  return (
    <div className="space-y-4">
      {isAcademy && (
        <div className="flex justify-end">
          <GhostButton onClick={() => setAvailableOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {t('entities.learning.make_available', 'Make available')}
          </GhostButton>
        </div>
      )}
      {isLoading && <div className="dash-shimmer h-32 rounded-[var(--dash-radius)]" />}
      {!isLoading && (learning as any[]).length === 0 && (
        <AcademicEmptyState
          title={t('entities.learning.none', 'No learning yet')}
          description={
            isAcademy
              ? t('entities.learning.none_academy', 'Make courses or training programs available to this entity, or assign them to it from the course’s Access tab.')
              : t('entities.learning.none_coordinator', 'The academy has not made any courses available to your entity yet.')
          }
        />
      )}
      {(learning as any[]).map((r) => (
        <Section
          key={`${r.resource_type}:${r.resource_uuid}`}
          title={r.resource_name || r.resource_uuid}
          description={String(t(`entities.learning.${r.resource_type}`, r.resource_type === 'course' ? 'Course' : 'Training program'))}
          action={
            canAssign && (
              <GhostButton onClick={() => setAssignTo(r)}>
                <Send className="h-3.5 w-3.5" /> {t('entities.audience.assign', 'Assign')}
              </GhostButton>
            )
          }
        >
          {!r.published && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--dash-tile-amber))] px-3 py-2 text-xs text-[hsl(var(--dash-tile-amber-fg))]">
              <AlertTriangle className="h-4 w-4" />
              {t('entities.audience.unpublished', 'Not published yet — assigned members can only open it once it is published.')}
            </div>
          )}
          <AssignmentRows assignments={r.assignments || []} onRemove={canAssign || isAcademy ? remove : undefined} showMode={false} />
        </Section>
      ))}

      <Modal
        isDialogOpen={!!assignTo}
        onOpenChange={(o: boolean) => !o && setAssignTo(null)}
        minWidth="md"
        dialogTitle={assignTo ? `${t('entities.audience.assign', 'Assign')} · ${assignTo.resource_name}` : ''}
        dialogContent={
          assignTo && (
            <AssignForm
              key={assignTo.resource_uuid}
              entityUuid={entityUuid}
              resource={{ resource_type: assignTo.resource_type, resource_uuid: assignTo.resource_uuid }}
              onDone={() => {
                setAssignTo(null)
                refresh()
              }}
            />
          )
        }
      />
      <Modal
        isDialogOpen={availableOpen}
        onOpenChange={setAvailableOpen}
        minWidth="md"
        dialogTitle={t('entities.learning.make_available', 'Make available')}
        dialogContent={
          <MakeAvailableForm
            entityUuid={entityUuid}
            onDone={() => {
              setAvailableOpen(false)
              refresh()
            }}
          />
        }
      />
    </div>
  )
}
