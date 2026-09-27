'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getEntityOptions } from '@services/administration/administration'

const selectCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

export const EDITABLE_GROUP_TYPES = ['general', 'department', 'cohort']

/** Entity / type / status fields shared by the create and edit group modals. */
export function GroupClassificationFields({
  values,
  onChange,
}: {
  values: { entity_uuid: string; group_type: string; status: string }
  onChange: (_field: string, _value: string) => void
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const { data: entities = [] } = useQuery({
    queryKey: ['administration', 'entity-options', org?.id],
    queryFn: () => getEntityOptions(org.id, access_token),
    enabled: !!org?.id && !!access_token,
  })
  return (
    <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-3">
      <label className="space-y-1 text-sm">
        <span className="font-medium text-gray-700">{t('entities.entity', 'Entity')}</span>
        <select className={selectCls} value={values.entity_uuid} onChange={(e) => onChange('entity_uuid', e.target.value)}>
          <option value="">{t('entities.no_entity', 'None (academy-wide)')}</option>
          {(entities as any[]).map((o) => (
            <option key={o.entity_uuid} value={o.entity_uuid}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-gray-700">{t('entities.group_type', 'Type')}</span>
        <select className={selectCls} value={values.group_type} onChange={(e) => onChange('group_type', e.target.value)}>
          {EDITABLE_GROUP_TYPES.map((g) => (
            <option key={g} value={g}>
              {String(t(`entities.group_type_${g}`, g))}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-gray-700">{t('administration.common.status', 'Status')}</span>
        <select className={selectCls} value={values.status} onChange={(e) => onChange('status', e.target.value)}>
          {['active', 'inactive'].map((s) => (
            <option key={s} value={s}>
              {String(t(`administration.common.status_${s}`, s))}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
