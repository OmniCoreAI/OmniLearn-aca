'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { Users } from '@phosphor-icons/react'
import { Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'

export default function MembersWidget() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgId = org?.id

  const { data: membersData, isLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 1, 'recent', 5],
    queryFn: () =>
      apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=5&sort_order=desc`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const members: any[] = membersData?.items ?? []
  const totalMembers = membersData?.total ?? 0

  return (
    <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
            {t('dashboard.home.recent_members', 'Recent members')}
          </h3>
          {totalMembers > 0 && (
            <span className="rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-accent))]">
              {totalMembers}
            </span>
          )}
        </div>
        <Link
          href="/dash/users/settings/users"
          className="text-xs font-medium text-[hsl(var(--dash-accent))] hover:underline"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dash-shimmer h-11 rounded-xl" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <span className="mb-2 rounded-full bg-[hsl(var(--dash-canvas))] p-3 text-[hsl(var(--dash-muted))]">
            <Users size={20} weight="duotone" />
          </span>
          <p className="text-xs text-[hsl(var(--dash-muted))]">
            {t('dashboard.home.no_members_yet', 'No members yet')}
          </p>
        </div>
      ) : (
        <Stagger className="space-y-0.5">
          {members.map((member: any) => {
            const user = member.user
            const displayName =
              user.first_name || user.last_name
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                : user.username
            const initials = `${(user.first_name?.[0] || user.username?.[0] || '').toUpperCase()}${(user.last_name?.[0] || '').toUpperCase()}`
            const avatar = user.avatar_image
              ? getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
              : null

            return (
              <StaggerItem key={user.user_uuid}>
                <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[hsl(var(--dash-canvas))]">
                  {avatar ? (
                    <span
                      className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${avatar})` }}
                      role="img"
                      aria-label={displayName}
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--dash-accent-soft))] text-xs font-semibold text-[hsl(var(--dash-accent))]">
                      {initials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[hsl(var(--dash-ink))]">
                      {displayName}
                    </span>
                    <span className="block truncate text-xs text-[hsl(var(--dash-muted))]">
                      {member.role?.name || user.email}
                    </span>
                  </span>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </section>
  )
}
