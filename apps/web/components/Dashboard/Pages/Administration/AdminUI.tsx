'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  DataTable,
  GhostButton,
  IconButton,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  FinanceDefaults,
  LookupKind,
  createLookup,
  deleteLookup,
  getAdminSetting,
  getLookupOptions,
  getLookups,
  updateLookup,
} from '@services/administration/administration'

/* Building blocks shared by the Administration & Configuration screens. */

export const useAdminContext = useAcademicContext

export interface AdminTab {
  href: string
  label: string
  /** Match only the exact path (used for a section's index tab). */
  exact?: boolean
}

/** Pill tab bar for an administration section (hrefs are org-relative). */
export function AdminTabs({ orgslug, tabs }: { orgslug: string; tabs: AdminTab[] }) {
  const pathname = usePathname() || ''
  return (
    <div className="mb-6 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-1">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href || pathname === `${tab.href}/`
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={getUriWithOrg(orgslug, tab.href)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
                : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

/** Breadcrumbs rooted at the Administration overview. */
export function AdminBreadcrumbs({ orgslug, items }: { orgslug: string; items: { label: string; href?: string }[] }) {
  const { t } = useTranslation()
  return (
    <Breadcrumbs
      items={[
        {
          label: t('dashboard.home.nav.administration', 'Administration & Configuration'),
          href: getUriWithOrg(orgslug, '/dash/administration'),
          icon: <SlidersHorizontal size={14} />,
        },
        ...items.map((i) => ({ label: i.label, href: i.href ? getUriWithOrg(orgslug, i.href) : undefined })),
      ]}
    />
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (_v: string) => void
  placeholder?: string
}) {
  return (
    <div className="mb-4 flex max-w-sm items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5">
      <Search className="h-4 w-4 text-[hsl(var(--dash-muted))]" />
      <input
        className="flex-1 bg-transparent text-sm focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Display name for a seeded/admin lookup, honouring the Arabic name when present. */
export function useLookupLabel() {
  const { i18n } = useTranslation()
  const isArabic = (i18n.language || '').startsWith('ar')
  return (lookup: { name: string; extra?: any } | null | undefined) => {
    if (!lookup) return '—'
    return (isArabic && lookup.extra?.name_ar) || lookup.name
  }
}

/** Org currencies & taxes (Administration → General Configuration). */
export function useFinanceDefaults(): FinanceDefaults {
  const { orgId, access_token, ready } = useAdminContext()
  const { data } = useQuery({
    queryKey: ['administration', 'settings', orgId, 'finance_defaults'],
    queryFn: () => getAdminSetting(orgId, 'finance_defaults', access_token),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })
  return (
    data || {
      default_currency: 'EGP',
      currencies: ['EGP', 'USD'],
      tax_rates: [{ name: 'VAT', rate: 14, is_default: true }],
    }
  )
}

export function CurrencySelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (_v: string) => void
  className?: string
}) {
  const defaults = useFinanceDefaults()
  const options = defaults.currencies.includes(value) || !value ? defaults.currencies : [value, ...defaults.currencies]
  return (
    <select className={cn(inputCls, className)} value={value || defaults.default_currency} onChange={(e) => onChange(e.target.value)}>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

/** Active lookups of a kind for dropdowns (any org member). */
export function useLookupOptions(kind: LookupKind) {
  const { orgId, access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['administration', 'lookup-options', orgId, kind],
    queryFn: () => getLookupOptions(orgId, kind, access_token),
    enabled: ready,
  })
  return data as { id: number; lookup_uuid: string; name: string; code: string; color?: string }[]
}

export function lookupKindLabel(t: TFunction, kind: LookupKind): string {
  const fallbacks: Record<LookupKind, string> = {
    course_category: 'Course categories',
    facility_type: 'Facility types',
    equipment: 'Equipment',
    location_type: 'Location types',
    addon_category: 'Add-on categories',
    entity_type: 'Entity types',
  }
  return String(t(`administration.lookups.kind_${kind}`, fallbacks[kind]))
}

/**
 * Full CRUD table for one lookup kind — used by General Configuration and by
 * sections that own a category list (facility types, add-on categories, …).
 */
export function LookupManager({ kind, description }: { kind: LookupKind; description?: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['administration', 'lookups', orgId, kind],
    queryFn: () => getLookups(orgId, access_token, kind),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'lookups', orgId, kind] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'lookup-options', orgId, kind] })
  }

  const remove = async (row: any) => {
    if (!window.confirm(t('administration.common.confirm_delete', 'Delete this item? This cannot be undone.'))) return
    try {
      await deleteLookup(row.lookup_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--dash-ink))]">{lookupKindLabel(t, kind)}</h2>
          {description && <p className="text-xs text-[hsl(var(--dash-muted))]">{description}</p>}
        </div>
        <GhostButton
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" /> {t('administration.common.add', 'Add')}
        </GhostButton>
      </div>
      <DataTable
        headers={[
          t('administration.common.name', 'Name'),
          t('administration.common.code', 'Code'),
          t('administration.common.description', 'Description'),
          t('administration.common.in_use', 'In use'),
          t('administration.common.status', 'Status'),
          '',
        ]}
        empty={isLoading ? '…' : t('administration.common.empty', 'Nothing here yet.')}
      >
        {(rows as any[]).map((row) => (
          <tr key={row.lookup_uuid}>
            <td className={tdCls}>
              <div className="flex items-center gap-2 font-medium">
                {row.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />}
                {label(row)}
                {row.is_system && (
                  <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-muted))]">
                    {t('administration.common.default_badge', 'Default')}
                  </span>
                )}
              </div>
            </td>
            <td className={`${tdCls} font-mono text-xs`}>{row.code}</td>
            <td className={`${tdCls} text-xs text-[hsl(var(--dash-muted))]`}>{row.description || '—'}</td>
            <td className={tdCls}>{row.usage_count}</td>
            <td className={tdCls}>
              <StatusPill status={row.status} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              <IconButton
                onClick={() => {
                  setEditing(row)
                  setOpen(true)
                }}
                aria-label={t('administration.common.edit', 'Edit')}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" onClick={() => remove(row)} aria-label={t('administration.common.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </td>
          </tr>
        ))}
      </DataTable>
      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="sm"
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${label(editing)}` : `${t('administration.common.add', 'Add')} — ${lookupKindLabel(t, kind)}`}
        dialogContent={
          <LookupForm
            kind={kind}
            lookup={editing}
            orgId={orgId}
            token={access_token}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
    </div>
  )
}

function LookupForm({
  kind,
  lookup,
  orgId,
  token,
  onDone,
}: {
  kind: LookupKind
  lookup: any
  orgId: number
  token: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(lookup?.name || '')
  const [nameAr, setNameAr] = useState(lookup?.extra?.name_ar || '')
  const [code, setCode] = useState(lookup?.code || '')
  const [description, setDescription] = useState(lookup?.description || '')
  const [color, setColor] = useState(lookup?.color || '')
  const [status, setStatus] = useState(lookup?.status || 'active')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        code: code || undefined,
        description: description || null,
        color: color || null,
        status,
        extra: { ...(lookup?.extra || {}), name_ar: nameAr || undefined },
      }
      if (lookup) await updateLookup(lookup.lookup_uuid, payload, token)
      else await createLookup(orgId, { ...payload, kind }, token)
      toast.success(lookup ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('administration.common.name', 'Name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('administration.common.name_ar', 'Arabic name')}>
          <input className={inputCls} dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('administration.common.code', 'Code')}>
          <input
            className={inputCls}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('administration.common.code_auto', 'Auto')}
          />
        </Field>
        <Field label={t('administration.common.color', 'Color')}>
          <input type="color" className={cn(inputCls, 'h-[38px] p-1')} value={color || '#c9a227'} onChange={(e) => setColor(e.target.value)} />
        </Field>
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{t('academic.state_active', 'active')}</option>
            <option value="inactive">{t('administration.common.status_inactive', 'inactive')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}
