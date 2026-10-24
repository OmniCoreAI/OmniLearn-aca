'use client'
import React, { useMemo } from 'react'

import Link from 'next/link'
import { Crown, Shield, User, Users, SignOut, CaretDown, Globe, Check, ShoppingBag, SquaresFour, UserCircle } from '@phosphor-icons/react'
import UserAvatar from '@components/Objects/UserAvatar'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import Tooltip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@components/ui/dropdown-menu"
import { signOut } from '@components/Contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/lib/i18n'
import { AVAILABLE_LANGUAGES } from '@/lib/languages'
import LanguageSwitcher from '@components/Utils/LanguageSwitcher'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'
import { isSystemRoleName } from '@/lib/system-roles'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'

interface RoleInfo {
  name: string;
  icon: React.ReactNode;
  /** Tinted pill used on light headers. */
  tone: string;
  description: string;
  showBadge?: boolean;
}

const ROLE_TONES = {
  superAdmin: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  admin: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  maintainer: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  instructor: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  user: 'bg-gray-100 text-gray-700 ring-gray-200',
}

/** Small role pill: readable, tinted on light headers and translucent on coloured ones. */
function RolePill({ icon, label, tone, onDark }: { icon: React.ReactNode; label: string; tone: string; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-[150px] items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-semibold leading-4 ring-1 ring-inset ${
        onDark ? 'bg-white/15 text-white ring-white/25' : tone
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

interface CustomRoleInfo {
  name: string;
  description?: string;
}

export const HeaderProfileBox = ({ primaryColor = '' }: { primaryColor?: string }) => {
  const session = useLHSession() as any
  const { userRoles, rights } = useAdminStatus()
  const org = useOrg() as any
  const { t, i18n } = useTranslation()
  const { track } = useOmniLearnAnalytics()
  const colors = getMenuColorClasses(primaryColor)


  const userRoleInfo = useMemo((): RoleInfo | null => {
    if (session.data?.user?.is_superadmin === true) {
      return {
        name: t('roles.role_super_admin'),
        icon: <Crown size={11} weight="fill" />,
        tone: ROLE_TONES.superAdmin,
        description: t('roles.role_super_admin_desc'),
        showBadge: true,
      }
    }

    if (!userRoles || userRoles.length === 0) return null;

    // Find the highest priority role for the current organization
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);

    if (orgRoles.length === 0) return null;

    // Sort by role priority (admin > maintainer > instructor > user)
    const sortedRoles = [...orgRoles].sort((a: any, b: any) => {
      const getRolePriority = (role: any) => {
        if (role.role.role_uuid === 'role_global_admin' || role.role.id === 1) return 4;
        if (role.role.role_uuid === 'role_global_maintainer' || role.role.id === 2) return 3;
        if (role.role.role_uuid === 'role_global_instructor' || role.role.id === 3) return 2;
        return 1;
      };
      return getRolePriority(b) - getRolePriority(a);
    });

    const highestRole = sortedRoles[0];

    // Define role configurations based on actual database roles
    const roleConfigs: { [key: string]: RoleInfo } = {
      'role_global_admin': {
        name: t('roles.role_admin'),
        icon: <Crown size={11} weight="fill" />,
        tone: ROLE_TONES.admin,
        description: t('roles.role_admin_desc'),
        showBadge: true,
      },
      'role_global_maintainer': {
        name: t('roles.role_maintainer'),
        icon: <Shield size={11} weight="fill" />,
        tone: ROLE_TONES.maintainer,
        description: t('roles.role_maintainer_desc'),
        showBadge: true,
      },
      'role_global_instructor': {
        name: t('roles.role_instructor'),
        icon: <Users size={11} weight="fill" />,
        tone: ROLE_TONES.instructor,
        description: t('roles.role_instructor_desc'),
        showBadge: true,
      },
      'role_global_user': {
        name: t('roles.role_user'),
        icon: <User size={11} weight="fill" />,
        tone: ROLE_TONES.user,
        description: t('roles.role_user_desc'),
        showBadge: false,
      }
    };

    // Determine role based on role_uuid or id
    let roleKey = 'role_global_user'; // default
    if (highestRole.role.role_uuid) {
      roleKey = highestRole.role.role_uuid;
    } else if (highestRole.role.id === 1) {
      roleKey = 'role_global_admin';
    } else if (highestRole.role.id === 2) {
      roleKey = 'role_global_maintainer';
    } else if (highestRole.role.id === 3) {
      roleKey = 'role_global_instructor';
    }

    return roleConfigs[roleKey] || roleConfigs['role_global_user'];
    // t and superadmin flag are real dependencies: labels must recompute on language change
  }, [userRoles, org?.id, t, session.data?.user?.is_superadmin]);

  const customRoles = useMemo((): CustomRoleInfo[] => {
    if (!userRoles || userRoles.length === 0) return [];

    // Find roles for the current organization
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);
    
    if (orgRoles.length === 0) return [];

    // Filter for custom roles (not system roles)
    const customRoles = orgRoles.filter((role: any) => {
      const isSystemRole =
        role.role.role_uuid?.startsWith('role_global_') ||
        [1, 2, 3, 4].includes(role.role.id) ||
        isSystemRoleName(role.role.name);

      return !isSystemRole;
    });

    return customRoles.map((role: any) => ({
      name: role.role.name || t('roles.custom_role'),
      description: role.role.description
    }));
    // t is a real dependency: the fallback label must recompute on language change
  }, [userRoles, org?.id, t]);

  const user = session.data?.user
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || ''
  const onDark = colors.profileName === 'text-white'
  const customRoleInfos: RoleInfo[] = customRoles.map((role) => ({
    name: role.name,
    icon: <Shield size={11} weight="fill" />,
    tone: ROLE_TONES.user,
    description: role.description || `${t('roles.custom_role')}: ${role.name}`,
  }))
  const systemRole = userRoleInfo && userRoleInfo.showBadge !== false ? userRoleInfo : null
  const allRoles = [...(systemRole ? [systemRole] : []), ...customRoleInfos]
  const primaryRole = allRoles[0] || null
  const extraRoles = allRoles.length - 1
  const currentLanguage = AVAILABLE_LANGUAGES.find((l) => l.code === i18n.language.split('-')[0])
  const menuItemCls = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm'

  return (
    <div className="flex items-center">
      {session.status == 'unauthenticated' && (
        <div className="flex items-stretch grow items-center">
          <ul className="flex space-x-0.5 sm:space-x-1 items-center">
            <li>
              <LanguageSwitcher primaryColor={primaryColor} />
            </li>
            <li>
              <Link
                className={`px-3 py-2 rounded-lg transition-colors text-sm font-bold ${colors.hoverBg} ${colors.text}`}
                href={getUriWithOrg(org?.slug, '/login')} >{t('auth.login')}</Link>
            </li>
            <li className={`rounded-lg shadow-sm transition-colors px-4 py-2 text-xs sm:text-sm font-bold ml-1 sm:ml-2 ${colors.signUpBtn}`}>
              <Link href={getUriWithOrg(org?.slug, '/signup')}>{t('auth.sign_up')}</Link>
            </li>
          </ul>
        </div>
      )}
      {session.status == 'authenticated' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`group flex cursor-pointer items-center gap-2.5 rounded-full py-1 pe-2.5 ps-1 transition-colors ${colors.profileHover} data-[state=open]:bg-black/[0.04]`}
              aria-label={t('user.account_menu', 'Account menu')}
            >
              <span className="relative shrink-0">
                <UserAvatar border="border-2" rounded="rounded-full" width={34} shadow={primaryColor ? '' : undefined} />
                <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-start">
                <span className={`max-w-[160px] truncate text-[13px] font-semibold capitalize leading-4 ${colors.profileName}`}>{displayName}</span>
                {primaryRole ? (
                  <Tooltip content={primaryRole.description} sideOffset={12} side="bottom">
                    <span className="flex items-center gap-1">
                      <RolePill icon={primaryRole.icon} label={primaryRole.name} tone={primaryRole.tone} onDark={onDark} />
                      {extraRoles > 0 ? (
                        <span className={`text-[10px] font-semibold ${colors.profileMuted}`}>+{extraRoles}</span>
                      ) : null}
                    </span>
                  </Tooltip>
                ) : (
                  <span className={`max-w-[160px] truncate text-[11px] leading-4 ${colors.profileMuted}`}>{session.data.user.email}</span>
                )}
              </span>
              <CaretDown
                aria-hidden="true"
                size={12}
                weight="bold"
                className={`${colors.profileMuted} transition-transform group-data-[state=open]:rotate-180`}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 rounded-2xl p-1.5" align="end" sideOffset={8}>
            <DropdownMenuLabel className="p-0">
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <UserAvatar border="border-2" rounded="rounded-full" width={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold capitalize text-gray-900">{displayName}</p>
                  <p className="truncate text-xs font-normal text-gray-500">{session.data.user.email}</p>
                  {allRoles.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {allRoles.map((role) => (
                        <RolePill key={role.name} icon={role.icon} label={role.name} tone={role.tone} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <div className="py-1">
              {rights?.dashboard?.action_access && (
                <DropdownMenuItem asChild className={menuItemCls}>
                  <Link href="/dash">
                    <SquaresFour size={16} weight="duotone" />
                    <span>{t('common.dashboard')}</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className={menuItemCls}>
                <Link href="/account/general">
                  <UserCircle size={16} weight="duotone" />
                  <span>{t('user.user_settings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={menuItemCls}>
                <Link href={getUriWithOrg(org?.slug, '/account/purchases')}>
                  <ShoppingBag size={16} weight="duotone" />
                  <span>{t('account.purchases')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={menuItemCls}>
                  <Globe size={16} weight="duotone" />
                  <span className="flex-1">{t('common.language')}</span>
                  <span className="text-xs text-gray-400">{currentLanguage?.nativeName}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-xl p-1">
                    {AVAILABLE_LANGUAGES.map((language) => (
                      <DropdownMenuItem
                        key={language.code}
                        onClick={() => changeLanguage(language.code)}
                        className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2"
                      >
                        <span>{t(language.translationKey)} ({language.nativeName})</span>
                        {i18n.language.split('-')[0] === language.code && <Check size={14} weight="bold" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </div>
            <DropdownMenuSeparator className="mx-1" />
            <DropdownMenuItem
              onClick={() => {
                track(AnalyticsEvent.LogoutClicked, { source: 'header_profile' })
                signOut({ callbackUrl: '/' })
              }}
              className={`${menuItemCls} text-red-600 focus:bg-red-50 focus:text-red-600`}
            >
              <SignOut size={16} weight="duotone" />
              <span>{t('user.sign_out', 'Sign out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
