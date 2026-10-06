'use client'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BookOpen,
  Calendar,
  Certificate,
  ClipboardText,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import {
  getCourseAcademicProfile,
  upsertCourseAcademicProfile,
  getCourseSessions,
  createCourseSession,
  deleteCourseSession,
} from '@services/academic/academic'
import {
  FacilitySelect,
  InstructorSelect,
  saveWithConflictCheck,
  useFacilityOptions,
} from '@components/Dashboard/Pages/Administration/Pickers'
import { AddOnAttachmentsPanel } from '@components/Dashboard/Pages/Administration/AddOnAttachmentsPanel'

const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

const OFFERING_STATUSES = ['draft', 'open', 'in_progress', 'closed', 'archived']

function instructorLabel(u: any): string {
  if (!u) return ''
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return full || u.username || ''
}

/**
 * Editor for a Course's academic profile — the offering attributes that follow
 * the course everywhere it is used (postgraduate semesters + training programs).
 * Learning materials and the question bank live in the course itself and are
 * only surfaced here; the certificate reuses the course's existing certification.
 */
export function CourseProfilePanel({
  courseUuid,
  access_token,
}: {
  courseUuid: string
  orgId: number
  access_token: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['academic', 'course-profile', courseUuid],
    queryFn: () => getCourseAcademicProfile(courseUuid, access_token),
    enabled: !!courseUuid && !!access_token,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['academic', 'course-sessions', courseUuid],
    queryFn: () => getCourseSessions(courseUuid, access_token),
    enabled: !!courseUuid && !!access_token,
  })

  const [creditHours, setCreditHours] = useState('')
  const [capacity, setCapacity] = useState('')
  const [status, setStatus] = useState('draft')
  const [classroom, setClassroom] = useState('')
  const [issuesCertificate, setIssuesCertificate] = useState(false)
  const [instructorUuid, setInstructorUuid] = useState<string>('')
  const [facilityUuid, setFacilityUuid] = useState<string>('')
  const facilityOptions = useFacilityOptions()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile === undefined) return
    setCreditHours(profile?.credit_hours != null ? String(profile.credit_hours) : '')
    setCapacity(profile?.capacity != null ? String(profile.capacity) : '')
    setStatus(profile?.status || 'draft')
    setClassroom(profile?.classroom || '')
    setIssuesCertificate(!!profile?.issues_certificate)
    setInstructorUuid(profile?.instructor?.user_uuid || '')
    setFacilityUuid(profile?.facility?.facility_uuid || '')
  }, [profile])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        credit_hours: creditHours === '' ? null : Number(creditHours),
        capacity: capacity === '' ? null : Number(capacity),
        status,
        classroom: classroom || null,
        issues_certificate: issuesCertificate,
        instructor_uuid: instructorUuid,
        facility_uuid: facilityUuid,
      }
      const saved = await saveWithConflictCheck(
        (allow_conflict) => upsertCourseAcademicProfile(courseUuid, { ...payload, allow_conflict }, access_token),
        t('administration.facilities.book_anyway', 'Book the room anyway?')
      )
      if (saved) {
        toast.success(t('academic.profile_saved'))
        queryClient.invalidateQueries({ queryKey: ['academic', 'course-profile', courseUuid] })
        queryClient.invalidateQueries({ queryKey: ['academic', 'course-sessions', courseUuid] })
      }
    } catch (err: any) {
      toast.error(err?.message || t('academic.profile_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const selectedFacility = facilityOptions.find((f) => f.facility_uuid === facilityUuid)
  const overCapacity =
    selectedFacility?.capacity != null && capacity !== '' && Number(capacity) > selectedFacility.capacity

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('academic.credit_hours')}</label>
          <input
            type="number"
            step="0.5"
            min="0"
            className={inputCls}
            value={creditHours}
            onChange={(e) => setCreditHours(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t('academic.capacity')}</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            placeholder={t('academic.unlimited')}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t('academic.status')}</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {OFFERING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.cstatus_${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('academic.classroom')}</label>
          <input
            className={inputCls}
            placeholder={t('academic.classroom_placeholder')}
            value={classroom}
            onChange={(e) => setClassroom(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('academic.instructor')}</label>
          <InstructorSelect
            className={inputCls}
            value={instructorUuid}
            onChange={setInstructorUuid}
            current={profile?.instructor ? { user_uuid: profile.instructor.user_uuid, name: instructorLabel(profile.instructor) } : null}
          />
        </div>
        <div>
          <label className={labelCls}>{t('administration.facilities.default_room', 'Room / facility')}</label>
          <FacilitySelect
            className={inputCls}
            value={facilityUuid}
            onChange={setFacilityUuid}
            current={profile?.facility || null}
          />
          {overCapacity && (
            <p className="mt-1 text-[11px] text-amber-700">
              {t('administration.facilities.over_capacity', 'Capacity is larger than the room ({{count}} seats).', { count: selectedFacility?.capacity })}
            </p>
          )}
        </div>
      </div>

      {/* Add-ons come from the shared catalog (Administration → Add-ons). */}
      <div>
        <label className={labelCls}>{t('academic.add_ons')}</label>
        <AddOnAttachmentsPanel targetType="course" targetUuid={courseUuid} compact />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={issuesCertificate}
          onChange={(e) => setIssuesCertificate(e.target.checked)}
        />
        <Certificate className="w-4 h-4" />
        {t('academic.issues_certificate')}
      </label>

      {/* Surfaced from the existing course (no duplication) */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
          <BookOpen className="w-3.5 h-3.5" /> {t('academic.learning_materials_in_course')}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
          <ClipboardText className="w-3.5 h-3.5" />
          {(profile?.assignment_count ?? 0)} {t('academic.question_bank_assignments')}
        </span>
        {profile?.has_course_certification && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700">
            <Certificate className="w-3.5 h-3.5" /> {t('academic.has_certification')}
          </span>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2 bg-[hsl(var(--dash-accent))] text-[hsl(var(--dash-ink))] rounded-lg text-sm font-bold disabled:opacity-40"
      >
        {saving ? t('academic.saving') : t('academic.save_profile')}
      </button>

      <SessionsEditor
        courseUuid={courseUuid}
        access_token={access_token}
        sessions={sessions as any[]}
      />
    </div>
  )
}

function SessionsEditor({
  courseUuid,
  access_token,
  sessions,
}: {
  courseUuid: string
  access_token: string
  sessions: any[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [facilityUuid, setFacilityUuid] = useState('')
  const [instructorUuid, setInstructorUuid] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['academic', 'course-sessions', courseUuid] })

  const add = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const created = await saveWithConflictCheck(
        (allow_conflict) =>
          createCourseSession(
            courseUuid,
            {
              title: title.trim(),
              start_date: start || null,
              end_date: end || null,
              location: location || null,
              facility_uuid: facilityUuid || null,
              instructor_uuid: instructorUuid || null,
              allow_conflict,
            },
            access_token
          ),
        t('administration.facilities.book_anyway', 'Book the room anyway?')
      )
      if (!created) return
      setTitle('')
      setStart('')
      setEnd('')
      setLocation('')
      setFacilityUuid('')
      setInstructorUuid('')
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.session_failed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (sessionUuid: string) => {
    setBusy(true)
    try {
      await deleteCourseSession(courseUuid, sessionUuid, access_token)
      refresh()
    } catch {
      toast.error(t('academic.session_failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
        <Calendar className="w-4 h-4" /> {t('academic.schedule')}
      </div>
      <div className="space-y-1 mb-3">
        {sessions.map((s) => (
          <div
            key={s.session_uuid}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg"
          >
            <span className="text-sm text-gray-800">
              {s.title}
              {(s.start_date || s.location || s.facility) && (
                <span className="text-gray-400 text-xs">
                  {' '}
                  · {[s.start_date?.replace('T', ' '), s.facility?.name, s.location].filter(Boolean).join(' · ')}
                </span>
              )}
              {s.instructor && (
                <span className="ms-2 rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-tile-mint-fg))]">
                  {t('academic.taught_by', 'Taught by')} {instructorLabel(s.instructor)}
                </span>
              )}
            </span>
            <button
              onClick={() => remove(s.session_uuid)}
              disabled={busy}
              className="text-gray-400 hover:text-red-600 disabled:opacity-40"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputCls}
          placeholder={t('academic.session_title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FacilitySelect
          className={inputCls}
          value={facilityUuid}
          onChange={setFacilityUuid}
          emptyLabel={t('administration.facilities.course_room', 'Course room (default)')}
        />
        <input
          className={inputCls}
          placeholder={t('academic.location')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          type="datetime-local"
          className={inputCls}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="datetime-local"
          className={inputCls}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <InstructorSelect
          className={inputCls}
          value={instructorUuid}
          onChange={setInstructorUuid}
          emptyLabel={t('academic.session_course_instructor', 'Course instructor teaches it')}
        />
      </div>
      <button
        onClick={add}
        disabled={busy || !title.trim()}
        className="mt-2 flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-black disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" /> {t('academic.add_session')}
      </button>
    </div>
  )
}
