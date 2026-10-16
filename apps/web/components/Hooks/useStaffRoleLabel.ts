'use client'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useWorkspaceRole from '@components/Hooks/useWorkspaceRole'

/**
 * The staff role shown under a person's name in the top bar ("Super admin",
 * "Instructor", ...). Only meaningful for staff: learners keep "Student".
 */
export default function useStaffRoleLabel(): string {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const role = useWorkspaceRole()
  const isSuperadmin = session?.data?.user?.is_superadmin === true

  if (isSuperadmin) return t('student_portal.role_superadmin', 'Super admin')
  if (role === 'instructor') return t('roles_page.role_instructor', 'Instructor')
  if (role === 'coordinator') return t('roles_page.role_coordinator', 'Entity coordinator')
  return t('roles_page.role_admin', 'Academy admin')
}
