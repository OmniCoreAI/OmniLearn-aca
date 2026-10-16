'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarBlank, CaretDown, Check, ChalkboardTeacher, ListBullets, LockSimple, MapPin, Play } from '@phosphor-icons/react'
import { EmptyState, Panel, PanelHeader, Pill, ProgressBar, useFormats } from '@components/StudentPortal/Dashboard/ui'
import { cn } from '@/lib/utils'
import { formatSlot } from '@components/Dashboard/Pages/Administration/HallBooking/hallTime'
import { activityType, type CourseOutline, type OutlineChapter, type OutlineLecture, type OutlineLesson } from './useCourseOutline'

function LessonStatus({ state, number }: { state: OutlineLesson['state']; number: string }) {
  if (state === 'done') {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(152_55%_40%)] text-white">
        <Check size={15} weight="bold" />
      </span>
    )
  }
  if (state === 'next') {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(43_90%_62%),hsl(39_82%_47%))] text-[hsl(220_10%_8%)] shadow-[0_6px_14px_-6px_hsl(43_85%_45%/0.9)]">
        <Play size={13} weight="fill" />
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
        <LockSimple size={14} weight="bold" />
      </span>
    )
  }
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--dash-border))] bg-white text-[11px] font-bold tabular-nums text-[hsl(var(--dash-muted))]">
      {number}
    </span>
  )
}

function LessonRow({ lesson, signedIn, onPrefetch }: { lesson: OutlineLesson; signedIn: boolean; onPrefetch: (_activity: any) => void }) {
  const { t } = useTranslation()
  const type = activityType(lesson.activity.activity_type)
  const TypeIcon = type.icon
  const locked = lesson.state === 'locked'
  const isNext = signedIn && lesson.state === 'next'

  const inner = (
    <>
      <LessonStatus state={signedIn || lesson.state === 'locked' ? lesson.state : 'todo'} number={lesson.number} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[14px] font-semibold',
            locked ? 'text-[hsl(var(--dash-muted))]' : 'text-[hsl(var(--dash-ink))]',
            lesson.state === 'done' && signedIn && 'text-[hsl(var(--dash-ink))]/70'
          )}
          dir="auto"
        >
          {lesson.activity.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[hsl(var(--dash-muted))]">
          <TypeIcon size={13} />
          <span>{t(type.labelKey)}</span>
          <span aria-hidden="true" className="text-[hsl(var(--dash-border))]">•</span>
          <span className="tabular-nums">{lesson.number}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lesson.isCurrent ? <Pill tone="blue">{t('course_page.lesson_current', 'You are here')}</Pill> : null}
        {isNext && !lesson.isCurrent ? <Pill tone="gold">{t('course_page.next_up', 'Next up')}</Pill> : null}
        {signedIn && lesson.state === 'done' ? (
          <span className="hidden text-[12px] font-semibold text-[hsl(152_60%_30%)] sm:inline">{t('course_page.lesson_done', 'Completed')}</span>
        ) : null}
        {locked ? <Pill tone="neutral">{t('course.locked', 'Locked')}</Pill> : null}
        {!locked ? (
          <ArrowRight
            size={15}
            weight="bold"
            className="text-[hsl(var(--dash-muted))]/60 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--dash-ink))] rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          />
        ) : null}
      </div>
    </>
  )

  const rowClass = cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5',
    isNext && 'bg-[hsl(43_85%_96%)] ring-1 ring-inset ring-[hsl(43_80%_80%)]',
    lesson.isCurrent && 'bg-[hsl(212_75%_97%)] ring-1 ring-inset ring-[hsl(212_70%_85%)]'
  )

  if (locked) {
    return (
      <li>
        <div className={cn(rowClass, 'cursor-not-allowed select-none')} title={t('course.activity_locked_hint', 'Sign in or join the right user group to unlock this.')}>
          {inner}
        </div>
      </li>
    )
  }
  return (
    <li>
      <Link
        href={lesson.href}
        prefetch={false}
        onMouseEnter={() => onPrefetch(lesson.activity)}
        className={cn(rowClass, 'group transition-colors hover:bg-[hsl(var(--dash-canvas))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-ink))]/20')}
      >
        {inner}
      </Link>
    </li>
  )
}

function ChapterBlock({
  chapter,
  open,
  onToggle,
  signedIn,
  onPrefetch,
}: {
  chapter: OutlineChapter
  open: boolean
  onToggle: () => void
  signedIn: boolean
  onPrefetch: (_activity: any) => void
}) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const complete = chapter.total > 0 && chapter.done >= chapter.total
  const pct = chapter.total ? Math.round((chapter.done / chapter.total) * 100) : 0
  const panelId = `chapter-${chapter.key}`

  return (
    <li className={cn('rounded-2xl border transition-colors', open ? 'border-[hsl(var(--dash-border))] bg-white' : 'border-[hsl(var(--dash-border))]/70 bg-[hsl(var(--dash-canvas))]/45')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-ink))]/20"
      >
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-extrabold tabular-nums',
            complete && signedIn
              ? 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]'
              : chapter.containsNext && signedIn
                ? 'bg-[hsl(43_85%_92%)] text-[hsl(36_80%_28%)]'
                : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70'
          )}
        >
          {complete && signedIn ? <Check size={18} weight="bold" /> : fmt.number(chapter.number)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-[hsl(var(--dash-muted))]">
            {t('course_page.chapter_n', 'Chapter {{n}}', { n: fmt.number(chapter.number) })}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-bold text-[hsl(var(--dash-ink))]" dir="auto">
              {chapter.chapter.name}
            </span>
            {chapter.locked ? (
              <Pill tone="neutral">
                <LockSimple size={11} weight="bold" />
                {t('course.locked', 'Locked')}
              </Pill>
            ) : null}
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <span className="text-[12px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">
            {signedIn
              ? t('course_page.chapter_progress', '{{done}} of {{total}} lessons', { done: fmt.number(chapter.done), total: fmt.number(chapter.total) })
              : t('course_page.lessons_count', '{{count}} lessons', { count: chapter.total })}
          </span>
          {signedIn ? <ProgressBar value={pct} tone={complete ? 'green' : 'gold'} className="h-1.5 w-28" /> : null}
        </span>
        <CaretDown size={16} weight="bold" className={cn('shrink-0 text-[hsl(var(--dash-muted))] transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <div id={panelId} className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          {chapter.lessons.length ? (
            <ol className="space-y-1 border-t border-[hsl(var(--dash-border))]/70 px-2 py-2">
              {chapter.lessons.map((lesson) => (
                <LessonRow key={lesson.activity.activity_uuid} lesson={lesson} signedIn={signedIn} onPrefetch={onPrefetch} />
              ))}
            </ol>
          ) : (
            <p className="border-t border-[hsl(var(--dash-border))]/70 px-4 py-4 text-[13px] text-[hsl(var(--dash-muted))]">
              {t('course_page.chapter_empty', 'No lessons in this chapter yet.')}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

/** A lecture: who teaches it, when and where, its progress, then its chapters. */
function LectureSection({ group, signedIn, children }: { group: OutlineLecture; signedIn: boolean; children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const fmt = useFormats()
  const lecture = group.lecture
  const complete = group.total > 0 && group.done >= group.total
  const pct = group.total ? Math.round((group.done / group.total) * 100) : 0
  const place = lecture?.room || lecture?.location
  return (
    <li className="space-y-2.5">
      <div className="flex flex-wrap items-start gap-3 px-1">
        <span
          className={cn(
            'inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none',
            complete && signedIn
              ? 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]'
              : group.containsNext && signedIn
                ? 'bg-[linear-gradient(135deg,hsl(43_90%_62%),hsl(39_82%_47%))] text-[hsl(220_10%_8%)]'
                : 'bg-[hsl(var(--dash-ink))] text-white'
          )}
        >
          {lecture ? (
            <>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{t('course_page.lecture_short', 'Lec')}</span>
              <span className="text-[16px] font-extrabold tabular-nums">{fmt.number(group.number)}</span>
            </>
          ) : (
            <ListBullets size={18} weight="bold" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
            {lecture ? t('course_page.lecture_n', 'Lecture {{n}}', { n: fmt.number(group.number) }) : t('course_page.more_content', 'More content')}
          </p>
          <h3 className="text-[16px] font-bold leading-snug text-[hsl(var(--dash-ink))]" dir="auto">
            {lecture ? lecture.title : t('course_page.more_content_title', 'Extra chapters')}
          </h3>
          {lecture ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[hsl(var(--dash-muted))]">
              {lecture.instructor_name ? (
                <span className="inline-flex items-center gap-1">
                  <ChalkboardTeacher size={14} /> {lecture.instructor_name}
                </span>
              ) : null}
              {lecture.start_date ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarBlank size={14} /> {formatSlot(lecture.start_date, lecture.end_date, i18n.language)}
                </span>
              ) : null}
              {place ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {place}
                </span>
              ) : null}
            </p>
          ) : null}
          {lecture?.description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--dash-ink))]/75" dir="auto">
              {lecture.description}
            </p>
          ) : null}
        </div>
        {group.total ? (
          <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
            <span className="text-[12px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">
              {signedIn
                ? t('course_page.lessons_done_of', '{{done}}/{{total}} lessons', { done: group.done, total: group.total })
                : t('course_page.lessons_count', '{{count}} lessons', { count: group.total })}
            </span>
            {signedIn ? <ProgressBar value={pct} tone={complete ? 'green' : 'gold'} className="h-1.5 w-24" /> : null}
          </div>
        ) : null}
      </div>
      {group.chapters.length ? (
        <ol className="space-y-2.5 border-s-2 border-[hsl(var(--dash-border))]/70 ps-3 sm:ms-[1.3rem] sm:ps-5">{children}</ol>
      ) : (
        <p className="rounded-xl bg-[hsl(var(--dash-canvas))] px-4 py-3 text-[13px] text-[hsl(var(--dash-muted))] sm:ms-[1.3rem]">
          {t('course_page.lecture_empty', 'The materials for this lecture will appear here.')}
        </p>
      )}
    </li>
  )
}

/** Chapters and lessons, with the learner's progress through each. */
export default function CourseCurriculum({
  outline,
  signedIn,
  onPrefetch,
}: {
  outline: CourseOutline
  signedIn: boolean
  onPrefetch: (_activity: any) => void
}) {
  const { t } = useTranslation()
  // Chapters the learner opened or closed; the rest follow the default: the
  // chapter with the next lesson (or the first) is open, small courses open fully.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const focusKey = (outline.chapters.find((c) => c.containsNext) ?? outline.chapters[0])?.key
  const isOpen = (key: string) => overrides[key] ?? (outline.total <= 8 || key === focusKey)

  const allOpen = outline.chapters.length > 0 && outline.chapters.every((c) => isOpen(c.key))
  const toggleAll = () => setOverrides(Object.fromEntries(outline.chapters.map((c) => [c.key, !allOpen])))

  return (
    <Panel className="p-4 sm:p-5" aria-labelledby="course-content-title">
      <PanelHeader
        id="course-content-title"
        icon={<ListBullets size={18} weight="bold" />}
        title={t('course_page.content_title', 'Course content')}
        subtitle={`${
          outline.lectureGroups.some((g) => g.lecture)
            ? t('course_page.lectures_count', '{{count}} lectures', { count: outline.lectureGroups.filter((g) => g.lecture).length })
            : t('course_page.chapters_count', '{{count}} chapters', { count: outline.chapters.length })
        } · ${t('course_page.lessons_count', '{{count}} lessons', { count: outline.total })}`}
        action={
          outline.chapters.length > 1 ? (
            <button
              type="button"
              onClick={toggleAll}
              className="shrink-0 rounded-full border border-[hsl(var(--dash-border))] px-3 py-1.5 text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]/80 transition-colors hover:border-[hsl(var(--dash-ink))]/20 hover:text-[hsl(var(--dash-ink))]"
            >
              {allOpen ? t('course_page.collapse_all', 'Collapse all') : t('course_page.expand_all', 'Expand all')}
            </button>
          ) : null
        }
      />
      {outline.lectureGroups.length ? (
        <ol className="mt-5 space-y-7">
          {outline.lectureGroups.map((group) => (
            <LectureSection key={group.key} group={group} signedIn={signedIn}>
              {group.chapters.map((chapter) => (
                <ChapterBlock
                  key={chapter.key}
                  chapter={chapter}
                  open={isOpen(chapter.key)}
                  onToggle={() => setOverrides((prev) => ({ ...prev, [chapter.key]: !isOpen(chapter.key) }))}
                  signedIn={signedIn}
                  onPrefetch={onPrefetch}
                />
              ))}
            </LectureSection>
          ))}
        </ol>
      ) : outline.chapters.length ? (
        <ol className="mt-4 space-y-2.5">
          {outline.chapters.map((chapter) => (
            <ChapterBlock
              key={chapter.key}
              chapter={chapter}
              open={isOpen(chapter.key)}
              onToggle={() => setOverrides((prev) => ({ ...prev, [chapter.key]: !isOpen(chapter.key) }))}
              signedIn={signedIn}
              onPrefetch={onPrefetch}
            />
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<ListBullets size={22} />}
          title={t('course_page.no_lessons', 'No lessons yet')}
          description={t('course_page.no_lessons_body', 'Lessons will appear here once the instructor publishes them.')}
        />
      )}
    </Panel>
  )
}
