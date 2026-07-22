'use client'
import React, { useState } from 'react'
import { Users as ChalkboardTeacher, Plus, Trash2, Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { Field, SubmitRow, inputCls } from '../../postgraduate/client'
import {
  getInstructorCategories,
  createInstructorCategory,
  updateInstructorCategory,
  deleteInstructorCategory,
} from '@services/instructors/instructors'

function InstructorCategoriesHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instructor-categories', orgId] })

  const handleDelete = async (c: any) => {
    if (!window.confirm(t('instructors.confirm_delete_category', 'Delete this category?'))) return
    try {
      await deleteInstructorCategory(c.category_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('instructors.title', 'Instructors'),
            href: getUriWithOrg(orgslug, '/dash/instructors'),
            icon: <ChalkboardTeacher size={14} />,
          },
          {
            label: t('instructors.categories', 'Categories & Rates'),
            href: getUriWithOrg(orgslug, '/dash/instructors/categories'),
          },
        ]}
      />
      <AcademicHeader
        title={t('instructors.categories', 'Categories & Rates')}
        subtitle={t('instructors.categories_desc', 'Set an hourly rate per delivery language (e.g. English, Arabic)')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('instructors.new_category', 'New Category')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <InstructorTabs orgslug={orgslug} />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="dash-shimmer h-20 rounded-[var(--dash-radius)]" />
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))] nice-shadow">
        {!isLoading && categories.length === 0 && (
          <div className="p-10 text-center text-[hsl(var(--dash-muted))]">
            {t('instructors.no_categories', 'No categories yet. Create one to define hourly rates.')}
          </div>
        )}
        {categories.map((c: any) => (
          <div key={c.category_uuid} className="flex items-start justify-between gap-4 border-b border-[hsl(var(--dash-border))]/60 p-4 transition-colors last:border-b-0 hover:bg-[hsl(var(--dash-accent-soft))]/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[hsl(var(--dash-ink))]">{c.name}</h3>
                {c.instructor_count > 0 && (
                  <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[10px] font-bold uppercase text-[hsl(var(--dash-muted))]">
                    {c.instructor_count} {t('instructors.title', 'Instructors')}
                  </span>
                )}
              </div>
              {c.description && <p className="mt-0.5 text-sm text-[hsl(var(--dash-muted))]">{c.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.hourly_rate != null && (
                  <span className="rounded-full bg-[hsl(var(--dash-tile-mint))] px-2 py-0.5 text-xs text-[hsl(var(--dash-tile-mint-fg))]">
                    {t('instructors.base_rate', 'Base')}: {c.hourly_rate} {c.currency || ''}
                  </span>
                )}
                {(c.language_rates || []).map((r: any) => (
                  <span key={r.id} className="rounded-full bg-[hsl(var(--dash-tile-lavender))] px-2 py-0.5 text-xs text-[hsl(var(--dash-tile-lavender-fg))]">
                    {r.language}: {r.hourly_rate} {c.currency || ''}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setEditing(c)
                  setModalOpen(true)
                }}
                className="rounded-md p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="rounded-md p-1.5 text-[hsl(var(--dash-muted))] hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('instructors.edit_category', 'Edit Category') : t('instructors.new_category', 'New Category')}
        dialogContent={
          <CategoryForm
            orgId={orgId!}
            access_token={access_token}
            category={editing}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function CategoryForm({
  orgId,
  access_token,
  category,
  onDone,
}: {
  orgId: number
  access_token: string
  category: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [currency, setCurrency] = useState(category?.currency || 'USD')
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('academic.currency')}>
          <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>
      </div>

      <Field label={t('instructors.base_rate', 'Base hourly rate')}>
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputCls}
          value={baseRate}
          onChange={(e) => setBaseRate(e.target.value)}
          placeholder={t('instructors.base_rate_hint', 'Used when a language has no specific rate')}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[hsl(var(--dash-ink))]">
            {t('instructors.language_rates', 'Per-language rates')}
          </label>
          <button
            type="button"
            onClick={addRate}
            className="text-xs font-bold text-[hsl(var(--dash-accent))] flex items-center gap-1 hover:opacity-70"
          >
            <Plus className="w-3.5 h-3.5" /> {t('instructors.add_language', 'Add language')}
          </button>
        </div>
        <div className="space-y-2">
          {rates.length === 0 && (
            <p className="text-xs text-[hsl(var(--dash-muted))]">
              {t('instructors.no_language_rates', 'No per-language rates. The base rate applies to all languages.')}
            </p>
          )}
          {rates.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputCls}
                placeholder={t('instructors.language', 'Language')}
                value={r.language}
                onChange={(e) => setRate(i, 'language', e.target.value)}
              />
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
                className="p-2 text-[hsl(var(--dash-muted))] hover:text-red-500 shrink-0"
                aria-label={t('academic.delete', 'Delete')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <SubmitRow saving={saving} />
    </form>
  )
}

export default InstructorCategoriesHome
