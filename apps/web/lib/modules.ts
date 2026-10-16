'use client'
import { useMemo } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'

/**
 * Platform sections ("modules") switched on/off in the API's `.env` file with
 * `OMNILEARN_FEATURE_<NAME>=false`. A module that is off is hidden from every
 * user, super admins included, and its API answers 404.
 *
 * The API sends the current state on the org (`config.config.modules`) and on
 * the portal-navigation response. Keep this list in sync with
 * `apps/api/src/security/modules.py`.
 */
export type ModuleKey = 'postgraduate' | 'training_programs' | 'finance' | 'analytics' | 'reports' | 'news' | 'online_classes'

export const MODULE_KEYS: ModuleKey[] = ['postgraduate', 'training_programs', 'finance', 'analytics', 'reports', 'news', 'online_classes']

/**
 * Path prefixes each module owns, beyond its sidebar items: dashboard
 * sub-pages that live under another section, and learner-portal pages
 * (org-relative, without the `/orgslug` prefix).
 */
const MODULE_PATHS: Record<ModuleKey, string[]> = {
  postgraduate: ['/dash/postgraduate', '/dash/reports/admissions', '/academics', '/admissions'],
  training_programs: ['/dash/training-programs', '/programs'],
  finance: ['/dash/finance', '/dash/reports/financial', '/dash/instructors/finance'],
  analytics: ['/dash/analytics'],
  reports: ['/dash/reports'],
  news: ['/dash/cms/news'],
  online_classes: ['/dash/online-classes', '/dash/administration/zoom', '/online'],
}

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')

/** Modules that own this path (a path can belong to more than one, e.g. /dash/reports/financial). */
export function modulesForPath(path: string): ModuleKey[] {
  return MODULE_KEYS.filter((key) => MODULE_PATHS[key].some((prefix) => matches(path, prefix)))
}

/** Module states from the org; anything missing counts as on. */
export function readModules(org: any): Record<ModuleKey, boolean> {
  const raw = org?.config?.config?.modules || {}
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, raw[key] !== false])) as Record<ModuleKey, boolean>
}

export function useModules() {
  const org = useOrg() as any
  const modules = useMemo(() => readModules(org), [org])
  const isModuleEnabled = (key: ModuleKey) => modules[key] !== false
  /** False when any module owning `path` is off. Pass paths without the org prefix. */
  const isPathEnabled = (path: string) => modulesForPath(path).every(isModuleEnabled)
  return { modules, isModuleEnabled, isPathEnabled }
}
