'use client'
import React, { useState } from 'react'
import { Award, Plus, Unlink, SlidersHorizontal } from 'lucide-react'
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
  AcademicGridSkeleton,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import {
  getTrainingProgram,
  getTrainingProgramCourses,
  linkCourseToTrainingProgram,
  unlinkCourseFromTrainingProgram,
} from '@services/academic/academic'

function TrainingProgramDetail({ orgslug, tpuuid }: { orgslug: string; tpuuid: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const tp_uuid = `trainingprogram_${tpuuid}`

  const [modalOpen, setModalOpen] = useState(false)
  const [profileCourse, setProfileCourse] = useState<any>(null)

  const { data: program } = useQuery({
    queryKey: ['academic', 'training-program', tp_uuid],
    queryFn: () => getTrainingProgram(tp_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['academic', 'training-program-courses', tp_uuid],
    queryFn: () => getTrainingProgramCourses(tp_uuid, access_token),
    enabled: !!access_token,
    staleTime: 15_000,
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['academic', 'training-program-courses', tp_uuid] })

  const handleUnlink = async (course_uuid: string) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await unlinkCourseFromTrainingProgram(tp_uuid, course_uuid, access_token)
      toast.success(t('academic.updated'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const linkedUuids = (courses as any[]).map((c) => c.course_uuid)

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('academic.training_programs'),
            href: getUriWithOrg(orgslug, '/dash/training-programs'),
            icon: <Award size={14} />,
          },
          { label: program?.name || t('academic.training_program') },
        ]}
      />
      <AcademicHeader
        title={program?.name || t('academic.training_program')}
        subtitle={program ? t(`academic.type_${program.training_type}`) : t('academic.courses')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="training_programs" orgId={orgId!}>
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.add_course')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      {isLoading && <AcademicGridSkeleton count={4} />}
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
            <div className="absolute top-2 left-2 z-10 flex gap-1">
              <button
                onClick={() => setProfileCourse(course)}
                title={t('academic.academic_profile')}
                className="p-1.5 rounded-md bg-white/90 nice-shadow text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))]"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleUnlink(course.course_uuid)}
                title={t('academic.delete')}
                className="p-1.5 rounded-md bg-white/90 nice-shadow text-[hsl(var(--dash-muted))] hover:text-red-500"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={t('academic.add_course')}
        dialogContent={
          <AttachCourseModal
            orgslug={orgslug}
            access_token={access_token}
            linkedCourseUuids={linkedUuids}
            onLink={(courseUuid) => linkCourseToTrainingProgram(tp_uuid, courseUuid, access_token)}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
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

export default TrainingProgramDetail
