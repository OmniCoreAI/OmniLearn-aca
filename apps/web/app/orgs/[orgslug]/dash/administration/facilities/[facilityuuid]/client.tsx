'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarClock, MapPin, Pencil, Users, Wrench } from 'lucide-react'
import { Door } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { RowActionsMenu, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminBreadcrumbs, AdminCard, AdminDrawer, DetailItem, useAdminContext, useLookupLabel } from '@components/Dashboard/Pages/Administration/AdminUI'
import { FACILITY_STATUSES, FacilityForm } from '@components/Dashboard/Pages/Administration/FacilityForm'
import { getFacility, getFacilityBookings, updateFacility } from '@services/administration/administration'
import { facilityImageUrl } from '../client'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function FacilityDetail({ orgslug, facilityUuid }: { orgslug: string; facilityUuid: string }) {
  const { t, i18n } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editOpen, setEditOpen] = useState(false)
  const [range, setRange] = useState<'upcoming' | 'all'>('upcoming')

  const { data: facility } = useQuery({
    queryKey: ['administration', 'facility', facilityUuid],
    queryFn: () => getFacility(facilityUuid, access_token),
    enabled: ready,
  })
  const since = range === 'all' ? undefined : new Date().toISOString().slice(0, 16)
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['administration', 'facility', facilityUuid, 'bookings', range],
    queryFn: () => getFacilityBookings(facilityUuid, access_token, since),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['administration', 'facility', facilityUuid] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'facilities'] })
  }

  if (!facility) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer mb-5 h-28 rounded-[1.25rem]" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="dash-shimmer h-80 rounded-[1.25rem]" />
          <div className="dash-shimmer h-80 rounded-[1.25rem] lg:col-span-2" />
        </div>
      </AcademicPageShell>
    )
  }
  const image = facilityImageUrl(org?.org_uuid, facility)
  const statusLabel = (st: string) => String(t(`administration.facilities.status_${st}`, st))
  const money = (v: number | null | undefined) => (v != null ? `${v.toLocaleString(i18n.language)} ${facility.currency || ''}`.trim() : null)
  const setStatus = async (next: string) => {
    try {
      await updateFacility(facilityUuid, { status: next }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const when = (value?: string) => {
    if (!value) return ''
    const d = new Date(value)
    return Number.isNaN(d.getTime())
      ? value.replace('T', ' ')
      : new Intl.DateTimeFormat(i18n.language || 'en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
  }
  const slots: any[] = facility.availability?.slots || []
  const blackouts: any[] = facility.availability?.blackout_dates || []
  const place = [facility.location_name, facility.floor ? `${t('administration.facilities.floor', 'Floor')} ${facility.floor}` : null, facility.room_number ? `${t('administration.facilities.room_number', 'Room')} ${facility.room_number}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' }, { label: facility.name }]}
      />

      {/* Header */}
      <section className="dash-card mb-5 flex flex-col gap-4 rounded-[1.25rem] p-5 sm:flex-row sm:items-center">
        {image ? (
          <img src={image} alt="" className="h-16 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-[hsl(var(--dash-border))]" />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
            <Door size={28} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{facility.name}</h1>
            <StatusPill status={facility.status} label={statusLabel(facility.status)} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
            {facility.facility_type ? <span>{label(facility.facility_type)}</span> : null}
            {place ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {place}
              </span>
            ) : null}
            {facility.capacity != null ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {t('administration.facilities.capacity_n', '{{count}} people', { count: facility.capacity })}
              </span>
            ) : null}
            {facility.code ? <span className="font-mono text-[12px]">{facility.code}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
          </button>
          <RowActionsMenu
            label={t('administration.table.actions', 'Actions')}
            actions={FACILITY_STATUSES.filter((st) => st !== facility.status).map((st) => ({
              label: st === 'active' ? t('administration.common.activate', 'Activate') : st === 'inactive' ? t('administration.common.deactivate', 'Deactivate') : t('administration.facilities.mark_maintenance', 'Mark as under maintenance'),
              icon: st === 'maintenance' ? <Wrench className="h-3.5 w-3.5" /> : undefined,
              onSelect: () => setStatus(st),
            }))}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <AdminCard title={t('administration.facilities.details', 'Details')}>
            <dl className="grid grid-cols-2 gap-4">
              <DetailItem label={t('administration.facilities.capacity', 'Capacity (people)')}>{facility.capacity}</DetailItem>
              <DetailItem label={t('administration.facilities.type', 'Type')}>{facility.facility_type ? label(facility.facility_type) : null}</DetailItem>
              <DetailItem label={t('administration.facilities.hourly_cost', 'Hourly cost')}>{money(facility.hourly_cost)}</DetailItem>
              <DetailItem label={t('administration.facilities.daily_cost', 'Daily cost')}>{money(facility.daily_cost)}</DetailItem>
              <DetailItem label={t('administration.facilities.floor', 'Floor')}>{facility.floor}</DetailItem>
              <DetailItem label={t('administration.facilities.room_number', 'Room no.')}>{facility.room_number}</DetailItem>
            </dl>
            {facility.description ? <p className="mt-4 whitespace-pre-line border-t border-[hsl(var(--dash-border))] pt-4 text-sm leading-relaxed">{facility.description}</p> : null}
          </AdminCard>

          <AdminCard title={t('administration.facilities.equipment', 'Facilities / equipment')}>
            {(facility.equipment || []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {(facility.equipment || []).map((e: any) => (
                  <span key={e.lookup_uuid} className="rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-xs font-medium">
                    {e.name}
                    {e.quantity > 1 ? <span className="text-[hsl(var(--dash-muted))]"> ×{e.quantity}</span> : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[hsl(var(--dash-muted))]">{t('administration.facilities.no_equipment', 'No equipment listed.')}</p>
            )}
          </AdminCard>

          <AdminCard title={t('administration.facilities.availability', 'Weekly availability')}>
            {slots.length === 0 ? (
              <p className="text-sm text-[hsl(var(--dash-muted))]">{t('administration.facilities.always', 'No restrictions')}</p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--dash-border))]">
                {WEEKDAYS.map((day) => {
                  const daySlots = slots.filter((s) => s.day === day)
                  return (
                    <li key={day} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className={daySlots.length ? 'font-medium' : 'text-[hsl(var(--dash-muted))]'}>{String(t(`instructors.day_${day}`, day))}</span>
                      <span className="flex flex-wrap justify-end gap-1">
                        {daySlots.length ? (
                          daySlots.map((s, i) => (
                            <span key={i} className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[11px]">
                              {s.start}–{s.end}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[hsl(var(--dash-muted))]">{t('administration.facilities.closed', 'Closed')}</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {blackouts.length ? (
              <div className="mt-3 space-y-1 border-t border-[hsl(var(--dash-border))] pt-3">
                {blackouts.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {b.start} → {b.end || b.start}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </AdminCard>
        </div>

        <div className="lg:col-span-2">
          <DashDataTable
            rows={bookings as any[]}
            rowKey={(b: any) => b.session_uuid}
            loading={bookingsLoading}
            pageSize={15}
            itemLabel={(n) => t('administration.facilities.bookings_count', '{{count}} sessions', { count: n })}
            toolbar={
              <>
                <span className="me-1 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('administration.facilities.bookings', 'Bookings')}</span>
                <ToolbarSelect
                  label={t('administration.facilities.show', 'Show')}
                  value={range}
                  onChange={(v) => setRange(v as 'upcoming' | 'all')}
                  options={[
                    { value: 'upcoming', label: t('administration.facilities.upcoming', 'Upcoming') },
                    { value: 'all', label: t('administration.facilities.all_sessions', 'Including past') },
                  ]}
                />
              </>
            }
            empty={
              <AcademicEmptyState
                compact
                icon={<CalendarClock className="h-6 w-6" />}
                title={t('administration.facilities.no_bookings', 'No sessions booked')}
                description={t('administration.facilities.bookings_desc', 'Sessions scheduled in this room, directly or through their course default.')}
              />
            }
            columns={[
              {
                key: 'when',
                header: t('administration.facilities.when', 'When'),
                primary: true,
                sortValue: (b: any) => b.start,
                cell: (b: any) => (
                  <div className="leading-tight">
                    <div className="whitespace-nowrap text-[13px] font-medium">{when(b.start)}</div>
                    {b.end ? <div className="whitespace-nowrap text-[11px] text-[hsl(var(--dash-muted))]">→ {when(b.end)}</div> : null}
                  </div>
                ),
              },
              { key: 'session', header: t('administration.facilities.session', 'Session'), cell: (b: any) => <span className="line-clamp-1 text-[13px]">{b.title || '—'}</span> },
              {
                key: 'parent',
                header: t('administration.facilities.booked_by', 'Course / offering'),
                cell: (b: any) => {
                  const href =
                    b.source === 'course_session' && b.parent_uuid
                      ? `/dash/courses/course/${b.parent_uuid.replace('course_', '')}/general`
                      : b.source === 'offering_session' && b.parent_uuid
                        ? `/dash/postgraduate/offerings/${b.parent_uuid.replace('offering_', '')}`
                        : null
                  return (
                    <div className="min-w-0 leading-tight">
                      {href ? (
                        <Link className="line-clamp-1 text-[13px] font-medium hover:underline" href={getUriWithOrg(orgslug, href)} onClick={(e) => e.stopPropagation()}>
                          {b.parent_name}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 text-[13px]">{b.parent_name || '—'}</span>
                      )}
                      {b.inherited ? <div className="text-[11px] text-[hsl(var(--dash-muted))]">{t('administration.facilities.inherited', 'course default')}</div> : null}
                    </div>
                  )
                },
              },
            ]}
          />
        </div>
      </div>

      <AdminDrawer
        icon={<Door size={20} weight="duotone" />}
        open={editOpen}
        onOpenChange={setEditOpen}
        width="sm:max-w-[640px]"
        title={`${t('administration.common.edit', 'Edit')} ${facility.name}`}
        description={t('administration.facilities.form_desc', 'Capacity, equipment, availability and cost are used when scheduling sessions.')}
      >
        {editOpen ? (
          <FacilityForm
            facility={facility}
            onCancel={() => setEditOpen(false)}
            onDone={() => {
              setEditOpen(false)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
    </AcademicPageShell>
  )
}

export default FacilityDetail
