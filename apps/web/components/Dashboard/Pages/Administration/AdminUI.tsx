'use client'
import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Power, SlidersHorizontal, Tag, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { Field, FormActions, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
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
    <div className={cn(TAB_TRACK, 'mb-6')}>
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href || pathname === `${tab.href}/`
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={getUriWithOrg(orgslug, tab.href)}
            className={tabItemClass(active)}
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
    <div className="mb-4">
      <ToolbarSearch value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

/**
 * Promise-based confirmation for actions launched from menus:
 * `const { confirm, dialog } = useConfirm()` → render `dialog`, then
 * `if (await confirm({...})) doIt()`.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    title: string
    message: string
    confirmText: string
    tone: 'warning' | 'info'
  } | null>(null)
  const resolver = useRef<((_ok: boolean) => void) | null>(null)

  const confirm = useCallback(
    (opts: { title: string; message: string; confirmText: string; tone?: 'warning' | 'info' }) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setState({ tone: 'warning', ...opts })
      }),
    []
  )
  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setState(null)
  }
  const dialog = (
    <ConfirmationModal
      open={!!state}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
      dialogTitle={state?.title || ''}
      confirmationMessage={state?.message || ''}
      confirmationButtonText={state?.confirmText || ''}
      status={state?.tone || 'warning'}
      functionToExecute={() => settle(true)}
    />
  )
  return { confirm, dialog }
}

/**
 * Side drawer for medium create/edit forms (the pattern between a small modal
 * and a full page). The body scrolls; use `<FormActions sticky />` inside the
 * form so Save stays visible.
 */
export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  width,
}: {
  open: boolean
  onOpenChange: (_open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  width?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width={width}>
        <SheetHeader title={title} description={description} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

const STORED_VIEW_EVENT = 'admin-stored-view'

/**
 * A remembered per-browser choice (e.g. table vs cards). Read through
 * useSyncExternalStore so the server render and hydration agree (server
 * snapshot = fallback) and every consumer updates together.
 */
export function useStoredView<V extends string>(key: string, fallback: V): [V, (_next: V) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener('storage', notify)
    window.addEventListener(STORED_VIEW_EVENT, notify)
    return () => {
      window.removeEventListener('storage', notify)
      window.removeEventListener(STORED_VIEW_EVENT, notify)
    }
  }, [])
  const read = () => {
    try {
      return (localStorage.getItem(key) as V | null) || fallback
    } catch {
      return fallback
    }
  }
  const value = useSyncExternalStore(subscribe, read, () => fallback)
  const set = useCallback(
    (next: V) => {
      try {
        localStorage.setItem(key, next)
      } catch {
        /* private mode: the choice just isn't remembered */
      }
      window.dispatchEvent(new Event(STORED_VIEW_EVENT))
    },
    [key]
  )
  return [value, set]
}

/** Backend timestamps are naive strings ("2026-09-28 14:57:06.4"); show a short date. */
export function formatAdminDate(value: string | null | undefined, locale?: string) {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Initials avatar or photo used in the first column of people tables. */
export function PersonAvatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => [...w][0])
    .join('')
    .toUpperCase()
  return src ? (
    <img src={src} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[12px] font-semibold text-[hsl(var(--dash-accent))]"
      style={{ width: size, height: size }}
    >
      {initials || '•'}
    </span>
  )
}

/** Display name for a seeded/admin lookup, honouring the Arabic name when present. */
/** White section card used on admin detail pages. */
export function AdminCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('dash-card rounded-[1.25rem] p-5', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Label/value pair in a definition list; empty values show a dash. */
export function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{label}</dt>
      <dd className="mt-1 text-sm text-[hsl(var(--dash-ink))]">{children || <span className="text-[hsl(var(--dash-muted))]">—</span>}</dd>
    </div>
  )
}

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
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['administration', 'lookups', orgId, kind],
    queryFn: () => getLookups(orgId, access_token, kind),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'lookups', orgId, kind] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'lookup-options', orgId, kind] })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows as any[]).filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!q || [r.name, r.code, r.description, r.extra?.name_ar].some((v) => v && String(v).toLowerCase().includes(q)))
    )
  }, [rows, search, status])

  const remove = async (row: any) => {
    const ok = await confirm({
      title: t('administration.common.delete_title', 'Delete {{name}}?', { name: label(row) }),
      message: row.usage_count
        ? t('administration.common.delete_in_use', 'It is used {{count}} times. Deactivate it instead to keep existing records intact.', { count: row.usage_count })
        : t('administration.common.confirm_delete', 'Delete this item? This cannot be undone.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteLookup(row.lookup_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const toggleStatus = async (row: any) => {
    try {
      await updateLookup(row.lookup_uuid, { status: row.status === 'active' ? 'inactive' : 'active' }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const openForm = (row: any) => {
    setEditing(row)
    setOpen(true)
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{lookupKindLabel(t, kind)}</h2>
          {description && <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{description}</p>}
        </div>
      </div>
      <DashDataTable
        rows={filtered}
        rowKey={(r: any) => r.lookup_uuid}
        loading={isLoading}
        onRowClick={openForm}
        itemLabel={(n) => t('administration.table.items', '{{count}} items', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={search} onChange={setSearch} placeholder={t('administration.common.search', 'Search…')} />
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
        toolbarEnd={
          <GhostButton onClick={() => openForm(null)}>
            <Plus className="h-3.5 w-3.5" /> {t('administration.common.add', 'Add')}
          </GhostButton>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<Tag className="h-6 w-6" />}
            title={search || status !== 'all' ? t('administration.common.no_matches', 'No matches') : t('administration.common.empty_title', 'Nothing here yet')}
            description={
              search || status !== 'all'
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('administration.common.empty_lookup_hint', 'Add the first entry so it can be picked from lists across the academy.')
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: t('administration.common.name', 'Name'),
            sortValue: (r: any) => label(r),
            width: 'w-[30%]',
            cell: (r: any) => (
              <div className="flex min-w-0 items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color || 'hsl(var(--dash-border))' }} />
                <span className="truncate">{label(r)}</span>
                {r.is_system && (
                  <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-muted))]">
                    {t('administration.common.default_badge', 'Default')}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'code',
            header: t('administration.common.code', 'Code'),
            sortValue: (r: any) => r.code,
            cell: (r: any) => <span className="font-mono text-xs text-[hsl(var(--dash-muted))]">{r.code}</span>,
          },
          {
            key: 'description',
            header: t('administration.common.description', 'Description'),
            hideBelow: 'lg',
            hideOnMobile: true,
            cell: (r: any) => <span className="line-clamp-1 text-xs text-[hsl(var(--dash-muted))]">{r.description || '—'}</span>,
          },
          {
            key: 'usage',
            header: t('administration.common.in_use', 'In use'),
            align: 'end',
            sortValue: (r: any) => r.usage_count,
            cell: (r: any) => <span className="tabular-nums">{r.usage_count}</span>,
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (r: any) => r.status,
            cell: (r: any) => <StatusPill status={r.status} />,
          },
        ]}
        actions={(r: any) => [
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(r) },
          {
            label: r.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
            icon: <Power className="h-3.5 w-3.5" />,
            onSelect: () => toggleStatus(r),
          },
          ...(r.is_system
            ? []
            : [{ label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(r) }]),
        ]}
      />
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
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
      {dialog}
    </div>
  )
}

function LookupForm({
  kind,
  lookup,
  orgId,
  token,
  onDone,
  onCancel,
}: {
  kind: LookupKind
  lookup: any
  orgId: number
  token: string
  onDone: () => void
  onCancel: () => void
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
        <Field label={t('administration.common.name', 'Name')} required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label={t('administration.common.name_ar', 'Arabic name')}>
          <input className={inputCls} dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('administration.common.code', 'Code')} hint={t('administration.common.code_hint', 'Leave empty to generate one.')}>
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
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
