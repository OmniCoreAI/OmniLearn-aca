'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, IconButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Availability, AvailabilityEditor } from '@components/Dashboard/Pages/Instructors/InstructorForm'
import {
  CurrencySelect,
  useAdminContext,
  useFinanceDefaults,
  useLookupOptions,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  createFacility,
  getLocations,
  updateFacility,
  uploadFacilityImage,
} from '@services/administration/administration'

export const FACILITY_STATUSES = ['active', 'maintenance', 'inactive']

type Blackout = { start: string; end: string; reason: string }

export function FacilityForm({ facility, onDone }: { facility: any; onDone: (_saved?: any) => void }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const finance = useFinanceDefaults()
  const types = useLookupOptions('facility_type')
  const equipmentOptions = useLookupOptions('equipment')
  const { data: locations = [] } = useQuery({
    queryKey: ['administration', 'locations', orgId],
    queryFn: () => getLocations(orgId, access_token),
    enabled: ready,
  })

  const [form, setForm] = useState({
    name: facility?.name || '',
    code: facility?.code || '',
    facility_type_uuid: facility?.facility_type?.lookup_uuid || '',
    location_uuid: facility?.location_uuid || '',
    floor: facility?.floor || '',
    room_number: facility?.room_number || '',
    capacity: facility?.capacity != null ? String(facility.capacity) : '',
    hourly_cost: facility?.hourly_cost != null ? String(facility.hourly_cost) : '',
    daily_cost: facility?.daily_cost != null ? String(facility.daily_cost) : '',
    currency: facility?.currency || '',
    is_bookable: facility?.is_bookable ?? true,
    status: facility?.status || 'active',
    description: facility?.description || '',
  })
  const [equipment, setEquipment] = useState<{ lookup_uuid: string; quantity: number }[]>(
    (facility?.equipment || []).map((e: any) => ({ lookup_uuid: e.lookup_uuid, quantity: e.quantity }))
  )
  const [availability, setAvailability] = useState<Availability>({
    slots: facility?.availability?.slots || [],
    notes: facility?.availability?.notes || '',
  })
  const [blackouts, setBlackouts] = useState<Blackout[]>(facility?.availability?.blackout_dates || [])
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })
  const num = (value: string) => (value === '' ? null : Number(value))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code || undefined,
        capacity: num(form.capacity),
        hourly_cost: num(form.hourly_cost),
        daily_cost: num(form.daily_cost),
        currency: form.currency || finance.default_currency,
        equipment: equipment.filter((item) => item.lookup_uuid),
        availability: { ...availability, blackout_dates: blackouts.filter((b) => b.start) },
      }
      const saved = facility
        ? await updateFacility(facility.facility_uuid, payload, access_token)
        : await createFacility(orgId, payload, access_token)
      if (image) await uploadFacilityImage(saved.facility_uuid, image, access_token)
      toast.success(facility ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone(saved)
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={t('administration.common.name', 'Name')}>
            <input className={inputCls} value={form.name} onChange={set('name')} required placeholder="Training Room A" />
          </Field>
        </div>
        <Field label={t('administration.common.code', 'Code')}>
          <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('administration.facilities.type', 'Type')}>
          <select className={inputCls} value={form.facility_type_uuid} onChange={set('facility_type_uuid')}>
            <option value="">—</option>
            {types.map((o) => (
              <option key={o.lookup_uuid} value={o.lookup_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.location', 'Location')}>
          <select className={inputCls} value={form.location_uuid} onChange={set('location_uuid')}>
            <option value="">—</option>
            {(locations as any[]).map((l) => (
              <option key={l.location_uuid} value={l.location_uuid}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.capacity', 'Capacity (people)')}>
          <input type="number" min={0} className={inputCls} value={form.capacity} onChange={set('capacity')} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label={t('administration.facilities.floor', 'Floor')}>
          <input className={inputCls} value={form.floor} onChange={set('floor')} />
        </Field>
        <Field label={t('administration.facilities.room_number', 'Room no.')}>
          <input className={inputCls} value={form.room_number} onChange={set('room_number')} />
        </Field>
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            {FACILITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`administration.facilities.status_${s}`, s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.bookable', 'Bookable')}>
          <label className="flex h-[38px] items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_bookable} onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })} />
            {t('administration.facilities.bookable_hint', 'Can be scheduled')}
          </label>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('administration.facilities.hourly_cost', 'Hourly cost')}>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.hourly_cost} onChange={set('hourly_cost')} />
        </Field>
        <Field label={t('administration.facilities.daily_cost', 'Daily cost')}>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.daily_cost} onChange={set('daily_cost')} />
        </Field>
        <Field label={t('academic.currency', 'Currency')}>
          <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
        </Field>
      </div>

      <Field label={t('administration.facilities.equipment', 'Facilities / equipment')}>
        <div className="space-y-2">
          {equipment.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_90px_auto] gap-2">
              <select
                className={inputCls}
                value={item.lookup_uuid}
                onChange={(e) => setEquipment(equipment.map((x, i) => (i === index ? { ...x, lookup_uuid: e.target.value } : x)))}
              >
                <option value="">—</option>
                {equipmentOptions.map((o) => (
                  <option key={o.lookup_uuid} value={o.lookup_uuid}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={item.quantity}
                onChange={(e) => setEquipment(equipment.map((x, i) => (i === index ? { ...x, quantity: Number(e.target.value) || 1 } : x)))}
              />
              <IconButton type="button" tone="danger" onClick={() => setEquipment(equipment.filter((_, i) => i !== index))} aria-label={t('administration.common.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
          <GhostButton type="button" onClick={() => setEquipment([...equipment, { lookup_uuid: '', quantity: 1 }])}>
            <Plus className="h-3.5 w-3.5" /> {t('administration.facilities.add_equipment', 'Add equipment')}
          </GhostButton>
        </div>
      </Field>

      <Field label={t('administration.facilities.availability', 'Weekly availability')}>
        <AvailabilityEditor value={availability} onChange={setAvailability} />
      </Field>

      <Field label={t('administration.facilities.blackouts', 'Unavailable periods (maintenance, holidays…)')}>
        <div className="space-y-2">
          {blackouts.map((b, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2">
              <input type="date" className={inputCls} value={b.start} onChange={(e) => setBlackouts(blackouts.map((x, i) => (i === index ? { ...x, start: e.target.value } : x)))} />
              <input type="date" className={inputCls} value={b.end} onChange={(e) => setBlackouts(blackouts.map((x, i) => (i === index ? { ...x, end: e.target.value } : x)))} />
              <input className={inputCls} value={b.reason} placeholder={t('administration.facilities.reason', 'Reason')} onChange={(e) => setBlackouts(blackouts.map((x, i) => (i === index ? { ...x, reason: e.target.value } : x)))} />
              <IconButton type="button" tone="danger" onClick={() => setBlackouts(blackouts.filter((_, i) => i !== index))} aria-label={t('administration.common.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
          <GhostButton type="button" onClick={() => setBlackouts([...blackouts, { start: '', end: '', reason: '' }])}>
            <Plus className="h-3.5 w-3.5" /> {t('administration.facilities.add_blackout', 'Add period')}
          </GhostButton>
        </div>
      </Field>

      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={set('description')} />
      </Field>
      <Field label={t('administration.facilities.image', 'Photo')}>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-[hsl(var(--dash-muted))] file:me-3 file:rounded-full file:border-0 file:bg-[hsl(var(--dash-accent-soft))] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--dash-accent))]"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
        />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}
