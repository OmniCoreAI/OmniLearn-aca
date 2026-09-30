'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, LayoutGrid, List, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Door } from '@phosphor-icons/react'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicPrimaryButton,
  AcademicGrid,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  useAdminContext,
  useConfirm,
  useLookupLabel,
  useStoredView,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { FACILITY_STATUSES, FacilityForm } from '@components/Dashboard/Pages/Administration/FacilityForm'
import { deleteFacility, getFacilities, updateFacility } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

export const facilityImageUrl = (orgUuid: string, f: any) =>
  f?.image ? getOrgContentUrl(orgUuid, `facilities/${f.facility_uuid}/images/${f.image}`) : null

const VIEW_KEY = 'admin-facilities-view'

function FacilitiesHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [location, setLocation] = useState('all')
  const [status, setStatus] = useState('all')
  const [view, changeView] = useStoredView<'table' | 'cards'>(VIEW_KEY, 'table')

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['administration', 'facilities', orgId],
    queryFn: () => getFacilities(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'facilities', orgId] })
  const openForm = (f: any) => {
    setEditing(f)
    setOpen(true)
  }

  const remove = async (f: any) => {
    const ok = await confirm({
      title: t('administration.facilities.delete_title', 'Delete {{name}}?', { name: f.name }),
      message: t(
        'administration.facilities.confirm_delete',
        'Delete this facility? Courses and sessions keep their text location.'
      ),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteFacility(f.facility_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const setFacilityStatus = async (rows: any[], next: string) => {
    try {
      await Promise.all(rows.map((f) => updateFacility(f.facility_uuid, { status: next }, access_token)))
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const f of facilities as any[]) if (f.facility_type) seen.set(f.facility_type.lookup_uuid, label(f.facility_type))
    return [...seen].map(([value, text]) => ({ value, label: text }))
  }, [facilities, label])
  const locationOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const f of facilities as any[]) if (f.location_uuid) seen.set(f.location_uuid, f.location_name || f.location_uuid)
    return [...seen].map(([value, text]) => ({ value, label: text }))
  }, [facilities])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (facilities as any[]).filter(
      (f) =>
        (type === 'all' || f.facility_type?.lookup_uuid === type) &&
        (location === 'all' || f.location_uuid === location) &&
        (status === 'all' || f.status === status) &&
        (!q ||
          f.name.toLowerCase().includes(q) ||
          (f.code || '').toLowerCase().includes(q) ||
          (f.location_name || '').toLowerCase().includes(q) ||
          (f.equipment || []).some((e: any) => (e.name || '').toLowerCase().includes(q)))
    )
  }, [facilities, query, type, location, status])
  const filtering = !!query || type !== 'all' || location !== 'all' || status !== 'all'

  const detailHref = (f: any) => getUriWithOrg(orgslug, `/dash/administration/facilities/${f.facility_uuid}`)
  const statusLabel = (st: string) => String(t(`administration.facilities.status_${st}`, st))
  const cost = (f: any) =>
    f.hourly_cost != null ? `${Number(f.hourly_cost).toLocaleString(i18n.language)} ${f.currency || ''}`.trim() : null

  const createButton = (
    <AcademicPrimaryButton onClick={() => openForm(null)}>
      <Plus className="h-4 w-4" /> {t('administration.facilities.new_facility', 'New facility')}
    </AcademicPrimaryButton>
  )
  const empty = (
    <AcademicEmptyState
      compact
      icon={<Door size={24} />}
      title={filtering ? t('administration.common.no_matches', 'No matches') : t('administration.facilities.none', 'No facilities yet')}
      description={
        filtering
          ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
          : t('administration.facilities.none_desc', 'Add rooms and halls once, then select them for any course, offering or session.')
      }
      action={filtering ? undefined : createButton}
    />
  )

  const toolbar = (
    <>
      <ToolbarSearch value={query} onChange={setQuery} placeholder={t('administration.facilities.search', 'Search by name, code or location')} />
      <ToolbarSelect
        label={t('administration.facilities.type', 'Type')}
        value={type}
        onChange={setType}
        options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...typeOptions]}
      />
      <ToolbarSelect
        label={t('administration.facilities.location', 'Location')}
        value={location}
        onChange={setLocation}
        options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...locationOptions]}
      />
      <ToolbarSelect
        label={t('administration.common.status', 'Status')}
        value={status}
        onChange={setStatus}
        options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...FACILITY_STATUSES.map((st) => ({ value: st, label: statusLabel(st) }))]}
      />
    </>
  )
  const viewToggle = (
    <div className={cn(TAB_TRACK, 'p-0.5 shadow-none')} role="tablist" aria-label={t('administration.common.view', 'View')}>
      <button type="button" role="tab" aria-selected={view === 'table'} aria-label={t('administration.common.view_table', 'Table')} onClick={() => changeView('table')} className={tabItemClass(view === 'table', 'px-2.5 py-1')}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" role="tab" aria-selected={view === 'cards'} aria-label={t('administration.common.view_cards', 'Cards')} onClick={() => changeView('cards')} className={tabItemClass(view === 'cards', 'px-2.5 py-1')}>
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.facilities', 'Facilities & Rooms') }]} />
      <AcademicHeader
        title={t('administration.nav.facilities', 'Facilities & Rooms')}
        subtitle={t('administration.facilities.subtitle', 'Rooms, halls and labs with capacity, equipment, availability and cost.')}
        action={createButton}
      />
      <FacilitiesTabs orgslug={orgslug} />

      {view === 'table' ? (
        <DashDataTable
          rows={visible}
          rowKey={(f: any) => f.facility_uuid}
          loading={isLoading}
          selectable
          rowHref={detailHref}
          initialSort={{ key: 'name', dir: 'asc' }}
          itemLabel={(n) => t('administration.facilities.count', '{{count}} facilities', { count: n })}
          toolbar={toolbar}
          toolbarEnd={viewToggle}
          empty={empty}
          bulkActions={(rows, clear) => (
            <>
              <GhostButton
                onClick={async () => {
                  await setFacilityStatus(rows, 'active')
                  clear()
                }}
              >
                <Power className="h-3.5 w-3.5" /> {t('administration.common.activate', 'Activate')}
              </GhostButton>
              <GhostButton
                onClick={async () => {
                  await setFacilityStatus(rows, 'inactive')
                  clear()
                }}
              >
                <Power className="h-3.5 w-3.5" /> {t('administration.common.deactivate', 'Deactivate')}
              </GhostButton>
            </>
          )}
          columns={[
            {
              key: 'name',
              header: t('administration.facilities.facility', 'Facility'),
              primary: true,
              sortValue: (f: any) => f.name,
              cell: (f: any) => {
                const img = facilityImageUrl(org?.org_uuid, f)
                return (
                  <div className="flex min-w-0 items-center gap-3">
                    {img ? (
                      <img src={img} alt="" className="h-9 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                        <Door size={17} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.name}</div>
                      <div className="truncate font-mono text-[11px] text-[hsl(var(--dash-muted))]">{f.code}</div>
                    </div>
                  </div>
                )
              },
            },
            {
              key: 'type',
              header: t('administration.facilities.type', 'Type'),
              sortValue: (f: any) => (f.facility_type ? label(f.facility_type) : null),
              cell: (f: any) => (f.facility_type ? <span className="whitespace-nowrap text-[13px]">{label(f.facility_type)}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
            },
            {
              key: 'capacity',
              header: t('administration.facilities.capacity_short', 'Capacity'),
              align: 'end',
              sortValue: (f: any) => f.capacity,
              cell: (f: any) => (f.capacity != null ? <span className="tabular-nums">{f.capacity}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
            },
            {
              key: 'location',
              header: t('administration.facilities.location', 'Location'),
              sortValue: (f: any) => f.location_name,
              cell: (f: any) => (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[13px]">{f.location_name || '—'}</div>
                  {f.floor || f.room_number ? (
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      {[f.floor && `${t('administration.facilities.floor', 'Floor')} ${f.floor}`, f.room_number && `#${f.room_number}`].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'equipment',
              header: t('administration.facilities.equipment_short', 'Equipment'),
              hideBelow: 'xl',
              hideOnMobile: true,
              cell: (f: any) => {
                const items = (f.equipment || []) as any[]
                if (!items.length) return <span className="text-[hsl(var(--dash-muted))]">—</span>
                return (
                  <div className="flex items-center gap-1">
                    {items.slice(0, 1).map((e) => (
                      <span key={e.lookup_uuid} className="whitespace-nowrap rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px]">
                        {label(e)}
                        {e.quantity > 1 ? ` ×${e.quantity}` : ''}
                      </span>
                    ))}
                    {items.length > 1 ? (
                      <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] text-[hsl(var(--dash-muted))]" title={items.slice(1).map((e) => label(e)).join(', ')}>
                        +{items.length - 1}
                      </span>
                    ) : null}
                  </div>
                )
              },
            },
            {
              key: 'cost',
              header: t('administration.facilities.hourly_cost', 'Hourly cost'),
              align: 'end',
              sortValue: (f: any) => f.hourly_cost,
              cell: (f: any) => (cost(f) ? <span className="whitespace-nowrap font-medium tabular-nums">{cost(f)}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
            },
            {
              key: 'status',
              header: t('administration.common.status', 'Status'),
              sortValue: (f: any) => f.status,
              cell: (f: any) => <StatusPill status={f.status} label={statusLabel(f.status)} />,
            },
          ]}
          actions={(f: any) => [
            { label: t('administration.common.view_details', 'View details'), icon: <Eye className="h-3.5 w-3.5" />, href: detailHref(f) },
            { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(f) },
            {
              label: f.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
              icon: <Power className="h-3.5 w-3.5" />,
              onSelect: () => setFacilityStatus([f], f.status === 'active' ? 'inactive' : 'active'),
            },
            { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(f) },
          ]}
        />
      ) : (
        <>
          <div className="dash-card mb-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
            <span className="text-[12px] text-[hsl(var(--dash-muted))]">
              {t('administration.facilities.count', '{{count}} facilities', { count: visible.length })}
            </span>
            {viewToggle}
          </div>
          {isLoading ? null : visible.length === 0 ? (
            <div className="dash-card rounded-[1.25rem] px-6 py-14">{empty}</div>
          ) : (
            <AcademicGrid>
              {visible.map((f) => (
                <AcademicCard
                  key={f.facility_uuid}
                  orgslug={orgslug}
                  href={`/dash/administration/facilities/${f.facility_uuid}`}
                  title={f.name}
                  subtitle={[f.facility_type ? label(f.facility_type) : null, f.location_name].filter(Boolean).join(' · ')}
                  thumbnailUrl={facilityImageUrl(org?.org_uuid, f)}
                  badges={[
                    ...(f.capacity != null ? [{ label: `${f.capacity} ${t('administration.facilities.people', 'people')}` }] : []),
                    { label: statusLabel(f.status) },
                  ]}
                  footerLabel={cost(f) ? `${cost(f)} / ${t('instructors.per_hour', 'h')}` : undefined}
                  onEdit={() => openForm(f)}
                  onDelete={() => remove(f)}
                />
              ))}
            </AcademicGrid>
          )}
        </>
      )}

      <AdminDrawer
        open={open}
        onOpenChange={setOpen}
        width="sm:max-w-[640px]"
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.facilities.new_facility', 'New facility')}
        description={t('administration.facilities.form_desc', 'Rooms are picked from lists when scheduling courses, offerings and sessions.')}
      >
        {open ? (
          <FacilityForm
            facility={editing}
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

export default FacilitiesHome
