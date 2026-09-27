'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Section, Stat } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CoordinatorPermissionsEditor } from '@components/Dashboard/Pages/Entities/EntityForm'
import { EntityMembersPanel } from '@components/Dashboard/Pages/Entities/EntityMembersPanel'
import { EntityGroupsPanel } from '@components/Dashboard/Pages/Entities/EntityGroupsPanel'
import { EntityLearningPanel } from '@components/Dashboard/Pages/Entities/EntityLearningPanel'
import { PageTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { getEntityLearning, getMyEntities } from '@services/administration/administration'

type Tab = 'overview' | 'members' | 'groups' | 'training'

function PortalOverview({ entity }: { entity: any }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const { data: learning = [] } = useQuery({
    queryKey: ['entities', entity.entity_uuid, 'learning'],
    queryFn: () => getEntityLearning(entity.entity_uuid, access_token),
    enabled: ready,
  })
  const assigned = (learning as any[]).filter((r) => (r.assignments || []).length > 0).length
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Section title={t('entities.portal.at_a_glance', 'At a glance')} className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('entities.members', 'Members')} value={entity.member_count} />
          <Stat label={t('entities.groups', 'Groups')} value={entity.group_count} />
          <Stat label={t('entities.portal.available', 'Available learning')} value={(learning as any[]).length} />
          <Stat label={t('entities.portal.assigned', 'Assigned')} value={assigned} />
        </div>
        <p className="mt-4 text-sm text-[hsl(var(--dash-muted))]">
          {t(
            'entities.portal.intro',
            'Add your people, organize them into groups, then assign them the courses the academy made available to your entity.'
          )}
        </p>
      </Section>
      <Section title={t('entities.portal.you_can', 'What you can do')}>
        <CoordinatorPermissionsEditor value={entity.coordinator_permissions} disabled />
        <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">
          {t('entities.portal.ask_academy', 'The academy decides these. Contact them to change what you can do.')}
        </p>
      </Section>
    </div>
  )
}

function MyEntityPortal({ orgslug: _orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const [selected, setSelected] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', 'mine', orgId],
    queryFn: () => getMyEntities(orgId, access_token),
    enabled: ready,
  })
  const list = entities as any[]
  const entity = list.find((e) => e.entity_uuid === selected) || list[0]
  const isArabic = (i18n.language || '').startsWith('ar')

  if (isLoading) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }
  if (!entity) {
    return (
      <AcademicPageShell>
        <AcademicHeader title={t('entities.portal.nav', 'My entity')} />
        <AcademicEmptyState
          title={t('entities.portal.none', 'You are not coordinating an entity')}
          description={t('entities.portal.none_desc', 'The academy assigns entity coordinators from Administration → Entities.')}
        />
      </AcademicPageShell>
    )
  }
  const perms = entity.coordinator_permissions || {}

  return (
    <AcademicPageShell>
      <AcademicHeader
        title={(isArabic && entity.name_ar) || entity.name}
        subtitle={t('entities.portal.subtitle', 'Entity coordinator workspace')}
        action={
          list.length > 1 && (
            <select className={`${inputCls} w-64`} value={entity.entity_uuid} onChange={(e) => { setSelected(e.target.value); setTab('overview') }}>
              {list.map((e) => (
                <option key={e.entity_uuid} value={e.entity_uuid}>
                  {e.name}
                </option>
              ))}
            </select>
          )
        }
      />
      <PageTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: t('entities.tab_overview', 'Overview') },
          { id: 'members', label: `${t('entities.members', 'Members')} (${entity.member_count})` },
          { id: 'groups', label: t('entities.groups', 'Groups') },
          { id: 'training', label: t('entities.portal.training', 'Training') },
        ]}
      />
      {tab === 'overview' && <PortalOverview entity={entity} />}
      {tab === 'members' && (
        <EntityMembersPanel key={entity.entity_uuid} entityUuid={entity.entity_uuid} isAcademy={false} canManage={!!perms.can_manage_members} />
      )}
      {tab === 'groups' && <EntityGroupsPanel key={entity.entity_uuid} entityUuid={entity.entity_uuid} canManage={!!perms.can_manage_groups} />}
      {tab === 'training' && (
        <EntityLearningPanel key={entity.entity_uuid} entityUuid={entity.entity_uuid} isAcademy={false} canAssign={!!perms.can_assign_training} />
      )}
    </AcademicPageShell>
  )
}

export default MyEntityPortal
