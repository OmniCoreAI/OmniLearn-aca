'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, MapPin, Sparkles } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'
import { getTrainingProgramCatalog } from '@services/academic/academic'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory, getTrainingProgramThumbnailMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'assigned'

function dateRange(start: string | null | undefined, end: string | null | undefined, locale: string) {
  const fmt = (v: string) => new Date(v).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return start ? fmt(start) : ''
}

/** Learner view of training programs: what's assigned to me and what I can join. */
function MyPrograms({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { org, orgId, access_token, ready } = useAcademicContext()
  const [filter, setFilter] = useState<Filter>('all')
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'training-programs', orgId],
    queryFn: () => getTrainingProgramCatalog(orgId, access_token),
    enabled: ready,
  })

  if (!access_token) {
    return (
      <GeneralWrapperStyled>
        <PortalHeader title={t('portal.programs.title', 'Training programs')} />
        <SignInPrompt orgslug={orgslug} />
      </GeneralWrapperStyled>
    )
  }

  const programs = (Array.isArray(data) ? data : []) as any[]
  const assignedCount = programs.filter((p) => p.assigned).length
  const shown = filter === 'assigned' ? programs.filter((p) => p.assigned) : programs
  const orgUuid: string | undefined = org?.org_uuid

  return (
    <GeneralWrapperStyled>
      <PortalHeader
        title={t('portal.programs.title', 'Training programs')}
        subtitle={t('portal.programs.subtitle', 'Programs assigned to you and the ones open to join.')}
      />

      {programs.length > 0 && (
        <div role="tablist" className="mb-5 inline-flex rounded-full bg-[hsl(var(--dash-canvas))] p-1">
          {(['all', 'assigned'] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filter === key ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              {key === 'all'
                ? t('portal.programs.all', 'All ({{count}})', { count: programs.length })
                : t('portal.programs.assigned', 'Assigned to me ({{count}})', { count: assignedCount })}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="dash-shimmer h-64 rounded-[var(--dash-radius)]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] p-10 text-center text-sm text-[hsl(var(--dash-muted))]">
          {filter === 'assigned'
            ? t('portal.programs.none_assigned', 'Nothing assigned to you yet.')
            : t('portal.programs.none', 'No training programs are open right now.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {shown.map((p) => {
            const cover =
              p.thumbnail_image && orgUuid
                ? getTrainingProgramThumbnailMediaDirectory(orgUuid, p.trainingprogram_uuid, p.thumbnail_image)
                : null
            const when = dateRange(p.start_date, p.end_date, i18n.language)
            return (
              <article key={p.trainingprogram_uuid} className="dash-card flex flex-col overflow-hidden rounded-[var(--dash-radius)]">
                <div className="relative h-32 bg-[linear-gradient(135deg,hsl(var(--dash-gradient-from)),hsl(var(--dash-gradient-to)))]">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                    {p.training_type ? (
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-ink))]">
                        {String(t(`academic.type_${p.training_type}`, { defaultValue: p.training_type }))}
                      </span>
                    ) : <span />}
                    {p.assigned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-ink))] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <Sparkles className="h-3 w-3" /> {t('portal.programs.assigned_badge', 'Assigned to you')}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{p.name}</h2>
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--dash-muted))]">{p.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" /> {when || t('portal.programs.dates_tbc', 'Dates to be announced')}
                    </span>
                    {p.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {p.location}
                      </span>
                    ) : null}
                    <span className="font-medium text-[hsl(var(--dash-ink))]">
                      {p.is_paid && p.price ? `${p.price} ${p.currency || ''}`.trim() : t('portal.programs.free', 'Free')}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <p className="mb-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))]">
                      {t('portal.programs.courses', 'Courses ({{count}})', { count: p.courses.length })}
                    </p>
                    {p.courses.length === 0 ? (
                      <p className="text-sm text-[hsl(var(--dash-muted))]">{t('portal.programs.courses_soon', 'Courses will appear here soon.')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {p.courses.map((c: any) => (
                          <li key={c.course_uuid}>
                            <Link
                              href={getUriWithOrg(orgslug, `/course/${c.course_uuid.replace('course_', '')}`)}
                              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                            >
                              <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                                {c.thumbnail_image && orgUuid ? (
                                  <img
                                    src={getCourseThumbnailMediaDirectory(orgUuid, c.course_uuid, c.thumbnail_image)}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <BookOpen className="h-4 w-4" />
                                )}
                              </span>
                              <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </GeneralWrapperStyled>
  )
}

export default MyPrograms
