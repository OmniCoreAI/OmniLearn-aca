'use client'

import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookCopy } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import LearnerHome, { GuestHero } from '@components/Landings/LearnerHome'

interface LandingClassicProps {
  courses: any[]
  orgslug: string
  org_id: string | number
}

function LandingClassic({ courses, orgslug, org_id }: LandingClassicProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const signedIn = !!session?.data?.tokens?.access_token

  // Two rows at the widest grid; the rest live on the courses page
  const displayedCourses = courses.slice(0, 10)
  const hasMoreCourses = courses.length > 10

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="mb-10">{signedIn ? <LearnerHome orgslug={orgslug} /> : <GuestHero orgslug={orgslug} />}</div>

        {/* Courses */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
                {t('learner.home.explore', 'Explore courses')}
                {courses.length > 0 ? (
                  <span className="rounded-full bg-[hsl(var(--dash-ink))]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">
                    {courses.length}
                  </span>
                ) : null}
              </h2>
              <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">
                {t('learner.home.explore_desc', 'Courses and programs open to you — pick one to start learning.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {courses.length > 0 ? (
                <Link
                  href={getUriWithOrg(orgslug, '/courses')}
                  className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  {t('learner.home.view_all', 'View all')}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              ) : null}
              <AuthenticatedClientElement ressourceType="courses" action="create" checkMethod="roles" orgId={org_id}>
                <Link href={getUriWithOrg(orgslug, '/courses?new=true')}>
                  <NewCourseButton />
                </Link>
              </AuthenticatedClientElement>
            </div>
          </div>
          {courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-white px-4 py-12 text-center">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                <BookCopy className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="text-base font-semibold text-[hsl(var(--dash-ink))]">{t('courses.no_courses')}</h3>
              <p className="mt-1 max-w-xs text-sm text-[hsl(var(--dash-muted))]">
                <ContentPlaceHolderIfUserIsNotAdmin text={t('courses.create_courses_placeholder')} />
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {displayedCourses.map((course: any, index: number) => (
                <div key={course.course_uuid} className="flex">
                  <CourseThumbnail course={course} orgslug={orgslug} isPriority={index < 4} />
                </div>
              ))}
            </div>
          )}
          {hasMoreCourses ? (
            <div className="flex justify-center pt-2">
              <Link
                href={getUriWithOrg(orgslug, '/courses')}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-5 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
              >
                {t('courses.view_all_courses')} ({courses.length})
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          ) : null}
        </section>
      </GeneralWrapperStyled>
    </div>
  )
}

export default LandingClassic
