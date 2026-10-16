'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { CalendarClock, ChevronDown, GripVertical, Hexagon, Lock, MapPin, Pencil, Plus, Presentation, Trash2, UserRound } from 'lucide-react'
import { queryKeys } from '@lib/query/keys'
import { revalidateTags } from '@services/utils/ts/requests'
import { createChapter, reorderLectureContent, updateChapter, updateCourseOrderStructure } from '@services/courses/chapters'
import { createCourseSession, deleteCourseSession, getCourseAcademicProfile, updateCourseSession } from '@services/academic/academic'
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useCourseRights } from '@components/Hooks/useCourseRights'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { AdminDrawer, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { FacilitySelect, InstructorSelect, saveWithConflictCheck } from '@components/Dashboard/Pages/Administration/Pickers'
import { RoomPickerButton } from '@components/Dashboard/Pages/Administration/FloorPlan/RoomPicker'
import { formatSlot } from '@components/Dashboard/Pages/Administration/HallBooking/hallTime'
import { cn } from '@/lib/utils'
import ChapterElement from './DraggableElements/ChapterElement'

/* =====================================================================
   Course content organised by lectures (training-program courses).
   Each lecture (a course session) holds chapters; its instructor edits
   them, course editors manage everything. Order changes save at once:
   course editors through the course-wide order, lecture instructors
   through the per-lecture order endpoint.
   ===================================================================== */

const NONE = 'none'
const lectureDroppable = (uuid: string | null) => `lecture:${uuid || NONE}`
const lectureOf = (droppableId: string) => {
  const id = droppableId.replace(/^lecture:/, '')
  return id === NONE ? null : id
}
const toLocalInput = (value?: string | null) => (value ? value.slice(0, 16) : '')
const personName = (u: any) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username : '')

type OrderEntry = { chapter_id: number; activities_order_by_ids: { activity_id: number }[] }
const orderOf = (chapters: any[]): OrderEntry[] =>
  chapters.map((c) => ({ chapter_id: c.id, activities_order_by_ids: (c.activities || []).map((a: any) => ({ activity_id: a.id })) }))

export default function LecturesEditor({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`courses.lectures.${key}`, fallback, opts))
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const course = useCourse() as any
  const dispatchCourse = useCourseDispatch() as any
  const structure = course?.courseStructure || {}
  const courseUuid: string = structure.course_uuid || ''
  const cleanUuid = courseUuid.replace(/^course_/, '')
  const { rights } = useCourseRights(courseUuid)
  const canManage = !!rights?.permissions?.update_content
  const taught = useMemo(() => new Set(rights?.lectures?.taught || []), [rights])
  const { confirm, dialog } = useConfirm()

  const profileKey = ['academic', 'course-profile', courseUuid]
  const { data: profile } = useQuery({
    queryKey: profileKey,
    queryFn: () => getCourseAcademicProfile(courseUuid, access_token),
    enabled: !!courseUuid && !!access_token,
  })
  const lectures: any[] = useMemo(
    () => [...(profile?.sessions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [profile]
  )
  const courseInstructor = profile?.instructor || null

  const chapters: any[] = structure.chapters || []
  const chaptersOf = (lectureUuid: string | null) => chapters.filter((c) => (c.lecture_uuid || null) === lectureUuid)
  const known = new Set(lectures.map((l) => l.session_uuid))
  const unassigned = chapters.filter((c) => !c.lecture_uuid || !known.has(c.lecture_uuid))
  const canEdit = (lectureUuid: string | null) => canManage || (!!lectureUuid && taught.has(lectureUuid))

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [drawer, setDrawer] = useState<{ lecture?: any } | null>(null)
  const [newChapterFor, setNewChapterFor] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(cleanUuid) }),
      queryClient.invalidateQueries({ queryKey: profileKey }),
      queryClient.invalidateQueries({ queryKey: ['academic', 'course-sessions', courseUuid] }),
    ])
    revalidateTags(['courses'], orgslug)
  }

  /** The course outline grouped lecture by lecture (then chapters outside lectures). */
  const groupedChapters = (byLecture: Map<string | null, any[]>, lectureOrder = lectures) => [
    ...lectureOrder.flatMap((l) => byLecture.get(l.session_uuid) || []),
    ...(byLecture.get(null) || []),
  ]
  const currentGroups = () => {
    const map = new Map<string | null, any[]>()
    for (const l of lectures) map.set(l.session_uuid, chaptersOf(l.session_uuid).map((c) => ({ ...c, activities: [...(c.activities || [])] })))
    map.set(null, unassigned.map((c) => ({ ...c, activities: [...(c.activities || [])] })))
    return map
  }

  const persist = async (groups: Map<string | null, any[]>, touched: (string | null)[], lectureOrder = lectures) => {
    const next = groupedChapters(groups, lectureOrder)
    dispatchCourse({ type: 'setCourseStructure', payload: { ...structure, chapters: next } })
    try {
      if (canManage) {
        await updateCourseOrderStructure(courseUuid, { chapter_order_by_ids: orderOf(next) } as any, access_token)
      } else {
        for (const uuid of touched) {
          if (uuid) await reorderLectureContent(courseUuid, uuid, { chapter_order_by_ids: orderOf(groups.get(uuid) || []) }, access_token)
        }
      }
    } catch (err: any) {
      toast.error(err?.message || tr('save_failed', 'Could not save the new order'))
    } finally {
      await refresh()
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type, draggableId } = result
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return

    if (type === 'lecture') {
      if (!canManage) return
      const order = [...lectures]
      const [moved] = order.splice(source.index, 1)
      order.splice(destination.index, 0, moved)
      setBusy(true)
      try {
        await Promise.all(
          order.map((l, i) => (l.order === i ? null : updateCourseSession(courseUuid, l.session_uuid, { order: i }, access_token))).filter(Boolean)
        )
        await persist(currentGroups(), [], order)
      } catch (err: any) {
        toast.error(err?.message || tr('save_failed', 'Could not save the new order'))
        await refresh()
      } finally {
        setBusy(false)
      }
      return
    }

    const groups = currentGroups()
    if (type === 'chapter') {
      const from = lectureOf(source.droppableId)
      const to = lectureOf(destination.droppableId)
      if (!canEdit(from) || !canEdit(to)) return
      const src = groups.get(from) || []
      const [moved] = src.splice(source.index, 1)
      const dst = from === to ? src : groups.get(to) || []
      dst.splice(destination.index, 0, { ...moved, lecture_uuid: to })
      groups.set(to, dst)
      setBusy(true)
      try {
        if (from !== to) await updateChapter(moved.id, { lecture_uuid: to || '' }, access_token)
        await persist(groups, from === to ? [to] : [from, to])
      } catch (err: any) {
        toast.error(err?.message || tr('move_failed', 'Could not move the chapter'))
        await refresh()
      } finally {
        setBusy(false)
      }
      return
    }

    if (type === 'activity') {
      const lectureOfChapter = (chapterUuid: string) => chapters.find((c) => c.chapter_uuid === chapterUuid)?.lecture_uuid || null
      const from = lectureOfChapter(source.droppableId)
      const to = lectureOfChapter(destination.droppableId)
      if (from !== to && !canManage) {
        toast.error(tr('same_lecture_only', 'Activities can only move between chapters of the same lecture'))
        return
      }
      if (!canEdit(from) || !canEdit(to)) return
      const findChapter = (uuid: string) => [...groups.values()].flat().find((c) => c.chapter_uuid === uuid)
      const srcChapter = findChapter(source.droppableId)
      const dstChapter = findChapter(destination.droppableId) || srcChapter
      const [moved] = srcChapter.activities.splice(source.index, 1)
      dstChapter.activities.splice(destination.index, 0, moved)
      setBusy(true)
      try {
        await persist(groups, [from, to].filter((v, i, a) => a.indexOf(v) === i))
      } finally {
        setBusy(false)
      }
      return
    }
    void draggableId
  }

  const submitChapter = async (chapter: any) => {
    try {
      await createChapter({ ...chapter, lecture_uuid: newChapterFor || undefined }, access_token)
      setNewChapterFor(undefined)
      await refresh()
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || tr('chapter_failed', 'Could not add the chapter'))
    }
  }

  const removeLecture = async (lecture: any) => {
    const ok = await confirm({
      title: tr('delete_title', 'Delete {{name}}?', { name: lecture.title }),
      message: tr('delete_message', 'Its chapters stay in the course, under "Not in a lecture". Its room booking is released.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteCourseSession(courseUuid, lecture.session_uuid, access_token)
      await refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  if (!course) return null

  const teacherOf = (lecture: any) => lecture.instructor || courseInstructor
  const renderChapters = (lectureUuid: string | null, list: any[]) =>
    canEdit(lectureUuid) ? (
      <Droppable droppableId={lectureDroppable(lectureUuid)} type="chapter">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn('min-h-[48px] space-y-4 rounded-xl transition-colors', snapshot.isDraggingOver && 'bg-[hsl(var(--dash-accent-soft))]/60')}
          >
            {list.map((chapter, index) => (
              <ChapterElement key={chapter.chapter_uuid} chapterIndex={index} orgslug={orgslug} course_uuid={courseUuid} chapter={chapter} />
            ))}
            {provided.placeholder}
            {!list.length ? (
              <p className="px-1 py-3 text-[12.5px] text-[hsl(var(--dash-muted))]">{tr('no_chapters', 'No chapters yet. Add the first one below.')}</p>
            ) : null}
          </div>
        )}
      </Droppable>
    ) : (
      <ul className="space-y-1.5">
        {list.map((chapter) => (
          <li key={chapter.chapter_uuid} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-2 text-[13px]">
            <Hexagon className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" />
            <span className="min-w-0 flex-1 truncate font-medium">{chapter.name}</span>
            <span className="text-[11.5px] text-[hsl(var(--dash-muted))]">{tr('n_activities', '{{count}} activities', { count: chapter.activities?.length || 0 })}</span>
          </li>
        ))}
        {!list.length ? <li className="px-1 text-[12.5px] text-[hsl(var(--dash-muted))]">{tr('no_chapters_ro', 'No chapters yet.')}</li> : null}
      </ul>
    )

  const addChapterButton = (lectureUuid: string | null) =>
    canEdit(lectureUuid) ? (
      <GhostButton type="button" onClick={() => setNewChapterFor(lectureUuid)} className="mt-3">
        <Plus className="h-3.5 w-3.5" /> {tr('add_chapter', 'Add chapter')}
      </GhostButton>
    ) : null

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{tr('title', 'Lectures')}</h2>
          <p className="text-[12.5px] text-[hsl(var(--dash-muted))]">
            {canManage
              ? tr('subtitle_manager', 'Each lecture has its own instructor, who adds its chapters and materials.')
              : tr('subtitle_instructor', 'You can edit the lectures you teach. The others are shown read-only.')}
          </p>
        </div>
        {canManage ? (
          <AcademicPrimaryButton type="button" onClick={() => setDrawer({})}>
            <Plus className="h-4 w-4" /> {tr('add', 'Add lecture')}
          </AcademicPrimaryButton>
        ) : null}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="lectures" type="lecture" isDropDisabled={!canManage}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className={cn('space-y-4', busy && 'pointer-events-none opacity-70')}>
              {lectures.map((lecture, index) => {
                const editable = canEdit(lecture.session_uuid)
                const mine = taught.has(lecture.session_uuid)
                const list = chaptersOf(lecture.session_uuid)
                const teacher = teacherOf(lecture)
                const open = !collapsed[lecture.session_uuid]
                return (
                  <Draggable key={lecture.session_uuid} draggableId={`lec-${lecture.session_uuid}`} index={index} isDragDisabled={!canManage}>
                    {(drag) => (
                      <section
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={cn(
                          'dash-card rounded-[1.25rem] border-s-4 p-4',
                          mine ? 'border-s-[hsl(var(--dash-accent))]' : editable ? 'border-s-transparent' : 'border-s-[hsl(var(--dash-border))]'
                        )}
                      >
                        <header className="flex flex-wrap items-start gap-3">
                          <span
                            {...drag.dragHandleProps}
                            className={cn('mt-1 text-[hsl(var(--dash-muted))]', canManage ? 'cursor-grab' : 'hidden')}
                            aria-label={tr('drag', 'Drag to reorder')}
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[13px] font-bold text-[hsl(var(--dash-accent))]">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-[15px] font-semibold">{lecture.title}</h3>
                              {mine ? (
                                <span className="rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[10.5px] font-bold text-[hsl(var(--dash-accent))]">{tr('you_teach', 'You teach this')}</span>
                              ) : !editable ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--dash-muted))]">
                                  <Lock className="h-3 w-3" /> {tr('read_only', 'Read-only')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[hsl(var(--dash-muted))]">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" />
                                {teacher ? personName(teacher) : tr('no_instructor', 'No instructor yet')}
                                {!lecture.instructor && teacher ? ` · ${tr('course_instructor', 'course instructor')}` : ''}
                              </span>
                              {lecture.start_date ? (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock className="h-3.5 w-3.5" /> {formatSlot(lecture.start_date, lecture.end_date, i18n.language)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock className="h-3.5 w-3.5" /> {tr('self_paced', 'No date (self-paced)')}
                                </span>
                              )}
                              {lecture.facility?.name || lecture.location ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" /> {lecture.facility?.name || lecture.location}
                                </span>
                              ) : null}
                              <span>{tr('n_chapters', '{{count}} chapters', { count: list.length })}</span>
                            </div>
                            {lecture.description ? <p className="mt-1.5 line-clamp-2 text-[12.5px] text-[hsl(var(--dash-ink))]/80">{lecture.description}</p> : null}
                          </div>
                          <div className="flex items-center gap-1">
                            {canManage ? (
                              <>
                                <button type="button" onClick={() => setDrawer({ lecture })} className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]" aria-label={t('administration.common.edit', 'Edit')} title={t('administration.common.edit', 'Edit')}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => removeLecture(lecture)} className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-red-50 hover:text-red-600" aria-label={t('administration.common.delete', 'Delete')} title={t('administration.common.delete', 'Delete')}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setCollapsed((c) => ({ ...c, [lecture.session_uuid]: open }))}
                              className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))]"
                              aria-expanded={open}
                              aria-label={open ? tr('collapse', 'Collapse') : tr('expand', 'Expand')}
                            >
                              <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
                            </button>
                          </div>
                        </header>
                        {open ? (
                          <div className="mt-4 border-t border-[hsl(var(--dash-border))] pt-4">
                            {renderChapters(lecture.session_uuid, list)}
                            {addChapterButton(lecture.session_uuid)}
                          </div>
                        ) : null}
                      </section>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {!lectures.length && profile ? (
          <div className="dash-card flex flex-col items-center gap-2 rounded-[1.25rem] px-6 py-12 text-center">
            <Presentation className="h-7 w-7 text-[hsl(var(--dash-muted))]" />
            <div className="text-[14px] font-semibold">{tr('empty_title', 'No lectures yet')}</div>
            <p className="max-w-md text-[12.5px] text-[hsl(var(--dash-muted))]">
              {canManage
                ? tr('empty_manager', 'Add the first lecture, choose who teaches it, and they can start adding its chapters and materials.')
                : tr('empty_instructor', 'The course team has not added lectures yet.')}
            </p>
          </div>
        ) : null}

        {canManage && unassigned.length ? (
          <section className="dash-card rounded-[1.25rem] border border-dashed border-[hsl(var(--dash-border))] p-4">
            <h3 className="text-[14px] font-semibold">{tr('unassigned', 'Not in a lecture')}</h3>
            <p className="mb-3 text-[12px] text-[hsl(var(--dash-muted))]">{tr('unassigned_hint', 'Drag these chapters into a lecture so its instructor can edit them.')}</p>
            {renderChapters(null, unassigned)}
          </section>
        ) : null}
        {canManage && !unassigned.length && lectures.length ? (
          <Droppable droppableId={lectureDroppable(null)} type="chapter">
            {(provided, snapshot) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className={cn('rounded-xl', snapshot.isDraggingOver && 'min-h-[40px] border border-dashed border-[hsl(var(--dash-border))]')}>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : null}
      </DragDropContext>

      <Modal
        isDialogOpen={newChapterFor !== undefined}
        onOpenChange={(open) => {
          if (!open) setNewChapterFor(undefined)
        }}
        minHeight="sm"
        dialogContent={<NewChapterModal course={structure} closeModal={() => setNewChapterFor(undefined)} submitChapter={submitChapter} />}
        dialogTitle={t('dashboard.courses.structure.modals.new_chapter.title')}
        dialogDescription={
          newChapterFor
            ? tr('new_chapter_in', 'In {{lecture}}', { lecture: lectures.find((l) => l.session_uuid === newChapterFor)?.title || '' })
            : t('dashboard.courses.structure.modals.new_chapter.description')
        }
      />

      <AdminDrawer
        icon={<Presentation size={20} />}
        open={!!drawer}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
        title={drawer?.lecture ? tr('edit_title', 'Edit {{name}}', { name: drawer.lecture.title }) : tr('add', 'Add lecture')}
        description={tr('form_desc', 'The instructor you choose can add chapters and materials to this lecture.')}
      >
        {drawer ? (
          <LectureForm
            key={drawer.lecture?.session_uuid || 'new'}
            lecture={drawer.lecture}
            courseUuid={courseUuid}
            nextOrder={lectures.length}
            attendees={profile?.capacity ?? null}
            courseInstructorName={personName(courseInstructor)}
            onCancel={() => setDrawer(null)}
            onDone={async () => {
              setDrawer(null)
              await refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </div>
  )
}

function LectureForm({
  lecture,
  courseUuid,
  nextOrder,
  attendees,
  courseInstructorName,
  onCancel,
  onDone,
}: {
  lecture?: any
  courseUuid: string
  nextOrder: number
  attendees: number | null
  courseInstructorName: string
  onCancel: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`courses.lectures.${key}`, fallback, opts))
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [title, setTitle] = useState(lecture?.title || '')
  const [description, setDescription] = useState(lecture?.description || '')
  const [instructor, setInstructor] = useState<string>(lecture?.instructor?.user_uuid || '')
  const [start, setStart] = useState(toLocalInput(lecture?.start_date))
  const [end, setEnd] = useState(toLocalInput(lecture?.end_date))
  const [facility, setFacility] = useState<string>(lecture?.facility?.facility_uuid || '')
  const [location, setLocation] = useState(lecture?.location || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = String(t('administration.validation.required', 'Required'))
    if (start && end && end <= start) next.end = tr('end_after_start', 'The lecture must end after it starts')
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        instructor_uuid: instructor || '',
        start_date: start || null,
        end_date: end || null,
        facility_uuid: facility || '',
        location: location || null,
      }
      const saved = await saveWithConflictCheck(
        (allow_conflict) =>
          lecture
            ? updateCourseSession(courseUuid, lecture.session_uuid, { ...payload, allow_conflict }, access_token)
            : createCourseSession(courseUuid, { ...payload, order: nextOrder, allow_conflict }, access_token),
        t('administration.facilities.book_anyway', 'Book the room anyway?')
      )
      if (!saved) return
      toast.success(lecture ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={tr('section_lecture', 'Lecture')}>
        <Field label={tr('field_title', 'Title')} required error={errors.title} className="sm:col-span-2">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} placeholder={tr('title_placeholder', 'e.g. Introduction to networking')} autoFocus />
        </Field>
        <Field label={tr('field_description', 'What it covers')} className="sm:col-span-2">
          <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label={tr('field_instructor', 'Instructor')}
          hint={tr('instructor_hint', 'They can add and edit this lecture’s chapters and materials.')}
          className="sm:col-span-2"
        >
          <InstructorSelect
            className={inputCls}
            value={instructor}
            onChange={setInstructor}
            current={lecture?.instructor ? { user_uuid: lecture.instructor.user_uuid, name: personName(lecture.instructor) } : null}
            emptyLabel={courseInstructorName ? tr('course_instructor_named', 'Course instructor ({{name}})', { name: courseInstructorName }) : tr('course_instructor_default', 'Course instructor')}
          />
        </Field>
      </FormSection>
      <FormSection title={tr('section_when', 'When and where (optional)')}>
        <Field label={t('academic.starts', 'Starts')}>
          <input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('academic.ends', 'Ends')} error={errors.end}>
          <input type="datetime-local" className={inputCls} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.end} />
        </Field>
        <Field label={t('administration.facilities.room', 'Room')} className="sm:col-span-2">
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} current={lecture?.facility} emptyLabel={t('administration.facilities.course_room', 'Course room (default)')} />
          <div className="mt-1.5 flex justify-end">
            <RoomPickerButton
              value={facility}
              onChange={setFacility}
              period={{ start, end, attendees, exclude: lecture?.session_uuid }}
              clearLabel={t('administration.facilities.course_room', 'Course room (default)')}
            />
          </div>
        </Field>
        <Field label={t('academic.off.location_note', 'Location note or link')} className="sm:col-span-2">
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </FormSection>
      <FormActions saving={saving} onCancel={onCancel} sticky />
    </form>
  )
}
