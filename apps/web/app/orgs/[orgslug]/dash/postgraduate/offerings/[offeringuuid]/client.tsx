'use client'
import { FacilitySelect, saveWithConflictCheck } from '@components/Dashboard/Pages/Administration/Pickers'
import { RoomAssist } from '@components/Dashboard/Pages/Administration/HallBooking/RoomAssist'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpenText,
  CalendarDots,
  ChalkboardTeacher,
  Check,
  Door,
  Exam,
  GraduationCap,
  PencilSimple,
  Plus,
  Trash,
  UserPlus,
  Users,
  Warning,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicEmptyState, AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker, LecturerPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import { GradebookPanel } from '@components/Dashboard/Pages/Academic/GradebookPanel'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, IconButton, PostgradTabs, Section, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import DashDataTable, { RowActionsMenu, type DashRowAction } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import {
  createOfferingSession,
  deleteOffering,
  deleteOfferingSession,
  displayName,
  enrollInOffering,
  getOffering,
  getOfferingEnrollments,
  getOfferingSessions,
  getOrgLmsCourses,
  updateEnrollmentStatus,
  updateOffering,
  updateOfferingSession,
} from '@services/academic/core'
import { cn } from '@/lib/utils'

const FLOW = ['planned', 'open', 'in_progress', 'completed'] as const
// The forward step from each status, and the way back where one exists.
const NEXT: Record<string, string | null> = { planned: 'open', open: 'in_progress', in_progress: 'completed', completed: null, cancelled: null }
// Completed/failed are never set by hand: they come from gradebook approval.
const ENROLLMENT_NEXT: Record<string, string[]> = {
  registered: ['dropped', 'withdrawn'],
  dropped: ['registered'],
  withdrawn: ['registered'],
  completed: [],
  failed: [],
}
const SESSION_TYPES = ['lecture', 'seminar', 'lab', 'tutorial', 'workshop', 'exam', 'other']
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'
type Tab = 'roster' | 'schedule' | 'gradebook' | 'materials'

/**
 * One course offering. ``workspace="office"`` is the Graduate Studies Office
 * view; ``"teaching"`` is the lecturer's view from My Teaching. Controls follow
 * what the API says the viewer may do, in both workspaces.
 */
function OfferingDetail({ orgslug, offeringuuid, workspace = 'office' }: { orgslug: string; offeringuuid: string; workspace?: 'office' | 'teaching' }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const offering_uuid = `offering_${offeringuuid}`
  const [tabChoice, setTabChoice] = useState<Tab | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [sessionDrawer, setSessionDrawer] = useState<null | { session?: any }>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [createContentOpen, setCreateContentOpen] = useState(false)
  const [now] = useState(() => Date.now())

  const { data: offering, error } = useQuery({ queryKey: ['academic', 'offering', offering_uuid], queryFn: () => getOffering(offering_uuid, access_token), enabled: !!access_token, retry: false })
  const { data: sessions = [] } = useQuery({ queryKey: ['academic', 'offering-sessions', offering_uuid], queryFn: () => getOfferingSessions(offering_uuid, access_token), enabled: !!access_token })
  const { data: roster = [], error: rosterError, isLoading: loadingRoster } = useQuery({
    queryKey: ['academic', 'offering-roster', offering_uuid],
    queryFn: () => getOfferingEnrollments(offering_uuid, access_token),
    enabled: !!access_token,
    retry: false,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering', offering_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering-sessions', offering_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering-roster', offering_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offerings'] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }
  const act = async (fn: () => Promise<any>, ok = t('academic.updated')) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }
  const confirmConflict = async (message: string) =>
    (await ask({ title: t('administration.facilities.book_anyway', 'Book the room anyway?'), message, confirmText: t('academic.off.book_anyway', 'Book anyway'), tone: 'warning' })) !== null

  if (error)
    return (
      <AcademicPageShell>
        <p className="dash-card rounded-[1.25rem] p-6 text-sm">{(error as any)?.message}</p>
      </AcademicPageShell>
    )

  const canManage = !!offering?.viewer_can_manage
  const isStaff = canManage || !!offering?.viewer_teaches
  const tab: Tab = tabChoice ?? (offering && ['in_progress', 'completed'].includes(offering.status) ? 'gradebook' : 'roster')
  const contentHref = offering?.content_course_uuid
    ? canManage
      ? getUriWithOrg(orgslug, `/dash/courses/course/${offering.content_course_uuid.replace('course_', '')}/general`)
      : getUriWithOrg(orgslug, `/course/${offering.content_course_uuid.replace('course_', '')}`)
    : null
  // Everyone taking the course or who finished it; the API counts registered and finished separately.
  const students = offering ? offering.enrolled_count + (offering.results_count || 0) : 0
  const fill = offering?.capacity ? Math.min(100, Math.round((students / offering.capacity) * 100)) : null
  const when = (v?: string | null, opts?: Intl.DateTimeFormatOptions) => (v ? new Date(v).toLocaleString(i18n.language, opts) : '')

  const nextStatus = offering ? NEXT[offering.status] : null
  const nextLabel: Record<string, string> = {
    open: t('academic.off.open_registration', 'Open registration'),
    in_progress: t('academic.off.start_teaching', 'Start teaching'),
    completed: t('academic.off.complete', 'Complete offering'),
  }
  const advance = async () => {
    if (!nextStatus) return
    if (nextStatus === 'completed') {
      const ok = await ask({
        title: t('academic.off.complete_title', 'Complete {{code}}?', { code: offering.code }),
        message: t('academic.confirm_offering_completed', 'Mark this offering completed? This needs approved grades for every registered student and cannot be undone.'),
        confirmText: t('academic.off.complete', 'Complete offering'),
        tone: 'warning',
      })
      if (ok === null) return
    }
    act(() => updateOffering(offering_uuid, { status: nextStatus }, access_token))
  }
  const cancelOffering = async () => {
    const ok = await ask({
      title: t('academic.off.cancel_title', 'Cancel {{code}}?', { code: offering.code }),
      message: t('academic.confirm_offering_cancelled', 'Cancel this offering? Every registered student is withdrawn and loses access to the course content. This cannot be undone.'),
      confirmText: t('academic.off.cancel', 'Cancel offering'),
      tone: 'danger',
    })
    if (ok !== null) act(() => updateOffering(offering_uuid, { status: 'cancelled' }, access_token))
  }
  const remove = async () => {
    const ok = await ask({
      title: t('academic.off.delete_title', 'Delete {{code}}?', { code: offering.code }),
      message: t('academic.off.delete_message', 'Only offerings without results can be deleted. Cancel it instead once teaching has started.'),
      confirmText: t('academic.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok === null) return
    try {
      await deleteOffering(offering_uuid, access_token)
      toast.success(t('academic.deleted'))
      router.push(getUriWithOrg(orgslug, '/dash/postgraduate/offerings'))
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }
  const changeEnrollment = async (e: any, status: string) => {
    if (status !== 'registered') {
      const ok = await ask({
        title: status === 'dropped' ? t('academic.off.drop_title', 'Drop {{name}}?', { name: displayName(e.user) }) : t('academic.off.withdraw_title', 'Withdraw {{name}}?', { name: displayName(e.user) }),
        message: t('academic.roster_desc', 'Registrations for this offering. Dropping or withdrawing a student removes their access to the course materials.'),
        confirmText: String(t(`academic.state_${status}`, status)),
        tone: 'warning',
      })
      if (ok === null) return
    }
    act(() => updateEnrollmentStatus(offering_uuid, e.enrollment_uuid, status, access_token))
  }
  const removeSession = async (s: any) => {
    const ok = await ask({ title: t('academic.off.delete_session', 'Delete this session?'), message: s.title || when(s.start_datetime), confirmText: t('academic.delete', 'Delete'), tone: 'danger' })
    if (ok !== null) act(() => deleteOfferingSession(offering_uuid, s.session_uuid, access_token), t('academic.deleted'))
  }

  const sortedSessions = [...(sessions as any[])].sort((a, b) => String(a.start_datetime || '').localeCompare(String(b.start_datetime || '')))
  const tabs: { key: Tab; label: string; count?: number; Icon: React.ElementType }[] = [
    { key: 'roster', label: t('academic.roster', 'Roster'), count: (roster as any[]).length, Icon: Users },
    { key: 'schedule', label: t('academic.schedule', 'Schedule'), count: sortedSessions.length, Icon: CalendarDots },
    { key: 'gradebook', label: t('academic.off.gradebook', 'Gradebook'), Icon: Exam },
    { key: 'materials', label: t('academic.content_course', 'Course materials'), Icon: BookOpenText },
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={
          workspace === 'teaching'
            ? [
                { label: t('academic.my_teaching', 'My Teaching'), href: getUriWithOrg(orgslug, '/dash/postgraduate/teaching'), icon: <GraduationCap size={14} /> },
                { label: offering?.code || '…' },
              ]
            : [
                { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
                { label: t('academic.tab_offerings', 'Course Offerings'), href: getUriWithOrg(orgslug, '/dash/postgraduate/offerings') },
                { label: offering?.code || '…' },
              ]
        }
      />
      {workspace === 'office' ? <PostgradTabs orgslug={orgslug} /> : null}

      {offering ? (
        <section className="dash-card mb-4 mt-2 rounded-[1.25rem] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--dash-muted))]">{offering.course_code}</span>
                <StatusPill status={offering.status} />
                <StatusPill status={offering.grade_status === 'open' ? 'draft' : offering.grade_status} label={String(t(`academic.grades_${offering.grade_status}`, offering.grade_status))} />
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{offering.course_name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
                <span className="font-mono text-[12px] text-[hsl(var(--dash-ink))]/75">{offering.code}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDots size={14} /> {offering.term_code}
                </span>
                <span>{offering.cohort_code || offering.cohort_name || t('academic.open_offering', 'Open')}</span>
                <span>{t('academic.section', 'Section')} {offering.section}</span>
                <span>{t('academic.off.credits', '{{count}} cr', { count: offering.credits })}</span>
                {offering.facility?.name || offering.classroom ? (
                  <span className="inline-flex items-center gap-1">
                    <Door size={14} /> {offering.facility?.name || offering.classroom}
                  </span>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {offering.instructor ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-canvas))] py-1 pe-3 ps-1 text-[12.5px]">
                    <PersonAvatar name={displayName(offering.instructor)} size={24} />
                    <span className="font-medium">{displayName(offering.instructor)}</span>
                    <span className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.instructor', 'Instructor')}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 transition-colors enabled:hover:bg-amber-100"
                  >
                    <Warning size={14} weight="bold" /> {canManage ? t('academic.office.action_assign', 'Assign lecturer') : t('academic.off.no_lecturer', 'No lecturer')}
                  </button>
                )}
                {offering.teaching_assistant ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-canvas))] py-1 pe-3 ps-1 text-[12.5px]">
                    <PersonAvatar name={displayName(offering.teaching_assistant)} size={24} />
                    <span className="font-medium">{displayName(offering.teaching_assistant)}</span>
                    <span className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.teaching_assistant', 'Teaching assistant')}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-[260px]">
              <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
                <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.tab_students', 'Students')}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {students}
                  {offering.capacity != null ? <span className="text-xs font-normal text-[hsl(var(--dash-muted))]"> / {offering.capacity}</span> : null}
                </p>
                {fill != null ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white">
                    <div className={cn('h-full rounded-full', fill >= 100 ? 'bg-red-400' : GOLD)} style={{ width: `${fill}%` }} />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
                <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.schedule', 'Schedule')}</p>
                <p className="text-lg font-semibold tabular-nums">{sortedSessions.length}</p>
              </div>
            </div>
          </div>

          {/* Lifecycle */}
          <div className="mt-5 flex flex-col gap-3 border-t border-[hsl(var(--dash-border))]/60 pt-4 md:flex-row md:items-center">
            {offering.status === 'cancelled' ? (
              <p className="flex-1 text-[13px] font-medium text-red-700">{t('academic.off.cancelled_note', 'This offering was cancelled. Registrations were withdrawn.')}</p>
            ) : (
              <ol className="flex flex-1 items-center gap-1 overflow-x-auto">
                {FLOW.map((step, i) => {
                  const at = FLOW.indexOf(offering.status as any)
                  const done = i < at || (i === at && step === 'completed')
                  const current = i === at && step !== 'completed'
                  return (
                    <React.Fragment key={step}>
                      <li className="flex shrink-0 items-center gap-1.5">
                        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold', done ? 'bg-emerald-500 text-white' : current ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
                          {done ? <Check size={12} weight="bold" /> : i + 1}
                        </span>
                        <span className={cn('whitespace-nowrap text-[12px]', current ? 'font-semibold' : 'text-[hsl(var(--dash-muted))]')}>{String(t(`academic.state_${step}`, step))}</span>
                      </li>
                      {i < FLOW.length - 1 ? <li aria-hidden="true" className={cn('h-px min-w-4 flex-1', i < at ? 'bg-emerald-400' : 'bg-[hsl(var(--dash-border))]')} /> : null}
                    </React.Fragment>
                  )
                })}
              </ol>
            )}
            {canManage ? (
              <div className="flex shrink-0 items-center gap-2">
                {nextStatus ? (
                  <button
                    type="button"
                    onClick={advance}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_hsl(0_0%_8%/0.6)] transition-all hover:-translate-y-px hover:opacity-90"
                  >
                    {nextLabel[nextStatus]} <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
                  </button>
                ) : null}
                <GhostButton onClick={() => setEditOpen(true)}>
                  <PencilSimple size={14} /> {t('academic.edit', 'Edit')}
                </GhostButton>
                <RowActionsMenu
                  label={t('administration.table.actions', 'Actions')}
                  actions={[
                    ...(offering.status === 'open' ? [{ label: t('academic.off.back_to_planned', 'Back to planned'), onSelect: () => act(() => updateOffering(offering_uuid, { status: 'planned' }, access_token)) }] : []),
                    ...(['planned', 'open', 'in_progress'].includes(offering.status) ? [{ label: t('academic.off.cancel', 'Cancel offering'), tone: 'danger' as const, onSelect: cancelOffering }] : []),
                    { label: t('academic.delete', 'Delete'), tone: 'danger' as const, onSelect: remove },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="dash-shimmer mb-4 mt-2 h-48 rounded-[1.25rem]" />
      )}

      {offering?.viewer_teaches && !canManage ? (
        <p className="mb-4 rounded-2xl bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
          {t('academic.teaching_scope_hint', 'You teach this offering. You manage its schedule and gradebook; registrations and the offering itself are handled by the program office.')}
        </p>
      ) : null}

      <div className={cn(TAB_TRACK, 'mb-5')} role="tablist">
        {tabs.map(({ key, label, count, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTabChoice(key)} className={tabItemClass(tab === key, 'inline-flex items-center gap-1.5')}>
            <Icon size={15} weight={tab === key ? 'fill' : 'duotone'} />
            {label}
            {count != null ? <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', tab === key ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))]')}>{count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'roster' ? (
        rosterError ? (
          <p className="dash-card rounded-[1.25rem] p-6 text-sm text-[hsl(var(--dash-muted))]">{(rosterError as any)?.message}</p>
        ) : (
          <DashDataTable
            rows={roster as any[]}
            rowKey={(e: any) => e.enrollment_uuid}
            loading={loadingRoster}
            initialSort={{ key: 'student', dir: 'asc' }}
            itemLabel={(n) => t('academic.coh.students_count', '{{count}} students', { count: n })}
            actions={canManage ? (e: any) => (ENROLLMENT_NEXT[e.status] || []).map((s): DashRowAction => ({ label: s === 'registered' ? t('academic.off.reregister', 'Register again') : String(t(`academic.state_${s}`, s)), tone: s === 'registered' ? undefined : 'danger', onSelect: () => changeEnrollment(e, s) })) : undefined}
            toolbarEnd={
              canManage ? (
                <GhostButton onClick={() => setEnrollOpen(true)}>
                  <UserPlus size={14} /> {t('academic.register_student', 'Register student')}
                </GhostButton>
              ) : undefined
            }
            empty={<AcademicEmptyState compact icon={<Users size={24} />} title={t('academic.no_enrollments', 'No students registered.')} description={t('academic.roster_desc', 'Registrations for this offering. Dropping or withdrawing a student removes their access to the course materials.')} />}
            columns={[
              {
                key: 'student',
                header: t('academic.student', 'Student'),
                primary: true,
                sortValue: (e: any) => displayName(e.user),
                cell: (e: any) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar name={displayName(e.user)} size={32} />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate font-medium">{displayName(e.user)}</div>
                      <div className="truncate font-mono text-[11px] text-[hsl(var(--dash-muted))]">{e.student_number || e.user?.email}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'registered', header: t('academic.registered_at', 'Registered'), hideBelow: 'lg', sortValue: (e: any) => e.registered_at, cell: (e: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{when(e.registered_at, { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}</span> },
              { key: 'status', header: t('academic.status'), sortValue: (e: any) => e.status, cell: (e: any) => <StatusPill status={e.status} /> },
            ]}
          />
        )
      ) : null}

      {tab === 'schedule' ? (
        <Section
          icon={<CalendarDots size={18} weight="duotone" />}
          title={t('academic.schedule', 'Schedule')}
          count={sortedSessions.length}
          action={
            isStaff ? (
              <GhostButton onClick={() => setSessionDrawer({})}>
                <Plus size={14} /> {t('academic.add_session', 'Add session')}
              </GhostButton>
            ) : null
          }
        >
          {sortedSessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-10 text-center text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_sessions', 'No sessions scheduled.')}</p>
          ) : (
            <ul className="space-y-2">
              {sortedSessions.map((s) => {
                const start = s.start_datetime ? new Date(s.start_datetime) : null
                const past = start ? start.getTime() < now : false
                return (
                  <li key={s.session_uuid} className={cn('group flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-3 py-2.5', past && 'opacity-70')}>
                    <span className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-[hsl(var(--dash-border))]/70 text-center">
                      <span className={cn('w-full py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white', past ? 'bg-[hsl(var(--dash-muted))]' : 'bg-[hsl(var(--dash-ink))]')}>
                        {start ? start.toLocaleDateString(i18n.language, { month: 'short' }) : '—'}
                      </span>
                      <span className="py-1 text-base font-bold leading-none tabular-nums">{start ? start.getDate() : '·'}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">
                        {s.title || String(t(`academic.stype_${s.session_type}`, s.session_type || ''))}
                        {s.session_type ? <span className="ms-2 rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[10.5px] font-medium text-[hsl(var(--dash-muted))]">{String(t(`academic.stype_${s.session_type}`, s.session_type))}</span> : null}
                      </p>
                      <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">
                        {[
                          start ? `${start.toLocaleDateString(i18n.language, { weekday: 'short' })} ${when(s.start_datetime, { hour: '2-digit', minute: '2-digit' })}${s.end_datetime ? ` – ${when(s.end_datetime, { hour: '2-digit', minute: '2-digit' })}` : ''}` : null,
                          [s.facility?.name || (!s.location && offering?.facility?.name), s.location].filter(Boolean).join(' · '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {isStaff ? (
                      <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
                        <IconButton onClick={() => setSessionDrawer({ session: s })} aria-label={t('academic.edit', 'Edit')}>
                          <PencilSimple size={15} />
                        </IconButton>
                        <IconButton tone="danger" onClick={() => removeSession(s)} aria-label={t('academic.delete', 'Delete')}>
                          <Trash size={15} />
                        </IconButton>
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      ) : null}

      {tab === 'gradebook' && offering ? <GradebookPanel offering={offering} /> : null}

      {tab === 'materials' ? (
        <Section icon={<BookOpenText size={18} weight="duotone" />} title={t('academic.content_course', 'Course materials')} description={t('academic.content_course_desc', 'Term-specific lectures, assignments and exams live in this offering’s content course. Registered students get access automatically.')}>
          {contentHref ? (
            <Link href={contentHref} className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-4 py-3 transition-shadow hover:shadow-[0_12px_28px_-18px_hsl(220_30%_20%/0.45)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
                <BookOpenText size={20} weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{offering.content_course_name}</span>
                <span className="block text-[12px] text-[hsl(var(--dash-muted))]">{canManage ? t('academic.off.edit_content', 'Edit lectures, assignments and exams') : t('academic.off.view_content', 'Open the course')}</span>
              </span>
              <ArrowSquareOut size={16} className="text-[hsl(var(--dash-muted))] transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </Link>
          ) : canManage ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-6 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_content_course', 'No content course linked yet — choose one via Edit.')}</p>
              <GhostButton onClick={() => setCreateContentOpen(true)}>
                <Plus size={14} /> {t('academic.create_content_course', 'Create content course')}
              </GhostButton>
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_content_course_staff', 'No course materials are linked yet. Ask the program office to link or create the content course.')}</p>
          )}
        </Section>
      ) : null}

      <PostgradDrawer
        isDialogOpen={editOpen}
        onOpenChange={setEditOpen}
        minWidth="md"
        icon={<ChalkboardTeacher size={20} weight="duotone" />}
        dialogTitle={`${t('academic.edit', 'Edit')} ${offering?.code || ''}`}
        dialogContent={
          offering ? (
            <OfferingEditForm
              orgslug={orgslug}
              offering={offering}
              confirmConflict={confirmConflict}
              onDone={() => {
                setEditOpen(false)
                refresh()
              }}
            />
          ) : null
        }
      />
      <PostgradDrawer
        isDialogOpen={!!sessionDrawer}
        onOpenChange={(o: boolean) => !o && setSessionDrawer(null)}
        icon={<CalendarDots size={20} weight="duotone" />}
        dialogTitle={sessionDrawer?.session ? t('academic.off.edit_session', 'Edit session') : t('academic.add_session', 'Add session')}
        dialogDescription={offering ? `${offering.course_code} · ${offering.code}` : undefined}
        dialogContent={
          sessionDrawer ? (
            <SessionForm
              offeringUuid={offering_uuid}
              session={sessionDrawer.session}
              defaultRoom={offering?.facility}
              attendees={offering ? offering.enrolled_count || offering.capacity || null : null}
              confirmConflict={confirmConflict}
              onDone={() => {
                setSessionDrawer(null)
                refresh()
              }}
            />
          ) : null
        }
      />
      <Modal
        isDialogOpen={createContentOpen}
        onOpenChange={setCreateContentOpen}
        minWidth="md"
        dialogTitle={t('academic.create_content_course', 'Create content course')}
        dialogContent={
          createContentOpen && (
            // Same course-creation flow as Training Courses; the new course is linked as this offering's content course.
            <CreateCourseModal
              orgslug={orgslug}
              closeModal={() => setCreateContentOpen(false)}
              onCreated={async (courseUuid: string) => {
                try {
                  await updateOffering(offering_uuid, { content_course_uuid: courseUuid }, access_token)
                  refresh()
                } catch (err: any) {
                  toast.error(err?.message || t('academic.update_failed'))
                }
              }}
            />
          )
        }
      />
      <PostgradDrawer
        isDialogOpen={enrollOpen}
        onOpenChange={setEnrollOpen}
        icon={<UserPlus size={20} weight="duotone" />}
        dialogTitle={t('academic.register_student', 'Register student')}
        dialogDescription={offering ? `${offering.course_code} · ${offering.code}` : undefined}
        dialogContent={
          <EnrollForm
            offeringUuid={offering_uuid}
            onDone={() => {
              setEnrollOpen(false)
              refresh()
            }}
          />
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function OfferingEditForm({ orgslug, offering, onDone, confirmConflict }: { orgslug: string; offering: any; onDone: () => void; confirmConflict: (_m: string) => Promise<boolean> }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [section, setSection] = useState(offering.section)
  const [classroom, setClassroom] = useState(offering.classroom || '')
  const [facility, setFacility] = useState<string>(offering.facility?.facility_uuid || '')
  const [capacity, setCapacity] = useState(offering.capacity != null ? String(offering.capacity) : '')
  const [instructor, setInstructor] = useState<string | null>(offering.instructor?.user_uuid || null)
  const [instructorLabel, setInstructorLabel] = useState<string | undefined>(offering.instructor ? displayName(offering.instructor) : undefined)
  const [ta, setTa] = useState<string | null>(offering.teaching_assistant?.user_uuid || null)
  const [taLabel, setTaLabel] = useState<string | undefined>(offering.teaching_assistant ? displayName(offering.teaching_assistant) : undefined)
  const [content, setContent] = useState<string>(offering.content_course_uuid || '')
  const [saving, setSaving] = useState(false)

  const { data: lmsCourses = [] } = useQuery({ queryKey: ['academic', 'org-courses', orgslug], queryFn: () => getOrgLmsCourses(orgslug, access_token), enabled: !!access_token })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await saveWithConflictCheck(
        (allow_conflict) =>
          updateOffering(
            offering.offering_uuid,
            {
              section,
              classroom: classroom || null,
              facility_uuid: facility,
              allow_conflict,
              capacity: capacity === '' ? null : Number(capacity),
              instructor_uuid: instructor || '',
              teaching_assistant_uuid: ta || '',
              content_course_uuid: content || null,
            },
            access_token
          ),
        t('administration.facilities.book_anyway', 'Book the room anyway?'),
        confirmConflict
      )
      if (!saved) return
      toast.success(t('academic.updated'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.off.section_teaching', 'Teaching staff')} columns={1}>
        <Field label={t('academic.instructor', 'Instructor')}>
          <LecturerPicker
            orgId={orgId}
            access_token={access_token}
            value={instructor}
            selectedLabel={instructorLabel}
            onChange={(uuid, label) => {
              setInstructor(uuid)
              setInstructorLabel(label)
            }}
          />
        </Field>
        <Field label={t('academic.teaching_assistant', 'Teaching assistant')}>
          <LecturerPicker
            orgId={orgId}
            access_token={access_token}
            value={ta}
            selectedLabel={taLabel}
            onChange={(uuid, label) => {
              setTa(uuid)
              setTaLabel(label)
            }}
          />
        </Field>
      </FormSection>
      <FormSection title={t('academic.off.section_delivery', 'Lecturer and room')}>
        <Field label={t('administration.facilities.default_room', 'Room / facility')} className="sm:col-span-2">
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} current={offering.facility} />
        </Field>
        <Field label={t('academic.classroom')}>
          <input className={inputCls} value={classroom} onChange={(e) => setClassroom(e.target.value)} />
        </Field>
        <Field label={t('academic.section', 'Section')}>
          <input className={inputCls} value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label={t('academic.capacity')} hint={t('training.capacity_hint', 'Leave empty for open seats')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.content_course', 'Course materials')} columns={1}>
        <Field label={t('academic.off.content_course', 'Content course')} hint={t('academic.off.content_hint', 'Registered students get access to it automatically.')}>
          <select className={inputCls} value={content} onChange={(e) => setContent(e.target.value)}>
            <option value="">—</option>
            {(lmsCourses as any[]).map((c) => (
              <option key={c.course_uuid} value={c.course_uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

const toLocalInput = (v?: string | null) => (v ? v.slice(0, 16) : '')

function SessionForm({
  offeringUuid,
  session,
  defaultRoom,
  attendees,
  onDone,
  confirmConflict,
}: {
  offeringUuid: string
  session?: any
  /** The offering's room, used by sessions without their own. */
  defaultRoom?: { facility_uuid: string; name: string } | null
  attendees?: number | null
  onDone: () => void
  confirmConflict: (_m: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [title, setTitle] = useState(session?.title || '')
  const [type, setType] = useState(session?.session_type || 'lecture')
  const [start, setStart] = useState(toLocalInput(session?.start_datetime))
  const [end, setEnd] = useState(toLocalInput(session?.end_datetime))
  const [location, setLocation] = useState(session?.location || '')
  const [facility, setFacility] = useState<string>(session?.facility?.facility_uuid || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (start && end && end <= start) {
      setError(String(t('academic.off.end_after_start', 'The end must be after the start')))
      return
    }
    setError('')
    setSaving(true)
    try {
      const payload = { title: title || null, session_type: type, start_datetime: start || null, end_datetime: end || null, location: location || null, facility_uuid: facility || '' }
      const saved = await saveWithConflictCheck(
        (allow_conflict) =>
          session
            ? updateOfferingSession(offeringUuid, session.session_uuid, { ...payload, allow_conflict }, access_token)
            : createOfferingSession(offeringUuid, { ...payload, allow_conflict }, access_token),
        t('administration.facilities.book_anyway', 'Book the room anyway?'),
        confirmConflict
      )
      if (!saved) return
      toast.success(session ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('academic.off.section_session', 'Session')}>
        <Field label={t('academic.session_title', 'Title')}>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('academic.off.title_placeholder', 'Week 3 lecture')} />
        </Field>
        <Field label={t('academic.session_type', 'Type')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {SESSION_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.stype_${s}`, s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.starts', 'Starts')}>
          <input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('academic.ends', 'Ends')} error={error}>
          <input type="datetime-local" className={inputCls} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!error} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.location', 'Location')}>
        <Field label={t('administration.facilities.room', 'Room')}>
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} current={session?.facility} emptyLabel={t('administration.facilities.offering_room', 'Offering room (default)')} />
        </Field>
        <RoomAssist
          className="sm:col-span-2"
          start={start}
          end={end}
          room={facility}
          defaultRoom={defaultRoom}
          attendees={attendees}
          exclude={session?.session_uuid}
          onPickRoom={setFacility}
          onPickTime={(s, e) => {
            setStart(s)
            setEnd(e)
          }}
        />
        <Field label={t('academic.off.location_note', 'Location note or link')}>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

function EnrollForm({ offeringUuid, onDone }: { offeringUuid: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [user, setUser] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [override, setOverride] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await enrollInOffering(offeringUuid, user, access_token, override)
      toast.success(t('academic.registered_ok', 'Student registered'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.student', 'Student')} columns={1}>
        <Field label={t('academic.student', 'Student')} required>
          <CoordinatorPicker
            orgId={orgId}
            access_token={access_token}
            value={user}
            selectedLabel={label}
            onlyRoles={['role_global_user']}
            placeholder={t('academic.search_students', 'Search trainees…')}
            onChange={(uuid, l) => {
              setUser(uuid)
              setLabel(l)
            }}
          />
        </Field>
        <label className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900">
          <input type="checkbox" className="mt-0.5" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          {t('academic.override_prereq', 'Override prerequisite check (exceptional case)')}
        </label>
      </FormSection>
      <SubmitRow saving={saving} disabled={!user} />
    </form>
  )
}

export default OfferingDetail
