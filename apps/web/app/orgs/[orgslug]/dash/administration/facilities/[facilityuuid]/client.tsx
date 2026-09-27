'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { DataTable, GhostButton, Section, Stat, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, useAdminContext, useLookupLabel } from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilityForm } from '@components/Dashboard/Pages/Administration/FacilityForm'
import { getFacility, getFacilityBookings } from '@services/administration/administration'
import { facilityImageUrl } from '../client'

function FacilityDetail({ orgslug, facilityUuid }: { orgslug: string; facilityUuid: string }) {
  const { t } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editOpen, setEditOpen] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const { data: facility } = useQuery({
    queryKey: ['administration', 'facility', facilityUuid],
    queryFn: () => getFacility(facilityUuid, access_token),
    enabled: ready,
  })
  const since = showPast ? undefined : new Date().toISOString().slice(0, 16)
  const { data: bookings = [] } = useQuery({
    queryKey: ['administration', 'facility', facilityUuid, 'bookings', showPast],
    queryFn: () => getFacilityBookings(facilityUuid, access_token, since),
    enabled: ready,
  })

  if (!facility) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }
  const image = facilityImageUrl(org?.org_uuid, facility)

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' },
          { label: facility.name },
        ]}
      />
      <AcademicHeader
        title={facility.name}
        subtitle={[facility.facility_type ? label(facility.facility_type) : null, facility.location_name].filter(Boolean).join(' · ')}
        action={
          <GhostButton onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
          </GhostButton>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title={t('administration.facilities.details', 'Details')}>
          {image && (
            <img src={image} alt="" className="mb-3 aspect-video w-full rounded-xl object-cover" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('administration.facilities.capacity', 'Capacity (people)')} value={facility.capacity ?? '—'} />
            <Stat label={t('administration.common.status', 'Status')} value={<StatusPill status={facility.status} label={String(t(`administration.facilities.status_${facility.status}`, facility.status))} />} />
            <Stat label={t('administration.facilities.hourly_cost', 'Hourly cost')} value={facility.hourly_cost != null ? `${facility.hourly_cost} ${facility.currency || ''}` : '—'} />
            <Stat label={t('administration.facilities.daily_cost', 'Daily cost')} value={facility.daily_cost != null ? `${facility.daily_cost} ${facility.currency || ''}` : '—'} />
            <Stat label={t('administration.facilities.floor', 'Floor')} value={facility.floor || '—'} />
            <Stat label={t('administration.facilities.room_number', 'Room no.')} value={facility.room_number || '—'} />
          </div>
          {facility.description && <p className="mt-3 whitespace-pre-line text-sm">{facility.description}</p>}
          <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
            {t('administration.facilities.equipment', 'Facilities / equipment')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(facility.equipment || []).length === 0 && <span className="text-sm text-[hsl(var(--dash-muted))]">—</span>}
            {(facility.equipment || []).map((e: any) => (
              <span key={e.lookup_uuid} className="rounded-full bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-xs">
                {e.name}
                {e.quantity > 1 ? ` ×${e.quantity}` : ''}
              </span>
            ))}
          </div>
          <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
            {t('administration.facilities.availability', 'Weekly availability')}
          </h3>
          <ul className="space-y-1 text-sm">
            {(facility.availability?.slots || []).length === 0 && <li className="text-[hsl(var(--dash-muted))]">{t('administration.facilities.always', 'No restrictions')}</li>}
            {(facility.availability?.slots || []).map((s: any, i: number) => (
              <li key={i} className="flex justify-between">
                <span>{String(t(`instructors.day_${s.day}`, s.day))}</span>
                <span className="font-mono text-xs">
                  {s.start} – {s.end}
                </span>
              </li>
            ))}
            {(facility.availability?.blackout_dates || []).map((b: any, i: number) => (
              <li key={`b${i}`} className="text-xs text-amber-700">
                {b.start} → {b.end || b.start}: {b.reason || t('administration.facilities.unavailable', 'unavailable')}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          className="lg:col-span-2"
          title={t('administration.facilities.bookings', 'Bookings')}
          description={t('administration.facilities.bookings_desc', 'Sessions scheduled in this room, directly or through their course default.')}
          action={
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
              {t('administration.facilities.show_past', 'Include past sessions')}
            </label>
          }
        >
          <DataTable
            headers={[
              t('administration.facilities.when', 'When'),
              t('administration.facilities.session', 'Session'),
              t('administration.facilities.booked_by', 'Course / offering'),
              '',
            ]}
            empty={t('administration.facilities.no_bookings', 'No sessions booked.')}
          >
            {(bookings as any[]).map((b) => (
              <tr key={b.session_uuid}>
                <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>
                  {b.start?.replace('T', ' ')}
                  {b.end ? ` → ${b.end.replace('T', ' ')}` : ''}
                </td>
                <td className={tdCls}>{b.title || '—'}</td>
                <td className={tdCls}>
                  {b.source === 'course_session' && b.parent_uuid ? (
                    <Link className="hover:underline" href={getUriWithOrg(orgslug, `/dash/courses/course/${b.parent_uuid.replace('course_', '')}/general`)}>
                      {b.parent_name}
                    </Link>
                  ) : b.source === 'offering_session' && b.parent_uuid ? (
                    <Link className="hover:underline" href={getUriWithOrg(orgslug, `/dash/postgraduate/offerings/${b.parent_uuid.replace('offering_', '')}`)}>
                      {b.parent_name}
                    </Link>
                  ) : (
                    b.parent_name
                  )}
                </td>
                <td className={`${tdCls} text-xs text-[hsl(var(--dash-muted))]`}>
                  {b.inherited ? t('administration.facilities.inherited', 'course default') : ''}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>

      <Modal
        isDialogOpen={editOpen}
        onOpenChange={setEditOpen}
        minWidth="md"
        dialogTitle={`${t('administration.common.edit', 'Edit')} ${facility.name}`}
        dialogContent={
          <FacilityForm
            facility={facility}
            onDone={() => {
              setEditOpen(false)
              queryClient.invalidateQueries({ queryKey: ['administration', 'facility', facilityUuid] })
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

export default FacilityDetail
