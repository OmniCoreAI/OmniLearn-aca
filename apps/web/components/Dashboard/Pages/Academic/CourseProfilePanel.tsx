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
  updateCourseSession,
  deleteCourseSession,
} from '@services/academic/academic'
import { CoordinatorPicker } from './AcademicPeople'

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
  orgId,
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
  const [instructorUuid, setInstructorUuid] = useState<string | null>(null)
  const [instructorName, setInstructorName] = useState<string | undefined>(undefined)
  const [addOns, setAddOns] = useState<{ name: string; price?: number | null }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile === undefined) return
    setCreditHours(profile?.credit_hours != null ? String(profile.credit_hours) : '')
    setCapacity(profile?.capacity != null ? String(profile.capacity) : '')
    setStatus(profile?.status || 'draft')
    setClassroom(profile?.classroom || '')
    setIssuesCertificate(!!profile?.issues_certificate)
    setInstructorUuid(profile?.instructor?.user_uuid || null)
    setInstructorName(instructorLabel(profile?.instructor) || undefined)
    setAddOns(Array.isArray(profile?.add_ons) ? profile.add_ons : [])
  }, [profile])

  const save = async () => {
    setSaving(true)
    try {
      await upsertCourseAcademicProfile(
        courseUuid,
        {
          credit_hours: creditHours === '' ? null : Number(creditHours),
          capacity: capacity === '' ? null : Number(capacity),
          status,
          classroom: classroom || null,
          issues_certificate: issuesCertificate,
          instructor_uuid: instructorUuid ?? '',
          add_ons: addOns
            .filter((a) => a.name.trim())
            .map((a) => ({
              name: a.name.trim(),
              price: a.price === null || a.price === undefined || (a.price as any) === '' ? null : Number(a.price),
            })),
        },
        access_token
      )
      toast.success(t('academic.profile_saved'))
      queryClient.invalidateQueries({ queryKey: ['academic', 'course-profile', courseUuid] })
    } catch {
      toast.error(t('academic.profile_save_failed'))
    } finally {
      setSaving(false)
    }
  }

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

      <div>
        <label className={labelCls}>{t('academic.instructor')}</label>
        <CoordinatorPicker
          orgId={orgId}
          access_token={access_token}
          value={instructorUuid}
          selectedLabel={instructorName}
          onChange={(uuid, label) => {
            setInstructorUuid(uuid)
            setInstructorName(label)
          }}
        />
      </div>

      {/* Add-ons ("snacks", material kits, etc.) */}
      <div>
        <label className={labelCls}>{t('academic.add_ons')}</label>
        <div className="space-y-2">
          {addOns.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputCls}
                placeholder={t('academic.add_on_name')}
                value={a.name}
                onChange={(e) => {
                  const next = [...addOns]
                  next[i] = { ...next[i], name: e.target.value }
                  setAddOns(next)
                }}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-28 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]"
                placeholder={t('academic.price')}
                value={a.price ?? ''}
                onChange={(e) => {
                  const next = [...addOns]
                  next[i] = { ...next[i], price: e.target.value === '' ? null : Number(e.target.value) }
                  setAddOns(next)
                }}
              />
              <button
                type="button"
                onClick={() => setAddOns(addOns.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAddOns([...addOns, { name: '', price: null }])}
            className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-black"
          >
            <Plus className="w-3.5 h-3.5" /> {t('academic.add_add_on')}
          </button>
        </div>
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
        className="w-full py-2 bg-[hsl(var(--dash-accent))] text-white rounded-lg text-sm font-bold disabled:opacity-40"
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
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['academic', 'course-sessions', courseUuid] })

  const add = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      await createCourseSession(
        courseUuid,
        { title: title.trim(), start_date: start || null, end_date: end || null, location: location || null },
        access_token
      )
      setTitle('')
      setStart('')
      setEnd('')
      setLocation('')
      refresh()
    } catch {
      toast.error(t('academic.session_failed'))
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
              {(s.start_date || s.location) && (
                <span className="text-gray-400 text-xs">
                  {' '}
                  · {[s.start_date, s.location].filter(Boolean).join(' · ')}
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
