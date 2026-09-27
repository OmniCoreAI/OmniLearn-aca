'use client'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Package } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { AddOnTargetType, getTargetAddOns, setMyAddOnSelection } from '@services/administration/administration'

/**
 * Participant-facing list of the optional (and required) add-ons attached to a
 * course or program. Choices are recorded only — nothing is charged here.
 */
export default function OptionalAddOnsCard({
  targetType,
  targetUuid,
}: {
  targetType: AddOnTargetType
  targetUuid: string
}) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const queryKey = ['addons', 'target', targetType, targetUuid]
  const { data, error } = useQuery({
    queryKey,
    queryFn: () => getTargetAddOns(targetType, targetUuid, token),
    enabled: !!token && !!targetUuid,
    retry: false,
  })
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data) return
    const next: Record<string, number> = {}
    for (const item of data.items || []) next[item.attachment.attachment_uuid] = item.selected_quantity
    setQuantities(next)
  }, [data])

  if (error || !data || !(data.items || []).length) return null

  const items = data.items as any[]
  const lineTotal = (item: any) => {
    const q = item.attachment.is_required ? Math.max(1, quantities[item.attachment.attachment_uuid] || 0) : quantities[item.attachment.attachment_uuid] || 0
    return q * item.attachment.unit_price_with_tax
  }
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0)
  const currency = data.currency || items[0]?.attachment.currency || ''
  const dirty = items.some((item) => (quantities[item.attachment.attachment_uuid] || 0) !== item.selected_quantity)

  const save = async () => {
    setSaving(true)
    try {
      const saved = await setMyAddOnSelection(
        targetType,
        targetUuid,
        items.map((item) => ({
          attachment_uuid: item.attachment.attachment_uuid,
          quantity: item.attachment.is_required
            ? Math.max(1, quantities[item.attachment.attachment_uuid] || 0)
            : quantities[item.attachment.attachment_uuid] || 0,
        })),
        token
      )
      queryClient.setQueryData(queryKey, saved)
      toast.success(t('administration.addons.saved_choice', 'Your add-on choices were saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Package className="h-4 w-4" /> {t('administration.addons.optional_title', 'Optional add-ons')}
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const a = item.attachment
          const q = quantities[a.attachment_uuid] || 0
          return (
            <li key={a.attachment_uuid} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-gray-800">{a.name}</div>
                <div className="text-[11px] text-gray-500">
                  {a.unit_price_with_tax} {a.currency || ''}
                  {a.tax_rate ? ` (${t('administration.addons.incl_tax', 'incl. tax')})` : ''}
                </div>
              </div>
              {a.is_required ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {t('administration.addons.included', 'Included')}
                </span>
              ) : a.max_quantity > 1 ? (
                <input
                  type="number"
                  min={0}
                  max={a.max_quantity}
                  value={q}
                  disabled={!a.available && !item.selected_quantity}
                  onChange={(e) =>
                    setQuantities({ ...quantities, [a.attachment_uuid]: Math.min(a.max_quantity, Math.max(0, Number(e.target.value) || 0)) })
                  }
                  className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={q > 0}
                  disabled={!a.available && !item.selected_quantity}
                  onChange={(e) => setQuantities({ ...quantities, [a.attachment_uuid]: e.target.checked ? 1 : 0 })}
                />
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
        <span className="text-gray-500">{t('administration.addons.total', 'Total')}</span>
        <span className="font-semibold">
          {Math.round(total * 100) / 100} {currency}
        </span>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="w-full rounded-lg bg-[hsl(var(--dash-accent))] py-2 text-sm font-semibold text-[hsl(var(--dash-ink))] disabled:opacity-40"
      >
        {saving ? '…' : t('administration.addons.save_choice', 'Save my choices')}
      </button>
      <p className="text-[11px] text-gray-400">{t('administration.addons.recorded_only', 'Your choice is recorded for the organizers; no payment is taken here.')}</p>
    </div>
  )
}
