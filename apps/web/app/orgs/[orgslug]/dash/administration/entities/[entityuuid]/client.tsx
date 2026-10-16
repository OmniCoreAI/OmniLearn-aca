'use client'
import React, { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Buildings } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable from '@components/Dashboard/Shared/DataTable/DashDataTable'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  PersonAvatar,
  useAdminContext,
  useLookupLabel,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntityForm } from '@components/Dashboard/Pages/Entities/EntityForm'
import { EntityOverview } from '@components/Dashboard/Pages/Entities/EntityOverview'
import { EntityMembersPanel, personName } from '@components/Dashboard/Pages/Entities/EntityMembersPanel'
import { EntityGroupsPanel } from '@components/Dashboard/Pages/Entities/EntityGroupsPanel'
import { EntityLearningPanel } from '@components/Dashboard/Pages/Entities/EntityLearningPanel'
import { PositionsManager } from '@components/Dashboard/Pages/Entities/PositionsManager'
import { UserImportWizard } from '@components/Dashboard/Pages/Entities/UserImportWizard'
import { EntityProgressPanel } from '@components/Dashboard/Pages/Entities/EntityProgressPanel'
import { PageTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { getEntity } from '@services/administration/administration'
import { getInstructorImageUrl, getInstructors } from '@services/instructors/instructors'
import { entityLogoUrl } from '../client'

type Tab = 'overview' | 'members' | 'groups' | 'positions' | 'instructors' | 'learning' | 'progress' | 'imports'

function EntityInstructors({ orgslug, entityUuid }: { orgslug: string; entityUuid: string }) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'instructors'],
    queryFn: () => getInstructors(orgId, access_token, entityUuid),
    enabled: ready,
  })
  return (
    <DashDataTable
      rows={instructors as any[]}
      rowKey={(i: any) => i.instructor_uuid}
      loading={isLoading}
      rowHref={(i: any) => getUriWithOrg(orgslug, `/dash/instructors/${i.instructor_uuid}`)}
      itemLabel={(n) => t('instructors.count', '{{count}} instructors', { count: n })}
      empty={
        <AcademicEmptyState
          compact
          title={t('entities.no_instructors', 'No instructors linked to this entity.')}
          description={t('entities.no_instructors_hint', 'Instructors from this entity appear here once their profile is linked to it.')}
        />
      }
      columns={[
        {
          key: 'name',
          header: t('instructors.instructor', 'Instructor'),
          primary: true,
          sortValue: (i: any) => personName(i.user),
          cell: (i: any) => (
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar name={personName(i.user)} src={getInstructorImageUrl(org?.org_uuid, i)} size={32} />
              <span className="truncate font-medium">{personName(i.user)}</span>
            </div>
          ),
        },
        { key: 'category', header: t('instructors.category', 'Category'), cell: (i: any) => i.category?.name || '—' },
        {
          key: 'status',
          header: t('administration.common.status', 'Status'),
          cell: (i: any) => <StatusPill status={i.status} label={String(t(`instructors.status_${i.status}`, i.status))} />,
        },
      ]}
    />
  )
}

const TABS: Tab[] = ['overview', 'members', 'groups', 'learning', 'positions', 'instructors', 'progress', 'imports']

function EntityDetail({ orgslug, entityUuid }: { orgslug: string; entityUuid: string }) {
  const { t, i18n } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const label = useLookupLabel()
  const [editOpen, setEditOpen] = useState(false)
  const tab: Tab = (TABS as string[]).includes(searchParams.get('tab') || '') ? (searchParams.get('tab') as Tab) : 'overview'
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }
  const { data: entity } = useQuery({
    queryKey: ['entities', entityUuid, 'detail'],
    queryFn: () => getEntity(entityUuid, access_token),
    enabled: ready,
  })

  if (!entity) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer mb-4 h-8 w-64 rounded-full" />
        <div className="dash-shimmer mb-6 h-28 rounded-[1.25rem]" />
        <div className="dash-shimmer h-64 rounded-[1.25rem]" />
      </AcademicPageShell>
    )
  }
  const isArabic = (i18n.language || '').startsWith('ar')
  const name = (isArabic && entity.name_ar) || entity.name
  const logo = entityLogoUrl(org?.org_uuid, entity)
  const stats = [
    { key: 'members', label: t('entities.users', 'Users'), value: entity.member_count },
    { key: 'groups', label: t('entities.groups', 'Groups'), value: entity.group_count },
    { key: 'learning', label: t('entities.courses', 'Courses'), value: entity.learning_count ?? 0 },
  ]

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.entities', 'Entities'), href: '/dash/administration/entities' }, { label: name }]}
      />

      <section className="dash-card mb-5 flex flex-col gap-4 rounded-[1.25rem] p-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1 ring-1 ring-[hsl(var(--dash-border))]" />
          ) : (
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
              <Buildings size={28} />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{name}</h1>
              <StatusPill status={entity.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
              <span className="font-mono">{entity.code}</span>
              {entity.entity_type ? <span>{label(entity.entity_type)}</span> : null}
              {entity.parent_name ? <span>{t('entities.part_of', 'Part of')} {entity.parent_name}</span> : null}
              {entity.city ? <span>{[entity.city, entity.country].filter(Boolean).join(', ')}</span> : null}
            </div>
          </div>
        </div>
        <dl className="flex gap-2">
          {stats.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key as Tab)}
              className="min-w-[84px] rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]"
            >
              <dt className="text-[11px] font-medium text-[hsl(var(--dash-muted))]">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{s.value}</dd>
            </button>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 lg:self-center"
        >
          <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
        </button>
      </section>

      <PageTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: t('entities.tab_overview', 'Overview') },
          { id: 'members', label: t('entities.tab_users', 'Users ({{count}})', { count: entity.member_count }) },
          { id: 'groups', label: t('entities.tab_groups', 'User groups') },
          { id: 'learning', label: t('entities.tab_courses', 'Courses') },
          { id: 'positions', label: t('entities.positions', 'Positions') },
          { id: 'instructors', label: t('instructors.title', 'Instructors') },
          { id: 'progress', label: t('entities.tab_activity', 'Progress & activity') },
          { id: 'imports', label: t('entities.tab_imports', 'Imports') },
        ]}
      />
      {tab === 'overview' && <EntityOverview key={entity.update_date} entity={entity} isAcademy />}
      {tab === 'members' && <EntityMembersPanel entityUuid={entityUuid} isAcademy canManage />}
      {tab === 'groups' && <EntityGroupsPanel entityUuid={entityUuid} canManage />}
      {tab === 'positions' && <PositionsManager entityUuid={entityUuid} />}
      {tab === 'instructors' && <EntityInstructors orgslug={orgslug} entityUuid={entityUuid} />}
      {tab === 'learning' && <EntityLearningPanel entityUuid={entityUuid} isAcademy canAssign={false} />}
      {tab === 'progress' && <EntityProgressPanel entityUuid={entityUuid} />}
      {tab === 'imports' && <UserImportWizard entityUuid={entityUuid} />}

      <AdminDrawer
        icon={<Buildings size={20} weight="duotone" />}
        open={editOpen}
        onOpenChange={setEditOpen}
        width="sm:max-w-[640px]"
        title={`${t('administration.common.edit', 'Edit')} ${entity.name}`}
        description={t('entities.form_desc', 'Its people can then be grouped, assigned training and followed by a coordinator.')}
      >
        {editOpen ? (
          <EntityForm
            key={entity.update_date}
            entity={entity}
            onCancel={() => setEditOpen(false)}
            onDone={() => {
              setEditOpen(false)
              queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
              queryClient.invalidateQueries({ queryKey: ['administration', 'entities'] })
            }}
          />
        ) : null}
      </AdminDrawer>
    </AcademicPageShell>
  )
}

export default EntityDetail
