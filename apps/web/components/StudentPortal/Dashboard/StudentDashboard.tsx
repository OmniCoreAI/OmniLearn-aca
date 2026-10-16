'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { WarningCircle } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLearnerOverview } from '@/hooks/queries/useLearnerOverview'
import ContinueHero from './ContinueHero'
import PersonalStats from './PersonalStats'
import CourseProgress from './CourseProgress'
import UpcomingSchedule from './UpcomingSchedule'
import RecentActivity from './RecentActivity'

// recharts is large: keep it off the critical path.
const LearningActivityChart = dynamic(() => import('./LearningActivityChart'), {
  ssr: false,
  loading: () => <div className="dash-shimmer h-[380px] rounded-[1.25rem] fit:h-full" />,
})

/**
 * "My learning home": where I stopped, how far I am, how regular I am, my
 * courses, what's coming and what I did — all about the signed-in learner.
 *
 * On desktop-size screens (the `fit` variant) the whole page fills exactly one
 * screen: the bottom row and the side column share the leftover height and
 * long lists scroll inside their own card. Smaller screens keep a scrolling stack.
 */
export default function StudentDashboard({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { data, isLoading, isError, refetch } = useLearnerOverview(org?.id)

  const courses = data?.courses ?? []
  // Courses come most-recent first; the first unfinished one is where to pick up.
  const resume = courses.find((c) => !c.completed) ?? null
  const allDone = courses.length > 0 && !resume

  return (
    // 86px = the sticky top bar (62) + the shell's bottom padding (24).
    <div className="mx-auto flex w-full max-w-[1680px] flex-col px-3 pb-2 pt-4 sm:px-5 fit:h-[calc(100dvh-86px)] fit:pb-0 fit:pt-4">
      {isError ? (
        <div role="alert" className="mb-4 flex shrink-0 items-center gap-3 rounded-2xl border border-[hsl(var(--dash-warn))]/25 bg-[hsl(var(--dash-warn-soft))] px-4 py-3 text-[13.5px] text-[hsl(var(--dash-warn))]">
          <WarningCircle size={18} weight="fill" className="shrink-0" />
          <span className="flex-1">{t('student_portal.load_error', 'We couldn’t load your progress.')}</span>
          <button type="button" onClick={() => refetch()} className="font-semibold underline underline-offset-2">
            {t('student_portal.retry', 'Retry')}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px] fit:min-h-0 fit:flex-1 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4 fit:min-h-0">
          <div className="fit:shrink-0">
            <ContinueHero orgslug={orgslug} overview={data} resume={resume} allDone={allDone} loading={isLoading} />
          </div>
          <div className="fit:shrink-0">
            <PersonalStats totals={data?.totals} days={data?.days} loading={isLoading} />
          </div>
          <div className="grid grid-cols-1 gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-w-0 fit:min-h-0">
              <LearningActivityChart days={data?.days} totals={data?.totals} loading={isLoading} />
            </div>
            <div className="min-w-0 fit:min-h-0">
              <CourseProgress orgslug={orgslug} courses={data?.courses} nextUuid={resume?.course_uuid ?? null} loading={isLoading} />
            </div>
          </div>
        </div>

        <aside
          aria-label={t('student_portal.rail_label', 'Schedule and activity')}
          className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1 fit:flex fit:min-h-0 fit:flex-col"
        >
          <div className="min-w-0 fit:min-h-0 fit:flex-[1.9]">
            <UpcomingSchedule orgslug={orgslug} />
          </div>
          <div className="min-w-0 fit:min-h-0 fit:flex-1">
            <RecentActivity orgslug={orgslug} events={data?.recent} loading={isLoading} />
          </div>
        </aside>
      </div>
    </div>
  )
}
