'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  BookOpen,
  Users,
  ChatCircle,
  Microphone,
  Chalkboard,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { apiFetch } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import { getCommunities } from '@services/communities/communities'
import { getBoards } from '@services/boards/boards'
import { getOrgCourses } from '@services/courses/courses'
import { getOrgPodcasts } from '@services/podcasts/podcasts'

export default function ContentOverview() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug
  const orgId = org?.id
  const rf = org?.config?.config?.resolved_features
  const features = org?.config?.config?.features
  const isEnabled = (feature: string, defaultDisabled = false) => {
    if (rf?.[feature]) return rf[feature].enabled
    const v1 = features?.[feature]
    return defaultDisabled ? v1?.enabled === true : v1?.enabled !== false
  }

  // Courses
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'overview'],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  // Members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 'overview'],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=1`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  // Communities
  const communitiesEnabled = isEnabled('communities')
  const { data: communitiesData } = useQuery({
    queryKey: queryKeys.community.list(orgId),
    queryFn: () => getCommunities(orgId, 1, 500, null, token),
    enabled: !!communitiesEnabled && !!token && !!orgId,
    staleTime: 60_000,
  })

  // Podcasts
  const podcastsEnabled = isEnabled('podcasts', true)
  const { data: podcastsData } = useQuery({
    queryKey: [...queryKeys.podcasts.list(orgslug), 'overview'],
    queryFn: () => getOrgPodcasts(orgslug, null, token, true),
    enabled: !!podcastsEnabled && !!token && !!orgslug,
    staleTime: 60_000,
  })

  // Boards
  const boardsEnabled = isEnabled('boards', true)
  const { data: boardsData } = useQuery({
    queryKey: [...queryKeys.boards.list(orgslug), 'overview'],
    queryFn: () => getBoards(orgId, token),
    enabled: !!boardsEnabled && !!token && !!orgId,
    staleTime: 60_000,
  })

  const courses: any[] = coursesData ?? []
  const totalMembers = membersData?.total ?? 0
  const communities: any[] = communitiesData ?? []
  const podcasts: any[] = podcastsData ?? []
  const boards: any[] = boardsData ?? []

  const publishedCourses = courses.filter((c: any) => c.published).length
  const draftCourses = courses.length - publishedCourses

  const cards = [
    {
      label: t('dashboard.home.courses'),
      value: courses.length,
      sub: `${publishedCourses} ${t('dashboard.home.published')} · ${draftCourses} ${t('dashboard.home.draft')}`,
      icon: BookOpen,
      iconColor: 'text-[hsl(var(--dash-accent))]',
      iconBg: 'bg-[hsl(var(--dash-accent-soft))]',
      href: '/dash/courses',
      show: true,
    },
    {
      label: t('dashboard.home.members'),
      value: totalMembers,
      sub: t('dashboard.home.total_users'),
      icon: Users,
      iconColor: 'text-[hsl(var(--dash-accent))]',
      iconBg: 'bg-[hsl(var(--dash-accent-soft))]',
      href: '/dash/users/settings/users',
      show: true,
    },
    {
      label: t('dashboard.home.communities'),
      value: communities.length,
      sub: `${communities.filter((c: any) => c.public).length} ${t('dashboard.home.public')}`,
      icon: ChatCircle,
      iconColor: 'text-[hsl(var(--dash-accent))]',
      iconBg: 'bg-[hsl(var(--dash-accent-soft))]',
      href: '/dash/communities',
      show: communitiesEnabled,
    },
    {
      label: t('dashboard.home.podcasts'),
      value: podcasts.length,
      sub: `${podcasts.reduce((sum: number, p: any) => sum + (p.episode_count || 0), 0)} ${t('dashboard.home.episodes')}`,
      icon: Microphone,
      iconColor: 'text-[hsl(var(--dash-accent))]',
      iconBg: 'bg-[hsl(var(--dash-accent-soft))]',
      href: '/dash/podcasts',
      show: podcastsEnabled,
    },
    {
      label: t('dashboard.home.boards'),
      value: boards.length,
      sub: `${boards.reduce((sum: number, b: any) => sum + (b.member_count || 0), 0)} ${t('dashboard.home.participants')}`,
      icon: Chalkboard,
      iconColor: 'text-[hsl(var(--dash-accent))]',
      iconBg: 'bg-[hsl(var(--dash-accent-soft))]',
      href: '/dash/boards',
      show: boardsEnabled,
    },
  ]

  const visibleCards = cards.filter((c) => c.show)
  const isLoading = coursesLoading || membersLoading

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl nice-shadow px-5 py-4 animate-pulse"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-gray-100 rounded-lg" />
              <div className="h-2.5 bg-gray-100 rounded w-16" />
            </div>
            <div className="h-7 bg-gray-100 rounded w-10 mb-1.5" />
            <div className="h-2 bg-gray-50 rounded w-24" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`grid gap-4 ${
        visibleCards.length <= 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      }`}
    >
      {visibleCards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-5 py-4 transition-colors hover:border-[hsl(var(--dash-accent))]/20 hover:bg-[hsl(var(--dash-accent-soft))]/40"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className={`rounded-lg p-1.5 ${card.iconBg}`}>
              <card.icon
                size={14}
                weight="duotone"
                className={card.iconColor}
              />
            </div>
            <span className="text-xs font-medium text-[hsl(var(--dash-muted))]">
              {card.label}
            </span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{card.value}</div>
          <p className="mt-0.5 text-[11px] text-[hsl(var(--dash-muted))]/80">{card.sub}</p>
        </Link>
      ))}
    </div>
  )
}
