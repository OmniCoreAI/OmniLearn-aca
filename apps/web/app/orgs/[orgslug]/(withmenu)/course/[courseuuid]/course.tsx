'use client'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMetadata } from '@services/courses/courses'
import { useTrail } from '@/hooks/queries/useTrail'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { BookOpenText, CheckCircle, Info, LockKey, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions'
import { useCourseEnrollment } from '@components/Objects/Courses/CourseActions/useCourseEnrollment'
import { UpdatesSection } from '@components/Objects/Courses/CourseAuthors/CourseAuthors'
import OptionalAddOnsCard from '@components/Pages/Courses/OptionalAddOnsCard'
import CourseOnlineClasses from '@components/Objects/OnlineMeetings/CourseOnlineClasses'
import CourseHero from '@components/Pages/Courses/Overview/CourseHero'
import CourseCurriculum from '@components/Pages/Courses/Overview/CourseCurriculum'
import { CourseInstructorsCard, CourseProgressCard } from '@components/Pages/Courses/Overview/CourseSideCards'
import { useCourseOutline } from '@components/Pages/Courses/Overview/useCourseOutline'
import { EmptyState, Panel, PanelHeader } from '@components/StudentPortal/Dashboard/ui'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getActivityWithAuthHeader } from '@services/courses/activities'
import { useTranslation } from 'react-i18next'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

/** Page frame shared by the course page, its skeleton and its error state. */
function CourseFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1480px] px-3 pb-10 pt-4 sm:px-5 lg:px-6">{children}</div>
}

/** Parse the course "learnings": a JSON list of {text, emoji, link}, or a legacy comma list. */
function parseLearnings(raw: unknown): { id: string; text: string; emoji?: string | null; link?: string }[] {
  if (!raw || typeof raw !== 'string') return []
  let items: any[] | null = null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) items = parsed
  } catch (_e) {
    // Not JSON: legacy comma-separated list.
  }
  if (!items) items = raw.split(',').map((text) => ({ text: text.trim() }))
  return items
    .map((item: any, i: number) => (typeof item === 'string' ? { id: `l-${i}`, text: item } : { ...item, id: item?.id || `l-${i}`, text: item?.text ?? '' }))
    .filter((item) => item.text && item.text.trim() !== '' && item.text !== 'null')
}

/** Long "about" text, folded after a few lines. */
function AboutPanel({ text }: { text: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 520 || text.split('\n').length > 8
  return (
    <Panel className="p-4 sm:p-5" aria-labelledby="course-about-title">
      <PanelHeader id="course-about-title" icon={<Info size={18} weight="bold" />} title={t('course_page.about_title', 'About this course')} />
      <div className="relative mt-3">
        <p
          className={`whitespace-pre-line break-words text-[14.5px] leading-[1.8] text-[hsl(var(--dash-ink))]/80 text-pretty ${long && !expanded ? 'max-h-[11.5rem] overflow-hidden' : ''}`}
          dir="auto"
        >
          {text}
        </p>
        {long && !expanded ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white" /> : null}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[13px] font-semibold text-[hsl(var(--dash-ink))] underline-offset-4 hover:underline"
        >
          {expanded ? t('course_page.show_less', 'Show less') : t('course_page.show_more', 'Show more')}
        </button>
      ) : null}
    </Panel>
  )
}

const CourseClient = (props: any) => {
  const { t } = useTranslation()
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const initialCourse = props.course
  const serverError = props.serverError
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const signedIn = !!session?.data?.user
  const queryClient = useQueryClient()

  const { data: clientCourseData, error: courseError, isLoading: courseLoading } = useQuery({
    queryKey: queryKeys.courses.meta(courseuuid),
    queryFn: () => getCourseMetadata(courseuuid, {}, access_token, { slim: true }),
    enabled: !!courseuuid && !serverError,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const course = initialCourse || clientCourseData

  const { track } = useOmniLearnAnalytics('learner')

  // Track course view
  const courseId = course?.id
  const courseUuidForTracking = course?.course_uuid
  useEffect(() => {
    if (courseId && courseUuidForTracking) {
      track(AnalyticsEvent.CourseViewed, {
        course_uuid: courseUuidForTracking,
      })
    }
  }, [courseId, courseUuidForTracking, track])

  // Fetch trail data — shared cache with useTrail hook used elsewhere
  const { data: trailData } = useTrail(org?.id)

  const outline = useCourseOutline({ course, courseuuid, orgslug, trailData, currentActivity: props.current_activity })
  const enrollment = useCourseEnrollment({ course, courseuuid, orgslug, trailData })
  const learnings = useMemo(() => parseLearnings(course?.learnings), [course?.learnings])

  // Show loading state if fetching course data client-side
  if (!initialCourse && !serverError && courseLoading) {
    return (
      <CourseFrame>
        <div aria-busy="true" className="space-y-5">
          <div className="dash-shimmer h-4 w-48 rounded-full" />
          <div className="grid gap-5 rounded-[1.5rem] border border-[hsl(var(--dash-border))]/80 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
            <div className="space-y-4 p-3">
              <div className="dash-shimmer h-5 w-20 rounded-full" />
              <div className="dash-shimmer h-8 w-2/3 rounded-lg" />
              <div className="dash-shimmer h-4 w-full rounded" />
              <div className="dash-shimmer h-4 w-4/5 rounded" />
              <div className="dash-shimmer mt-6 h-11 w-44 rounded-full" />
            </div>
            <div className="dash-shimmer aspect-[16/10] rounded-2xl lg:aspect-auto lg:min-h-[300px]" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-2.5 rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="dash-shimmer h-16 rounded-2xl" />
              ))}
            </div>
            <div className="dash-shimmer h-56 rounded-[1.25rem]" />
          </div>
        </div>
      </CourseFrame>
    )
  }

  // Determine the active error (server-side or client-side)
  const activeError = serverError || courseError

  // Show error if course fetch failed
  if (!course && activeError) {
    const denied = activeError?.status === 403
    return (
      <CourseFrame>
        <Panel className="mx-auto mt-6 max-w-lg">
          <EmptyState
            className="py-12"
            icon={denied ? <LockKey size={24} /> : <WarningCircle size={24} />}
            title={t('course.accessDenied', 'Unable to access this course')}
            description={
              denied
                ? t('course.noPermission', 'You do not have permission to view this course.')
                : t('course.loadError', 'This course could not be found or there was an error loading it.')
            }
            action={
              <Link
                href={getUriWithOrg(orgslug, '/courses')}
                className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:opacity-90"
              >
                <BookOpenText size={16} />
                {t('course.backToCourses', 'Back to Courses')}
              </Link>
            }
          />
        </Panel>
      </CourseFrame>
    )
  }

  const handleActivityMouseEnter = (activity: any) => {
    if (!activity?.activity_uuid) return
    const cleanUuid = activity.activity_uuid.replace('activity_', '')
    queryClient.prefetchQuery({
      queryKey: queryKeys.activity.detail(cleanUuid),
      queryFn: () => getActivityWithAuthHeader(cleanUuid, {}, access_token),
      staleTime: 60_000,
    })
  }

  // Generate JSON-LD structured data for SEO
  const generateJsonLd = () => {
    if (!course || !org) return null
    const seo = course.seo || {}

    // Check if JSON-LD is enabled (defaults to true if not set)
    if (seo.enable_jsonld === false) return null

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: seo.title || course.name,
      description: seo.description || course.description || '',
      provider: {
        '@type': 'Organization',
        name: org.name,
        ...(org.description && { description: org.description }),
      },
      ...(course.thumbnail_image && {
        image: getCourseThumbnailMediaDirectory(
          org?.org_uuid,
          course?.course_uuid,
          course?.thumbnail_image
        ),
      }),
      ...(course.creation_date && { dateCreated: course.creation_date }),
      ...(course.update_date && { dateModified: course.update_date }),
    }

    return jsonLd
  }

  const jsonLd = generateJsonLd()
  const about = (course?.about ?? '').trim()
  // Paid courses and visitors outside the academy get the offers / join card instead.
  const showProgressCard = !(enrollment.linkedOffers.length > 0 && !enrollment.isStarted) && !(signedIn && !enrollment.isUserPartOfTheOrg)

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {!course || !org ? null : (
        <CourseFrame>
          <div className="mb-4">
            <Breadcrumbs
              items={[
                { label: t('courses.courses'), href: getUriWithOrg(orgslug, '/courses'), icon: <BookOpenText size={14} /> },
                { label: course.name },
              ]}
            />
          </div>

          <CourseHero
            course={course}
            org={org}
            outline={outline}
            shareUrl={getUriWithOrg(orgslug, `/course/${courseuuid}`)}
            signedIn={signedIn}
            isStarted={enrollment.isStarted}
            hasOffers={enrollment.linkedOffers.length > 0}
            isActionLoading={enrollment.isActionLoading}
            onStart={enrollment.handleCourseAction}
          />

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              {signedIn ? (
                <CourseOnlineClasses courseUuid={course.course_uuid} orgslug={orgslug} access_token={access_token} />
              ) : null}
              <CourseCurriculum outline={outline} signedIn={signedIn} onPrefetch={handleActivityMouseEnter} />

              {learnings.length ? (
                <Panel className="p-4 sm:p-5" aria-labelledby="course-learnings-title">
                  <PanelHeader id="course-learnings-title" icon={<Sparkle size={18} weight="bold" />} title={t('courses.what_you_will_learn')} />
                  <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {learnings.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5 rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5 text-[13.5px] text-[hsl(var(--dash-ink))]/85">
                        {item.emoji ? (
                          <span className="mt-px shrink-0 text-[15px] leading-none" aria-hidden="true">{item.emoji}</span>
                        ) : (
                          <CheckCircle size={17} weight="fill" className="mt-px shrink-0 text-[hsl(152_55%_40%)]" />
                        )}
                        <span className="min-w-0 flex-1" dir="auto">
                          {item.link ? (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                              {item.text}
                            </a>
                          ) : (
                            item.text
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {about ? <AboutPanel text={about} /> : null}
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-[86px]">
              {showProgressCard ? (
                <CourseProgressCard
                  outline={outline}
                  signedIn={signedIn}
                  isStarted={enrollment.isStarted}
                  isActionLoading={enrollment.isActionLoading}
                  onAction={enrollment.handleCourseAction}
                />
              ) : null}
              <div id="course-actions" className="scroll-mt-24 empty:hidden">
                <CoursesActions courseuuid={courseuuid} orgslug={orgslug} course={course} trailData={trailData} variant="extras" />
              </div>
              <OptionalAddOnsCard targetType="course" targetUuid={course.course_uuid} />
              <CourseInstructorsCard authors={course.authors} />
              <Panel className="px-5 pb-4 pt-3">
                <CourseProvider courseuuid={course.course_uuid}>
                  <UpdatesSection />
                </CourseProvider>
              </Panel>
            </aside>
          </div>
        </CourseFrame>
      )}
    </>
  )
}

export default CourseClient
