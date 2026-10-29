'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, Eye, Landmark, Layers, Pencil, PencilRuler, Plus, RotateCcw, Save } from 'lucide-react'
import { Buildings } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, AdminDrawer, useAdminContext, useConfirm, useLookupOptions } from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import {
  createLocation,
  getFacilities,
  getFloorPlan,
  getLocations,
  saveFloorPlan,
  updateLocation,
} from '@services/administration/administration'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import FloorPlanEditor, { type UnplacedFacility } from './FloorPlanEditor'
import FloorPlanView from './FloorPlanView'
import { emptyPlan } from './geometry'
import { RoomDetails, todayStr, nowTime, useRoomOccupancy } from './occupancy'

type LocationNode = any & { children: LocationNode[] }

export default function FloorPlansWorkspace({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm, dialog } = useConfirm()
  const equipmentOptions = useLookupOptions('equipment')
  const typeOptions = useLookupOptions('facility_type')
  const locationTypes = useLookupOptions('location_type')

  /* ---------- data ---------- */
  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['administration', 'locations', orgId],
    queryFn: () => getLocations(orgId, access_token),
    enabled: ready,
  })
  const { data: facilities = [] } = useQuery({
    queryKey: ['administration', 'facilities', orgId],
    queryFn: () => getFacilities(orgId, access_token),
    enabled: ready,
  })
  const all = locations as any[]

  const tree = useMemo(() => {
    const byUuid = new Map<string, LocationNode>(all.map((l) => [l.location_uuid, { ...l, children: [] }]))
    const roots: LocationNode[] = []
    for (const node of byUuid.values()) {
      const parent = node.parent_uuid ? byUuid.get(node.parent_uuid) : null
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return roots
  }, [all])

  // Depth-first order for the compact picker shown when there is no room for the tree.
  const flat = useMemo(() => {
    const out: { node: LocationNode; depth: number }[] = []
    const walk = (nodes: LocationNode[], depth: number) =>
      nodes.forEach((node) => {
        out.push({ node, depth })
        walk(node.children, depth + 1)
      })
    walk(tree, 0)
    return out
  }, [tree])

  const requested = searchParams.get('building')
  const selectedUuid = useMemo(() => {
    if (requested && all.some((l) => l.location_uuid === requested)) return requested
    const drawn = all.find((l) => l.floor_count > 0)
    const building = all.find((l) => l.location_type?.code === 'BUILDING')
    return (drawn || building || all[0])?.location_uuid || null
  }, [requested, all])
  const selected = all.find((l) => l.location_uuid === selectedUuid) || null

  const planKey = ['administration', 'floor-plan', selectedUuid]
  const { data: planData, dataUpdatedAt } = useQuery({
    queryKey: planKey,
    queryFn: () => getFloorPlan(selectedUuid as string, access_token),
    enabled: ready && !!selectedUuid,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  /* ---------- draft ---------- */
  const [draft, setDraft] = useState<any>(null)
  const [dirty, setDirty] = useState(false)
  const [version, setVersion] = useState(0)
  const [floorIdx, setFloorIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const loadedFor = useRef<string | null>(null)
  const [loadedUuid, setLoadedUuid] = useState<string | null>(null)
  const resetDraft = (plan: any) => {
    setDraft(plan || emptyPlan(tr('ground_floor', 'Ground floor')))
    setDirty(false)
    setVersion((v) => v + 1)
  }
  useEffect(() => {
    if (!planData || planData.location_uuid !== selectedUuid) return
    // A background refetch must not throw away unsaved edits of the same building.
    if (dirty && loadedFor.current === selectedUuid) return
    if (loadedFor.current !== selectedUuid) setFloorIdx(0)
    loadedFor.current = selectedUuid
    setLoadedUuid(selectedUuid)
    resetDraft(planData.plan)
  }, [planData, dataUpdatedAt, selectedUuid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const askDiscard = async () =>
    !dirty ||
    (await confirm({
      title: tr('unsaved_title', 'Discard unsaved changes?'),
      message: tr('unsaved_message', 'Your changes to this floor plan have not been saved.'),
      confirmText: tr('discard', 'Discard'),
    }))

  const selectLocation = async (uuid: string) => {
    if (uuid === selectedUuid || !(await askDiscard())) return
    setDirty(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set('building', uuid)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const save = async () => {
    if (!selectedUuid || !draft) return
    setSaving(true)
    try {
      const res = await saveFloorPlan(selectedUuid, draft, access_token)
      queryClient.setQueryData(planKey, { location_uuid: res.location_uuid, plan: res.plan })
      loadedFor.current = selectedUuid
      resetDraft(res.plan)
      toast.success(
        res.created || res.updated
          ? tr('saved_summary', 'Floor plan saved · {{created}} rooms created, {{updated}} updated', { created: res.created, updated: res.updated })
          : tr('saved', 'Floor plan saved')
      )
      queryClient.invalidateQueries({ queryKey: ['administration', 'facilities', orgId] })
      queryClient.invalidateQueries({ queryKey: ['administration', 'locations', orgId] })
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  const discard = async () => {
    if (await askDiscard()) resetDraft(planData?.plan)
  }

  /* ---------- rooms that can still be placed ---------- */
  const unplaced = useMemo<UnplacedFacility[]>(() => {
    if (!draft || !selectedUuid) return []
    const placed = new Set<string>(draft.floors.flatMap((f: any) => f.rooms.map((r: any) => r.facility_uuid).filter(Boolean)))
    return (facilities as any[])
      .filter((f) => !placed.has(f.facility_uuid) && (f.location_uuid === selectedUuid || !f.location_uuid))
      .sort((a, b) => Number(!!b.location_uuid) - Number(!!a.location_uuid) || a.name.localeCompare(b.name))
  }, [facilities, draft, selectedUuid])

  /* ---------- live view ---------- */
  const [mode, setMode] = useState<'design' | 'live'>('design')
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState(nowTime)
  const [picked, setPicked] = useState<{ room: any; floor: any } | null>(null)
  const { statusOf: liveStatus, bookingsFor } = useRoomOccupancy(date, time, mode === 'live')

  /* ---------- location drawer ---------- */
  const [drawer, setDrawer] = useState<{ location?: any; parent?: any; typeCode?: string } | null>(null)
  const typeUuid = (code: string) => locationTypes.find((o) => o.code === code)?.lookup_uuid || ''

  const facilityHref = (uuid: string) => getUriWithOrg(orgslug, `/dash/administration/facilities/${uuid}`)

  /* ---------- render ---------- */
  const addCampus = (
    <AcademicPrimaryButton onClick={() => setDrawer({ typeCode: 'CAMPUS' })}>
      <Plus className="h-4 w-4" /> {tr('new_campus', 'New campus')}
    </AcademicPrimaryButton>
  )

  const renderNode = (node: LocationNode, depth: number): React.ReactNode => {
    const active = node.location_uuid === selectedUuid
    const isCampus = !node.parent_uuid && node.children.length > 0
    const Icon = isCampus || node.location_type?.code === 'CAMPUS' ? Landmark : Building2
    return (
      <li key={node.location_uuid}>
        <div
          className={cn(
            'group flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors',
            active ? 'bg-[hsl(var(--dash-accent-soft))] ring-1 ring-[hsl(var(--dash-accent))]/30' : 'hover:bg-[hsl(var(--dash-canvas))]'
          )}
          style={{ paddingInlineStart: 10 + depth * 16 }}
        >
          <button type="button" onClick={() => selectLocation(node.location_uuid)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
            <span
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-[hsl(var(--dash-accent))] text-[hsl(var(--dash-ink))]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{node.name}</span>
              <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
                {[node.location_type?.name, node.floor_count ? tr('n_floors', '{{count}} floors', { count: node.floor_count }) : null, tr('n_rooms', '{{count}} rooms', { count: node.facility_count })]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </button>
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {depth < 2 ? (
              <button
                type="button"
                title={tr('add_building_in', 'Add a building inside {{name}}', { name: node.name })}
                aria-label={tr('add_building_in', 'Add a building inside {{name}}', { name: node.name })}
                onClick={() => setDrawer({ parent: node, typeCode: 'BUILDING' })}
                className="rounded-md p-1 text-[hsl(var(--dash-muted))] hover:bg-white hover:text-[hsl(var(--dash-ink))]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              title={t('administration.common.edit', 'Edit')}
              aria-label={t('administration.common.edit', 'Edit')}
              onClick={() => setDrawer({ location: node })}
              className="rounded-md p-1 text-[hsl(var(--dash-muted))] hover:bg-white hover:text-[hsl(var(--dash-ink))]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        {node.children.length ? <ul className="mt-0.5 space-y-0.5">{node.children.map((c: LocationNode) => renderNode(c, depth + 1))}</ul> : null}
      </li>
    )
  }

  const modeToggle = (
    <div className={cn(TAB_TRACK, 'p-0.5 shadow-none')} role="tablist" aria-label={tr('mode', 'Mode')}>
      <button type="button" role="tab" aria-selected={mode === 'design'} onClick={() => setMode('design')} className={tabItemClass(mode === 'design', 'inline-flex items-center gap-1.5 px-3 py-1')}>
        <PencilRuler className="h-3.5 w-3.5" /> {tr('design', 'Design')}
      </button>
      <button type="button" role="tab" aria-selected={mode === 'live'} onClick={() => setMode('live')} className={tabItemClass(mode === 'live', 'inline-flex items-center gap-1.5 px-3 py-1')}>
        <Eye className="h-3.5 w-3.5" /> {tr('live', 'Live view')}
      </button>
    </div>
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' },
          { label: tr('title', 'Floor plans') },
        ]}
      />
      <AcademicHeader
        title={tr('title', 'Floor plans')}
        subtitle={tr('subtitle', 'Draw each building floor by floor. Rooms you add become facilities that can be booked and scheduled.')}
        action={addCampus}
      />
      <FacilitiesTabs orgslug={orgslug} />

      {!loadingLocations && !all.length ? (
        <div className="dash-card rounded-[1.25rem] px-6 py-14">
          <AcademicEmptyState
            compact
            icon={<Buildings size={24} />}
            title={tr('empty_title', 'Start with a campus')}
            description={tr('empty_desc', 'Add a campus, add its buildings, then draw each building’s floors and rooms.')}
            action={addCampus}
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 2xl:grid-cols-[250px_minmax(0,1fr)]">
          {/* campuses & buildings */}
          <aside className="dash-card hidden rounded-[1.25rem] p-3 2xl:sticky 2xl:top-4 2xl:block">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">{tr('campuses_buildings', 'Campuses & buildings')}</h2>
            </div>
            <ul className="space-y-0.5">{tree.map((n) => renderNode(n, 0))}</ul>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[hsl(var(--dash-border))] px-1 pt-3">
              <GhostButton onClick={() => setDrawer({ typeCode: 'CAMPUS' })}>
                <Landmark className="h-3.5 w-3.5" /> {tr('campus', 'Campus')}
              </GhostButton>
              <GhostButton onClick={() => setDrawer({ parent: selected && !selected.parent_uuid ? selected : undefined, typeCode: 'BUILDING' })}>
                <Building2 className="h-3.5 w-3.5" /> {tr('building', 'Building')}
              </GhostButton>
            </div>
          </aside>

          {/* plan */}
          <section className="min-w-0">
            {selected ? (
              <div className="dash-card mb-4 flex flex-wrap items-center gap-3 rounded-[1.25rem] px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
                  <Layers className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="hidden truncate text-[15px] font-semibold 2xl:block">{selected.name}</h2>
                    <select
                      className={cn(inputCls, 'h-8 w-auto max-w-[260px] rounded-full py-0 text-[13px] font-semibold 2xl:hidden')}
                      value={selectedUuid || ''}
                      onChange={(e) => selectLocation(e.target.value)}
                      aria-label={tr('campuses_buildings', 'Campuses & buildings')}
                    >
                      {flat.map(({ node, depth }) => (
                        <option key={node.location_uuid} value={node.location_uuid}>
                          {'\u00a0\u00a0\u00a0'.repeat(depth)}
                          {node.name}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center gap-0.5 2xl:hidden">
                      <button
                        type="button"
                        title={tr('new_campus', 'New campus')}
                        aria-label={tr('new_campus', 'New campus')}
                        onClick={() => setDrawer({ typeCode: 'CAMPUS' })}
                        className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
                      >
                        <Landmark className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={tr('new_building', 'New building')}
                        aria-label={tr('new_building', 'New building')}
                        onClick={() => setDrawer({ parent: selected.parent_uuid ? all.find((l) => l.location_uuid === selected.parent_uuid) : selected, typeCode: 'BUILDING' })}
                        className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={t('administration.common.edit', 'Edit')}
                        aria-label={t('administration.common.edit', 'Edit')}
                        onClick={() => setDrawer({ location: selected })}
                        className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    {selected.status !== 'active' ? <StatusPill status={selected.status} /> : null}
                    {dirty ? (
                      <span className="rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-accent))]">
                        {tr('unsaved', 'Unsaved changes')}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">
                    {[selected.parent_name, selected.location_type?.name, [selected.address, selected.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ') ||
                      tr('no_details', 'No address yet')}
                  </p>
                </div>
                {modeToggle}
                {mode === 'design' ? (
                  <div className="flex items-center gap-2">
                    <GhostButton onClick={discard} disabled={!dirty || saving}>
                      <RotateCcw className="h-3.5 w-3.5" /> {tr('discard', 'Discard')}
                    </GhostButton>
                    <AcademicPrimaryButton onClick={save} disabled={!dirty || saving} className="disabled:opacity-50 disabled:shadow-none">
                      <Save className="h-4 w-4" /> {saving ? t('administration.common.saving', 'Saving…') : tr('save', 'Save plan')}
                    </AcademicPrimaryButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[12px]">
                    <input type="date" className={cn(inputCls, 'h-8 w-auto rounded-full py-0')} value={date} onChange={(e) => setDate(e.target.value || todayStr())} aria-label={tr('date', 'Date')} />
                    <input type="time" step={1800} className={cn(inputCls, 'h-8 w-auto rounded-full py-0')} value={time} onChange={(e) => setTime(e.target.value || '09:00')} aria-label={tr('time', 'Time')} />
                  </div>
                )}
              </div>
            ) : null}

            {!selected || !draft || loadedUuid !== selectedUuid ? (
              <div className="dash-card dash-shimmer h-[520px] rounded-[1.25rem]" />
            ) : mode === 'design' ? (
              <div className="dash-card rounded-[1.25rem] p-3 sm:p-4">
                <FloorPlanEditor
                  key={`${selectedUuid}:${version}`}
                  value={draft}
                  onChange={(next) => {
                    setDraft(next)
                    setDirty(true)
                  }}
                  floorIdx={floorIdx}
                  onFloorIdxChange={setFloorIdx}
                  equipmentOptions={equipmentOptions}
                  typeOptions={typeOptions}
                  unplaced={unplaced}
                  facilityHref={facilityHref}
                  equipmentHref={getUriWithOrg(orgslug, '/dash/administration/facilities/equipment')}
                />
              </div>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="dash-card min-w-0 rounded-[1.25rem] p-3 sm:p-4">
                  <FloorPlanView
                    plan={draft}
                    getStatus={liveStatus}
                    selectedRoomId={picked?.room.id ?? null}
                    onRoomSelect={(room, floor) => setPicked({ room, floor })}
                    onFloorChange={() => setPicked(null)}
                  />
                </div>
                <aside className="dash-card rounded-[1.25rem] p-4 text-[13px] lg:sticky lg:top-4">
                  <RoomDetails orgslug={orgslug} picked={picked} status={picked ? liveStatus(picked.room) : null} time={time} bookings={bookingsFor(picked?.room)} />
                </aside>
              </div>
            )}
          </section>
        </div>
      )}

      <AdminDrawer
        icon={<Buildings size={20} weight="duotone" />}
        open={!!drawer}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
        title={
          drawer?.location
            ? `${t('administration.common.edit', 'Edit')} ${drawer.location.name}`
            : drawer?.typeCode === 'CAMPUS'
              ? tr('new_campus', 'New campus')
              : tr('new_building', 'New building')
        }
        description={tr('location_drawer_desc', 'Campuses hold buildings; each building gets its own floor plan.')}
      >
        {drawer ? (
          <PlaceForm
            key={drawer.location?.location_uuid || `${drawer.typeCode}-${drawer.parent?.location_uuid || ''}`}
            location={drawer.location}
            defaults={{ location_type_uuid: drawer.typeCode ? typeUuid(drawer.typeCode) : '', parent_uuid: drawer.parent?.location_uuid || '' }}
            locations={all}
            types={locationTypes}
            onCancel={() => setDrawer(null)}
            onDone={(loc) => {
              setDrawer(null)
              queryClient.invalidateQueries({ queryKey: ['administration', 'locations', orgId] })
              if (!drawer.location && loc?.location_uuid) selectLocation(loc.location_uuid)
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </AcademicPageShell>
  )
}

function PlaceForm({
  location,
  defaults,
  locations,
  types,
  onDone,
  onCancel,
}: {
  location?: any
  defaults: { location_type_uuid: string; parent_uuid: string }
  locations: any[]
  types: { lookup_uuid: string; name: string }[]
  onDone: (_loc: any) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const [form, setForm] = useState({
    name: location?.name || '',
    code: location?.code || '',
    location_type_uuid: location ? location.location_type?.lookup_uuid || '' : defaults.location_type_uuid,
    parent_uuid: location ? location.parent_uuid || '' : defaults.parent_uuid,
    address: location?.address || '',
    city: location?.city || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(String(t('administration.validation.required', 'Required')))
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code || undefined,
        location_type_uuid: form.location_type_uuid || null,
        parent_uuid: form.parent_uuid || null,
      }
      const saved = location ? await updateLocation(location.location_uuid, payload, access_token) : await createLocation(orgId, payload, access_token)
      toast.success(location ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone(saved)
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('administration.common.name', 'Name')} required error={error}>
          <input className={inputCls} value={form.name} onChange={set('name')} aria-invalid={!!error} autoFocus />
        </Field>
        <Field label={t('administration.common.code', 'Code')} hint={t('administration.common.code_hint', 'Leave empty to generate one.')}>
          <input
            className={`${inputCls} font-mono`}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder={t('administration.common.code_auto', 'Auto')}
          />
        </Field>
        <Field label={t('administration.facilities.type', 'Type')}>
          <select className={inputCls} value={form.location_type_uuid} onChange={set('location_type_uuid')}>
            <option value="">—</option>
            {types.map((o) => (
              <option key={o.lookup_uuid} value={o.lookup_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.parent', 'Part of')} hint={t('administration.facilities.parent_hint', 'e.g. a building inside a campus')}>
          <select className={inputCls} value={form.parent_uuid} onChange={set('parent_uuid')}>
            <option value="">—</option>
            {locations
              .filter((l) => l.location_uuid !== location?.location_uuid)
              .map((l) => (
                <option key={l.location_uuid} value={l.location_uuid}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('administration.facilities.address', 'Address')}>
          <input className={inputCls} value={form.address} onChange={set('address')} />
        </Field>
        <Field label={t('administration.facilities.city', 'City')}>
          <input className={inputCls} value={form.city} onChange={set('city')} />
        </Field>
      </FormSection>
      <FormActions saving={saving} onCancel={onCancel} sticky />
    </form>
  )
}
