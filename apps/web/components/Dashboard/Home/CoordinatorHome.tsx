'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Buildings,
  Certificate,
  ChartLineUp,
  FileXls,
  Hourglass,
  ListChecks,
  UserPlus,
  Users,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import { getEntityLearning, getEntityProgress, getMyEntities } from '@services/administration/administration'
import { getUriWithOrg } from '@services/config/config'
import { HomeCard, EmptyState } from './HomeCard'
import { ViewAllLink, WorkBadge, WorkListSkeleton, WorkRow } from './WorkspaceUI'

/** Dashboard home for the Entity Coordinator role: a snapshot of the entity they run. */
export default function CoordinatorHome() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const orgId: number | undefined = org?.id
  const orgslug: string = org?.slug
  const token: string = session?.data?.tokens?.access_token
  const ready = !!orgId && !!token

  const entitiesQ = useQuery({
    queryKey: ['entities', 'mine', orgId],
    queryFn: () => getMyEntities(orgId!, token),
    enabled: ready,
  })
  const entities = (Array.isArray(entitiesQ.data) ? entitiesQ.data : []) as any[]
  const entity = entities[0]
  const entityUuid: string | undefined = entity?.entity_uuid

  const progressQ = useQuery({
    queryKey: ['entities', entityUuid, 'progress', ''],
    queryFn: () => getEntityProgress(entityUuid!, token),
    enabled: ready && !!entityUuid,
  })
  const learningQ = useQuery({
    queryKey: ['entities', entityUuid, 'learning'],
    queryFn: () => getEntityLearning(entityUuid!, token),
    enabled: ready && !!entityUuid,
  })

  const href = (path: string) => getUriWithOrg(orgslug, path)
  const portal = (tab?: string) => href(`/dash/my-entity${tab ? `?tab=${tab}` : ''}`)

  if (!entitiesQ.isLoading && !entity) {
    return (
      <HomeCard title={t('entities.portal.nav', 'My entity')}>
        <EmptyState>
          {t('entities.portal.none_desc', 'The academy assigns entity coordinators from Administration → Entities.')}
        </EmptyState>
      </HomeCard>
    )
  }

  const progress = progressQ.data as any
  const members = (progress?.members ?? []) as any[]
  const learning = (Array.isArray(learningQ.data) ? learningQ.data : []) as any[]
  const unassigned = learning.filter((r) => (r.assignments || []).length === 0)
  const notStarted = members.filter((m) => m.enrolled > 0 && m.completed === 0 && !m.average_progress)
  const nothingAssigned = members.filter((m) => !m.enrolled)
  const perms = entity?.coordinator_permissions || {}
  const loading = entitiesQ.isLoading || progressQ.isLoading || learningQ.isLoading
  const isArabic = (i18n.language || '').startsWith('ar')
  const entityName = entity ? (isArabic && entity.name_ar) || entity.name : ''

  const actions = [
    perms.can_manage_members && { key: 'members', label: t('workspace.add_members', 'Add members'), icon: UserPlus, tab: 'members' },
    perms.can_import_users && { key: 'import', label: t('workspace.import_members', 'Import from Excel'), icon: FileXls, tab: 'import' },
    perms.can_assign_training && { key: 'training', label: t('workspace.assign_training', 'Assign training'), icon: ListChecks, tab: 'training' },
    { key: 'progress', label: t('workspace.view_progress', 'Progress & activity'), icon: ChartLineUp, tab: 'progress' },
  ].filter(Boolean) as { key: string; label: string; icon: React.ElementType; tab: string }[]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
          <Buildings size={20} weight="duotone" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{entityName || '…'}</p>
          <p className="text-[12px] text-[hsl(var(--dash-muted))]">
            {entities.length > 1
              ? t('workspace.more_entities', 'You coordinate {{count}} entities — switch between them in My organization.', { count: entities.length })
              : t('entities.portal.subtitle', 'Entity coordinator workspace')}
          </p>
        </div>
      </div>

      <DashStatCards
        loading={loading}
        stats={[
          { key: 'members', label: t('workspace.learners', 'Learners'), value: progress?.total_members ?? 0, icon: Users, tone: 'rose', href: portal('members') },
          { key: 'active', label: t('workspace.learning_now', 'Learning now'), value: progress?.active_learners ?? 0, icon: BookOpen, tone: 'stone', href: portal('progress') },
          { key: 'completion', label: t('workspace.completion_rate', 'Completion rate'), value: `${progress?.completion_rate ?? 0}%`, icon: Certificate, tone: 'gold' },
          { key: 'to-assign', label: t('workspace.training_to_assign', 'Training to assign'), value: unassigned.length, icon: ListChecks, tone: 'sand', href: portal('training') },
        ]}
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 @3xl:col-span-4">
          <HomeCard title={t('workspace.quick_actions', 'Quick actions')}>
            <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-1">
              {actions.map(({ key, label, icon: Icon, tab }) => (
                <Link
                  key={key}
                  href={portal(tab)}
                  className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-3 py-3 text-[13.5px] font-semibold transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[hsl(var(--dash-accent))]">
                    <Icon size={18} weight="duotone" />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </HomeCard>
        </div>

        <div className="col-span-12 @3xl:col-span-8">
          <HomeCard
            title={t('workspace.training', 'Training for your people')}
            subtitle={t('workspace.training_desc', 'What the academy made available to your entity')}
            action={<ViewAllLink href={portal('training')} label={t('workspace.open_training', 'Open training')} />}
          >
            {loading ? (
              <WorkListSkeleton />
            ) : learning.length === 0 ? (
              <EmptyState>{t('workspace.no_learning', 'The academy hasn’t made any courses or programs available to your entity yet.')}</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {learning.slice(0, 6).map((r) => {
                  const assignedTo = (r.assignments || []).length
                  return (
                    <WorkRow
                      key={r.resource_uuid}
                      href={portal('training')}
                      icon={r.resource_type === 'training_program' ? Certificate : BookOpen}
                      title={r.resource_name || r.resource_uuid}
                      meta={r.resource_type === 'training_program' ? t('workspace.training_program', 'Training program') : t('workspace.course', 'Course')}
                      badge={
                        assignedTo ? (
                          <WorkBadge>{t('workspace.assigned_to_n', 'Assigned to {{count}}', { count: assignedTo })}</WorkBadge>
                        ) : (
                          <WorkBadge tone="warn">{t('workspace.not_assigned', 'Not assigned yet')}</WorkBadge>
                        )
                      }
                    />
                  )
                })}
              </ul>
            )}
          </HomeCard>
        </div>

        <div className="col-span-12">
          <HomeCard
            title={t('workspace.not_started', 'Haven’t started yet')}
            subtitle={
              nothingAssigned.length
                ? t('workspace.nothing_assigned_n', '{{count}} learners have nothing assigned', { count: nothingAssigned.length })
                : undefined
            }
            action={<ViewAllLink href={portal('progress')} label={t('workspace.view_progress', 'Progress & activity')} />}
          >
            {loading ? (
              <WorkListSkeleton rows={2} />
            ) : notStarted.length === 0 ? (
              <EmptyState>{t('workspace.everyone_started', 'Everyone with assigned training has started.')}</EmptyState>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2">
                {notStarted.slice(0, 8).map((m) => (
                  <WorkRow
                    key={m.member_uuid}
                    href={portal('progress')}
                    icon={Hourglass}
                    title={[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username}
                    meta={[m.position_name, t('workspace.n_assigned', '{{count}} assigned', { count: m.enrolled })].filter(Boolean).join(' · ')}
                  />
                ))}
              </ul>
            )}
          </HomeCard>
        </div>
      </div>
    </div>
  )
}
