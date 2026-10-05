'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Package } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  CurrencySelect,
  useAdminContext,
  useConfirm,
  useFinanceDefaults,
  useLookupLabel,
  useLookupOptions,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { AddOnsTabs } from '@components/Dashboard/Pages/Administration/AddOnsTabs'
import { createAddOn, deleteAddOn, getAddOns, updateAddOn, uploadAddOnImage } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'

const UNITS = ['per_participant', 'per_session', 'per_item']

function AddOnsHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ['administration', 'addons', orgId],
    queryFn: () => getAddOns(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'addons', orgId] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'addon-options', orgId] })
  }
  const openForm = (a: any) => {
    setEditing(a)
    setOpen(true)
  }

  const remove = async (a: any) => {
    const ok = await confirm({
      title: t('administration.addons.delete_title', 'Delete {{name}}?', { name: a.name }),
      message: a.attachment_count
        ? t(
            'administration.addons.delete_attached',
            'It is attached to {{count}} courses or programs. Deactivate it instead to keep existing registrations intact.',
            { count: a.attachment_count }
          )
        : t('administration.common.confirm_delete', 'Delete this item? This cannot be undone.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteAddOn(a.addon_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const setAddOnStatus = async (rows: any[], next: string) => {
    try {
      await Promise.all(rows.map((a) => updateAddOn(a.addon_uuid, { status: next }, access_token)))
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of addons as any[]) if (a.category) seen.set(a.category.lookup_uuid, label(a.category))
    return [...seen].map(([value, text]) => ({ value, label: text }))
  }, [addons, label])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (addons as any[]).filter(
      (a) =>
        (category === 'all' || a.category?.lookup_uuid === category) &&
        (status === 'all' || a.status === status) &&
        (!q || a.name.toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q) || (a.category ? label(a.category) : '').toLowerCase().includes(q))
    )
  }, [addons, query, category, status, label])
  const filtering = !!query || category !== 'all' || status !== 'all'
  const money = (a: any) => `${Number(a.price || 0).toLocaleString(i18n.language)} ${a.currency || ''}`.trim()

  const createButton = (
    <AcademicPrimaryButton onClick={() => openForm(null)}>
      <Plus className="h-4 w-4" /> {t('administration.addons.new', 'New add-on')}
    </AcademicPrimaryButton>
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.addons', 'Add-ons') }]} />
      <AcademicHeader
        title={t('administration.nav.addons', 'Add-ons')}
        subtitle={t('administration.addons.subtitle', 'Optional items and services priced once and attached to courses, programs and registrations.')}
        action={createButton}
      />
      <AddOnsTabs orgslug={orgslug} />
      <DashDataTable
        rows={visible}
        rowKey={(a: any) => a.addon_uuid}
        loading={isLoading}
        selectable
        onRowClick={openForm}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('administration.addons.count', '{{count}} add-ons', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('administration.addons.search', 'Search add-ons')} />
            <ToolbarSelect
              label={t('administration.addons.category', 'Category')}
              value={category}
              onChange={setCategory}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...categoryOptions]}
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
                await setAddOnStatus(rows, 'active')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.activate', 'Activate')}
            </GhostButton>
            <GhostButton
              onClick={async () => {
                await setAddOnStatus(rows, 'inactive')
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
            icon={<Package size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('administration.addons.none_title', 'No add-ons yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('administration.addons.none_desc', 'Create meals, notebooks or training kits once, then attach them to any course or program.')
            }
            action={filtering ? undefined : createButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('administration.common.name', 'Name'),
            primary: true,
            sortValue: (a: any) => a.name,
            cell: (a: any) => (
              <div className="flex min-w-0 items-center gap-3">
                {a.image ? (
                  <img src={getOrgContentUrl(org?.org_uuid, `addons/${a.addon_uuid}/images/${a.image}`)} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                    <Package size={17} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.name}</div>
                  {a.description ? <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{a.description}</div> : null}
                </div>
              </div>
            ),
          },
          {
            key: 'category',
            header: t('administration.addons.category', 'Category'),
            sortValue: (a: any) => (a.category ? label(a.category) : null),
            cell: (a: any) =>
              a.category ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.category.color || 'hsl(var(--dash-border))' }} />
                  {label(a.category)}
                </span>
              ) : (
                <span className="text-[hsl(var(--dash-muted))]">—</span>
              ),
          },
          {
            key: 'price',
            header: t('administration.addons.price', 'Price'),
            align: 'end',
            sortValue: (a: any) => Number(a.price || 0),
            cell: (a: any) => (
              <div className="leading-tight">
                <div className="whitespace-nowrap font-medium tabular-nums">{money(a)}</div>
                <div className="whitespace-nowrap text-[11px] text-[hsl(var(--dash-muted))]">
                  {a.tax_rate
                    ? `${a.tax_rate}% ${a.tax_inclusive ? t('administration.addons.incl', 'incl.') : t('administration.addons.tax', 'tax')}`
                    : t('administration.addons.no_tax', 'No tax')}
                </div>
              </div>
            ),
          },
          {
            key: 'unit',
            header: t('administration.addons.unit', 'Unit'),
            hideBelow: 'lg',
            cell: (a: any) => <span className="whitespace-nowrap text-[13px] text-[hsl(var(--dash-muted))]">{String(t(`administration.addons.unit_${a.unit}`, a.unit))}</span>,
          },
          {
            key: 'attached',
            header: t('administration.addons.used_in', 'Attached to'),
            align: 'end',
            sortValue: (a: any) => a.attachment_count,
            cell: (a: any) => <span className="tabular-nums">{a.attachment_count ?? 0}</span>,
          },
          {
            key: 'selected',
            header: t('administration.addons.selected', 'Selected'),
            align: 'end',
            hideBelow: 'lg',
            sortValue: (a: any) => a.selected_quantity,
            cell: (a: any) => (
              <span className="whitespace-nowrap tabular-nums">
                {a.selected_quantity ?? 0}
                {a.stock != null ? <span className="text-[hsl(var(--dash-muted))]"> / {a.stock}</span> : null}
              </span>
            ),
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (a: any) => a.status,
            cell: (a: any) => <StatusPill status={a.status} />,
          },
        ]}
        actions={(a: any) => [
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(a) },
          {
            label: a.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
            icon: <Power className="h-3.5 w-3.5" />,
            onSelect: () => setAddOnStatus([a], a.status === 'active' ? 'inactive' : 'active'),
          },
          { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(a) },
        ]}
      />
      <AdminDrawer
        icon={<Package size={20} weight="duotone" />}
        open={open}
        onOpenChange={setOpen}
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.addons.new', 'New add-on')}
        description={t('administration.addons.form_desc', 'Priced once, then attached to courses, programs and registrations.')}
      >
        {open ? (
          <AddOnForm
            addon={editing}
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

function AddOnForm({ addon, onDone, onCancel }: { addon: any; onDone: () => void; onCancel: () => void }) {
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const next: Record<string, string> = {}
    const nonNegative = t('administration.validation.non_negative', 'Enter a number of 0 or more')
    if (!form.name.trim()) next.name = t('administration.validation.required', 'Required')
    if (form.price === '') next.price = t('administration.validation.required', 'Required')
    else if (isNaN(Number(form.price)) || Number(form.price) < 0) next.price = nonNegative
    if (form.stock !== '' && (isNaN(Number(form.stock)) || Number(form.stock) < 0)) next.stock = nonNegative
    if (form.available_from && form.available_until && form.available_until < form.available_from)
      next.available_until = t('administration.validation.date_range', 'End date must be on or after the start date')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
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
    <form onSubmit={submit} noValidate className="space-y-6">
      <FormSection title={t('administration.addons.section_basic', 'Basic information')}>
        <Field label={t('administration.common.name', 'Name')} required error={errors.name}>
          <input className={inputCls} aria-invalid={!!errors.name} value={form.name} onChange={set('name')} placeholder="Lunch Meal" autoFocus />
        </Field>
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
        <Field label={t('administration.common.description', 'Description')} className="sm:col-span-2">
          <textarea className={inputCls} rows={2} value={form.description} onChange={set('description')} />
        </Field>
        <Field label={t('administration.addons.image', 'Image')} className="sm:col-span-2">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-[hsl(var(--dash-muted))] file:me-3 file:rounded-full file:border-0 file:bg-[hsl(var(--dash-canvas))] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--dash-ink))]"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
        </Field>
      </FormSection>

      <FormSection title={t('administration.addons.section_pricing', 'Pricing')}>
        <Field label={t('administration.addons.price', 'Price')} required error={errors.price}>
          <input type="number" min={0} step="0.01" inputMode="decimal" className={inputCls} aria-invalid={!!errors.price} value={form.price} onChange={set('price')} />
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
        <Field label={t('administration.addons.unit', 'Unit')} hint={t('administration.addons.unit_hint', 'How the price is counted on a registration.')}>
          <select className={inputCls} value={form.unit} onChange={set('unit')}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`administration.addons.unit_${u}`, u)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--dash-ink))] sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--dash-ink))]" checked={form.tax_inclusive} onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked })} />
          {t('administration.addons.tax_inclusive', 'Price already includes tax')}
        </label>
      </FormSection>

      <FormSection title={t('administration.addons.section_availability', 'Availability')}>
        <Field label={t('administration.addons.available_from', 'Available from')}>
          <input type="date" className={inputCls} value={form.available_from} onChange={set('available_from')} />
        </Field>
        <Field label={t('administration.addons.available_until', 'Available until')} error={errors.available_until}>
          <input type="date" className={inputCls} aria-invalid={!!errors.available_until} value={form.available_until} onChange={set('available_until')} />
        </Field>
        <Field label={t('administration.addons.stock_label', 'Stock')} hint={t('administration.addons.stock_hint', 'Leave empty for unlimited.')} error={errors.stock}>
          <input type="number" min={0} inputMode="numeric" className={inputCls} aria-invalid={!!errors.stock} value={form.stock} onChange={set('stock')} />
        </Field>
        <Field label={t('administration.common.status', 'Status')} hint={t('administration.addons.status_hint', 'Inactive add-ons stay on past registrations but can’t be picked.')}>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            <option value="active">{t('academic.state_active', 'active')}</option>
            <option value="inactive">{t('administration.common.status_inactive', 'inactive')}</option>
          </select>
        </Field>
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky submitLabel={addon ? t('academic.save', 'Save') : t('administration.addons.create', 'Create add-on')} />
    </form>
  )
}

export default AddOnsHome
