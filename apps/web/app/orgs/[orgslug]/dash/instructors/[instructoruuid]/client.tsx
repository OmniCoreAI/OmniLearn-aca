'use client'
import { ChalkboardTeacher } from '@phosphor-icons/react'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Pencil, Phone, Plus, Power, ShieldCheck, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { RowActionsMenu } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import {
  AdminBreadcrumbs,
  AdminCard,
  AdminDrawer,
  DetailItem,
  PersonAvatar,
  formatAdminDate,
  useAdminContext,
  useConfirm,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { InstructorForm, WEEKDAYS } from '@components/Dashboard/Pages/Instructors/InstructorForm'
import { ApproveInstructorForm } from '@components/Dashboard/Pages/Instructors/ApproveInstructorForm'
import { InstructorAssignmentsPanel } from '@components/Dashboard/Pages/Instructors/InstructorAssignmentsPanel'
import {
  assignInstructorCourse,
  getInstructor,
  getInstructorCourses,
  getInstructorImageUrl,
  getInstructorWorkLogs,
  unassignInstructorCourse,
  updateInstructor,
} from '@services/instructors/instructors'
import { getOrgLmsCourses } from '@services/academic/core'
import { cn } from '@/lib/utils'

const nameOf = (i: any) => `${i?.user?.first_name || ''} ${i?.user?.last_name || ''}`.trim() || i?.user?.username || '—'
const TABS = ['overview', 'courses', 'assignments', 'availability', 'activity'] as const
type Tab = (typeof TABS)[number]

function InstructorDetail({ orgslug, instructorUuid }: { orgslug: string; instructorUuid: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { confirm, dialog } = useConfirm()
  const [editOpen, setEditOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [courseToAdd, setCourseToAdd] = useState('')
  const tab = (TABS as readonly string[]).includes(searchParams.get('tab') || '') ? (searchParams.get('tab') as Tab) : 'overview'
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['instructor', instructorUuid],
    queryFn: () => getInstructor(instructorUuid, access_token),
    enabled: ready,
  })
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['instructor', instructorUuid, 'courses'],
    queryFn: () => getInstructorCourses(instructorUuid, access_token),
    enabled: ready,
  })
  const { data: worklogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['instructor-worklogs', orgId, instructorUuid],
    queryFn: () => getInstructorWorkLogs(orgId, access_token, instructorUuid),
    enabled: ready,
  })
  const { data: lmsCourses = [] } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: () => getOrgLmsCourses(orgslug, access_token),
    enabled: ready,
  })

  const courseNames = useMemo(
    () => new Map((lmsCourses as any[]).map((c) => [c.course_uuid, c.name])),
    [lmsCourses]
  )

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['instructor', instructorUuid] })
    queryClient.invalidateQueries({ queryKey: ['instructors', orgId] })
  }

  if (isLoading || !instructor) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer mb-4 h-8 w-64 rounded-full" />
        <div className="dash-shimmer mb-6 h-32 rounded-[1.25rem]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="dash-shimmer h-64 rounded-[1.25rem] lg:col-span-2" />
          <div className="dash-shimmer h-64 rounded-[1.25rem]" />
        </div>
      </AcademicPageShell>
    )
  }

  const name = nameOf(instructor)
  const image = getInstructorImageUrl(org?.org_uuid, instructor)
  const money = (v: number | null | undefined, currency?: string | null) =>
    v == null ? '—' : `${Number(v).toLocaleString(i18n.language)} ${currency || ''}`.trim()
  const totalHours = (worklogs as any[]).reduce((sum, w) => sum + (w.hours || 0), 0)
  const totalAmount = (worklogs as any[]).reduce((sum, w) => sum + (w.amount || 0), 0)
  const assigned = new Set((courses as any[]).map((c) => c.course_uuid))
  const slots: { day: string; start: string; end: string }[] = instructor.availability?.slots || []

  const addCourse = async () => {
    if (!courseToAdd) return
    try {
      await assignInstructorCourse(instructorUuid, courseToAdd, access_token)
      toast.success(t('instructors.course_assigned', 'Course assigned'))
      setCourseToAdd('')
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const removeCourse = async (course: any) => {
    const ok = await confirm({
      title: t('instructors.unassign_title', 'Remove from {{course}}?', { course: course.name }),
      message: t('instructors.confirm_unassign', 'Remove this instructor from the course?'),
      confirmText: t('instructors.unassign', 'Remove'),
    })
    if (!ok) return
    try {
      await unassignInstructorCourse(instructorUuid, course.course_uuid, access_token)
      toast.success(t('instructors.course_unassigned', 'Removed from course'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const toggleActive = async () => {
    try {
      await updateInstructor(instructorUuid, { status: instructor.status === 'active' ? 'inactive' : 'active' }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const tabLabels: Record<Tab, string> = {
    overview: t('instructors.tab_overview', 'Overview'),
    courses: t('instructors.tab_courses', 'Courses ({{count}})', { count: (courses as any[]).length }),
    assignments: t('instructors.tab_assignments', 'Programs & schedule'),
    availability: t('instructors.availability', 'Availability'),
    activity: t('instructors.tab_activity', 'Activity'),
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.instructors', 'Instructors / Trainers'), href: '/dash/instructors' }, { label: name }]}
      />

      {/* Profile header */}
      <section className="dash-card mb-5 flex flex-col gap-4 rounded-[1.25rem] p-5 sm:flex-row sm:items-center">
        <PersonAvatar name={name} src={image} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{name}</h1>
            <StatusPill status={instructor.status} label={String(t(`instructors.status_${instructor.status}`, instructor.status))} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
            {instructor.category ? <span>{instructor.category.name}</span> : null}
            {(instructor.specializations || []).length ? <span>{instructor.specializations.join(' · ')}</span> : null}
            {instructor.contact_info?.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {instructor.contact_info.email}
              </span>
            ) : null}
            {instructor.contact_info?.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {instructor.contact_info.phone}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {instructor.status === 'pending_approval' ? (
            <GhostButton onClick={() => setApproveOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5" /> {t('instructors.approve', 'Approve')}
            </GhostButton>
          ) : null}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
          </button>
          {instructor.status !== 'pending_approval' ? (
            <RowActionsMenu
              label={t('administration.table.actions', 'Actions')}
              actions={[
                {
                  label: instructor.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
                  icon: <Power className="h-3.5 w-3.5" />,
                  onSelect: toggleActive,
                },
              ]}
            />
          ) : null}
        </div>
      </section>

      <div className={cn(TAB_TRACK, 'mb-5')} role="tablist">
        {TABS.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tabItemClass(tab === key)}>
            {tabLabels[key]}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <AdminCard title={t('instructors.profile', 'Profile')}>
              {instructor.bio ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--dash-ink))]">{instructor.bio}</p>
              ) : (
                <p className="text-sm text-[hsl(var(--dash-muted))]">{t('instructors.no_bio', 'No profile description yet.')}</p>
              )}
            </AdminCard>
            <AdminCard title={t('instructors.section_professional', 'Professional information')}>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <DetailItem label={t('instructors.category', 'Category')}>{instructor.category?.name}</DetailItem>
                <DetailItem label={t('instructors.department', 'Department')}>{instructor.department}</DetailItem>
                <DetailItem label={t('instructors.specializations_short', 'Expertise')}>
                  {(instructor.specializations || []).length ? (
                    <span className="flex flex-wrap gap-1">
                      {instructor.specializations.map((s: string) => (
                        <span key={s} className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </DetailItem>
                <DetailItem label={t('instructors.languages_short', 'Languages')}>{(instructor.languages || []).join(', ')}</DetailItem>
                {instructor.entity_name ? <DetailItem label={t('instructors.entity', 'Entity')}>{instructor.entity_name}</DetailItem> : null}
                <DetailItem label={t('administration.common.created', 'Created')}>{formatAdminDate(instructor.creation_date, i18n.language)}</DetailItem>
              </dl>
            </AdminCard>
          </div>
          <div className="space-y-5">
            <AdminCard title={t('instructors.rates', 'Rates')} description={t('instructors.rates_desc', 'The instructor override wins; otherwise the category rate applies.')}>
              <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{t('instructors.effective_rate', 'Effective rate')}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-[hsl(var(--dash-ink))]">
                  {money(instructor.effective_hourly_rate, instructor.rate_currency)}
                  <span className="ms-1 text-sm font-normal text-[hsl(var(--dash-muted))]">/ {t('instructors.per_hour', 'h')}</span>
                </div>
                <div className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">
                  {instructor.rate_source === 'instructor'
                    ? t('instructors.rate_source_override', 'Personal rate')
                    : instructor.rate_source
                      ? t('instructors.rate_source_category', 'From category')
                      : t('instructors.no_rate', 'No rate configured')}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <DetailItem label={t('instructors.category_default', 'Category default')}>
                  {instructor.category?.hourly_rate != null ? money(instructor.category.hourly_rate, instructor.category.currency) : null}
                </DetailItem>
                <DetailItem label={t('instructors.rate_override', 'Hourly rate override')}>
                  {instructor.hourly_rate != null ? money(instructor.hourly_rate, instructor.rate_currency) : null}
                </DetailItem>
              </dl>
              {(instructor.category?.language_rates || []).length > 0 && (
                <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">
                  {t('instructors.language_rates', 'Language rates')}:{' '}
                  {instructor.category.language_rates.map((r: any) => `${r.language} ${r.hourly_rate}`).join(' · ')}
                </p>
              )}
            </AdminCard>
            <AdminCard
              title={t('instructors.finance', 'Finance')}
              action={
                <Link className="text-xs font-semibold text-[hsl(var(--dash-accent))] hover:underline" href={getUriWithOrg(orgslug, '/dash/instructors/finance')}>
                  {t('instructors.open_finance', 'Open finance')}
                </Link>
              }
            >
              <dl className="grid grid-cols-2 gap-4">
                <DetailItem label={t('instructors.total_hours', 'Total hours')}>
                  <span className="tabular-nums">{totalHours.toLocaleString(i18n.language)}</span>
                </DetailItem>
                <DetailItem label={t('instructors.total_cost', 'Total cost')}>{money(totalAmount, instructor.rate_currency)}</DetailItem>
              </dl>
            </AdminCard>
          </div>
        </div>
      ) : null}

      {tab === 'courses' ? (
        <DashDataTable
          rows={courses as any[]}
          rowKey={(c: any) => c.course_uuid}
          loading={coursesLoading}
          rowHref={(c: any) => getUriWithOrg(orgslug, `/dash/courses/course/${c.course_uuid.replace('course_', '')}/general`)}
          itemLabel={(n) => t('instructors.courses_count', '{{count}} courses', { count: n })}
          toolbar={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <select className={cn(inputCls, 'h-9 w-full rounded-full py-0 sm:w-64')} value={courseToAdd} onChange={(e) => setCourseToAdd(e.target.value)}>
                <option value="">{t('instructors.pick_course', 'Select a course…')}</option>
                {(lmsCourses as any[])
                  .filter((c) => !assigned.has(c.course_uuid))
                  .map((c) => (
                    <option key={c.course_uuid} value={c.course_uuid}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <GhostButton onClick={addCourse} disabled={!courseToAdd || instructor.status !== 'active'}>
                <Plus className="h-3.5 w-3.5" /> {t('instructors.assign_course', 'Assign course')}
              </GhostButton>
            </div>
          }
          empty={
            <AcademicEmptyState
              compact
              title={t('instructors.no_courses', 'Not assigned to any course yet.')}
              description={t('instructors.no_courses_hint', 'Pick a course above to make this instructor its lead trainer.')}
            />
          }
          columns={[
            { key: 'name', header: t('instructors.course', 'Course'), primary: true, sortValue: (c: any) => c.name, cell: (c: any) => <span className="font-medium">{c.name}</span> },
            {
              key: 'role',
              header: t('instructors.role', 'Role'),
              sortValue: (c: any) => c.source,
              cell: (c: any) => <span className="text-[13px]">{String(t(`instructors.link_${c.source}`, c.source))}</span>,
            },
            {
              key: 'status',
              header: t('administration.common.status', 'Status'),
              cell: (c: any) => (
                <StatusPill status={c.published ? 'active' : 'draft'} label={c.published ? t('instructors.published', 'Published') : t('instructors.unpublished', 'Unpublished')} />
              ),
            },
          ]}
          actions={(c: any) =>
            c.source === 'profile'
              ? [{ label: t('instructors.unassign', 'Remove'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => removeCourse(c) }]
              : []
          }
        />
      ) : null}

      {tab === 'assignments' ? (
        <InstructorAssignmentsPanel orgslug={orgslug} instructorUuid={instructorUuid} access_token={access_token} />
      ) : null}

      {tab === 'availability' ? (
        <AdminCard
          title={t('instructors.availability', 'Weekly availability')}
          description={instructor.availability?.notes || t('instructors.availability_desc', 'Used when scheduling sessions for this instructor.')}
          action={
            <GhostButton onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
            </GhostButton>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((day) => {
              const daySlots = slots.filter((s) => s.day === day)
              return (
                <div key={day} className={cn('rounded-2xl border p-3', daySlots.length ? 'border-[hsl(var(--dash-border))] bg-white' : 'border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/50')}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{String(t(`instructors.day_${day}`, day))}</div>
                  <div className="mt-2 space-y-1">
                    {daySlots.length ? (
                      daySlots.map((s, i) => (
                        <div key={i} className="rounded-lg bg-[hsl(var(--dash-accent-soft))] px-2 py-1 text-center text-xs font-medium tabular-nums text-[hsl(var(--dash-ink))]">
                          {s.start}–{s.end}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[hsl(var(--dash-muted))]">{t('instructors.unavailable', 'Unavailable')}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </AdminCard>
      ) : null}

      {tab === 'activity' ? (
        <DashDataTable
          rows={worklogs as any[]}
          rowKey={(w: any) => w.worklog_uuid}
          loading={logsLoading}
          initialSort={{ key: 'date', dir: 'desc' }}
          itemLabel={(n) => t('instructors.worklogs_count', '{{count}} work logs', { count: n })}
          empty={
            <AcademicEmptyState
              compact
              title={t('instructors.no_activity', 'No activity yet')}
              description={t('instructors.no_activity_hint', 'Logged teaching hours appear here, with the rate applied and the cost.')}
            />
          }
          columns={[
            { key: 'date', header: t('instructors.work_date', 'Date'), sortValue: (w: any) => w.work_date || w.creation_date, cell: (w: any) => formatAdminDate(w.work_date || w.creation_date, i18n.language) },
            {
              key: 'course',
              header: t('instructors.course', 'Course'),
              primary: true,
              cell: (w: any) => <span className="font-medium">{(w.course_uuid && courseNames.get(w.course_uuid)) || w.description || '—'}</span>,
            },
            { key: 'hours', header: t('instructors.hours', 'Hours'), align: 'end', sortValue: (w: any) => w.hours, cell: (w: any) => <span className="tabular-nums">{w.hours}</span> },
            { key: 'rate', header: t('instructors.rate_applied', 'Rate'), align: 'end', hideBelow: 'lg', cell: (w: any) => money(w.rate_applied, w.currency) },
            { key: 'amount', header: t('instructors.amount', 'Amount'), align: 'end', sortValue: (w: any) => w.amount, cell: (w: any) => <span className="font-medium tabular-nums">{money(w.amount, w.currency)}</span> },
          ]}
        />
      ) : null}

      <AdminDrawer
        icon={<ChalkboardTeacher size={20} weight="duotone" />}
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t('instructors.edit', 'Edit Instructor')}
        description={name}
      >
        {editOpen ? (
          <InstructorForm
            orgId={orgId}
            access_token={access_token}
            instructor={instructor}
            onCancel={() => setEditOpen(false)}
            onDone={() => {
              setEditOpen(false)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      <Modal
        isDialogOpen={approveOpen}
        onOpenChange={setApproveOpen}
        minWidth="sm"
        dialogTitle={t('instructors.approve', 'Approve')}
        dialogContent={
          <ApproveInstructorForm
            orgId={orgId}
            access_token={access_token}
            instructor={instructor}
            onDone={() => {
              setApproveOpen(false)
              refresh()
            }}
          />
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

export default InstructorDetail
