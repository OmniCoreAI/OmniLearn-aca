'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  useAdminContext,
  useConfirm,
  useLookupLabel,
  useLookupOptions,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { createLocation, deleteLocation, getLocations, updateLocation } from '@services/administration/administration'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LocationsPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['administration', 'locations', orgId],
    queryFn: () => getLocations(orgId, access_token),
    enabled: ready,
  })
  const all = locations as any[]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'locations', orgId] })
  const openForm = (loc: any) => {
    setEditing(loc)
    setOpen(true)
  }

  const remove = async (loc: any) => {
    const ok = await confirm({
      title: t('administration.facilities.delete_location_title', 'Delete {{name}}?', { name: loc.name }),
      message:
        loc.facility_count > 0
          ? t('administration.facilities.confirm_delete_location_used', '{{count}} facilities are at this location. They are kept but lose their location — consider deactivating instead.', {
              count: loc.facility_count,
            })
          : t('administration.facilities.confirm_delete_location', 'Delete this location? Its facilities are kept.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteLocation(loc.location_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const setLocationStatus = async (rows: any[], next: string) => {
    try {
      await Promise.all(rows.map((loc) => updateLocation(loc.location_uuid, { status: next }, access_token)))
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const loc of all) if (loc.location_type) seen.set(loc.location_type.lookup_uuid, label(loc.location_type))
    return [...seen].map(([value, text]) => ({ value, label: text }))
  }, [all, label])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (loc) =>
        (type === 'all' || loc.location_type?.lookup_uuid === type) &&
        (status === 'all' || loc.status === status) &&
        (!q || `${loc.name} ${loc.code} ${loc.city || ''} ${loc.address || ''}`.toLowerCase().includes(q))
    )
  }, [all, query, type, status])
  const filtering = !!query || type !== 'all' || status !== 'all'

  const createButton = (
    <AcademicPrimaryButton onClick={() => openForm(null)}>
      <Plus className="h-4 w-4" /> {t('administration.facilities.new_location', 'New location')}
    </AcademicPrimaryButton>
  )

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
        action={createButton}
      />
      <FacilitiesTabs orgslug={orgslug} />
      <DashDataTable
        rows={visible}
        rowKey={(loc: any) => loc.location_uuid}
        loading={isLoading}
        selectable
        onRowClick={openForm}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('administration.facilities.locations_count', '{{count}} locations', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('administration.facilities.search_locations', 'Search by name, code or city')} />
            <ToolbarSelect
              label={t('administration.facilities.type', 'Type')}
              value={type}
              onChange={setType}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...typeOptions]}
            />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: t('academic.state_active', 'Active') },
                { value: 'inactive', label: t('administration.common.status_inactive', 'Inactive') },
              ]}
            />
          </>
        }
        bulkActions={(rows, clear) => (
          <>
            <GhostButton
              onClick={async () => {
                await setLocationStatus(rows, 'active')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.activate', 'Activate')}
            </GhostButton>
            <GhostButton
              onClick={async () => {
                await setLocationStatus(rows, 'inactive')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.deactivate', 'Deactivate')}
            </GhostButton>
          </>
        )}
        empty={
          <AcademicEmptyState
            compact
            icon={<MapPin className="h-6 w-6" />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('administration.facilities.no_locations', 'No locations yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('administration.facilities.no_locations_hint', 'Add your buildings or branches, then place facilities in them.')
            }
            action={filtering ? undefined : createButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('administration.common.name', 'Name'),
            primary: true,
            sortValue: (loc: any) => loc.name,
            cell: (loc: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{loc.name}</div>
                  <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                    <span className="font-mono">{loc.code}</span>
                    {loc.parent_name ? ` · ${t('administration.facilities.part_of', 'Part of')} ${loc.parent_name}` : ''}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'type',
            header: t('administration.facilities.type', 'Type'),
            sortValue: (loc: any) => (loc.location_type ? label(loc.location_type) : null),
            cell: (loc: any) => (loc.location_type ? <span className="whitespace-nowrap text-[13px]">{label(loc.location_type)}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
          },
          {
            key: 'address',
            header: t('administration.facilities.address', 'Address'),
            hideBelow: 'lg',
            hideOnMobile: true,
            cell: (loc: any) => <span className="line-clamp-1 text-[13px] text-[hsl(var(--dash-muted))]">{[loc.address, loc.city, loc.country].filter(Boolean).join(', ') || '—'}</span>,
          },
          {
            key: 'facilities',
            header: t('administration.facilities.tab_facilities', 'Facilities'),
            align: 'end',
            sortValue: (loc: any) => loc.facility_count,
            cell: (loc: any) => <span className="tabular-nums">{loc.facility_count}</span>,
          },
          { key: 'status', header: t('administration.common.status', 'Status'), sortValue: (loc: any) => loc.status, cell: (loc: any) => <StatusPill status={loc.status} /> },
        ]}
        actions={(loc: any) => [
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(loc) },
          {
            label: loc.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
            icon: <Power className="h-3.5 w-3.5" />,
            onSelect: () => setLocationStatus([loc], loc.status === 'active' ? 'inactive' : 'active'),
          },
          { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(loc) },
        ]}
      />

      <AdminDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.facilities.new_location', 'New location')}
        description={t('administration.facilities.location_form_desc', 'Facilities are placed in a location so learners know where to go.')}
      >
        {open ? (
          <LocationForm
            key={editing?.location_uuid || 'new'}
            location={editing}
            locations={all}
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </AcademicPageShell>
  )
}

function LocationForm({ location, locations, onDone, onCancel }: { location: any; locations: any[]; onDone: () => void; onCancel?: () => void }) {
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = String(t('administration.validation.required', 'Required'))
    if (form.contact_email && !EMAIL_RE.test(form.contact_email)) next.contact_email = String(t('administration.validation.email', 'Enter a valid email'))
    setErrors(next)
    if (Object.keys(next).length) return
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
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('administration.common.name', 'Name')} required error={errors.name}>
          <input className={inputCls} value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('administration.common.code', 'Code')} hint={t('administration.common.code_hint', 'Leave empty to generate one.')}>
          <input className={`${inputCls} font-mono`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
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
        <Field label={t('administration.facilities.parent', 'Part of')} hint={t('administration.facilities.parent_hint', 'e.g. a building inside a campus')}>
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
            <option value="active">{t('academic.state_active', 'Active')}</option>
            <option value="inactive">{t('administration.common.status_inactive', 'Inactive')}</option>
          </select>
        </Field>
      </FormSection>

      <FormSection title={t('administration.form.address', 'Address')}>
        <Field label={t('administration.facilities.address', 'Address')} className="sm:col-span-2">
          <input className={inputCls} value={form.address} onChange={set('address')} />
        </Field>
        <Field label={t('administration.facilities.city', 'City')}>
          <input className={inputCls} value={form.city} onChange={set('city')} />
        </Field>
        <Field label={t('administration.facilities.country', 'Country')}>
          <input className={inputCls} value={form.country} onChange={set('country')} />
        </Field>
      </FormSection>

      <FormSection title={t('administration.form.contact', 'Contact')}>
        <Field label={t('administration.facilities.contact_phone', 'Contact phone')}>
          <input className={inputCls} value={form.contact_phone} onChange={set('contact_phone')} inputMode="tel" />
        </Field>
        <Field label={t('administration.facilities.contact_email', 'Contact email')} error={errors.contact_email}>
          <input type="email" className={inputCls} value={form.contact_email} onChange={set('contact_email')} aria-invalid={!!errors.contact_email} />
        </Field>
        <Field label={t('administration.facilities.notes', 'Notes')} className="sm:col-span-2">
          <textarea className={inputCls} rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky={!!onCancel} />
    </form>
  )
}

export default LocationsPage
