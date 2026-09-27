'use client'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, IconButton, Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { SettingsTabs } from '@components/Dashboard/Pages/Administration/SettingsTabs'
import { FinanceDefaults, getAdminSetting, putAdminSetting } from '@services/administration/administration'

function FinanceDefaultsSettings({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const queryKey = ['administration', 'settings', orgId, 'finance_defaults']
  const { data } = useQuery({
    queryKey,
    queryFn: () => getAdminSetting(orgId, 'finance_defaults', access_token),
    enabled: ready,
  })
  const [form, setForm] = useState<FinanceDefaults | null>(null)
  const [newCurrency, setNewCurrency] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  if (!form) return <AcademicPageShell><div className="dash-shimmer h-40 rounded-xl" /></AcademicPageShell>

  const save = async () => {
    setSaving(true)
    try {
      const saved = await putAdminSetting(orgId, 'finance_defaults', form, access_token)
      setForm(saved)
      queryClient.setQueryData(queryKey, saved)
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const addCurrency = () => {
    const code = newCurrency.trim().toUpperCase()
    if (code.length !== 3 || form.currencies.includes(code)) return
    setForm({ ...form, currencies: [...form.currencies, code] })
    setNewCurrency('')
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.settings', 'General Configuration') }]} />
      <AcademicHeader
        title={t('administration.nav.settings', 'General Configuration')}
        subtitle={t('administration.settings.subtitle', 'Categories, currencies and taxes reused across the whole academy.')}
      />
      <SettingsTabs orgslug={orgslug} />

      <div className="grid max-w-3xl grid-cols-1 gap-6">
        <Section
          title={t('administration.settings.currencies', 'Currencies')}
          description={t('administration.settings.currencies_desc', 'Offered by every price, rate and cost field (ISO codes, e.g. EGP).')}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {form.currencies.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-1 text-xs font-semibold"
              >
                {code}
                {code !== form.default_currency && (
                  <button
                    type="button"
                    className="text-[hsl(var(--dash-muted))] hover:text-red-600"
                    aria-label={t('administration.common.delete', 'Delete')}
                    onClick={() => setForm({ ...form, currencies: form.currencies.filter((c) => c !== code) })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('administration.settings.default_currency', 'Default currency')}>
              <select
                className={inputCls}
                value={form.default_currency}
                onChange={(e) => setForm({ ...form, default_currency: e.target.value })}
              >
                {form.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('administration.settings.add_currency', 'Add currency')}>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  maxLength={3}
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                  placeholder="SAR"
                />
                <GhostButton type="button" onClick={addCurrency}>
                  <Plus className="h-3.5 w-3.5" />
                </GhostButton>
              </div>
            </Field>
          </div>
        </Section>

        <Section
          title={t('administration.settings.taxes', 'Taxes')}
          description={t('administration.settings.taxes_desc', 'Tax rates that add-ons and other priced items can apply.')}
          action={
            <GhostButton
              type="button"
              onClick={() => setForm({ ...form, tax_rates: [...form.tax_rates, { name: '', rate: 0, is_default: false }] })}
            >
              <Plus className="h-3.5 w-3.5" /> {t('administration.settings.add_tax', 'Add tax')}
            </GhostButton>
          }
        >
          <div className="space-y-2">
            {form.tax_rates.length === 0 && (
              <p className="text-sm text-[hsl(var(--dash-muted))]">{t('administration.settings.no_taxes', 'No taxes configured.')}</p>
            )}
            {form.tax_rates.map((tax, index) => (
              <div key={index} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2">
                <input
                  className={inputCls}
                  value={tax.name}
                  placeholder={t('administration.common.name', 'Name')}
                  onChange={(e) => {
                    const tax_rates = [...form.tax_rates]
                    tax_rates[index] = { ...tax, name: e.target.value }
                    setForm({ ...form, tax_rates })
                  }}
                />
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className={inputCls}
                    value={tax.rate}
                    onChange={(e) => {
                      const tax_rates = [...form.tax_rates]
                      tax_rates[index] = { ...tax, rate: Number(e.target.value) }
                      setForm({ ...form, tax_rates })
                    }}
                  />
                  <span className="pointer-events-none absolute end-3 top-2 text-sm text-[hsl(var(--dash-muted))]">%</span>
                </div>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="radio"
                    name="default_tax"
                    checked={tax.is_default}
                    onChange={() =>
                      setForm({ ...form, tax_rates: form.tax_rates.map((x, i) => ({ ...x, is_default: i === index })) })
                    }
                  />
                  {t('administration.settings.default', 'Default')}
                </label>
                <IconButton
                  tone="danger"
                  type="button"
                  onClick={() => setForm({ ...form, tax_rates: form.tax_rates.filter((_, i) => i !== index) })}
                  aria-label={t('administration.common.delete', 'Delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="dash-lift rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] hover:brightness-110 disabled:opacity-50"
          >
            {saving ? '…' : t('academic.save')}
          </button>
        </div>
      </div>
    </AcademicPageShell>
  )
}

export default FinanceDefaultsSettings
