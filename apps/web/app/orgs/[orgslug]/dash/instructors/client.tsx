'use client'
import React, { useState } from 'react'
import { Plus, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import { ChalkboardTeacher as ChalkboardTeacherIcon, CheckCircle, Pause, Tag } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicGridSkeleton,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { InstructorForm } from '@components/Dashboard/Pages/Instructors/InstructorForm'
import { ApproveInstructorForm } from '@components/Dashboard/Pages/Instructors/ApproveInstructorForm'
import { AdminBreadcrumbs, SearchBox } from '@components/Dashboard/Pages/Administration/AdminUI'
import { deleteInstructor, getInstructors, getInstructorImageUrl } from '@services/instructors/instructors'
import { cn } from '@/lib/utils'

const FILTERS = ['all', 'active', 'pending_approval', 'inactive', 'on_leave']

export const instructorName = (i: any) =>
  `${i.user?.first_name || ''} ${i.user?.last_name || ''}`.trim() || i.user?.username || '—'

function InstructorsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [approving, setApproving] = useState<any>(null)
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructors', orgId],
    queryFn: () => getInstructors(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instructors', orgId] })

  const handleDelete = async (i: any) => {
    if (!window.confirm(t('instructors.confirm_delete', 'Remove this instructor?'))) return
    try {
      await deleteInstructor(i.instructor_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const badgesFor = (i: any) => {
    const badges: { label: string; className?: string }[] = []
    if (i.category?.name)
      badges.push({ label: i.category.name, className: 'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]' })
    if (i.effective_hourly_rate != null)
      badges.push({
        label: `${i.effective_hourly_rate} ${i.rate_currency || ''}/${t('instructors.per_hour', 'h')}`,
        className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]',
      })
    const statusCls: Record<string, string> = {
      active: 'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]',
      inactive: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
      on_leave: 'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]',
      pending_approval: 'bg-[hsl(var(--dash-tile-rose))] text-[hsl(var(--dash-tile-rose-fg))]',
    }
    badges.push({
      label: t(`instructors.status_${i.status}`, i.status) as string,
      className: statusCls[i.status] || 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
    })
    return badges
  }

  const stats = {
    active: instructors.filter((i: any) => i.status === 'active').length,
    onLeave: instructors.filter((i: any) => i.status === 'on_leave').length,
    categories: new Set(instructors.map((i: any) => i.category?.name).filter(Boolean)).size,
  }

  const q = query.trim().toLowerCase()
  const visible = (instructors as any[]).filter(
    (i) =>
      (filter === 'all' || i.status === filter) &&
      (!q ||
        instructorName(i).toLowerCase().includes(q) ||
        (i.user?.email || '').toLowerCase().includes(q) ||
        (i.specializations || []).some((s: string) => s.toLowerCase().includes(q)))
  )
  const pendingCount = (instructors as any[]).filter((i) => i.status === 'pending_approval').length

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.instructors', 'Instructors / Trainers') }]} />
      <AcademicHeader
        title={t('administration.nav.instructors', 'Instructors / Trainers')}
        subtitle={t('instructors.subtitle', 'Manage instructors, categories and finance')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> {t('instructors.new_instructor', 'New Instructor')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'total', label: t('instructors.stats.total', 'Instructors'), value: instructors.length, icon: ChalkboardTeacherIcon, tone: 'rose' },
          { key: 'active', label: t('instructors.stats.active', 'Active'), value: stats.active, icon: CheckCircle, tone: 'stone' },
          { key: 'leave', label: t('instructors.stats.on_leave', 'On leave'), value: stats.onLeave, icon: Pause, tone: 'gold' },
          { key: 'categories', label: t('instructors.stats.categories', 'Categories'), value: stats.categories, icon: Tag, tone: 'sand', href: '/dash/instructors/categories' },
        ]}
      />

      <InstructorTabs orgslug={orgslug} />

      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder={t('instructors.search', 'Search by name, email or expertise')} />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                filter === f
                  ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]'
                  : 'border-[hsl(var(--dash-border))] text-[hsl(var(--dash-muted))]'
              )}
            >
              {f === 'all' ? t('instructors.filter_all', 'All') : t(`instructors.status_${f}`, f)}
              {f === 'pending_approval' && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <AcademicGridSkeleton />}
      <AcademicGrid>
        {!isLoading && visible.length === 0 && (
          <AcademicEmptyState
            title={t('instructors.none', 'No instructors yet')}
            description={t('instructors.none_desc', 'Add an instructor to start tracking hours and cost.')}
          />
        )}
        {visible.map((i: any) => (
          <div key={i.instructor_uuid} className="relative">
            <AcademicCard
              orgslug={orgslug}
              href={`/dash/instructors/${i.instructor_uuid}`}
              title={instructorName(i)}
              subtitle={(i.specializations || []).join(' · ') || i.user?.email || i.contact_info?.email || ''}
              thumbnailUrl={getInstructorImageUrl(org?.org_uuid, i)}
              badges={badgesFor(i)}
              onEdit={() => {
                setEditing(i)
                setModalOpen(true)
              }}
              onDelete={() => handleDelete(i)}
            />
            {i.status === 'pending_approval' && (
              <button
                type="button"
                onClick={() => setApproving(i)}
                className="absolute bottom-3 end-3 rounded-full bg-[hsl(var(--dash-accent))] px-3 py-1 text-[11px] font-semibold text-[hsl(var(--dash-ink))] shadow"
              >
                {t('instructors.approve', 'Approve')}
              </button>
            )}
          </div>
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('instructors.edit', 'Edit Instructor') : t('instructors.new_instructor', 'New Instructor')}
        dialogContent={
          <InstructorForm
            orgId={orgId!}
            access_token={access_token}
            instructor={editing}
            onDone={(saved) => {
              setModalOpen(false)
              refresh()
              if (saved?.temporary_password) {
                setTempPassword({ name: instructorName(saved), password: saved.temporary_password })
              }
            }}
          />
        }
      />

      <Modal
        isDialogOpen={!!approving}
        onOpenChange={(open) => !open && setApproving(null)}
        minWidth="sm"
        dialogTitle={`${t('instructors.approve', 'Approve')} — ${approving ? instructorName(approving) : ''}`}
        dialogContent={
          approving && (
            <ApproveInstructorForm
              orgId={orgId!}
              access_token={access_token}
              instructor={approving}
              onDone={() => {
                setApproving(null)
                refresh()
              }}
            />
          )
        }
      />

      <Modal
        isDialogOpen={!!tempPassword}
        onOpenChange={(open) => !open && setTempPassword(null)}
        minWidth="sm"
        dialogTitle={t('instructors.account_created', 'Account created')}
        dialogContent={
          tempPassword && (
            <div className="space-y-3 text-sm">
              <p>
                {t(
                  'instructors.temp_password_hint',
                  'Share this one-time temporary password with the instructor. It will not be shown again; they must change it at first login.'
                )}
              </p>
              <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 font-mono">
                <span>{tempPassword.password}</span>
                <button
                  type="button"
                  aria-label={t('instructors.copy', 'Copy')}
                  onClick={() => {
                    navigator.clipboard?.writeText(tempPassword.password)
                    toast.success(t('instructors.copied', 'Copied'))
                  }}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        }
      />
    </AcademicPageShell>
  )
}

export default InstructorsHome
