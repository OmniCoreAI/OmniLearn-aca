'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Unlink, Pencil, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import CourseThumbnail, { removeCoursePrefix } from '@components/Objects/Thumbnails/CourseThumbnail'
import AttachCourseModal from '@components/Dashboard/Pages/Academic/AttachCourseModal'
import { CourseProfilePanel } from '@components/Dashboard/Pages/Academic/CourseProfilePanel'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicEmptyState,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '../../../../../client'
import {
  getProgram,
  getCohort,
  getSemester,
  getSemesterCourses,
  linkCourseToSemester,
  updateSemesterCourse,
  unlinkCourseFromSemester,
} from '@services/academic/academic'

function SemesterDetail({
  orgslug,
  programuuid,
  cohortuuid,
  semesteruuid,
}: {
  orgslug: string
  programuuid: string
  cohortuuid: string
  semesteruuid: string
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const program_uuid = `program_${programuuid}`
  const cohort_uuid = `cohort_${cohortuuid}`
  const semester_uuid = `semester_${semesteruuid}`

  const [attachOpen, setAttachOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [profileCourse, setProfileCourse] = useState<any>(null)

  const { data: program } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: cohort } = useQuery({
    queryKey: ['academic', 'cohort', cohort_uuid],
    queryFn: () => getCohort(cohort_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: semester } = useQuery({
    queryKey: ['academic', 'semester', semester_uuid],
    queryFn: () => getSemester(semester_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['academic', 'semester-courses', semester_uuid],
    queryFn: () => getSemesterCourses(semester_uuid, access_token),
    enabled: !!access_token,
    staleTime: 15_000,
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['academic', 'semester-courses', semester_uuid] })

  const handleUnlink = async (course_uuid: string) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await unlinkCourseFromSemester(semester_uuid, course_uuid, access_token)
      toast.success(t('academic.updated'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const base = `/dash/postgraduate/${programuuid}/cohort/${cohortuuid}`
  const linkedUuids = (courses as any[]).map((c) => c.course_uuid)

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('academic.postgraduate_studies'),
            href: getUriWithOrg(orgslug, '/dash/postgraduate'),
            icon: <GraduationCap size={14} />,
          },
          { label: program?.name || t('academic.program'), href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`) },
          { label: cohort?.name || t('academic.cohort'), href: getUriWithOrg(orgslug, base) },
          { label: semester?.name || t('academic.semester') },
        ]}
      />
      <AcademicHeader
        title={semester?.name || t('academic.semester')}
        subtitle={t('academic.courses')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
            <button
              onClick={() => setAttachOpen(true)}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.add_course')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {!isLoading && courses.length === 0 && (
          <AcademicEmptyState title={t('academic.no_courses')} description={t('academic.no_courses_desc')} />
        )}
        {(courses as any[]).map((course) => (
          <div key={course.course_uuid} className="relative">
            <CourseThumbnail
              course={course}
              orgslug={orgslug}
              isDashboard={true}
              customLink={`/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`}
            />
            {(course.code || course.credit_hours != null) && (
              <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
                {course.code && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                    {course.code}
                  </span>
                )}
                {course.credit_hours != null && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 text-cyan-700">
                    {course.credit_hours} {t('academic.credit_hours')}
                  </span>
                )}
              </div>
            )}
            <div className="absolute top-2 left-2 z-10 flex gap-1">
              <button
                onClick={() => setProfileCourse(course)}
                title={t('academic.academic_profile')}
                className="p-1.5 rounded-md bg-white/90 nice-shadow text-gray-500 hover:text-black"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(course)}
                title={t('academic.edit')}
                className="p-1.5 rounded-md bg-white/90 nice-shadow text-gray-500 hover:text-black"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleUnlink(course.course_uuid)}
                title={t('academic.delete')}
                className="p-1.5 rounded-md bg-white/90 nice-shadow text-gray-500 hover:text-red-600"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isDialogOpen={attachOpen}
        onOpenChange={setAttachOpen}
        minWidth="md"
        dialogTitle={t('academic.add_course')}
        dialogContent={
          <AttachCourseModal
            orgslug={orgslug}
            access_token={access_token}
            linkedCourseUuids={linkedUuids}
            onLink={(courseUuid) => linkCourseToSemester(semester_uuid, courseUuid, access_token)}
            onDone={() => {
              setAttachOpen(false)
              refresh()
            }}
          />
        }
      />

      <Modal
        isDialogOpen={!!editing}
        onOpenChange={(open: boolean) => !open && setEditing(null)}
        minWidth="sm"
        dialogTitle={t('academic.edit')}
        dialogContent={
          editing ? (
            <CourseMetaForm
              semesterUuid={semester_uuid}
              access_token={access_token}
              course={editing}
              onDone={() => {
                setEditing(null)
                refresh()
              }}
            />
          ) : (
            <div />
          )
        }
      />

      <Modal
        isDialogOpen={!!profileCourse}
        onOpenChange={(open: boolean) => !open && setProfileCourse(null)}
        minWidth="md"
        dialogTitle={t('academic.academic_profile')}
        dialogDescription={profileCourse?.name}
        dialogContent={
          profileCourse ? (
            <CourseProfilePanel
              courseUuid={profileCourse.course_uuid}
              orgId={orgId!}
              access_token={access_token}
            />
          ) : (
            <div />
          )
        }
      />
    </AcademicPageShell>
  )
}

function CourseMetaForm({
  semesterUuid,
  access_token,
  course,
  onDone,
}: {
  semesterUuid: string
  access_token: string
  course: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState(course?.code || '')
  const [creditHours, setCreditHours] = useState<string>(
    course?.credit_hours != null ? String(course.credit_hours) : ''
  )
  const [order, setOrder] = useState<number>(course?.academic_order ?? 0)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSemesterCourse(
        semesterUuid,
        course.course_uuid,
        {
          code: code || null,
          credit_hours: creditHours ? Number(creditHours) : null,
          order: Number(order),
        },
        access_token
      )
      toast.success(t('academic.updated'))
      onDone()
    } catch {
      toast.error(t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500">{course?.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.code')}>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t('academic.credit_hours')}>
          <input type="number" step="0.5" className={inputCls} value={creditHours} onChange={(e) => setCreditHours(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.order')}>
        <input type="number" className={inputCls} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default SemesterDetail
