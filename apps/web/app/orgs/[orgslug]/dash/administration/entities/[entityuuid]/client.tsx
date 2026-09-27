'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { DataTable, GhostButton, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntityForm } from '@components/Dashboard/Pages/Entities/EntityForm'
import { EntityOverview } from '@components/Dashboard/Pages/Entities/EntityOverview'
import { EntityMembersPanel, personName } from '@components/Dashboard/Pages/Entities/EntityMembersPanel'
import { EntityGroupsPanel } from '@components/Dashboard/Pages/Entities/EntityGroupsPanel'
import { EntityLearningPanel } from '@components/Dashboard/Pages/Entities/EntityLearningPanel'
import { PositionsManager } from '@components/Dashboard/Pages/Entities/PositionsManager'
import { PageTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { getEntity } from '@services/administration/administration'
import { getInstructors } from '@services/instructors/instructors'
import { entityLogoUrl } from '../client'

type Tab = 'overview' | 'members' | 'groups' | 'positions' | 'instructors' | 'learning'

function EntityInstructors({ orgslug, entityUuid }: { orgslug: string; entityUuid: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'instructors'],
    queryFn: () => getInstructors(orgId, access_token, entityUuid),
    enabled: ready,
  })
  return (
    <DataTable
      headers={[t('instructors.title', 'Instructors'), t('administration.common.status', 'Status'), '']}
      empty={isLoading ? '…' : t('entities.no_instructors', 'No instructors linked to this entity.')}
    >
      {(instructors as any[]).map((i) => (
        <tr key={i.instructor_uuid}>
          <td className={tdCls}>{personName(i.user)}</td>
          <td className={tdCls}>
            <StatusPill status={i.status} label={String(t(`instructors.status_${i.status}`, i.status))} />
          </td>
          <td className={`${tdCls} text-end`}>
            <Link className="text-xs font-semibold underline" href={getUriWithOrg(orgslug, `/dash/instructors/${i.instructor_uuid}`)}>
              {t('entities.open', 'Open')}
            </Link>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

function EntityDetail({ orgslug, entityUuid }: { orgslug: string; entityUuid: string }) {
  const { t, i18n } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const { data: entity } = useQuery({
    queryKey: ['entities', entityUuid, 'detail'],
    queryFn: () => getEntity(entityUuid, access_token),
    enabled: ready,
  })

  if (!entity) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }
  const isArabic = (i18n.language || '').startsWith('ar')
  const name = (isArabic && entity.name_ar) || entity.name
  const logo = entityLogoUrl(org?.org_uuid, entity)

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.entities', 'Entities'), href: '/dash/administration/entities' }, { label: name }]}
      />
      <AcademicHeader
        title={name}
        subtitle={[entity.code, entity.parent_name].filter(Boolean).join(' · ')}
        action={
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />}
            <GhostButton onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
            </GhostButton>
          </div>
        }
      />
      <PageTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: t('entities.tab_overview', 'Overview') },
          { id: 'members', label: `${t('entities.members', 'Members')} (${entity.member_count})` },
          { id: 'groups', label: t('entities.groups', 'Groups') },
          { id: 'positions', label: t('entities.positions', 'Positions') },
          { id: 'instructors', label: t('instructors.title', 'Instructors') },
          { id: 'learning', label: t('entities.tab_learning', 'Available & assigned learning') },
        ]}
      />
      {tab === 'overview' && <EntityOverview key={entity.update_date} entity={entity} isAcademy />}
      {tab === 'members' && <EntityMembersPanel entityUuid={entityUuid} isAcademy canManage />}
      {tab === 'groups' && <EntityGroupsPanel entityUuid={entityUuid} canManage />}
      {tab === 'positions' && <PositionsManager entityUuid={entityUuid} />}
      {tab === 'instructors' && <EntityInstructors orgslug={orgslug} entityUuid={entityUuid} />}
      {tab === 'learning' && <EntityLearningPanel entityUuid={entityUuid} isAcademy canAssign={false} />}

      <Modal
        isDialogOpen={editOpen}
        onOpenChange={setEditOpen}
        minWidth="lg"
        dialogTitle={`${t('administration.common.edit', 'Edit')} ${entity.name}`}
        dialogContent={
          <EntityForm
            key={entity.update_date}
            entity={entity}
            onDone={() => {
              setEditOpen(false)
              queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

export default EntityDetail
