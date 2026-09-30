'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Lock } from 'lucide-react'
import { UsersThree } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import {
  AdminBreadcrumbs,
  AdminDrawer,
  PersonAvatar,
  formatAdminDate,
  useAdminContext,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import { getOrgLmsCourses } from '@services/academic/core'

const personName = (u: any) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.username || '—'

/** Where a group is managed: its organization's page, or the academy-wide groups screen. */
const manageHref = (orgslug: string, g: any) =>
  getUriWithOrg(orgslug, g.entity_uuid ? `/dash/administration/entities/${g.entity_uuid}?tab=groups` : '/dash/users/settings/usergroups')

function GroupDetail({ orgslug, group }: { orgslug: string; group: any }) {
  const { t, i18n } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['administration', 'usergroup', group.id, 'users'],
    queryFn: () => apiFetch(`${getAPIUrl()}usergroups/${group.id}/users`, access_token),
    enabled: ready,
  })
  const { data: resources = [] } = useQuery({
    queryKey: ['administration', 'usergroup', group.id, 'resources'],
    queryFn: () => apiFetch(`${getAPIUrl()}usergroups/${group.id}/resources`, access_token),
    enabled: ready,
  })
  const { data: courses = [] } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: () => getOrgLmsCourses(orgslug, access_token),
    enabled: ready,
  })
  const courseList = useMemo(() => {
    const byUuid = new Map((courses as any[]).map((c) => [c.course_uuid, c]))
    return ((resources as string[]) || []).filter((r) => r.startsWith('course_')).map((uuid) => byUuid.get(uuid) || { course_uuid: uuid, name: uuid })
  }, [resources, courses])

  const facts = [
    { label: t('usergroups.organization', 'Organization'), value: group.entity_name || t('usergroups.academy_wide', 'Academy-wide') },
    { label: t('usergroups.type', 'Type'), value: group.managed ? t('entities.group_type_automatic', 'Automatic') : String(t(`entities.group_type_${group.group_type}`, group.group_type)) },
    { label: t('administration.common.status', 'Status'), value: <StatusPill status={group.status} /> },
    { label: t('administration.common.created', 'Created'), value: formatAdminDate(group.creation_date, i18n.language) },
  ]

  return (
    <div className="space-y-6">
      {group.description ? <p className="text-sm leading-relaxed text-[hsl(var(--dash-ink))]">{group.description}</p> : null}
      <dl className="grid grid-cols-2 gap-4">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{f.label}</dt>
            <dd className="mt-1 text-sm text-[hsl(var(--dash-ink))]">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--dash-ink))]">
          {t('usergroups.members', 'Members')} <span className="font-normal text-[hsl(var(--dash-muted))]">· {(users as any[]).length}</span>
        </h3>
        {usersLoading ? (
          <div className="dash-shimmer h-24 rounded-2xl" />
        ) : (users as any[]).length ? (
          <ul className="max-h-72 divide-y divide-[hsl(var(--dash-border))]/70 overflow-y-auto rounded-2xl border border-[hsl(var(--dash-border))]">
            {(users as any[]).map((u) => (
              <li key={u.user_uuid || u.id} className="flex items-center gap-3 px-3 py-2">
                <PersonAvatar name={personName(u)} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{personName(u)}</div>
                  <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{u.email}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-5 text-center text-xs text-[hsl(var(--dash-muted))]">
            {t('usergroups.no_members', 'No members in this group yet.')}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--dash-ink))]">
          {t('usergroups.assigned_courses', 'Assigned courses')} <span className="font-normal text-[hsl(var(--dash-muted))]">· {courseList.length}</span>
        </h3>
        {courseList.length ? (
          <ul className="space-y-1">
            {courseList.map((c: any) => (
              <li key={c.course_uuid}>
                <Link
                  href={getUriWithOrg(orgslug, `/dash/courses/course/${c.course_uuid.replace('course_', '')}/general`)}
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--dash-muted))] rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-5 text-center text-xs text-[hsl(var(--dash-muted))]">
            {t('usergroups.no_courses', 'No courses assigned to this group.')}
          </p>
        )}
      </section>

      <Link
        href={manageHref(orgslug, group)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {group.entity_uuid ? t('usergroups.manage_in_org', 'Manage in {{org}}', { org: group.entity_name }) : t('usergroups.manage', 'Manage group')}
        <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
      </Link>
    </div>
  )
}

function UserGroupsHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('all')
  const [kind, setKind] = useState('manual')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState<any>(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['administration', 'usergroups', orgId],
    queryFn: () => apiFetch(`${getAPIUrl()}usergroups/org/${orgId}`, access_token),
    enabled: ready,
  })

  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const g of groups as any[]) if (g.entity_uuid) seen.set(g.entity_uuid, g.entity_name)
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [groups])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (groups as any[]).filter(
      (g) =>
        (kind === 'all' || (kind === 'automatic' ? g.managed : !g.managed)) &&
        (owner === 'all' || (owner === 'academy' ? !g.entity_uuid : g.entity_uuid === owner)) &&
        (status === 'all' || g.status === status) &&
        (!q || `${g.name} ${g.description || ''} ${g.entity_name || ''}`.toLowerCase().includes(q))
    )
  }, [groups, query, owner, kind, status])
  const filtering = !!query || owner !== 'all' || kind !== 'manual' || status !== 'all'

  const manual = (groups as any[]).filter((g) => !g.managed)
  const stats = {
    total: manual.length,
    orgGroups: manual.filter((g) => g.entity_uuid).length,
    members: manual.reduce((s, g) => s + (g.member_count || 0), 0),
    withCourses: manual.filter((g) => g.course_count > 0).length,
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('usergroups.title', 'User groups') }]} />
      <AcademicHeader
        title={t('usergroups.title', 'User groups')}
        subtitle={t('usergroups.subtitle', 'Every group in the academy — academy-wide and per organization — with its people and the courses assigned to it.')}
      />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'groups', label: t('usergroups.stats.groups', 'Groups'), value: stats.total, icon: UsersThree, tone: 'rose' },
          { key: 'org', label: t('usergroups.stats.org_groups', 'In organizations'), value: stats.orgGroups, icon: UsersThree, tone: 'stone', href: '/dash/administration/entities' },
          { key: 'members', label: t('usergroups.stats.memberships', 'Memberships'), value: stats.members, icon: UsersThree, tone: 'gold' },
          { key: 'courses', label: t('usergroups.stats.with_courses', 'With courses assigned'), value: stats.withCourses, icon: UsersThree, tone: 'sand' },
        ]}
      />

      <DashDataTable
        rows={visible}
        rowKey={(g: any) => g.usergroup_uuid}
        loading={isLoading}
        onRowClick={setOpen}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('entities.groups_count', '{{count}} groups', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('usergroups.search', 'Search groups')} />
            <ToolbarSelect
              label={t('usergroups.organization', 'Organization')}
              value={owner}
              onChange={setOwner}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'academy', label: t('usergroups.academy_wide', 'Academy-wide') },
                ...ownerOptions,
              ]}
            />
            <ToolbarSelect
              label={t('usergroups.type', 'Type')}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'manual', label: t('usergroups.kind_manual', 'Created by staff') },
                { value: 'automatic', label: t('entities.group_type_automatic', 'Automatic') },
                { value: 'all', label: t('administration.common.all', 'All') },
              ]}
            />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: t('academic.state_active', 'Active') },
                { value: 'inactive', label: t('administration.common.status_inactive', 'Inactive') },
              ]}
            />
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<UsersThree size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('usergroups.none', 'No user groups yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('usergroups.none_desc', 'Create groups inside an organization (departments, cohorts) or academy-wide under Users → User groups.')
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: t('usergroups.group', 'Group'),
            primary: true,
            sortValue: (g: any) => g.name,
            cell: (g: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                  {g.managed ? <Lock className="h-4 w-4" /> : <UsersThree size={17} />}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.name}</div>
                  {g.description ? <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{g.description}</div> : null}
                </div>
              </div>
            ),
          },
          {
            key: 'org',
            header: t('usergroups.organization', 'Organization'),
            sortValue: (g: any) => g.entity_name || '',
            cell: (g: any) =>
              g.entity_uuid ? (
                <span className="truncate text-[13px]">{g.entity_name}</span>
              ) : (
                <span className="text-[13px] text-[hsl(var(--dash-muted))]">{t('usergroups.academy_wide', 'Academy-wide')}</span>
              ),
          },
          { key: 'members', header: t('usergroups.members', 'Members'), align: 'end', sortValue: (g: any) => g.member_count, cell: (g: any) => <span className="tabular-nums">{g.member_count ?? 0}</span> },
          { key: 'courses', header: t('usergroups.courses', 'Courses'), align: 'end', sortValue: (g: any) => g.course_count, cell: (g: any) => <span className="tabular-nums">{g.course_count ?? 0}</span> },
          { key: 'status', header: t('administration.common.status', 'Status'), sortValue: (g: any) => g.status, cell: (g: any) => <StatusPill status={g.status} /> },
          {
            key: 'created',
            header: t('administration.common.created', 'Created'),
            hideBelow: 'lg',
            sortValue: (g: any) => g.creation_date,
            cell: (g: any) => <span className="whitespace-nowrap text-[13px] text-[hsl(var(--dash-muted))]">{formatAdminDate(g.creation_date, i18n.language)}</span>,
          },
        ]}
        actions={(g: any) => [
          { label: t('administration.common.view_details', 'View details'), onSelect: () => setOpen(g) },
          { label: g.entity_uuid ? t('usergroups.manage_in_org', 'Manage in {{org}}', { org: g.entity_name }) : t('usergroups.manage', 'Manage group'), href: manageHref(orgslug, g) },
        ]}
      />

      <AdminDrawer
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.name || ''}
        description={open?.entity_name || t('usergroups.academy_wide', 'Academy-wide')}
      >
        {open ? <GroupDetail orgslug={orgslug} group={open} /> : null}
      </AdminDrawer>
    </AcademicPageShell>
  )
}

export default UserGroupsHome
