'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, IconButton, Section, Stat, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { InstructorForm } from '@components/Dashboard/Pages/Instructors/InstructorForm'
import { ApproveInstructorForm } from '@components/Dashboard/Pages/Instructors/ApproveInstructorForm'
import {
  assignInstructorCourse,
  getInstructor,
  getInstructorCourses,
  getInstructorImageUrl,
  getInstructorWorkLogs,
  unassignInstructorCourse,
} from '@services/instructors/instructors'
import { getOrgLmsCourses } from '@services/academic/core'

const nameOf = (i: any) => `${i?.user?.first_name || ''} ${i?.user?.last_name || ''}`.trim() || i?.user?.username || '—'

function InstructorDetail({ orgslug, instructorUuid }: { orgslug: string; instructorUuid: string }) {
  const { t } = useTranslation()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [courseToAdd, setCourseToAdd] = useState('')

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['instructor', instructorUuid],
    queryFn: () => getInstructor(instructorUuid, access_token),
    enabled: ready,
  })
  const { data: courses = [] } = useQuery({
    queryKey: ['instructor', instructorUuid, 'courses'],
    queryFn: () => getInstructorCourses(instructorUuid, access_token),
    enabled: ready,
  })
  const { data: worklogs = [] } = useQuery({
    queryKey: ['instructor-worklogs', orgId, instructorUuid],
    queryFn: () => getInstructorWorkLogs(orgId, access_token, instructorUuid),
    enabled: ready,
  })
  const { data: lmsCourses = [] } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: () => getOrgLmsCourses(orgslug, access_token),
    enabled: ready,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['instructor', instructorUuid] })
    queryClient.invalidateQueries({ queryKey: ['instructors', orgId] })
  }

  if (isLoading || !instructor) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }

  const image = getInstructorImageUrl(org?.org_uuid, instructor)
  const totalHours = (worklogs as any[]).reduce((sum, w) => sum + (w.hours || 0), 0)
  const totalAmount = (worklogs as any[]).reduce((sum, w) => sum + (w.amount || 0), 0)
  const assigned = new Set((courses as any[]).map((c) => c.course_uuid))

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
  const removeCourse = async (courseUuid: string) => {
    if (!window.confirm(t('instructors.confirm_unassign', 'Remove this instructor from the course?'))) return
    try {
      await unassignInstructorCourse(instructorUuid, courseUuid, access_token)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.instructors', 'Instructors / Trainers'), href: '/dash/instructors' },
          { label: nameOf(instructor) },
        ]}
      />
      <AcademicHeader
        title={nameOf(instructor)}
        subtitle={instructor.user?.email}
        action={
          <div className="flex gap-2">
            {instructor.status === 'pending_approval' && (
              <GhostButton onClick={() => setApproveOpen(true)}>{t('instructors.approve', 'Approve')}</GhostButton>
            )}
            <GhostButton onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
            </GhostButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title={t('instructors.profile', 'Profile')} className="lg:col-span-1">
          <div className="mb-4 flex items-center gap-3">
            {image ? (
              <img src={image} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--dash-accent-soft))] text-xl font-semibold text-[hsl(var(--dash-accent))]">
                {nameOf(instructor).charAt(0)}
              </div>
            )}
            <div className="space-y-1">
              <StatusPill status={instructor.status} label={String(t(`instructors.status_${instructor.status}`, instructor.status))} />
              {instructor.category && <div className="text-xs text-[hsl(var(--dash-muted))]">{instructor.category.name}</div>}
            </div>
          </div>
          {instructor.bio && <p className="mb-3 whitespace-pre-line text-sm">{instructor.bio}</p>}
          <div className="grid grid-cols-1 gap-2">
            <Stat label={t('instructors.specializations_short', 'Expertise')} value={(instructor.specializations || []).join(', ') || '—'} />
            <Stat label={t('instructors.languages_short', 'Languages')} value={(instructor.languages || []).join(', ') || '—'} />
            <Stat label={t('instructors.department', 'Department')} value={instructor.department || '—'} />
            <Stat label={t('instructors.phone', 'Phone')} value={instructor.contact_info?.phone || '—'} />
            {instructor.entity && <Stat label={t('instructors.entity', 'Entity')} value={instructor.entity.name} />}
          </div>
        </Section>

        <div className="space-y-6 lg:col-span-2">
          <Section title={t('instructors.rates', 'Rates')} description={t('instructors.rates_desc', 'The instructor override wins; otherwise the category rate applies.')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={t('instructors.effective_rate', 'Effective rate')}
                value={instructor.effective_hourly_rate != null ? `${instructor.effective_hourly_rate} ${instructor.rate_currency || ''}` : '—'}
              />
              <Stat label={t('instructors.rate_source', 'Source')} value={String(t(`instructors.source_${instructor.rate_source}`, instructor.rate_source || '—'))} />
              <Stat
                label={t('instructors.category_default', 'Category default')}
                value={instructor.category?.hourly_rate != null ? `${instructor.category.hourly_rate} ${instructor.category.currency || ''}` : '—'}
              />
              <Stat label={t('instructors.rate_override', 'Hourly rate override')} value={instructor.hourly_rate ?? '—'} />
            </div>
            {(instructor.category?.language_rates || []).length > 0 && (
              <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">
                {t('instructors.language_rates', 'Language rates')}:{' '}
                {instructor.category.language_rates.map((r: any) => `${r.language} ${r.hourly_rate}`).join(' · ')}
              </p>
            )}
          </Section>

          <Section
            title={t('instructors.courses', 'Courses')}
            description={t('instructors.courses_desc', 'Courses this instructor teaches or co-authors.')}
            action={
              <div className="flex items-center gap-2">
                <select className={`${inputCls} w-56`} value={courseToAdd} onChange={(e) => setCourseToAdd(e.target.value)}>
                  <option value="">{t('instructors.pick_course', 'Select a course…')}</option>
                  {(lmsCourses as any[])
                    .filter((c) => !assigned.has(c.course_uuid))
                    .map((c) => (
                      <option key={c.course_uuid} value={c.course_uuid}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <GhostButton onClick={addCourse} disabled={!courseToAdd}>
                  <Plus className="h-3.5 w-3.5" /> {t('administration.common.add', 'Add')}
                </GhostButton>
              </div>
            }
          >
            <DataTable
              headers={[t('instructors.course', 'Course'), t('instructors.role', 'Role'), t('administration.common.status', 'Status'), '']}
              empty={t('instructors.no_courses', 'Not assigned to any course yet.')}
            >
              {(courses as any[]).map((c) => (
                <tr key={c.course_uuid}>
                  <td className={tdCls}>
                    <Link className="font-medium hover:underline" href={getUriWithOrg(orgslug, `/dash/courses/course/${c.course_uuid.replace('course_', '')}/general`)}>
                      {c.name}
                    </Link>
                  </td>
                  <td className={`${tdCls} text-xs`}>{String(t(`instructors.link_${c.source}`, c.source))}</td>
                  <td className={tdCls}>
                    <StatusPill status={c.published ? 'active' : 'draft'} label={c.published ? t('instructors.published', 'Published') : t('instructors.unpublished', 'Unpublished')} />
                  </td>
                  <td className={`${tdCls} text-end`}>
                    {c.source === 'profile' && (
                      <IconButton tone="danger" onClick={() => removeCourse(c.course_uuid)} aria-label={t('administration.common.delete', 'Delete')}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Section title={t('instructors.availability', 'Weekly availability')}>
              {(instructor.availability?.slots || []).length === 0 ? (
                <p className="text-sm text-[hsl(var(--dash-muted))]">{t('instructors.no_availability', 'No weekly availability set.')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {instructor.availability.slots.map((s: any, i: number) => (
                    <li key={i} className="flex justify-between">
                      <span>{String(t(`instructors.day_${s.day}`, s.day))}</span>
                      <span className="font-mono text-xs">
                        {s.start} – {s.end}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {instructor.availability?.notes && <p className="mt-2 text-xs text-[hsl(var(--dash-muted))]">{instructor.availability.notes}</p>}
            </Section>
            <Section
              title={t('instructors.finance', 'Finance')}
              action={
                <Link className="text-xs font-semibold text-[hsl(var(--dash-accent))]" href={getUriWithOrg(orgslug, '/dash/instructors/finance')}>
                  {t('instructors.open_finance', 'Open finance')}
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t('instructors.total_hours', 'Total hours')} value={totalHours} />
                <Stat label={t('instructors.total_cost', 'Total cost')} value={`${totalAmount.toFixed(2)} ${instructor.rate_currency || ''}`} />
              </div>
            </Section>
          </div>
        </div>
      </div>

      <Modal
        isDialogOpen={editOpen}
        onOpenChange={setEditOpen}
        minWidth="md"
        dialogTitle={t('instructors.edit', 'Edit Instructor')}
        dialogContent={
          <InstructorForm
            orgId={orgId}
            access_token={access_token}
            instructor={instructor}
            onDone={() => {
              setEditOpen(false)
              refresh()
            }}
          />
        }
      />
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
    </AcademicPageShell>
  )
}

export default InstructorDetail
