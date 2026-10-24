'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import { useCourse } from '@components/Contexts/CourseContext'
import { getUriWithOrg } from '@services/config/config'
import { Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { CourseProfilePanel } from '@components/Dashboard/Pages/Academic/CourseProfilePanel'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { NotificationOverridesPanel } from '@components/Dashboard/Pages/Communication/NotificationOverridesPanel'
import { getCourseAcademicProfile } from '@services/academic/academic'
import {
  getCertificateTemplateOptions,
  getNotificationOverrides,
  getResourceAudience,
  getTargetAttachments,
} from '@services/administration/administration'
import { getCourseCertifications } from '@services/courses/certifications'

type Step = { key: string; label: string; done: boolean | null; detail?: string; href?: string }

/**
 * "Delivery & Resources": everything configured once under Administration and
 * attached to this course — audience, instructor, room, add-ons, certificate
 * and messages — with a completeness chain on top.
 */
export default function EditCourseDelivery({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const course = useCourse() as any
  const courseStructure = course?.courseStructure
  const courseUuid: string = courseStructure?.course_uuid || ''
  const shortUuid = courseUuid.replace('course_', '')
  const { orgId, access_token, ready } = useAdminContext()
  const enabled = ready && !!courseUuid

  const { data: profile } = useQuery({
    queryKey: ['academic', 'course-profile', courseUuid],
    queryFn: () => getCourseAcademicProfile(courseUuid, access_token),
    enabled,
  })
  const { data: audience, isError: audienceHidden } = useQuery({
    queryKey: ['audience', 'course', courseUuid],
    queryFn: () => getResourceAudience('course', courseUuid, access_token),
    enabled,
    retry: false,
  })
  const { data: attachments = [] } = useQuery({
    queryKey: ['administration', 'addon-attachments', 'course', courseUuid],
    queryFn: () => getTargetAttachments('course', courseUuid, access_token),
    enabled,
  })
  const { data: certs } = useQuery({
    queryKey: ['delivery', 'certification', courseUuid],
    queryFn: () => getCourseCertifications(courseUuid, orgId, null, access_token),
    enabled,
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['administration', 'certificate-template-options', orgId],
    queryFn: () => getCertificateTemplateOptions(orgId, access_token),
    enabled,
  })
  const { data: overrides = [] } = useQuery({
    queryKey: ['communication', 'overrides', 'course', courseUuid],
    queryFn: () => getNotificationOverrides('course', courseUuid, access_token),
    enabled,
    retry: false,
  })

  const certification = (certs?.data || certs || [])[0]
  const templateUuid = certification?.config?.certificate_template_uuid
  const defaultTemplate = (templates as any[]).find((o) => o.is_default)
  const templateName = (templates as any[]).find((o) => o.template_uuid === templateUuid)?.name || defaultTemplate?.name
  const base = `/dash/courses/course/${shortUuid}`

  const steps: Step[] = [
    {
      key: 'audience',
      label: t('delivery.step_audience', 'Audience'),
      done: audienceHidden ? null : (audience?.assignments || []).length > 0 || courseStructure?.public === true,
      detail: courseStructure?.public ? String(t('delivery.public', 'Public')) : `${(audience?.assignments || []).length} ${t('delivery.assignments', 'assignment(s)')}`,
      href: `${base}/access`,
    },
    { key: 'instructor', label: t('delivery.step_instructor', 'Instructor'), done: !!profile?.instructor, detail: profile?.instructor ? `${profile.instructor.first_name || ''} ${profile.instructor.last_name || ''}`.trim() : undefined },
    { key: 'facility', label: t('delivery.step_facility', 'Facility'), done: !!profile?.facility, detail: profile?.facility?.name },
    { key: 'addons', label: t('delivery.step_addons', 'Add-ons'), done: (attachments as any[]).length > 0, detail: `${(attachments as any[]).length}` },
    {
      key: 'certificate',
      label: t('delivery.step_certificate', 'Certificate'),
      done: !!certification,
      detail: certification ? templateName || String(t('certificates.use_pattern', 'Built-in pattern below')) : undefined,
      href: `${base}/certification`,
    },
    {
      key: 'messages',
      label: t('delivery.step_messages', 'Messages'),
      done: true,
      detail: (overrides as any[]).length ? `${(overrides as any[]).length} ${t('delivery.custom', 'custom')}` : String(t('certificates.academy_default', 'Academy default')),
    },
  ]

  if (!courseUuid) return null

  return (
    <div className="mx-4 space-y-6 py-6 sm:mx-10">
      <Section
        title={t('delivery.title', 'Delivery & resources')}
        description={t('delivery.desc', 'Reusable items from Administration & Configuration attached to this course. Optional steps can stay empty.')}
      >
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, i) => {
            const content = (
              <div className="h-full rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] p-3">
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--dash-muted))]">
                  {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
                  {i + 1}
                </div>
                <div className="mt-1 text-sm font-semibold">{step.label}</div>
                <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{step.detail || '—'}</div>
              </div>
            )
            return (
              <li key={step.key}>
                {step.href ? <Link href={getUriWithOrg(orgslug, step.href)}>{content}</Link> : content}
              </li>
            )
          })}
        </ol>
      </Section>

      <Section title={t('delivery.teaching', 'Instructor, room, sessions & add-ons')}>
        <CourseProfilePanel courseUuid={courseUuid} orgId={orgId} access_token={access_token} />
      </Section>

      <Section
        title={t('delivery.messages', 'Messages for this course')}
        description={t('delivery.messages_desc', 'Pick a different email or SMS template for this course; everything else uses the academy defaults.')}
      >
        <NotificationOverridesPanel orgslug={orgslug} resourceType="course" resourceUuid={courseUuid} />
      </Section>
    </div>
  )
}
