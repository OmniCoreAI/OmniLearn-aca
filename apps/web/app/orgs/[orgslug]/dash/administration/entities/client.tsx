'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicPrimaryButton,
  AcademicGrid,
  AcademicGridSkeleton,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, SearchBox, useAdminContext, useLookupLabel } from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntitiesTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { EntityForm } from '@components/Dashboard/Pages/Entities/EntityForm'
import { deleteEntity, getEntities } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'

export const entityLogoUrl = (orgUuid: string, e: any) =>
  e?.logo ? getOrgContentUrl(orgUuid, `entities/${e.entity_uuid}/logo/${e.logo}`) : null

function EntitiesHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const isArabic = (i18n.language || '').startsWith('ar')
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['administration', 'entities', orgId],
    queryFn: () => getEntities(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'entities', orgId] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'entity-options', orgId] })
  }

  const remove = async (e: any) => {
    if (!window.confirm(t('entities.confirm_delete', 'Delete this entity? Members keep their accounts; its automatic groups and assignments are removed.'))) return
    try {
      await deleteEntity(e.entity_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  const q = query.trim().toLowerCase()
  const visible = (entities as any[]).filter(
    (e) => !q || `${e.name} ${e.name_ar || ''} ${e.code}`.toLowerCase().includes(q)
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.entities', 'Entities') }]} />
      <AcademicHeader
        title={t('administration.nav.entities', 'Entities')}
        subtitle={t('entities.subtitle', 'Ministries, universities and companies the academy trains for — with their members, groups and coordinators.')}
        action={
          <AcademicPrimaryButton onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" /> {t('entities.new_entity', 'New entity')}
          </AcademicPrimaryButton>
        }
      />
      <EntitiesTabs orgslug={orgslug} />
      <SearchBox value={query} onChange={setQuery} placeholder={t('entities.search', 'Search by name or code')} />

      {isLoading && <AcademicGridSkeleton />}
      <AcademicGrid>
        {!isLoading && visible.length === 0 && (
          <AcademicEmptyState
            title={t('entities.none', 'No entities yet')}
            description={t('entities.none_desc', 'Create an entity, give it a coordinator, then make training available to it.')}
          />
        )}
        {visible.map((e) => (
          <AcademicCard
            key={e.entity_uuid}
            orgslug={orgslug}
            href={`/dash/administration/entities/${e.entity_uuid}`}
            title={(isArabic && e.name_ar) || e.name}
            subtitle={[e.entity_type ? label(e.entity_type) : null, e.parent_name].filter(Boolean).join(' · ')}
            thumbnailUrl={entityLogoUrl(org?.org_uuid, e)}
            badges={[
              { label: `${e.member_count} ${t('entities.members_short', 'members')}`, className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]' },
              { label: `${e.group_count} ${t('entities.groups_short', 'groups')}`, className: 'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]' },
              ...(e.status !== 'active'
                ? [{ label: String(t(`administration.common.status_${e.status}`, e.status)), className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]' }]
                : []),
            ]}
            footerLabel={
              e.coordinators?.length
                ? `${t('entities.coordinator', 'Coordinator')}: ${e.coordinators.map((c: any) => `${c.first_name} ${c.last_name}`.trim() || c.username).join(', ')}`
                : String(t('entities.no_coordinators', 'No coordinator yet.'))
            }
            onEdit={() => { setEditing(e); setOpen(true) }}
            onDelete={() => remove(e)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="lg"
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('entities.new_entity', 'New entity')}
        dialogContent={
          <EntityForm
            key={editing?.entity_uuid || 'new'}
            entity={editing}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

export default EntitiesHome
