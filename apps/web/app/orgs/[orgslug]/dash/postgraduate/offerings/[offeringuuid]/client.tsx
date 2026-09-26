'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Plus, Pencil, Trash2, ExternalLink, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker, LecturerPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import { GradebookPanel } from '@components/Dashboard/Pages/Academic/GradebookPanel'
import {
  DataTable,
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  Stat,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
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

const OFFERING_NEXT: Record<string, string[]> = {
  planned: ['open', 'cancelled'],
  open: ['in_progress', 'planned', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
// Completed/failed are never set by hand: they come from gradebook approval.
const ENROLLMENT_NEXT: Record<string, string[]> = {
  registered: ['dropped', 'withdrawn'],
  dropped: ['registered'],
  withdrawn: ['registered'],
  completed: [],
  failed: [],
}
// Irreversible offering transitions, confirmed with their consequences.
const STATUS_CONFIRM: Record<string, string> = {
  cancelled:
    'Cancel this offering? Every registered student is withdrawn and loses access to the course content. This cannot be undone.',
  completed:
    'Mark this offering completed? This needs approved grades for every registered student and cannot be undone.',
}
const SESSION_TYPES = ['lecture', 'seminar', 'lab', 'tutorial', 'workshop', 'exam', 'other']

/**
 * One course offering. ``workspace="office"`` is the Graduate Studies Office
 * view (section tabs); ``"teaching"`` is the lecturer's view from My Teaching.
 * Controls follow what the API says the viewer may do, in both workspaces.
 */
function OfferingDetail({
  orgslug,
  offeringuuid,
  workspace = 'office',
}: {
  orgslug: string
  offeringuuid: string
  workspace?: 'office' | 'teaching'
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const offering_uuid = `offering_${offeringuuid}`
  const [editOpen, setEditOpen] = useState(false)
  const [sessionModal, setSessionModal] = useState<null | { session?: any }>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [createContentOpen, setCreateContentOpen] = useState(false)

  const { data: offering } = useQuery({
    queryKey: ['academic', 'offering', offering_uuid],
    queryFn: () => getOffering(offering_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['academic', 'offering-sessions', offering_uuid],
    queryFn: () => getOfferingSessions(offering_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: roster = [], error: rosterError } = useQuery({
    queryKey: ['academic', 'offering-roster', offering_uuid],
    queryFn: () => getOfferingEnrollments(offering_uuid, access_token),
    enabled: !!access_token,
    retry: false,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering', offering_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering-sessions', offering_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offering-roster', offering_uuid] })
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

  const canManage = !!offering?.viewer_can_manage
  const isStaff = canManage || !!offering?.viewer_teaches
  const contentHref = offering?.content_course_uuid
    ? canManage
      ? getUriWithOrg(orgslug, `/dash/courses/course/${offering.content_course_uuid.replace('course_', '')}/general`)
      : getUriWithOrg(orgslug, `/course/${offering.content_course_uuid.replace('course_', '')}`)
    : null

  const remove = async () => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteOffering(offering_uuid, access_token)
      toast.success(t('academic.deleted'))
      router.push(getUriWithOrg(orgslug, '/dash/postgraduate/offerings'))
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

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
      <AcademicHeader
        title={offering ? `${offering.course_code} · ${offering.course_name}` : '…'}
        subtitle={offering?.code}
        action={
          offering &&
          canManage && (
            <>
              {(OFFERING_NEXT[offering.status] || []).map((s) => (
                <GhostButton
                  key={s}
                  onClick={() =>
                    (!STATUS_CONFIRM[s] || window.confirm(t(`academic.confirm_offering_${s}`, STATUS_CONFIRM[s]))) &&
                    act(() => updateOffering(offering_uuid, { status: s }, access_token))
                  }
                >
                  {t(`academic.to_${s}`, `Mark ${s.replace('_', ' ')}`)}
                </GhostButton>
              ))}
              <GhostButton onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> {t('academic.edit', 'Edit')}
              </GhostButton>
              <IconButton tone="danger" onClick={remove} aria-label={t('academic.delete', 'Delete')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )
        }
      />
      {workspace === 'office' && <PostgradTabs orgslug={orgslug} />}
      {offering?.viewer_teaches && !canManage && (
        <p className="mb-4 max-w-3xl text-sm text-[hsl(var(--dash-muted))]">
          {t(
            'academic.teaching_scope_hint',
            'You teach this offering. You manage its schedule and gradebook; registrations and the offering itself are handled by the program office.'
          )}
        </p>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label={t('academic.status')} value={<StatusPill status={offering?.status} />} />
          <Stat label={t('academic.term', 'Term')} value={offering?.term_code} />
          <Stat label={t('academic.cohort', 'Cohort')} value={offering?.cohort_code || offering?.cohort_name || t('academic.open_offering', 'Open')} />
          <Stat label={t('academic.section', 'Section')} value={offering?.section} />
          <Stat label={t('academic.credits', 'Credits')} value={offering?.credits} />
          <Stat
            label={t('academic.enrolled_col', 'Enrolled')}
            value={offering ? `${offering.enrolled_count}${offering.capacity != null ? `/${offering.capacity}` : ''}` : '—'}
          />
          <Stat label={t('academic.instructor', 'Instructor')} value={offering?.instructor ? displayName(offering.instructor) : '—'} />
          <Stat label={t('academic.classroom')} value={offering?.classroom} />
        </div>

        <Section
          title={t('academic.content_course', 'Course materials')}
          description={t(
            'academic.content_course_desc',
            'Term-specific lectures, assignments and exams live in this offering’s content course. Registered students get access automatically.'
          )}
        >
          {contentHref ? (
            <Link
              href={contentHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--dash-accent))]"
            >
              <ExternalLink className="h-4 w-4" /> {offering.content_course_name}
            </Link>
          ) : canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[hsl(var(--dash-muted))]">
                {t('academic.no_content_course', 'No content course linked yet — choose one via Edit.')}
              </p>
              <GhostButton onClick={() => setCreateContentOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('academic.create_content_course', 'Create content course')}
              </GhostButton>
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--dash-muted))]">
              {t(
                'academic.no_content_course_staff',
                'No course materials are linked yet. Ask the program office to link or create the content course.'
              )}
            </p>
          )}
        </Section>

        <Section
          title={t('academic.schedule', 'Schedule')}
          action={
            isStaff && (
              <GhostButton onClick={() => setSessionModal({})}>
                <Plus className="h-3.5 w-3.5" /> {t('academic.add_session', 'Add session')}
              </GhostButton>
            )
          }
        >
          <DataTable
            headers={[
              t('academic.session_title', 'Title'),
              t('academic.session_type', 'Type'),
              t('academic.starts', 'Starts'),
              t('academic.ends', 'Ends'),
              t('academic.location', 'Location'),
              '',
            ]}
            empty={t('academic.no_sessions', 'No sessions scheduled.')}
          >
            {sessions.map((s: any) => (
              <tr key={s.session_uuid}>
                <td className={tdCls}>{s.title || '—'}</td>
                <td className={`${tdCls} text-xs`}>{s.session_type ? String(t(`academic.stype_${s.session_type}`, s.session_type)) : '—'}</td>
                <td className={`${tdCls} text-xs`}>{s.start_datetime?.replace('T', ' ') || '—'}</td>
                <td className={`${tdCls} text-xs`}>{s.end_datetime?.replace('T', ' ') || '—'}</td>
                <td className={`${tdCls} text-xs`}>{s.location || '—'}</td>
                <td className={`${tdCls} whitespace-nowrap text-right`}>
                  {isStaff && (
                    <>
                      <IconButton onClick={() => setSessionModal({ session: s })} aria-label={t('academic.edit', 'Edit')}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        onClick={() =>
                          window.confirm(t('academic.confirm_delete')) &&
                          act(() => deleteOfferingSession(offering_uuid, s.session_uuid, access_token), t('academic.deleted'))
                        }
                        aria-label={t('academic.delete', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        {offering && <GradebookPanel offering={offering} />}

        <Section
          title={t('academic.roster', 'Roster')}
          description={t(
            'academic.roster_desc',
            'Registrations for this offering. Dropping or withdrawing a student removes their access to the course materials.'
          )}
          action={
            canManage && (
              <GhostButton onClick={() => setEnrollOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> {t('academic.register_student', 'Register student')}
              </GhostButton>
            )
          }
        >
          {rosterError ? (
            <p className="text-sm text-[hsl(var(--dash-muted))]">{(rosterError as any)?.message}</p>
          ) : (
            <DataTable
              headers={[
                t('academic.student_number', 'Student no.'),
                t('academic.student', 'Student'),
                t('academic.registered_at', 'Registered'),
                t('academic.status'),
                '',
              ]}
              empty={t('academic.no_enrollments', 'No students registered.')}
            >
              {roster.map((e: any) => (
                <tr key={e.enrollment_uuid}>
                  <td className={`${tdCls} font-mono text-xs`}>{e.student_number || '—'}</td>
                  <td className={tdCls}>
                    <div className="font-medium">{displayName(e.user)}</div>
                    <div className="text-xs text-[hsl(var(--dash-muted))]">{e.user.email}</div>
                  </td>
                  <td className={`${tdCls} text-xs`}>{e.registered_at?.slice(0, 10)}</td>
                  <td className={tdCls}>
                    <StatusPill status={e.status} />
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {canManage && (ENROLLMENT_NEXT[e.status] || []).length > 0 && (
                      <select
                        className={selectCls('py-1 text-xs')}
                        value=""
                        onChange={(ev) =>
                          ev.target.value &&
                          act(() => updateEnrollmentStatus(offering_uuid, e.enrollment_uuid, ev.target.value, access_token))
                        }
                      >
                        <option value="">{t('academic.change_status', 'Change status…')}</option>
                        {ENROLLMENT_NEXT[e.status].map((s) => (
                          <option key={s} value={s}>
                            {t(`academic.state_${s}`, s)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Section>
      </div>

      <Modal
        isDialogOpen={editOpen}
        onOpenChange={setEditOpen}
        minWidth="md"
        dialogTitle={`${t('academic.edit', 'Edit')} ${offering?.code || ''}`}
        dialogContent={
          offering && (
            <OfferingEditForm
              orgslug={orgslug}
              offering={offering}
              onDone={() => {
                setEditOpen(false)
                refresh()
              }}
            />
          )
        }
      />
      <Modal
        isDialogOpen={!!sessionModal}
        onOpenChange={(o: boolean) => !o && setSessionModal(null)}
        minWidth="sm"
        dialogTitle={sessionModal?.session ? t('academic.edit', 'Edit') : t('academic.add_session', 'Add session')}
        dialogContent={
          sessionModal && (
            <SessionForm
              offeringUuid={offering_uuid}
              session={sessionModal.session}
              onDone={() => {
                setSessionModal(null)
                refresh()
              }}
            />
          )
        }
      />
      <Modal
        isDialogOpen={createContentOpen}
        onOpenChange={setCreateContentOpen}
        minWidth="md"
        dialogTitle={t('academic.create_content_course', 'Create content course')}
        dialogContent={
          createContentOpen && (
            // Same course-creation flow as Training Courses; the new course is
            // linked as this offering's content course.
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
      <Modal
        isDialogOpen={enrollOpen}
        onOpenChange={setEnrollOpen}
        minWidth="sm"
        dialogTitle={t('academic.register_student', 'Register student')}
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
    </AcademicPageShell>
  )
}

function OfferingEditForm({ orgslug, offering, onDone }: { orgslug: string; offering: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [section, setSection] = useState(offering.section)
  const [classroom, setClassroom] = useState(offering.classroom || '')
  const [capacity, setCapacity] = useState(offering.capacity != null ? String(offering.capacity) : '')
  const [instructor, setInstructor] = useState<string | null>(offering.instructor?.user_uuid || null)
  const [instructorLabel, setInstructorLabel] = useState<string | undefined>(
    offering.instructor ? displayName(offering.instructor) : undefined
  )
  const [ta, setTa] = useState<string | null>(offering.teaching_assistant?.user_uuid || null)
  const [taLabel, setTaLabel] = useState<string | undefined>(
    offering.teaching_assistant ? displayName(offering.teaching_assistant) : undefined
  )
  const [content, setContent] = useState<string>(offering.content_course_uuid || '')
  const [saving, setSaving] = useState(false)

  const { data: lmsCourses = [] } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: () => getOrgLmsCourses(orgslug, access_token),
    enabled: !!access_token,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateOffering(
        offering.offering_uuid,
        {
          section,
          classroom: classroom || null,
          capacity: capacity === '' ? null : Number(capacity),
          instructor_uuid: instructor || '',
          teaching_assistant_uuid: ta || '',
          content_course_uuid: content || null,
        },
        access_token
      )
      toast.success(t('academic.updated'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.section', 'Section')}>
          <input className={inputCls} value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label={t('academic.capacity')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
        </Field>
        <Field label={t('academic.classroom')}>
          <input className={inputCls} value={classroom} onChange={(e) => setClassroom(e.target.value)} />
        </Field>
      </div>
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
      <Field label={t('academic.content_course', 'Course materials')}>
        <select className={inputCls} value={content} onChange={(e) => setContent(e.target.value)}>
          <option value="">—</option>
          {(lmsCourses as any[]).map((c) => (
            <option key={c.course_uuid} value={c.course_uuid}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

function toLocalInput(v?: string | null) {
  return v ? v.slice(0, 16) : ''
}

function SessionForm({ offeringUuid, session, onDone }: { offeringUuid: string; session?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [title, setTitle] = useState(session?.title || '')
  const [type, setType] = useState(session?.session_type || 'lecture')
  const [start, setStart] = useState(toLocalInput(session?.start_datetime))
  const [end, setEnd] = useState(toLocalInput(session?.end_datetime))
  const [location, setLocation] = useState(session?.location || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title: title || null,
        session_type: type,
        start_datetime: start || null,
        end_datetime: end || null,
        location: location || null,
      }
      if (session) await updateOfferingSession(offeringUuid, session.session_uuid, payload, access_token)
      else await createOfferingSession(offeringUuid, payload, access_token)
      toast.success(session ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.session_title', 'Title')}>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.starts', 'Starts')}>
          <input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('academic.ends', 'Ends')}>
          <input type="datetime-local" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.location', 'Location')}>
        <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
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
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.student', 'Student')}>
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        {t('academic.override_prereq', 'Override prerequisite check (exceptional case)')}
      </label>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default OfferingDetail
