'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpenText, ChalkboardTeacher, CheckCircle, SignOut, Trophy } from '@phosphor-icons/react'
import UserAvatar from '@components/Objects/UserAvatar'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { GOLD, Panel, PanelHeader, Ring, useFormats } from '@components/StudentPortal/Dashboard/ui'
import { activityType, type CourseOutline } from './useCourseOutline'

const GREEN = 'hsl(152 55% 40%)'

/** Progress through the course, the next lesson, and start / leave. */
export function CourseProgressCard({
  outline,
  signedIn,
  isStarted,
  isActionLoading,
  onAction,
}: {
  outline: CourseOutline
  signedIn: boolean
  isStarted: boolean
  isActionLoading: boolean
  onAction: () => void
}) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const next = outline.next
  const NextIcon = next ? activityType(next.activity.activity_type).icon : BookOpenText

  if (!signedIn || !isStarted) {
    return (
      <Panel className="p-5">
        <div className="flex items-center gap-4">
          <Ring value={0} size={64} stroke={7}>
            <BookOpenText size={22} className="text-[hsl(var(--dash-muted))]" />
          </Ring>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[hsl(var(--dash-ink))]">
              {signedIn ? t('course_page.ready_title', 'Ready to begin?') : t('course_page.sign_in_title', 'Track your progress')}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[hsl(var(--dash-muted))]">
              {signedIn
                ? t('course_page.ready_body', 'Start the course and your progress is saved as you go.')
                : t('course_page.sign_in_body', 'Sign in to save your progress and pick up where you left off.')}
            </p>
          </div>
        </div>
        {outline.total > 0 ? (
          <button
            type="button"
            onClick={onAction}
            disabled={isActionLoading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--dash-ink))] py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isActionLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {t('course_page.start', 'Start course')}
            <ArrowRight size={15} weight="bold" className="rtl:rotate-180" />
          </button>
        ) : null}
      </Panel>
    )
  }

  return (
    <Panel className="p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{t('course_page.your_progress', 'Your progress')}</p>
      <div className="mt-3 flex items-center gap-4">
        <Ring value={outline.pct} size={84} stroke={8} color={outline.isComplete ? GREEN : GOLD} label={`${outline.pct}%`}>
          {outline.isComplete ? (
            <Trophy size={26} weight="duotone" className="text-[hsl(152_60%_30%)]" />
          ) : (
            <span className="text-[19px] font-extrabold tabular-nums text-[hsl(var(--dash-ink))]">{fmt.number(outline.pct)}%</span>
          )}
        </Ring>
        <dl className="min-w-0 space-y-2 text-[13px]">
          <div>
            <dt className="text-[hsl(var(--dash-muted))]">{t('course_page.lessons_label', 'Lessons')}</dt>
            <dd className="font-bold tabular-nums text-[hsl(var(--dash-ink))]">
              {t('course_page.x_of_y', '{{done}} of {{total}}', { done: fmt.number(outline.done), total: fmt.number(outline.total) })}
            </dd>
          </div>
          <div>
            <dt className="text-[hsl(var(--dash-muted))]">{t('course_page.chapters_label', 'Chapters completed')}</dt>
            <dd className="font-bold tabular-nums text-[hsl(var(--dash-ink))]">
              {t('course_page.x_of_y', '{{done}} of {{total}}', { done: fmt.number(outline.chaptersDone), total: fmt.number(outline.chapters.length) })}
            </dd>
          </div>
        </dl>
      </div>

      {next ? (
        <Link
          href={next.href}
          className="group mt-4 flex items-center gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))] p-3 transition-colors hover:bg-[hsl(43_85%_95%)]"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[hsl(36_80%_32%)] shadow-[0_1px_2px_hsl(220_30%_10%/0.06)]">
            <NextIcon size={20} weight="duotone" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold text-[hsl(var(--dash-muted))]">{t('course_page.next_up', 'Next up')}</span>
            <span className="block truncate text-[13.5px] font-bold text-[hsl(var(--dash-ink))]" dir="auto">
              {next.activity.name}
            </span>
            {outline.nextChapter ? (
              <span className="block truncate text-[11.5px] text-[hsl(var(--dash-muted))]" dir="auto">
                {outline.nextChapter.chapter.name}
              </span>
            ) : null}
          </span>
          <ArrowRight size={16} weight="bold" className="shrink-0 text-[hsl(var(--dash-muted))] transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--dash-ink))] rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      ) : outline.isComplete ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[hsl(152_45%_94%)] p-3 text-[13px] font-semibold text-[hsl(152_60%_26%)]">
          <CheckCircle size={18} weight="fill" className="mt-px shrink-0" />
          {t('course_page.completed_all', 'You have completed every lesson in this course.')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setConfirmLeave(true)}
        disabled={isActionLoading}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-warn))] disabled:opacity-60"
      >
        <SignOut size={14} className="rtl:-scale-x-100" />
        {t('course_page.leave', 'Leave course')}
      </button>
      <ConfirmationModal
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        dialogTitle={t('course_page.leave_title', 'Leave this course?')}
        confirmationMessage={t('course_page.leave_body', 'The course will be removed from your courses and your progress in it will be cleared. You can start again at any time.')}
        confirmationButtonText={t('course_page.leave', 'Leave course')}
        functionToExecute={() => {
          setConfirmLeave(false)
          onAction()
        }}
        status="warning"
      />
    </Panel>
  )
}

const ROLE_KEYS: Record<string, [string, string]> = {
  CREATOR: ['course_page.role_creator', 'Course creator'],
  MAINTAINER: ['course_page.role_maintainer', 'Maintainer'],
  CONTRIBUTOR: ['course_page.role_contributor', 'Contributor'],
  REPORTER: ['course_page.role_reporter', 'Reporter'],
}
const ROLE_ORDER: Record<string, number> = { CREATOR: 0, MAINTAINER: 1, CONTRIBUTOR: 2, REPORTER: 3 }

/** The people who teach and maintain the course. */
export function CourseInstructorsCard({ authors }: { authors: any[] }) {
  const { t } = useTranslation()
  const active = (authors ?? [])
    .filter((a) => a.authorship_status === 'ACTIVE')
    .sort((a, b) => (ROLE_ORDER[a.authorship] ?? 9) - (ROLE_ORDER[b.authorship] ?? 9))
  if (!active.length) return null

  return (
    <Panel className="p-5">
      <PanelHeader icon={<ChalkboardTeacher size={18} weight="bold" />} title={t('course_page.instructors_title', 'Instructors')} />
      <ul className="mt-4 space-y-3">
        {active.map((a) => {
          const u = a.user
          const name = u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.username
          const [key, fallback] = ROLE_KEYS[a.authorship] ?? ['', a.authorship]
          return (
            <li key={u.user_uuid} className="flex items-center gap-3">
              <UserAvatar
                width={40}
                rounded="rounded-full"
                avatar_url={u.avatar_image ? getUserAvatarMediaDirectory(u.user_uuid, u.avatar_image) : ''}
                predefined_avatar={u.avatar_image ? undefined : 'empty'}
                showProfilePopup
                userId={u.id}
              />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[hsl(var(--dash-ink))]" dir="auto">
                  {name}
                </p>
                <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">{key ? t(key, fallback) : fallback}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
