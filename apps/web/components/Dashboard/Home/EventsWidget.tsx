'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useAdminOrgCourses } from '@/hooks/queries/useCourses'
import { getAssignmentsFromACourse } from '@services/courses/assignments'
import { ClipboardText, Exam, NotePencil, PencilRuler } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'

const TILE_STYLES = [
  'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]',
  'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]',
  'bg-[hsl(var(--dash-tile-sky))] text-[hsl(var(--dash-tile-sky-fg))]',
  'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]',
  'bg-[hsl(var(--dash-tile-rose))] text-[hsl(var(--dash-tile-rose-fg))]',
]

const TILE_ICONS = [ClipboardText, NotePencil, Exam, PencilRuler]

/** Cap how many courses we fan-out assignment requests for — N+1 was killing load time. */
const MAX_COURSES_FOR_ASSIGNMENTS = 5
const ASSIGNMENT_CONCURRENCY = 3

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!, i)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  )
  return results
}

function WeekStrip() {
  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - 2 + i)
      return d
    })
  }, [])

  const todayKey = new Date().toDateString()

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const isToday = d.toDateString() === todayKey
        return (
          <div
            key={d.toISOString()}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl py-2 text-center transition-colors',
              isToday
                ? 'bg-[hsl(var(--dash-accent))] text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.35)]'
                : 'text-[hsl(var(--dash-muted))]'
            )}
          >
            <span className="text-[10px] font-medium uppercase">
              {d.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span
              className={cn(
                'text-sm font-semibold',
                isToday ? 'text-white' : 'text-[hsl(var(--dash-ink))]'
              )}
            >
              {d.getDate()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function EventsWidget() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug

  const { data: coursesData } = useAdminOrgCourses(orgslug)
  const courses: any[] = useMemo(() => coursesData ?? [], [coursesData])

  // Only the most recently updated courses — never fan-out across the full catalog
  const sampledCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => {
        const ta = new Date(a.updated_at || a.creation_date || 0).getTime()
        const tb = new Date(b.updated_at || b.creation_date || 0).getTime()
        return tb - ta
      })
      .slice(0, MAX_COURSES_FOR_ASSIGNMENTS)
  }, [courses])

  const courseUuids = useMemo(
    () => sampledCourses.map((c: any) => c.course_uuid as string),
    [sampledCourses]
  )
  const courseNameByUuid = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of sampledCourses) map[c.course_uuid] = c.name
    return map
  }, [sampledCourses])

  const uuidsKey = courseUuids.join(',')

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['assignments-upcoming', orgslug, uuidsKey],
    queryFn: async () => {
      const results = await mapPool(
        courseUuids,
        ASSIGNMENT_CONCURRENCY,
        async (uuid) => {
          try {
            return await getAssignmentsFromACourse(uuid, token)
          } catch {
            return { data: [] }
          }
        }
      )
      return results.flatMap((res: any, idx: number) =>
        (res?.data ?? []).map((a: any) => ({ ...a, _courseUuid: courseUuids[idx] }))
      )
    },
    enabled: courseUuids.length > 0 && !!token,
    staleTime: 120_000,
  })

  const upcoming = useMemo(() => {
    const all: any[] = assignmentsData ?? []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return all
      .filter((a) => a.due_date)
      .map((a) => ({ ...a, _due: new Date(a.due_date) }))
      .filter((a) => !isNaN(a._due.getTime()) && a._due >= today)
      .sort((a, b) => a._due.getTime() - b._due.getTime())
      .slice(0, 4)
  }, [assignmentsData])

  return (
    <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
          {t('dashboard.home.events', 'Events')}
        </h3>
        <Link
          href="/dash/assignments"
          className="text-xs font-medium text-[hsl(var(--dash-accent))] hover:underline"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      </div>

      <WeekStrip />

      <div className="mt-4 space-y-1">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="dash-shimmer h-12 rounded-xl" />
          ))
        ) : upcoming.length === 0 ? (
          <p className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-4 text-center text-xs text-[hsl(var(--dash-muted))]">
            {t('dashboard.home.no_upcoming_deadlines', 'No upcoming deadlines')}
          </p>
        ) : (
          <Stagger className="space-y-1" staggerDelay={0.04}>
            {upcoming.map((a: any, i: number) => {
              const Icon = TILE_ICONS[i % TILE_ICONS.length]
              const courseName = courseNameByUuid[a._courseUuid] || ''
              return (
                <StaggerItem key={a.assignment_uuid ?? `${a.title}-${i}`}>
                  <Link
                    href="/dash/assignments"
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                  >
                    <span
                      className={cn(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        TILE_STYLES[i % TILE_STYLES.length]
                      )}
                    >
                      <Icon size={18} weight="fill" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[hsl(var(--dash-ink))]">
                        {a.title || t('dashboard.home.assignment', 'Assignment')}
                      </span>
                      <span className="block truncate text-xs text-[hsl(var(--dash-muted))]">
                        {courseName}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-[hsl(var(--dash-accent))]">
                      {a._due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
    </section>
  )
}
