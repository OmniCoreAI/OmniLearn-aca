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
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { FacilityForm } from '@components/Dashboard/Pages/Administration/FacilityForm'
import { deleteFacility, getFacilities } from '@services/administration/administration'
import { getOrgContentUrl } from '@services/media/media'

export const facilityImageUrl = (orgUuid: string, f: any) =>
  f?.image ? getOrgContentUrl(orgUuid, `facilities/${f.facility_uuid}/images/${f.image}`) : null

function FacilitiesHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['administration', 'facilities', orgId],
    queryFn: () => getFacilities(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'facilities', orgId] })

  const remove = async (f: any) => {
    if (!window.confirm(t('administration.facilities.confirm_delete', 'Delete this facility? Courses and sessions keep their text location.'))) return
    try {
      await deleteFacility(f.facility_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  const q = query.trim().toLowerCase()
  const visible = (facilities as any[]).filter(
    (f) => !q || f.name.toLowerCase().includes(q) || (f.code || '').toLowerCase().includes(q) || (f.location_name || '').toLowerCase().includes(q)
  )

  const statusCls: Record<string, string> = {
    active: 'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]',
    maintenance: 'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]',
    inactive: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.facilities', 'Facilities & Rooms') }]} />
      <AcademicHeader
        title={t('administration.nav.facilities', 'Facilities & Rooms')}
        subtitle={t('administration.facilities.subtitle', 'Rooms, halls and labs with capacity, equipment, availability and cost.')}
        action={
          <AcademicPrimaryButton
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> {t('administration.facilities.new_facility', 'New facility')}
          </AcademicPrimaryButton>
        }
      />
      <FacilitiesTabs orgslug={orgslug} />
      <SearchBox value={query} onChange={setQuery} placeholder={t('administration.facilities.search', 'Search by name, code or location')} />

      {isLoading && <AcademicGridSkeleton />}
      <AcademicGrid>
        {!isLoading && visible.length === 0 && (
          <AcademicEmptyState
            title={t('administration.facilities.none', 'No facilities yet')}
            description={t('administration.facilities.none_desc', 'Add rooms and halls once, then select them for any course, offering or session.')}
          />
        )}
        {visible.map((f) => (
          <AcademicCard
            key={f.facility_uuid}
            orgslug={orgslug}
            href={`/dash/administration/facilities/${f.facility_uuid}`}
            title={f.name}
            subtitle={[f.facility_type ? label(f.facility_type) : null, f.location_name].filter(Boolean).join(' · ')}
            thumbnailUrl={facilityImageUrl(org?.org_uuid, f)}
            badges={[
              ...(f.capacity != null
                ? [{ label: `${f.capacity} ${t('administration.facilities.people', 'people')}`, className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]' }]
                : []),
              ...(f.hourly_cost != null
                ? [{ label: `${f.hourly_cost} ${f.currency || ''}/${t('instructors.per_hour', 'h')}`, className: 'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]' }]
                : []),
              { label: String(t(`administration.facilities.status_${f.status}`, f.status)), className: statusCls[f.status] || statusCls.inactive },
            ]}
            footerLabel={
              f.upcoming_bookings
                ? `${f.upcoming_bookings} ${t('administration.facilities.upcoming', 'upcoming sessions')}`
                : (f.equipment || []).map((e: any) => e.name).join(', ')
            }
            onEdit={() => {
              setEditing(f)
              setOpen(true)
            }}
            onDelete={() => remove(f)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('administration.facilities.new_facility', 'New facility')}
        dialogContent={
          <FacilityForm
            facility={editing}
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

export default FacilitiesHome
