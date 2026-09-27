'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, IconButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getUriWithOrg } from '@services/config/config'
import {
  AddOnTargetType,
  createAddOnAttachment,
  deleteAddOnAttachment,
  getAddOnOptions,
  getTargetAttachments,
  updateAddOnAttachment,
} from '@services/administration/administration'

/**
 * Attach catalog add-ons (Administration → Add-ons) to a course, training
 * program, cohort or offering, with an optional price override and
 * required / participant-selectable flags.
 */
export function AddOnAttachmentsPanel({
  targetType,
  targetUuid,
  compact = false,
}: {
  targetType: AddOnTargetType
  targetUuid: string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [pick, setPick] = useState('')
  const queryKey = ['administration', 'addon-attachments', targetType, targetUuid]

  const { data: attachments = [], error } = useQuery({
    queryKey,
    queryFn: () => getTargetAttachments(targetType, targetUuid, access_token),
    enabled: ready && !!targetUuid,
    retry: false,
  })
  const { data: options = [] } = useQuery({
    queryKey: ['administration', 'addon-options', orgId],
    queryFn: () => getAddOnOptions(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey })

  // Only configuration managers can manage attachments; others see nothing.
  if (error) return null

  const attached = new Set((attachments as any[]).map((a) => a.addon_uuid))

  const add = async () => {
    if (!pick) return
    try {
      await createAddOnAttachment({ addon_uuid: pick, target_type: targetType, target_uuid: targetUuid }, access_token)
      setPick('')
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const patch = async (a: any, data: any) => {
    try {
      await updateAddOnAttachment(a.attachment_uuid, data, access_token)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const remove = async (a: any) => {
    try {
      await deleteAddOnAttachment(a.attachment_uuid, access_token)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  return (
    <div className="space-y-2">
      {(attachments as any[]).length === 0 && (
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('administration.addons.none_attached', 'No add-ons attached.')}</p>
      )}
      {(attachments as any[]).map((a) => (
        <div
          key={a.attachment_uuid}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2"
        >
          <div className="min-w-[140px] flex-1">
            <div className="text-sm font-medium">{a.name}</div>
            <div className="text-[11px] text-[hsl(var(--dash-muted))]">
              {a.category_name ? `${a.category_name} · ` : ''}
              {t('administration.addons.catalog_price', 'Catalog')}: {a.catalog_price} {a.currency || ''}
              {a.tax_rate ? ` + ${a.tax_rate}%` : ''}
            </div>
          </div>
          <input
            type="number"
            min={0}
            step="0.01"
            className={`${inputCls} w-24`}
            defaultValue={a.price_override ?? ''}
            placeholder={String(a.catalog_price)}
            title={t('administration.addons.price_override', 'Price for this course (leave empty for catalog price)')}
            onBlur={(e) => {
              const value = e.target.value === '' ? null : Number(e.target.value)
              if (value !== (a.price_override ?? null)) patch(a, { price_override: value })
            }}
          />
          {!compact && (
            <input
              type="number"
              min={1}
              className={`${inputCls} w-16`}
              defaultValue={a.max_quantity}
              title={t('administration.addons.max_quantity', 'Max quantity per participant')}
              onBlur={(e) => {
                const value = Math.max(1, Number(e.target.value) || 1)
                if (value !== a.max_quantity) patch(a, { max_quantity: value })
              }}
            />
          )}
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={a.is_required} onChange={(e) => patch(a, { is_required: e.target.checked })} />
            {t('administration.addons.required', 'Required')}
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={a.is_selectable} onChange={(e) => patch(a, { is_selectable: e.target.checked })} />
            {t('administration.addons.selectable', 'Participants can choose')}
          </label>
          <IconButton tone="danger" onClick={() => remove(a)} aria-label={t('administration.common.delete', 'Delete')}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{t('administration.addons.pick', 'Add from the catalog…')}</option>
          {(options as any[])
            .filter((o) => !attached.has(o.addon_uuid))
            .map((o) => (
              <option key={o.addon_uuid} value={o.addon_uuid}>
                {o.name} — {o.price} {o.currency || ''}
              </option>
            ))}
        </select>
        <GhostButton type="button" onClick={add} disabled={!pick}>
          <Plus className="h-3.5 w-3.5" /> {t('administration.common.add', 'Add')}
        </GhostButton>
      </div>
      <Link className="text-[11px] font-semibold text-[hsl(var(--dash-accent))]" href={getUriWithOrg(org?.slug, '/dash/administration/add-ons')}>
        {t('administration.addons.manage_catalog', 'Manage the add-on catalog')}
      </Link>
    </div>
  )
}
