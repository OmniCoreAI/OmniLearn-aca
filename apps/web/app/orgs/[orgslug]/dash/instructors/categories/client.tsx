'use client'
import React, { useMemo, useState } from 'react'
import { Users as ChalkboardTeacher, Plus, Trash2, Pencil, Power, X } from 'lucide-react'
import { Tag } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminDrawer, CurrencySelect, useConfirm, useFinanceDefaults } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  getInstructorCategories,
  createInstructorCategory,
  updateInstructorCategory,
  deleteInstructorCategory,
} from '@services/instructors/instructors'

function InstructorCategoriesHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })
  const all = categories as any[]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instructor-categories', orgId] })
  const openForm = (c: any) => {
    setEditing(c)
    setOpen(true)
  }
  const money = (v: number, cur?: string) => `${Number(v).toLocaleString(i18n.language)} ${cur || ''}`.trim()

  const handleDelete = async (c: any) => {
    const ok = await confirm({
      title: t('instructors.delete_category_title', 'Delete {{name}}?', { name: c.name }),
      message:
        c.instructor_count > 0
          ? t('instructors.delete_category_used', '{{count}} instructors use this category and would lose their default rate. Deactivate it instead to keep their rates.', {
              count: c.instructor_count,
            })
          : t('instructors.confirm_delete_category', 'Delete this category?'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteInstructorCategory(c.category_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }
  const toggle = async (c: any) => {
    try {
      await updateInstructorCategory(c.category_uuid, { status: c.status === 'inactive' ? 'active' : 'inactive' }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => (status === 'all' || (c.status || 'active') === status) && (!q || `${c.name} ${c.description || ''}`.toLowerCase().includes(q)))
  }, [all, query, status])
  const filtering = !!query || status !== 'all'

  const createButton = (
    <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
      <AcademicPrimaryButton onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" /> {t('instructors.new_category', 'New Category')}
      </AcademicPrimaryButton>
    </AuthenticatedClientElement>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('instructors.title', 'Instructors'), href: getUriWithOrg(orgslug, '/dash/instructors'), icon: <ChalkboardTeacher size={14} /> },
          { label: t('instructors.categories', 'Categories & Rates'), href: getUriWithOrg(orgslug, '/dash/instructors/categories') },
        ]}
      />
      <AcademicHeader
        title={t('instructors.categories', 'Categories & Rates')}
        subtitle={t('instructors.categories_desc', 'Set an hourly rate per delivery language (e.g. English, Arabic)')}
        action={createButton}
      />
      <InstructorTabs orgslug={orgslug} />

      <DashDataTable
        rows={visible}
        rowKey={(c: any) => c.category_uuid}
        loading={isLoading}
        onRowClick={openForm}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('instructors.categories_count', '{{count}} categories', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('instructors.search_categories', 'Search categories')} />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: t('instructors.status_active', 'Active') },
                { value: 'inactive', label: t('instructors.status_inactive', 'Inactive') },
              ]}
            />
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<Tag size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('instructors.no_categories_title', 'No categories yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('instructors.no_categories', 'No categories yet. Create one to define hourly rates.')
            }
            action={filtering ? undefined : createButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('instructors.category', 'Category'),
            primary: true,
            sortValue: (c: any) => c.name,
            cell: (c: any) => (
              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium">{c.name}</div>
                {c.description ? <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{c.description}</div> : null}
              </div>
            ),
          },
          {
            key: 'base',
            header: t('instructors.base_rate_short', 'Base rate / h'),
            align: 'end',
            sortValue: (c: any) => c.hourly_rate,
            cell: (c: any) => (c.hourly_rate != null ? <span className="whitespace-nowrap font-medium tabular-nums">{money(c.hourly_rate, c.currency)}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
          },
          {
            key: 'languages',
            header: t('instructors.language_rates', 'Per-language rates'),
            hideBelow: 'lg',
            hideOnMobile: true,
            cell: (c: any) =>
              (c.language_rates || []).length ? (
                <div className="flex flex-wrap gap-1">
                  {(c.language_rates || []).map((r: any) => (
                    <span key={r.id ?? r.language} className="whitespace-nowrap rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px]">
                      {r.language} · <span className="tabular-nums">{money(r.hourly_rate, c.currency)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[12px] text-[hsl(var(--dash-muted))]">{t('instructors.base_for_all', 'Base rate for all languages')}</span>
              ),
          },
          {
            key: 'instructors',
            header: t('instructors.title', 'Instructors'),
            align: 'end',
            sortValue: (c: any) => c.instructor_count || 0,
            cell: (c: any) => <span className="tabular-nums">{c.instructor_count || 0}</span>,
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (c: any) => c.status || 'active',
            cell: (c: any) => <StatusPill status={c.status || 'active'} label={String(t(`instructors.status_${c.status || 'active'}`, c.status || 'active'))} />,
          },
        ]}
        actions={(c: any) => [
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(c) },
          {
            label: c.status === 'inactive' ? t('administration.common.activate', 'Activate') : t('administration.common.deactivate', 'Deactivate'),
            icon: <Power className="h-3.5 w-3.5" />,
            onSelect: () => toggle(c),
          },
          { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => handleDelete(c) },
        ]}
      />

      <AdminDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('instructors.new_category', 'New Category')}
        description={t('instructors.category_form_desc', 'Instructors in this category are paid these rates unless they have a personal rate.')}
      >
        {open ? (
          <CategoryForm
            key={editing?.category_uuid || 'new'}
            orgId={orgId!}
            access_token={access_token}
            category={editing}
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

function CategoryForm({
  orgId,
  access_token,
  category,
  onDone,
  onCancel,
}: {
  orgId: number
  access_token: string
  category: any
  onDone: () => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const financeDefaults = useFinanceDefaults()
  const [currency, setCurrency] = useState<string>(category?.currency || financeDefaults.default_currency)
  const [status, setStatus] = useState<string>(category?.status || 'active')
  const [baseRate, setBaseRate] = useState<string>(
    category?.hourly_rate != null ? String(category.hourly_rate) : ''
  )
  const [rates, setRates] = useState<{ language: string; hourly_rate: string }[]>(
    (category?.language_rates || []).map((r: any) => ({
      language: r.language,
      hourly_rate: String(r.hourly_rate),
    }))
  )
  const [saving, setSaving] = useState(false)

  const addRate = () => setRates((rs) => [...rs, { language: '', hourly_rate: '' }])
  const removeRate = (i: number) => setRates((rs) => rs.filter((_, idx) => idx !== i))
  const setRate = (i: number, key: 'language' | 'hourly_rate', v: string) =>
    setRates((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const language_rates = rates
        .filter((r) => r.language.trim() && r.hourly_rate !== '')
        .map((r) => ({ language: r.language.trim(), hourly_rate: Number(r.hourly_rate) }))
      const payload: any = {
        name,
        description: description || null,
        currency: currency || null,
        hourly_rate: baseRate === '' ? null : Number(baseRate),
        language_rates,
        status,
      }
      if (category) {
        await updateInstructorCategory(category.category_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createInstructorCategory(orgId, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.name')} required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('instructors.status', 'Status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{t('instructors.status_active', 'Active')}</option>
            <option value="inactive">{t('instructors.status_inactive', 'Inactive')}</option>
          </select>
        </Field>
        <Field label={t('academic.description')} className="sm:col-span-2">
          <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </FormSection>

      <FormSection title={t('instructors.section_rates', 'Rates')} description={t('instructors.rates_desc', 'Per-language rates win over the base rate; a personal rate on an instructor wins over both.')}>
        <Field label={t('instructors.base_rate', 'Base hourly rate')} hint={t('instructors.base_rate_hint', 'Used when a language has no specific rate')}>
          <input type="number" min={0} step="0.01" className={inputCls} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
        </Field>
        <Field label={t('academic.currency')}>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </Field>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[hsl(var(--dash-ink))]">{t('instructors.language_rates', 'Per-language rates')}</span>
            <button type="button" onClick={addRate} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]">
              <Plus className="h-3.5 w-3.5" /> {t('instructors.add_language', 'Add language')}
            </button>
          </div>
          {rates.length === 0 ? (
            <p className="rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2 text-xs text-[hsl(var(--dash-muted))]">
              {t('instructors.no_language_rates', 'No per-language rates. The base rate applies to all languages.')}
            </p>
          ) : null}
          {rates.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inputCls} placeholder={t('instructors.language', 'Language')} value={r.language} onChange={(e) => setRate(i, 'language', e.target.value)} />
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                placeholder={t('instructors.rate', 'Rate')}
                value={r.hourly_rate}
                onChange={(e) => setRate(i, 'hourly_rate', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeRate(i)}
                className="shrink-0 rounded-full p-2 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-warn))]"
                aria-label={t('academic.delete', 'Delete')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky={!!onCancel} />
    </form>
  )
}

export default InstructorCategoriesHome
