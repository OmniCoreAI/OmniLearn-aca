import { getAPIUrl } from '@services/config/config'

/**
 * Where a user should land right after signing in: staff (any role with
 * dashboard access in this org, or a superadmin) go to their dashboard,
 * learners to the learner home.
 */
export async function getLandingPath(orgId?: number): Promise<string> {
  try {
    const response = await fetch(`${getAPIUrl()}users/session`, { credentials: 'include' })
    if (!response.ok) return '/'
    const data = await response.json()
    if (data?.user?.is_superadmin) return '/dash'
    const roles: any[] = data?.roles || []
    const hasDashboard = roles.some(
      (r) => (orgId == null || r?.org?.id === orgId) && r?.role?.rights?.dashboard?.action_access === true
    )
    return hasDashboard ? '/dash' : '/'
  } catch {
    return '/'
  }
}

/** Only same-site absolute paths are allowed as a post-login destination. */
export function isSafeLandingPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}
