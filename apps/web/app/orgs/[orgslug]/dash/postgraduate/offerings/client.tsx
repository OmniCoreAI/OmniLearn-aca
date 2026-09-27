'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { LecturerPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { PostgradTabs, selectCls, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getPrograms, getProgramCohorts } from '@services/academic/academic'
import { OfferingsTable } from '@components/Dashboard/Pages/Academic/OfferingsTable'
import { createOffering, getAcademicCourses, getOfferings, getTerms } from '@services/academic/core'
import { FacilitySelect } from '@components/Dashboard/Pages/Administration/Pickers'

function OfferingsList({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)

  const { data: terms = [] } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId, access_token),
    enabled: ready,
  })
  const { data: offerings = [], isLoading } = useQuery({
    queryKey: ['academic', 'offerings', orgId, term],
    queryFn: () => getOfferings(orgId, access_token, { term_uuid: term || undefined }),
    enabled: ready,
  })

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_offerings', 'Course Offerings') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_offerings', 'Course Offerings')}
        subtitle={t(
          'academic.offerings_desc',
          'Each offering is one delivery of a catalog course in a term, with its own instructor, schedule, roster and materials.'
        )}
        action={
          <AcademicPrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t('academic.new_offering', 'New offering')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={selectCls()} value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">{t('academic.all_terms', 'All terms')}</option>
          {terms.map((tm: any) => (
            <option key={tm.term_uuid} value={tm.term_uuid}>
              {tm.code} · {tm.name}
            </option>
          ))}
        </select>
      </div>

      <OfferingsTable orgslug={orgslug} offerings={offerings} empty={isLoading ? '…' : undefined} />

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={t('academic.new_offering', 'New offering')}
        dialogContent={
          <OfferingCreateForm
            terms={terms}
            defaultTerm={term}
            onDone={() => {
              setOpen(false)
              queryClient.invalidateQueries({ queryKey: ['academic', 'offerings', orgId] })
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function OfferingCreateForm({ terms, defaultTerm, onDone }: { terms: any[]; defaultTerm?: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [course, setCourse] = useState('')
  const [term, setTerm] = useState(defaultTerm || '')
  const [program, setProgram] = useState('')
  const [cohort, setCohort] = useState('')
  const [section, setSection] = useState('A')
  const [capacity, setCapacity] = useState('')
  const [classroom, setClassroom] = useState('')
  const [facility, setFacility] = useState('')
  const [instructor, setInstructor] = useState<string | null>(null)
  const [instructorLabel, setInstructorLabel] = useState<string | undefined>()
  const [cloneTemplate, setCloneTemplate] = useState(true)
  const [saving, setSaving] = useState(false)

  const { data: courses = [] } = useQuery({
    queryKey: ['academic', 'catalog', orgId, ''],
    queryFn: () => getAcademicCourses(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const { data: programs = [] } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const { data: cohorts = [] } = useQuery({
    queryKey: ['academic', 'cohorts', program],
    queryFn: () => getProgramCohorts(program, access_token),
    enabled: !!program && !!access_token,
  })
  const selectedCourse = courses.find((c: any) => c.academic_course_uuid === course)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createOffering(
        orgId,
        {
          academic_course_uuid: course,
          term_uuid: term,
          cohort_uuid: cohort || null,
          section,
          capacity: capacity === '' ? null : Number(capacity),
          classroom: classroom || null,
          facility_uuid: facility || null,
          instructor_uuid: instructor,
          clone_template: cloneTemplate,
        },
        access_token
      )
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.catalog_course', 'Catalog course')}>
        <select className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)} required>
          <option value="">—</option>
          {courses
            .filter((c: any) => c.status !== 'retired')
            .map((c: any) => (
              <option key={c.academic_course_uuid} value={c.academic_course_uuid}>
                {c.code} · {c.name}
              </option>
            ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.term', 'Term')}>
          <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} required>
            <option value="">—</option>
            {terms.map((tm: any) => (
              <option key={tm.term_uuid} value={tm.term_uuid}>
                {tm.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.section', 'Section')}>
          <input className={inputCls} value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label={t('academic.capacity')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.program')}>
          <select
            className={inputCls}
            value={program}
            onChange={(e) => {
              setProgram(e.target.value)
              setCohort('')
            }}
          >
            <option value="">{t('academic.open_offering_opt', 'None (open offering)')}</option>
            {programs.map((p: any) => (
              <option key={p.program_uuid} value={p.program_uuid}>
                {p.code ? `${p.code} · ` : ''}
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.cohort', 'Cohort')}>
          <select className={inputCls} value={cohort} onChange={(e) => setCohort(e.target.value)} disabled={!program}>
            <option value="">—</option>
            {cohorts.map((c: any) => (
              <option key={c.cohort_uuid} value={c.cohort_uuid}>
                {c.code || c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <Field label={t('administration.facilities.default_room', 'Room / facility')}>
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} />
        </Field>
        <Field label={t('academic.classroom')}>
          <input className={inputCls} value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder={t('administration.facilities.free_text_hint', 'Optional free-text note')} />
        </Field>
      </div>
      {selectedCourse?.template_course_uuid && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cloneTemplate} onChange={(e) => setCloneTemplate(e.target.checked)} />
          {t('academic.clone_template_label', 'Start the content course from the catalog template')}
        </label>
      )}
      <SubmitRow saving={saving} />
    </form>
  )
}

export default OfferingsList
