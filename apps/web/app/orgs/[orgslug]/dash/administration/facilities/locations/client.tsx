'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, IconButton, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  AdminBreadcrumbs,
  useAdminContext,
  useLookupLabel,
  useLookupOptions,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { createLocation, deleteLocation, getLocations, updateLocation } from '@services/administration/administration'

function LocationsPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['administration', 'locations', orgId],
    queryFn: () => getLocations(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'locations', orgId] })

  const remove = async (loc: any) => {
    if (!window.confirm(t('administration.facilities.confirm_delete_location', 'Delete this location? Its facilities are kept.'))) return
    try {
      await deleteLocation(loc.location_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' },
          { label: t('administration.facilities.tab_locations', 'Locations') },
        ]}
      />
      <AcademicHeader
        title={t('administration.facilities.tab_locations', 'Locations')}
        subtitle={t('administration.facilities.locations_desc', 'Buildings, branches, campuses and training centers that host your facilities.')}
        action={
          <AcademicPrimaryButton
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> {t('administration.facilities.new_location', 'New location')}
          </AcademicPrimaryButton>
        }
      />
      <FacilitiesTabs orgslug={orgslug} />
      <DataTable
        headers={[
          t('administration.common.name', 'Name'),
          t('administration.facilities.type', 'Type'),
          t('administration.facilities.parent', 'Part of'),
          t('administration.facilities.address', 'Address'),
          t('administration.facilities.tab_facilities', 'Facilities'),
          t('administration.common.status', 'Status'),
          '',
        ]}
        empty={isLoading ? '…' : t('administration.facilities.no_locations', 'No locations yet.')}
      >
        {(locations as any[]).map((loc) => (
          <tr key={loc.location_uuid}>
            <td className={tdCls}>
              <div className="font-medium">{loc.name}</div>
              <div className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{loc.code}</div>
            </td>
            <td className={tdCls}>{loc.location_type ? label(loc.location_type) : '—'}</td>
            <td className={tdCls}>{loc.parent_name || '—'}</td>
            <td className={`${tdCls} text-xs`}>{[loc.address, loc.city, loc.country].filter(Boolean).join(', ') || '—'}</td>
            <td className={tdCls}>{loc.facility_count}</td>
            <td className={tdCls}>
              <StatusPill status={loc.status} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              <IconButton
                onClick={() => {
                  setEditing(loc)
                  setOpen(true)
                }}
                aria-label={t('administration.common.edit', 'Edit')}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" onClick={() => remove(loc)} aria-label={t('administration.common.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </td>
          </tr>
        ))}
      </DataTable>
      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.facilities.new_location', 'New location')}
        dialogContent={
          <LocationForm
            location={editing}
            locations={locations as any[]}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function LocationForm({ location, locations, onDone }: { location: any; locations: any[]; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const types = useLookupOptions('location_type')
  const [form, setForm] = useState({
    name: location?.name || '',
    code: location?.code || '',
    location_type_uuid: location?.location_type?.lookup_uuid || '',
    parent_uuid: location?.parent_uuid || '',
    address: location?.address || '',
    city: location?.city || '',
    country: location?.country || '',
    contact_phone: location?.contact_phone || '',
    contact_email: location?.contact_email || '',
    notes: location?.notes || '',
    status: location?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, code: form.code || undefined }
      if (location) await updateLocation(location.location_uuid, payload, access_token)
      else await createLocation(orgId, payload, access_token)
      toast.success(location ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
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
            <input className={inputCls} value={form.name} onChange={set('name')} required />
          </Field>
        </div>
        <Field label={t('administration.common.code', 'Code')}>
          <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('administration.facilities.type', 'Type')}>
          <select className={inputCls} value={form.location_type_uuid} onChange={set('location_type_uuid')}>
            <option value="">—</option>
            {types.map((o) => (
              <option key={o.lookup_uuid} value={o.lookup_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.parent', 'Part of')}>
          <select className={inputCls} value={form.parent_uuid} onChange={set('parent_uuid')}>
            <option value="">—</option>
            {locations
              .filter((l) => l.location_uuid !== location?.location_uuid)
              .map((l) => (
                <option key={l.location_uuid} value={l.location_uuid}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            <option value="active">{t('academic.state_active', 'active')}</option>
            <option value="inactive">{t('administration.common.status_inactive', 'inactive')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('administration.facilities.address', 'Address')}>
        <input className={inputCls} value={form.address} onChange={set('address')} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('administration.facilities.city', 'City')}>
          <input className={inputCls} value={form.city} onChange={set('city')} />
        </Field>
        <Field label={t('administration.facilities.country', 'Country')}>
          <input className={inputCls} value={form.country} onChange={set('country')} />
        </Field>
        <Field label={t('administration.facilities.contact_phone', 'Contact phone')}>
          <input className={inputCls} value={form.contact_phone} onChange={set('contact_phone')} />
        </Field>
        <Field label={t('administration.facilities.contact_email', 'Contact email')}>
          <input type="email" className={inputCls} value={form.contact_email} onChange={set('contact_email')} />
        </Field>
      </div>
      <Field label={t('administration.facilities.notes', 'Notes')}>
        <textarea className={inputCls} rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default LocationsPage
