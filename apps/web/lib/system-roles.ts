/** Global system role names (current + legacy) used for RBAC UI checks. */
export const SYSTEM_ROLE_NAMES = [
  'Super Admin',
  'Academy Admin',
  'Organization Coordinator',
  'Instructor',
  'Trainee',
  // Legacy names (pre-rename DB rows)
  'Admin',
  'Maintainer',
  'User',
] as const

export function isSystemRoleName(name: string | undefined | null): boolean {
  return !!name && SYSTEM_ROLE_NAMES.includes(name as (typeof SYSTEM_ROLE_NAMES)[number])
}

export function isSystemRole(role: {
  id?: number
  role_uuid?: string
  name?: string
}): boolean {
  if (role.role_uuid?.startsWith('role_global_')) return true
  if (role.id != null && [1, 2, 3, 4].includes(role.id)) return true
  return isSystemRoleName(role.name)
}
