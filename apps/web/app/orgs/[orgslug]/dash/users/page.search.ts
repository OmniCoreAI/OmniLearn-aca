import {
  Users,
  ShieldCheck,
  UserPlus,
  ClipboardText,
} from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMetas: SearchMeta[] = [
  {
    id: 'dash.users.list',
    titleKey: 'dashboard.users.settings.tabs.users',
    descriptionKey: 'dashboard.search.entries.users.description',
    keywordsKey: 'dashboard.search.entries.users.keywords',
    icon: Users,
    href: '/dash/users/settings/users',
    group: 'users',
  },
  {
    id: 'dash.users.add',
    titleKey: 'dashboard.users.settings.tabs.add',
    descriptionKey: 'dashboard.search.entries.users_add.description',
    keywordsKey: 'dashboard.search.entries.users_add.keywords',
    icon: UserPlus,
    href: '/dash/users/settings/add',
    group: 'users',
  },
  {
    id: 'dash.users.roles',
    titleKey: 'dashboard.users.settings.tabs.roles',
    descriptionKey: 'dashboard.search.entries.roles.description',
    keywordsKey: 'dashboard.search.entries.roles.keywords',
    icon: ShieldCheck,
    href: '/dash/users/settings/roles',
    group: 'users',
  },
  {
    id: 'dash.users.audit_logs',
    titleKey: 'dashboard.users.settings.tabs.audit_logs',
    descriptionKey: 'dashboard.search.entries.users_audit_logs.description',
    keywordsKey: 'dashboard.search.entries.users_audit_logs.keywords',
    icon: ClipboardText,
    href: '/dash/users/settings/audit-logs',
    group: 'users',
  },
]
