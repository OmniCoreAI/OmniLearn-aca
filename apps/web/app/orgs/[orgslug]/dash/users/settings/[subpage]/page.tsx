'use client'
import React, { useEffect, use } from 'react';
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { getUriWithOrg } from '@services/config/config'
import { UserPlus, Users, UsersRound, Shield, ShieldAlert } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers'
import OrgUsersAdd from '@components/Dashboard/Pages/Users/OrgUsersAdd/OrgUsersAdd'
import OrgUserGroups from '@components/Dashboard/Pages/Users/OrgUserGroups/OrgUserGroups'
import OrgRoles from '@components/Dashboard/Pages/Users/OrgRoles/OrgRoles'
import OrgAuditLogs from '@components/Dashboard/Pages/Org/OrgAuditLogs/OrgAuditLogs'
import { useTranslation } from 'react-i18next'
import { DashTabBar, DashTabItem } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'

export type SettingsParams = {
  subpage: string
  orgslug: string
}

function UsersSettingsPage(props: { params: Promise<SettingsParams> }) {
  const { t } = useTranslation()
  const router = useRouter()
  const params = use(props.params);
  const [H1Label, setH1Label] = React.useState('')
  const [H2Label, setH2Label] = React.useState('')

  function handleLabels() {
    if (params.subpage == 'users') {
      setH1Label(t('dashboard.users.settings.pages.users.title'))
      setH2Label(t('dashboard.users.settings.pages.users.subtitle'))
    }
    if (params.subpage == 'usergroups') {
      setH1Label(t('dashboard.users.settings.pages.usergroups.title'))
      setH2Label(t('dashboard.users.settings.pages.usergroups.subtitle'))
    }
    if (params.subpage == 'add') {
      setH1Label(t('dashboard.users.settings.pages.add.title'))
      setH2Label(t('dashboard.users.settings.pages.add.subtitle'))
    }
    if (params.subpage == 'roles') {
      setH1Label(t('dashboard.users.settings.pages.roles.title'))
      setH2Label(t('dashboard.users.settings.pages.roles.subtitle'))
    }
    if (params.subpage == 'audit-logs') {
      setH1Label(t('dashboard.users.settings.pages.audit_logs.title'))
      setH2Label(t('dashboard.users.settings.pages.audit_logs.subtitle'))
    }
  }

  useEffect(() => {
    handleLabels()
  }, [params.subpage, params, t])

  useEffect(() => {
    if (params.subpage === 'signups') {
      router.replace(getUriWithOrg(params.orgslug, '') + `/dash/users/settings/users`)
    }
  }, [params.subpage, params.orgslug, router])

  const tabs: DashTabItem[] = [
    {
      key: 'users',
      label: t('dashboard.users.settings.tabs.users'),
      icon: <Users size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/users`,
      active: params.subpage === 'users',
    },
    {
      key: 'usergroups',
      label: t('dashboard.users.settings.tabs.usergroups'),
      icon: <UsersRound size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/usergroups`,
      active: params.subpage === 'usergroups',
      requiresPlan: 'standard',
    },
    {
      key: 'roles',
      label: t('dashboard.users.settings.tabs.roles'),
      icon: <Shield size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/roles`,
      active: params.subpage === 'roles',
      requiresPlan: 'pro',
    },
    {
      key: 'add',
      label: t('dashboard.users.settings.tabs.add'),
      icon: <UserPlus size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/add`,
      active: params.subpage === 'add',
    },
    {
      key: 'audit-logs',
      label: t('dashboard.users.settings.tabs.audit_logs'),
      icon: <ShieldAlert size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/audit-logs`,
      active: params.subpage === 'audit-logs',
      requiresPlan: 'enterprise',
    },
  ]

  if (params.subpage === 'signups') {
    return null
  }

  return (
    <div className="grid h-screen w-full grid-cols-1 grid-rows-[auto_1fr] overflow-hidden bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]">
      <div className="relative z-10 flex-shrink-0 border-b border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-4 tracking-tight sm:px-10">
        <div className="pb-4 pt-6">
          <Breadcrumbs items={[
            { label: t('common.users'), href: '/dash/users/settings/users', icon: <Users size={14} /> }
          ]} />
        </div>
        <div className="my-2 py-3">
          <div className="flex w-full min-w-0 flex-col space-y-1">
            <div className="flex truncate pt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {H1Label}
            </div>
            <div className="flex truncate text-sm font-medium text-[hsl(var(--dash-muted))]">
              {H2Label}
            </div>
          </div>
        </div>
        <div className="pb-3">
          <DashTabBar tabs={tabs} />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="min-w-0 overflow-y-auto overflow-x-hidden"
      >
        {params.subpage == 'users' ? <OrgUsers /> : ''}
        {params.subpage == 'usergroups' ? <OrgUserGroups /> : ''}
        {params.subpage == 'add' ? <OrgUsersAdd /> : ''}
        {params.subpage == 'roles' ? <><div className="h-6"></div><OrgRoles /></> : ''}
        {params.subpage == 'audit-logs' ? <><div className="h-6"></div><OrgAuditLogs /></> : ''}
      </motion.div>
    </div>
  )
}

export default UsersSettingsPage
