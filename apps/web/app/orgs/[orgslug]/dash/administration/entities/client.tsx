'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Buildings } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  useAdminContext,
  useConfirm,
  useLookupLabel,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntitiesTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { EntityForm } from '@components/Dashboard/Pages/Entities/EntityForm'
import { deleteEntity, getEntities, updateEntity } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'

export const entityLogoUrl = (orgUuid: string, e: any) =>
  e?.logo ? getOrgContentUrl(orgUuid, `entities/${e.entity_uuid}/logo/${e.logo}`) : null

const personName = (u: any) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.username || ''

function EntitiesHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const { confirm, dialog } = useConfirm()
  const isArabic = (i18n.language || '').startsWith('ar')
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['administration', 'entities', orgId],
    queryFn: () => getEntities(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'entities', orgId] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'entity-options', orgId] })
  }
  const openForm = (e: any) => {
    setEditing(e)
    setOpen(true)
  }
  const displayName = (e: any) => (isArabic && e.name_ar) || e.name

  const remove = async (e: any) => {
    const ok = await confirm({
      title: t('entities.delete_title', 'Delete {{name}}?', { name: displayName(e) }),
      message: t(
        'entities.confirm_delete',
        'Delete this entity? Members keep their accounts; its automatic groups and assignments are removed.'
      ),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteEntity(e.entity_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const setEntityStatus = async (rows: any[], next: string) => {
    try {
      await Promise.all(rows.map((e) => updateEntity(e.entity_uuid, { status: next }, access_token)))
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of entities as any[]) if (e.entity_type) seen.set(e.entity_type.lookup_uuid, label(e.entity_type))
    return [...seen].map(([value, text]) => ({ value, label: text }))
  }, [entities, label])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (entities as any[]).filter(
      (e) =>
        (type === 'all' || e.entity_type?.lookup_uuid === type) &&
        (status === 'all' || e.status === status) &&
        (!q || `${e.name} ${e.name_ar || ''} ${e.code} ${e.city || ''}`.toLowerCase().includes(q))
    )
  }, [entities, query, type, status])
  const filtering = !!query || type !== 'all' || status !== 'all'
  const detailHref = (e: any) => getUriWithOrg(orgslug, `/dash/administration/entities/${e.entity_uuid}`)

  const createButton = (
    <AcademicPrimaryButton onClick={() => openForm(null)}>
      <Plus className="h-4 w-4" /> {t('entities.new_entity', 'New organization')}
    </AcademicPrimaryButton>
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.entities', 'Organizations') }]} />
      <AcademicHeader
        title={t('administration.nav.entities', 'Organizations')}
        subtitle={t('entities.subtitle', 'Ministries, universities and companies the academy trains for — with their members, groups and coordinators.')}
        action={createButton}
      />
      <EntitiesTabs orgslug={orgslug} />
      <DashDataTable
        rows={visible}
        rowKey={(e: any) => e.entity_uuid}
        loading={isLoading}
        selectable
        rowHref={detailHref}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('entities.count', '{{count}} organizations', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('entities.search', 'Search by name or code')} />
            <ToolbarSelect
              label={t('entities.type_short', 'Type')}
              value={type}
              onChange={setType}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...typeOptions]}
            />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: t('academic.state_active', 'Active') },
                { value: 'inactive', label: t('administration.common.status_inactive', 'Inactive') },
              ]}
            />
          </>
        }
        bulkActions={(rows, clear) => (
          <>
            <GhostButton
              onClick={async () => {
                await setEntityStatus(rows, 'active')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.activate', 'Activate')}
            </GhostButton>
            <GhostButton
              onClick={async () => {
                await setEntityStatus(rows, 'inactive')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.deactivate', 'Deactivate')}
            </GhostButton>
          </>
        )}
        empty={
          <AcademicEmptyState
            compact
            icon={<Buildings size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('entities.none', 'No organizations yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('entities.none_desc', 'Create an organization, give it a coordinator, then make training available to its people.')
            }
            action={filtering ? undefined : createButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('entities.organization', 'Organization'),
            primary: true,
            sortValue: (e: any) => displayName(e),
            cell: (e: any) => {
              const logo = entityLogoUrl(org?.org_uuid, e)
              return (
                <div className="flex min-w-0 items-center gap-3">
                  {logo ? (
                    <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-[hsl(var(--dash-border))]" />
                  ) : (
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                      <Buildings size={17} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{displayName(e)}</div>
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      <span className="font-mono">{e.code}</span>
                      {e.parent_name ? ` · ${t('entities.part_of', 'Part of')} ${e.parent_name}` : e.city ? ` · ${e.city}` : ''}
                    </div>
                  </div>
                </div>
              )
            },
          },
          {
            key: 'type',
            header: t('entities.type_short', 'Type'),
            sortValue: (e: any) => (e.entity_type ? label(e.entity_type) : null),
            cell: (e: any) => (e.entity_type ? <span className="whitespace-nowrap text-[13px]">{label(e.entity_type)}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
          },
          {
            key: 'members',
            header: t('entities.users', 'Users'),
            align: 'end',
            sortValue: (e: any) => e.member_count,
            cell: (e: any) => <span className="tabular-nums">{e.member_count}</span>,
          },
          {
            key: 'groups',
            header: t('entities.groups', 'Groups'),
            align: 'end',
            sortValue: (e: any) => e.group_count,
            cell: (e: any) => <span className="tabular-nums">{e.group_count}</span>,
          },
          {
            key: 'courses',
            header: t('entities.courses', 'Courses'),
            align: 'end',
            sortValue: (e: any) => e.learning_count ?? 0,
            cell: (e: any) => <span className="tabular-nums">{e.learning_count ?? 0}</span>,
          },
          {
            key: 'coordinator',
            header: t('entities.coordinator', 'Coordinator'),
            hideBelow: 'lg',
            hideOnMobile: true,
            cell: (e: any) =>
              e.coordinators?.length ? (
                <span className="truncate text-[13px]">
                  {personName(e.coordinators[0])}
                  {e.coordinators.length > 1 ? <span className="text-[hsl(var(--dash-muted))]"> +{e.coordinators.length - 1}</span> : null}
                </span>
              ) : (
                <span className="text-[12px] text-[hsl(var(--dash-muted))]">{t('entities.no_coordinators_short', 'Not assigned')}</span>
              ),
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (e: any) => e.status,
            cell: (e: any) => <StatusPill status={e.status} />,
          },
        ]}
        actions={(e: any) => [
          { label: t('administration.common.view_details', 'View details'), icon: <Eye className="h-3.5 w-3.5" />, href: detailHref(e) },
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(e) },
          {
            label: e.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
            icon: <Power className="h-3.5 w-3.5" />,
            onSelect: () => setEntityStatus([e], e.status === 'active' ? 'inactive' : 'active'),
          },
          { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(e) },
        ]}
      />

      <AdminDrawer
        open={open}
        onOpenChange={setOpen}
        width="sm:max-w-[640px]"
        title={editing ? `${t('administration.common.edit', 'Edit')} ${displayName(editing)}` : t('entities.new_entity', 'New organization')}
        description={t('entities.form_desc', 'Its people can then be grouped, assigned training and followed by a coordinator.')}
      >
        {open ? (
          <EntityForm
            key={editing?.entity_uuid || 'new'}
            entity={editing}
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

export default EntitiesHome
