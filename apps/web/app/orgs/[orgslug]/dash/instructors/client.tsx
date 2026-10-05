'use client'
import React, { useMemo, useState } from 'react'
import { Copy, Eye, Pencil, Plus, Power, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { ChalkboardTeacher, ChalkboardTeacher as ChalkboardTeacherIcon, CheckCircle, Pause, Tag } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { InstructorForm } from '@components/Dashboard/Pages/Instructors/InstructorForm'
import { ApproveInstructorForm } from '@components/Dashboard/Pages/Instructors/ApproveInstructorForm'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  PersonAvatar,
  formatAdminDate,
  useConfirm,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  deleteInstructor,
  getInstructorCategories,
  getInstructors,
  getInstructorImageUrl,
  updateInstructor,
} from '@services/instructors/instructors'

const STATUSES = ['active', 'pending_approval', 'on_leave', 'inactive']

export const instructorName = (i: any) =>
  `${i.user?.first_name || ''} ${i.user?.last_name || ''}`.trim() || i.user?.username || '—'

function InstructorsHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [approving, setApproving] = useState<any>(null)
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null)
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructors', orgId],
    queryFn: () => getInstructors(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instructors', orgId] })
  const openForm = (i: any) => {
    setEditing(i)
    setDrawerOpen(true)
  }

  const remove = async (i: any) => {
    const ok = await confirm({
      title: t('instructors.delete_title', 'Delete {{name}}?', { name: instructorName(i) }),
      message: t(
        'instructors.delete_message',
        'This removes the instructor profile and its rate settings. Their user account and course history stay. To keep them on record, deactivate instead.'
      ),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteInstructor(i.instructor_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }
  const setInstructorStatus = async (rows: any[], next: string) => {
    try {
      await Promise.all(rows.map((i) => updateInstructor(i.instructor_uuid, { status: next }, access_token)))
      toast.success(
        next === 'active'
          ? t('instructors.activated', '{{count}} activated', { count: rows.length })
          : t('instructors.deactivated', '{{count}} deactivated', { count: rows.length })
      )
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const counts = useMemo(() => {
    const by = (s: string) => (instructors as any[]).filter((i) => i.status === s).length
    return { active: by('active'), onLeave: by('on_leave'), pending: by('pending_approval') }
  }, [instructors])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (instructors as any[]).filter(
      (i) =>
        (status === 'all' || i.status === status) &&
        (category === 'all' || (category === 'none' ? !i.category : i.category?.category_uuid === category)) &&
        (!q ||
          instructorName(i).toLowerCase().includes(q) ||
          (i.user?.username || '').toLowerCase().includes(q) ||
          (i.contact_info?.email || '').toLowerCase().includes(q) ||
          (i.specializations || []).some((s: string) => s.toLowerCase().includes(q)))
    )
  }, [instructors, query, status, category])

  const filtering = !!query || status !== 'all' || category !== 'all'
  const money = (v: number, currency?: string | null) =>
    `${v.toLocaleString(i18n.language)} ${currency || ''}`.trim()

  const createButton = (
    <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
      <button
        onClick={() => openForm(null)}
        className="flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-all hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> {t('instructors.new_instructor', 'New Instructor')}
      </button>
    </AuthenticatedClientElement>
  )

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.instructors', 'Instructors / Trainers') }]} />
      <AcademicHeader
        title={t('administration.nav.instructors', 'Instructors / Trainers')}
        subtitle={t('instructors.subtitle', 'Manage instructors, categories and finance')}
        action={createButton}
      />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'total', label: t('instructors.stats.total', 'Instructors'), value: instructors.length, icon: ChalkboardTeacherIcon, tone: 'rose' },
          { key: 'active', label: t('instructors.stats.active', 'Active'), value: counts.active, icon: CheckCircle, tone: 'stone' },
          {
            key: 'pending',
            label: t('instructors.stats.pending', 'Awaiting approval'),
            value: counts.pending,
            hint: counts.onLeave ? t('instructors.stats.on_leave_hint', '{{count}} on leave', { count: counts.onLeave }) : undefined,
            icon: Pause,
            tone: 'gold',
          },
          { key: 'categories', label: t('instructors.stats.categories', 'Categories'), value: (categories as any[]).length, icon: Tag, tone: 'sand', href: '/dash/instructors/categories' },
        ]}
      />

      <InstructorTabs orgslug={orgslug} />

      <DashDataTable
        rows={visible}
        rowKey={(i: any) => i.instructor_uuid}
        loading={isLoading}
        selectable
        rowHref={(i: any) => getUriWithOrg(orgslug, `/dash/instructors/${i.instructor_uuid}`)}
        itemLabel={(n) => t('instructors.count', '{{count}} instructors', { count: n })}
        initialSort={{ key: 'name', dir: 'asc' }}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('instructors.search', 'Search by name, email or expertise')} />
            <ToolbarSelect
              label={t('instructors.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('instructors.filter_all', 'All') },
                ...STATUSES.map((s) => ({ value: s, label: t(`instructors.status_${s}`, s.replace('_', ' ')) as string })),
              ]}
            />
            <ToolbarSelect
              label={t('instructors.category', 'Category')}
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: t('instructors.filter_all', 'All') },
                ...(categories as any[]).map((c) => ({ value: c.category_uuid, label: c.name })),
                { value: 'none', label: t('instructors.no_category', 'No category') },
              ]}
            />
          </>
        }
        bulkActions={(rows, clear) => (
          <>
            <GhostButton
              onClick={async () => {
                await setInstructorStatus(rows, 'active')
                clear()
              }}
            >
              <Power className="h-3.5 w-3.5" /> {t('administration.common.activate', 'Activate')}
            </GhostButton>
            <GhostButton
              onClick={async () => {
                await setInstructorStatus(rows, 'inactive')
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
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('instructors.none', 'No instructors yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('instructors.none_desc_assign', 'Create your first instructor to start assigning trainers to courses.')
            }
            action={filtering ? undefined : createButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('instructors.instructor', 'Instructor'),
            primary: true,
            width: 'w-[30%]',
            sortValue: (i: any) => instructorName(i),
            cell: (i: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={instructorName(i)} src={getInstructorImageUrl(org?.org_uuid, i)} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{instructorName(i)}</div>
                  <div className="truncate text-xs text-[hsl(var(--dash-muted))]">
                    {(i.specializations || []).join(' · ') || i.contact_info?.email || `@${i.user?.username || ''}`}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'category',
            header: t('instructors.category', 'Category'),
            sortValue: (i: any) => i.category?.name,
            cell: (i: any) => (i.category ? <span className="text-[13px]">{i.category.name}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
          },
          {
            key: 'rate',
            header: t('instructors.hourly_rate', 'Hourly rate'),
            align: 'end',
            sortValue: (i: any) => i.effective_hourly_rate,
            cell: (i: any) =>
              i.effective_hourly_rate != null ? (
                <div className="leading-tight">
                  <div className="font-medium tabular-nums">{money(i.effective_hourly_rate, i.rate_currency)}</div>
                  <div className="text-[11px] text-[hsl(var(--dash-muted))]">
                    {i.rate_source === 'instructor'
                      ? t('instructors.rate_source_override', 'Personal rate')
                      : t('instructors.rate_source_category', 'From category')}
                  </div>
                </div>
              ) : (
                <span className="text-[hsl(var(--dash-muted))]">—</span>
              ),
          },
          {
            key: 'status',
            header: t('instructors.status', 'Status'),
            sortValue: (i: any) => i.status,
            cell: (i: any) => <StatusPill status={i.status} label={t(`instructors.status_${i.status}`, i.status.replace('_', ' ')) as string} />,
          },
          {
            key: 'courses',
            header: t('instructors.courses', 'Courses'),
            align: 'end',
            sortValue: (i: any) => i.course_count ?? 0,
            cell: (i: any) => <span className="tabular-nums">{i.course_count ?? 0}</span>,
          },
          {
            key: 'created',
            header: t('administration.common.created', 'Created'),
            hideBelow: 'lg',
            sortValue: (i: any) => i.creation_date,
            cell: (i: any) => <span className="text-[13px] text-[hsl(var(--dash-muted))]">{formatAdminDate(i.creation_date, i18n.language)}</span>,
          },
        ]}
        actions={(i: any) => [
          { label: t('instructors.view_profile', 'View profile'), icon: <Eye className="h-3.5 w-3.5" />, href: getUriWithOrg(orgslug, `/dash/instructors/${i.instructor_uuid}`) },
          { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(i) },
          ...(i.status === 'pending_approval'
            ? [{ label: t('instructors.approve', 'Approve'), icon: <ShieldCheck className="h-3.5 w-3.5" />, onSelect: () => setApproving(i) }]
            : [
                {
                  label: i.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
                  icon: <Power className="h-3.5 w-3.5" />,
                  onSelect: () => setInstructorStatus([i], i.status === 'active' ? 'inactive' : 'active'),
                },
              ]),
          { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(i) },
        ]}
      />

      <AdminDrawer
        icon={<ChalkboardTeacher size={20} weight="duotone" />}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editing ? t('instructors.edit', 'Edit Instructor') : t('instructors.new_instructor', 'New Instructor')}
        description={editing ? instructorName(editing) : t('instructors.new_desc', 'Add a trainer and set how they are paid.')}
      >
        {drawerOpen ? (
          <InstructorForm
            orgId={orgId!}
            access_token={access_token}
            instructor={editing}
            onCancel={() => setDrawerOpen(false)}
            onDone={(saved) => {
              setDrawerOpen(false)
              refresh()
              if (saved?.temporary_password) {
                setTempPassword({ name: instructorName(saved), password: saved.temporary_password })
              }
            }}
          />
        ) : null}
      </AdminDrawer>

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
      {dialog}
    </AcademicPageShell>
  )
}

export default InstructorsHome
