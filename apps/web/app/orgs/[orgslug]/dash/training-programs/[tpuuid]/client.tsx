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
import { Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AddOnAttachmentsPanel } from '@components/Dashboard/Pages/Administration/AddOnAttachmentsPanel'
import { AudiencePanel } from '@components/Dashboard/Pages/Administration/AudiencePanel'
import { NotificationOverridesPanel } from '@components/Dashboard/Pages/Communication/NotificationOverridesPanel'
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
  updateTrainingProgram,
} from '@services/academic/academic'
import { getCertificateTemplateOptions } from '@services/administration/administration'

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
  const { data: certificateTemplates = [] } = useQuery({
    queryKey: ['administration', 'certificate-template-options', orgId],
    queryFn: () => getCertificateTemplateOptions(orgId!, access_token),
    enabled: !!orgId && !!access_token,
  })
  const setCertificateTemplate = async (template_uuid: string) => {
    try {
      await updateTrainingProgram(tp_uuid, { certificate_template_uuid: template_uuid }, access_token)
      queryClient.invalidateQueries({ queryKey: ['academic', 'training-program', tp_uuid] })
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
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
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] flex items-center gap-2 hover:brightness-110 transition-all"
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title={t('administration.addons.program_addons', 'Program add-ons')}
          description={t('administration.addons.program_addons_desc', 'Meals, kits and services offered with this program.')}
        >
          <AddOnAttachmentsPanel targetType="training_program" targetUuid={tp_uuid} />
        </Section>
        <AudiencePanel resourceType="training_program" resourceUuid={tp_uuid} />
        <Section
          title={t('delivery.program_messages', 'Messages for this program')}
          description={t('delivery.program_messages_desc', 'Pick a different email or SMS template for this program and its courses; everything else uses the academy defaults.')}
        >
          <NotificationOverridesPanel orgslug={orgslug} resourceType="training_program" resourceUuid={tp_uuid} />
        </Section>
        {(certificateTemplates as any[]).length > 0 && (
          <Section
            title={t('certificates.program_template', 'Certificate template')}
            description={t('certificates.program_template_desc', 'Used for this program’s courses unless a course chooses its own.')}
          >
            <select
              className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm"
              value={program?.certificate_template_uuid || ''}
              onChange={(e) => setCertificateTemplate(e.target.value)}
            >
              <option value="">{t('certificates.academy_default', 'Academy default')}</option>
              {(certificateTemplates as any[]).map((o) => (
                <option key={o.template_uuid} value={o.template_uuid}>{o.name}</option>
              ))}
            </select>
          </Section>
        )}
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
