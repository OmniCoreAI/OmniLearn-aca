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
  CurrencySelect,
  SearchBox,
  useAdminContext,
  useFinanceDefaults,
  useLookupLabel,
  useLookupOptions,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { AddOnsTabs } from '@components/Dashboard/Pages/Administration/AddOnsTabs'
import { createAddOn, deleteAddOn, getAddOns, updateAddOn, uploadAddOnImage } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'

const UNITS = ['per_participant', 'per_session', 'per_item']

function AddOnsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ['administration', 'addons', orgId],
    queryFn: () => getAddOns(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'addons', orgId] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'addon-options', orgId] })
  }

  const remove = async (a: any) => {
    if (!window.confirm(t('administration.common.confirm_delete', 'Delete this item? This cannot be undone.'))) return
    try {
      await deleteAddOn(a.addon_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  const q = query.trim().toLowerCase()
  const visible = (addons as any[]).filter((a) => !q || a.name.toLowerCase().includes(q) || (a.category?.name || '').toLowerCase().includes(q))

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.addons', 'Add-ons') }]} />
      <AcademicHeader
        title={t('administration.nav.addons', 'Add-ons')}
        subtitle={t('administration.addons.subtitle', 'Optional items and services priced once and attached to courses, programs and registrations.')}
        action={
          <AcademicPrimaryButton
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> {t('administration.addons.new', 'New add-on')}
          </AcademicPrimaryButton>
        }
      />
      <AddOnsTabs orgslug={orgslug} />
      <SearchBox value={query} onChange={setQuery} placeholder={t('administration.addons.search', 'Search add-ons')} />
      <DataTable
        headers={[
          t('administration.common.name', 'Name'),
          t('administration.addons.category', 'Category'),
          t('administration.addons.price', 'Price'),
          t('administration.addons.tax', 'Tax'),
          t('administration.addons.unit', 'Unit'),
          t('administration.addons.used_in', 'Attached to'),
          t('administration.addons.selected', 'Selected'),
          t('administration.common.status', 'Status'),
          '',
        ]}
        empty={isLoading ? '…' : t('administration.addons.none', 'No add-ons yet. Create meals, notebooks, kits…')}
      >
        {visible.map((a) => (
          <tr key={a.addon_uuid}>
            <td className={tdCls}>
              <div className="flex items-center gap-2">
                {a.image && (
                  <img src={getOrgContentUrl(org?.org_uuid, `addons/${a.addon_uuid}/images/${a.image}`)} alt="" className="h-8 w-8 rounded object-cover" />
                )}
                <div>
                  <div className="font-medium">{a.name}</div>
                  {a.description && <div className="line-clamp-1 text-xs text-[hsl(var(--dash-muted))]">{a.description}</div>}
                </div>
              </div>
            </td>
            <td className={tdCls}>{a.category ? label(a.category) : '—'}</td>
            <td className={`${tdCls} whitespace-nowrap`}>
              {a.price} {a.currency || ''}
            </td>
            <td className={tdCls}>{a.tax_rate ? `${a.tax_rate}%${a.tax_inclusive ? ` ${t('administration.addons.incl', 'incl.')}` : ''}` : '—'}</td>
            <td className={`${tdCls} text-xs`}>{String(t(`administration.addons.unit_${a.unit}`, a.unit))}</td>
            <td className={tdCls}>{a.attachment_count}</td>
            <td className={tdCls}>
              {a.selected_quantity}
              {a.stock != null ? ` / ${a.stock}` : ''}
            </td>
            <td className={tdCls}>
              <StatusPill status={a.status} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              <IconButton
                onClick={() => {
                  setEditing(a)
                  setOpen(true)
                }}
                aria-label={t('administration.common.edit', 'Edit')}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" onClick={() => remove(a)} aria-label={t('administration.common.delete', 'Delete')}>
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
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.addons.new', 'New add-on')}
        dialogContent={
          <AddOnForm
            addon={editing}
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

function AddOnForm({ addon, onDone }: { addon: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const finance = useFinanceDefaults()
  const categories = useLookupOptions('addon_category')
  const defaultTax = finance.tax_rates.find((r) => r.is_default)
  const [form, setForm] = useState({
    name: addon?.name || '',
    code: addon?.code || '',
    category_uuid: addon?.category?.lookup_uuid || '',
    description: addon?.description || '',
    price: addon ? String(addon.price) : '',
    currency: addon?.currency || '',
    tax_rate: addon?.tax_rate != null ? String(addon.tax_rate) : addon ? '' : defaultTax ? String(defaultTax.rate) : '',
    tax_inclusive: addon?.tax_inclusive ?? false,
    unit: addon?.unit || 'per_participant',
    available_from: addon?.available_from || '',
    available_until: addon?.available_until || '',
    stock: addon?.stock != null ? String(addon.stock) : '',
    status: addon?.status || 'active',
  })
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code || undefined,
        price: Number(form.price || 0),
        currency: form.currency || finance.default_currency,
        tax_rate: form.tax_rate === '' ? null : Number(form.tax_rate),
        stock: form.stock === '' ? null : Number(form.stock),
        available_from: form.available_from || null,
        available_until: form.available_until || null,
        category_uuid: form.category_uuid || null,
      }
      const saved = addon ? await updateAddOn(addon.addon_uuid, payload, access_token) : await createAddOn(orgId, payload, access_token)
      if (image) await uploadAddOnImage(saved.addon_uuid, image, access_token)
      toast.success(addon ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
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
            <input className={inputCls} value={form.name} onChange={set('name')} required placeholder="Lunch Meal" />
          </Field>
        </div>
        <Field label={t('administration.addons.category', 'Category')}>
          <select className={inputCls} value={form.category_uuid} onChange={set('category_uuid')}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.lookup_uuid} value={c.lookup_uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label={t('administration.addons.price', 'Price')}>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.price} onChange={set('price')} required />
        </Field>
        <Field label={t('academic.currency', 'Currency')}>
          <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
        </Field>
        <Field label={t('administration.addons.tax_rate', 'Tax %')}>
          <select className={inputCls} value={form.tax_rate} onChange={set('tax_rate')}>
            <option value="">{t('administration.addons.no_tax', 'No tax')}</option>
            {finance.tax_rates.map((r) => (
              <option key={r.name} value={String(r.rate)}>
                {r.name} ({r.rate}%)
              </option>
            ))}
            {form.tax_rate && !finance.tax_rates.some((r) => String(r.rate) === form.tax_rate) && <option value={form.tax_rate}>{form.tax_rate}%</option>}
          </select>
        </Field>
        <Field label={t('administration.addons.unit', 'Unit')}>
          <select className={inputCls} value={form.unit} onChange={set('unit')}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`administration.addons.unit_${u}`, u)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.tax_inclusive} onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked })} />
        {t('administration.addons.tax_inclusive', 'Price already includes tax')}
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label={t('administration.addons.available_from', 'Available from')}>
          <input type="date" className={inputCls} value={form.available_from} onChange={set('available_from')} />
        </Field>
        <Field label={t('administration.addons.available_until', 'Available until')}>
          <input type="date" className={inputCls} value={form.available_until} onChange={set('available_until')} />
        </Field>
        <Field label={t('administration.addons.stock', 'Stock (empty = unlimited)')}>
          <input type="number" min={0} className={inputCls} value={form.stock} onChange={set('stock')} />
        </Field>
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            <option value="active">{t('academic.state_active', 'active')}</option>
            <option value="inactive">{t('administration.common.status_inactive', 'inactive')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={set('description')} />
      </Field>
      <Field label={t('administration.addons.image', 'Image')}>
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

export default AddOnsHome
