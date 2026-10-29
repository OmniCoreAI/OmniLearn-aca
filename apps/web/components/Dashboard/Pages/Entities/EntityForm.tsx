'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { useAdminContext, useLookupOptions } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  COORDINATOR_CAPABILITIES,
  CoordinatorPermissions,
  createEntity,
  getEntityOptions,
  updateEntity,
  uploadEntityLogo,
} from '@services/administration/administration'

export const ENTITY_STATUSES = ['active', 'inactive']

export const DEFAULT_COORDINATOR_PERMISSIONS: CoordinatorPermissions = {
  can_manage_members: true,
  can_import_users: true,
  can_manage_groups: true,
  can_assign_training: true,
  can_add_instructors: false,
}

export function capabilityLabel(t: TFunction, key: keyof CoordinatorPermissions): string {
  const labels: Record<keyof CoordinatorPermissions, [string, string]> = {
    can_manage_members: ['entities.cap.members', 'Add, edit and deactivate members'],
    can_import_users: ['entities.cap.import', 'Import members from Excel'],
    can_manage_groups: ['entities.cap.groups', 'Create and manage groups'],
    can_assign_training: ['entities.cap.training', 'Assign the training the academy made available'],
    can_add_instructors: ['entities.cap.instructors', 'Invite instructors (academy approves them)'],
  }
  const [key_, fallback] = labels[key]
  return String(t(key_, fallback))
}

/** Toggle list for what the academy lets an entity's coordinators do. */
export function CoordinatorPermissionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: CoordinatorPermissions
  onChange?: (_v: CoordinatorPermissions) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {COORDINATOR_CAPABILITIES.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!value[key]}
            disabled={disabled}
            onChange={(e) => onChange?.({ ...value, [key]: e.target.checked })}
          />
          {capabilityLabel(t, key)}
        </label>
      ))}
    </div>
  )
}

export function EntityForm({
  entity,
  onDone,
  onCancel,
}: {
  entity: any
  onDone: (_saved?: any) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const types = useLookupOptions('entity_type')
  const { data: options = [] } = useQuery({
    queryKey: ['administration', 'entity-options', orgId],
    queryFn: () => getEntityOptions(orgId, access_token),
    enabled: ready,
  })
  const [form, setForm] = useState({
    name: entity?.name || '',
    name_ar: entity?.name_ar || '',
    code: entity?.code || '',
    entity_type_uuid: entity?.entity_type?.lookup_uuid || '',
    parent_uuid: entity?.parent_uuid || '',
    status: entity?.status || 'active',
    contact_name: entity?.contact_name || '',
    contact_email: entity?.contact_email || '',
    contact_phone: entity?.contact_phone || '',
    website: entity?.website || '',
    address: entity?.address || '',
    city: entity?.city || '',
    country: entity?.country || '',
    description: entity?.description || '',
  })
  const [permissions, setPermissions] = useState<CoordinatorPermissions>(
    entity?.coordinator_permissions || DEFAULT_COORDINATOR_PERMISSIONS
  )
  const [logo, setLogo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = t('administration.validation.required', 'Required')
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()))
      next.contact_email = t('administration.validation.email', 'Enter a valid email address')
    if (form.website && !/^https?:\/\/\S+$/i.test(form.website.trim()))
      next.website = t('administration.validation.url', 'Start with http:// or https://')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { ...form, code: form.code || undefined, coordinator_permissions: permissions }
      const saved = entity
        ? await updateEntity(entity.entity_uuid, payload, access_token)
        : await createEntity(orgId, payload, access_token)
      if (logo) await uploadEntityLogo(saved.entity_uuid, logo, access_token)
      toast.success(entity ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone(saved)
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const parents = (options as any[]).filter((o) => o.entity_uuid !== entity?.entity_uuid)

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FormSection title={t('entities.section_basic', 'Basic information')}>
        <Field label={t('administration.common.name', 'Name')} required error={errors.name} className="sm:col-span-2">
          <input className={inputCls} aria-invalid={!!errors.name} value={form.name} onChange={set('name')} placeholder="Ministry of Communications" autoFocus />
        </Field>
        <Field label={t('entities.name_ar', 'Arabic name')}>
          <input className={inputCls} dir="rtl" value={form.name_ar} onChange={set('name_ar')} placeholder="وزارة الاتصالات" />
        </Field>
        <Field label={t('administration.common.code', 'Code')} hint={t('administration.common.code_hint', 'Leave empty to generate one.')}>
          <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
        <Field label={t('entities.type', 'Entity type')}>
          <select className={inputCls} value={form.entity_type_uuid} onChange={set('entity_type_uuid')}>
            <option value="">—</option>
            {types.map((o) => (
              <option key={o.lookup_uuid} value={o.lookup_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('entities.parent', 'Part of')} hint={t('entities.parent_hint', 'For a department or branch of another entity.')}>
          <select className={inputCls} value={form.parent_uuid} onChange={set('parent_uuid')}>
            <option value="">—</option>
            {parents.map((o) => (
              <option key={o.entity_uuid} value={o.entity_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.common.status', 'Status')} hint={t('entities.status_hint', 'Inactive entities keep their members and history.')}>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            {ENTITY_STATUSES.map((st) => (
              <option key={st} value={st}>
                {String(t(`administration.common.status_${st}`, st))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('entities.logo', 'Logo')}>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-[hsl(var(--dash-muted))] file:me-3 file:rounded-full file:border-0 file:bg-[hsl(var(--dash-canvas))] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--dash-ink))]"
            onChange={(e) => setLogo(e.target.files?.[0] || null)}
          />
        </Field>
      </FormSection>

      <FormSection title={t('entities.contact', 'Contact')}>
        <Field label={t('entities.contact_name', 'Contact person')}>
          <input className={inputCls} value={form.contact_name} onChange={set('contact_name')} />
        </Field>
        <Field label={t('entities.contact_email', 'Email')} error={errors.contact_email}>
          <input className={inputCls} type="email" aria-invalid={!!errors.contact_email} value={form.contact_email} onChange={set('contact_email')} />
        </Field>
        <Field label={t('entities.contact_phone', 'Phone')}>
          <input className={inputCls} type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
        </Field>
        <Field label={t('entities.website', 'Website')} error={errors.website}>
          <input className={inputCls} type="url" aria-invalid={!!errors.website} value={form.website} onChange={set('website')} placeholder="https://" />
        </Field>
      </FormSection>

      <FormSection title={t('entities.section_address', 'Address')} columns={3}>
        <Field label={t('entities.address', 'Address')} className="sm:col-span-3">
          <input className={inputCls} value={form.address} onChange={set('address')} />
        </Field>
        <Field label={t('entities.city', 'City')}>
          <input className={inputCls} value={form.city} onChange={set('city')} />
        </Field>
        <Field label={t('entities.country', 'Country')}>
          <input className={inputCls} value={form.country} onChange={set('country')} />
        </Field>
      </FormSection>

      <FormSection title={t('administration.common.description', 'Description')} columns={1}>
        <textarea className={inputCls} rows={3} aria-label={t('administration.common.description', 'Description')} value={form.description} onChange={set('description')} />
      </FormSection>

      <FormSection
        title={t('entities.coordinator_permissions', 'What coordinators of this entity can do')}
        description={t('entities.coordinator_permissions_desc', 'Coordinators only ever see their own entity’s members and training.')}
        columns={1}
      >
        <CoordinatorPermissionsEditor value={permissions} onChange={setPermissions} />
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky={!!onCancel} submitLabel={entity ? t('academic.save', 'Save') : t('entities.create', 'Create entity')} />
    </form>
  )
}
