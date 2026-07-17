'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { signOut } from '@components/Contexts/AuthContext'
import {
  House,
  BookOpen,
  Files,
  Users,
  CurrencyCircleDollar,
  Buildings,
  Globe,
  Question,
  Gear,
  SignOut,
  SidebarSimple,
  Check,
  CaretDown,
  PencilSimple,
  ChatsCircle,
  Book,
  ChatCircleDots,
  Headphones,
  ChartBar,
  DotsThree,
  UsersThree,
  Shield,
  UserPlus,
  ClipboardText,
  Palette,
  Rocket,
  Robot,
  LinkSimple,
  Key,
  Lock,
  Wrench,
  ChartLine,
  MagnifyingGlass,
  ChalkboardSimple,
  Cube,
  ShoppingBag,
  FolderSimple,
  GraduationCap,
  Certificate,
  ChalkboardTeacher,
} from '@phosphor-icons/react'
import { DiscordIcon } from '@components/Objects/Icons/DiscordIcon'
import CommandPaletteTrigger from '@components/Dashboard/CommandPalette/CommandPaletteTrigger'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import UserAvatar from '../../Objects/UserAvatar'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg, getAPIUrl } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/lib/i18n'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip"
import {
  HoverMenu,
  HoverMenuContent,
  HoverMenuItem,
  HoverMenuLabel,
  HoverMenuSeparator,
} from "@components/ui/hover-menu"
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import { AVAILABLE_LANGUAGES } from '@/lib/languages'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { getAssignmentsFromACourse } from '@services/courses/assignments'
import { getDeploymentMode } from '@services/config/config'
import PlanBadge from '@components/Dashboard/Shared/PlanRestricted/PlanBadge'
import { usePlan } from '@components/Hooks/usePlan'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

function DashLeftMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { t, i18n } = useTranslation()
  const { track } = useOmniLearnAnalytics('dashboard')
  const pathname = usePathname() || ''
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isActivePath = (path: string) => {
    if (path === '/dash') {
      return pathname === '/dash' || pathname === '/dash/'
    }
    return pathname === path || pathname.startsWith(path + '/')
  }
  const [recentAssignments, setRecentAssignments] = useState<any[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const access_token = session?.data?.tokens?.access_token

  // Fetch recent courses
  const { data: coursesData } = useQuery({
    queryKey: [...queryKeys.courses.list(org?.slug || ''), 'recent', 8],
    queryFn: async () => {
      const url = `${getAPIUrl()}courses/org_slug/${org.slug}/page/1/limit/8`
      const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, access_token))
      if (!res.ok) throw new Error('Failed to fetch courses')
      return res.json()
    },
    enabled: !!org?.slug,
    staleTime: 60_000,
  })
  const recentCourses = coursesData?.slice(0, 8) || []

  // Lazy-load assignments only when the assignments hover menu is opened
  const [assignmentsFetched, setAssignmentsFetched] = useState(false)

  const fetchAssignments = () => {
    if (assignmentsFetched || !coursesData || !access_token) return
    setAssignmentsFetched(true)
    const coursesToFetch = coursesData.slice(0, 5)
    const promises = coursesToFetch.map((course: any) =>
      getAssignmentsFromACourse(course.course_uuid, access_token)
    )
    Promise.all(promises).then((results) => {
      const allAssignments: any[] = []
      results.forEach((res: any, index: number) => {
        if (res?.data) {
          res.data.forEach((assignment: any) => {
            allAssignments.push({
              ...assignment,
              courseName: coursesToFetch[index].name
            })
          })
        }
      })
      setRecentAssignments(allAssignments.slice(0, 8))
    }).catch(() => {})
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dash-menu-collapsed')
      if (saved !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCollapsed(saved === 'true')
      }
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('dash-menu-collapsed', String(newState))
  }


  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org.slug, '/login') })
  }


  const plan = usePlan()
  const mode = getDeploymentMode()

  if (!org || !session) return null
  const planLabel =
    mode === 'ee' ? 'Enterprise Edition' :
    mode === 'oss' ? 'OSS' :
    plan  // SaaS: show actual plan name

  // Feature visibility from API resolved_features
  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const showLibrary = isEnabled('folders')
  const showCommunities = isEnabled('communities')
  const showPodcasts = isEnabled('podcasts')
  const showBoards = isEnabled('boards')
  const showPlaygrounds = isEnabled('playgrounds')
  const showPayments = isEnabled('payments')

  return (
    <TooltipProvider delayDuration={0}>
    <nav
      aria-label="Dashboard sidebar navigation"
      className={cn(
        "flex flex-col h-screen sticky top-0 z-overlay border-r border-[hsl(var(--dash-border))]/80 bg-[hsl(var(--dash-sidebar))] text-[hsl(var(--dash-ink))] transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className={cn(
        "flex items-center h-16 border-b border-[hsl(var(--dash-border))] px-4 shrink-0",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <Link
          className={cn("flex items-center transition-opacity hover:opacity-70", isCollapsed ? "" : "space-x-3")}
          href={'/'}
        >
          {plan === 'enterprise' && org?.logo_image ? (
            <img
              src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
              alt={org?.name}
              className="h-9 w-9 object-contain rounded-lg"
            />
          ) : (
            <img
              src="/lrn-dash.svg"
              alt="OmniLearn logo"
              className="h-8 w-8"
            />
          )}
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-[hsl(var(--dash-ink))] truncate">
                {org?.name}
              </span>
              <span className={cn(
                "text-[9px] font-medium uppercase tracking-wider",
                mode === 'ee' ? "text-amber-400" :
                mode === 'oss' ? "text-green-400" :
                plan === 'enterprise' ? "text-amber-400" :
                plan === 'pro' ? "text-purple-400" :
                plan === 'standard' ? "text-blue-400" :
                "text-[hsl(var(--dash-muted))]"
              )}>
                {planLabel}
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            aria-label="Collapse sidebar"
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all"
          >
            <SidebarSimple size={18} weight="fill" />
          </button>
        )}
      </div>

      {/* Search trigger */}
      <div className="px-3 pt-3">
        <CommandPaletteTrigger isCollapsed={isCollapsed} />
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <AdminAuthorization authorizationMode="component">
          <div className="space-y-4">
            <NavSection label={t('dashboard.home.nav.overview', 'Overview')} isCollapsed={isCollapsed}>
              <MenuLink
                href="/dash"
                icon={<House size={20} weight="fill" />}
                label={t('common.home')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash')}
                onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'home' })}
              />
            </NavSection>

            <NavSection label={t('dashboard.home.nav.academic', 'Academic')} isCollapsed={isCollapsed}>
              <MenuLink
                href="/dash/postgraduate"
                icon={<GraduationCap size={20} weight="fill" />}
                label={t('academic.postgraduate_studies', 'Postgraduate Studies')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/postgraduate')}
                onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'postgraduate' })}
              />
              <MenuLink
                href="/dash/training-programs"
                icon={<Certificate size={20} weight="fill" />}
                label={t('academic.training_programs', 'Training Programs')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/training-programs')}
                onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'training_programs' })}
              />
              <MenuLink
                href="/dash/instructors"
                icon={<ChalkboardTeacher size={20} weight="fill" />}
                label={t('instructors.title', 'Instructors')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/instructors')}
                onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'instructors' })}
              />
            </NavSection>

            <NavSection label={t('dashboard.home.nav.teaching', 'Teaching')} isCollapsed={isCollapsed}>
            {/* Assignments with hover menu */}
            <div onMouseEnter={fetchAssignments}>
            <HoverMenu
              content={
                <HoverMenuContent className="w-72">
                  <HoverMenuLabel className="text-[hsl(var(--dash-muted))] font-medium">{t('common.assignments')}</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/assignments" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Files size={16} weight="fill" />
                      <span>{t('common.all_assignments')}</span>
                    </Link>
                  </HoverMenuItem>
                  {recentAssignments.length > 0 && (
                    <>
                      <HoverMenuSeparator />
                      <HoverMenuLabel className="text-[hsl(var(--dash-muted))]">{t('common.recent')}</HoverMenuLabel>
                      {recentAssignments.map((assignment: any) => (
                        <HoverMenuItem key={assignment.assignment_uuid} asChild>
                          <Link
                            href={`/dash/assignments/${assignment.assignment_uuid.replace('assignment_', '')}?subpage=editor`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                          >
                            <PencilSimple size={14} className="text-[hsl(var(--dash-muted))]" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{assignment.title}</span>
                              <span className="text-xs text-[hsl(var(--dash-muted))]/70 truncate">{assignment.courseName}</span>
                            </div>
                          </Link>
                        </HoverMenuItem>
                      ))}
                    </>
                  )}
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/assignments')
                return (
                  <Link
                    href="/dash/assignments"
                    aria-label="Open assignments menu"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "bg-[hsl(var(--dash-canvas))] font-medium text-[hsl(var(--dash-ink))]"
                        : "text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                                        <span className="relative flex items-center justify-center">
                      <Files size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -right-2.5", active ? "text-[hsl(var(--dash-muted))]" : "text-[hsl(var(--dash-muted))]/70")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{t('common.assignments')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-[hsl(var(--dash-ink))]/75" : "text-[hsl(var(--dash-muted))]"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>
            </div>
            {showLibrary && (
              <MenuLink
                href="/dash/library"
                icon={<FolderSimple size={20} weight="fill" />}
                label={t('library.library')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/library')}
              />
            )}
            {showCommunities && (
              <MenuLink
                href="/dash/communities"
                icon={<ChatsCircle size={20} weight="fill" />}
                label={t('communities.title')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/communities')}
              />
            )}
            {showPodcasts && (
              <MenuLink
                href="/dash/podcasts"
                icon={<Headphones size={20} weight="fill" />}
                label={t('podcasts.podcasts')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/podcasts')}
              />
            )}
            {showBoards && (
              <MenuLink
                href="/dash/boards"
                icon={<ChalkboardSimple size={20} weight="fill" />}
                label={t('boards.boards')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/boards')}
              />
            )}
            {showPlaygrounds && (
              <MenuLink
                href="/dash/playgrounds"
                icon={<Cube size={20} weight="fill" />}
                label={t('common.playgrounds')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/playgrounds')}
              />
            )}
            </NavSection>

            <NavSection label={t('dashboard.home.nav.manage', 'Manage')} isCollapsed={isCollapsed}>
            {/* Users with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-[hsl(var(--dash-muted))] font-medium">{t('common.users')}</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/users" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Users size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.users')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/usergroups" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <UsersThree size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.users.settings.tabs.usergroups')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/roles" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Shield size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.users.settings.tabs.roles')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/signups" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <ClipboardText size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.signups')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/add" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <UserPlus size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.add')}</span>
                    </Link>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/users')
                return (
                  <Link
                    href="/dash/users/settings/users"
                    aria-label="Open users menu"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "bg-[hsl(var(--dash-canvas))] font-medium text-[hsl(var(--dash-ink))]"
                        : "text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                                        <span className="relative flex items-center justify-center">
                      <Users size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -right-2.5", active ? "text-[hsl(var(--dash-muted))]" : "text-[hsl(var(--dash-muted))]/70")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{t('common.users')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-[hsl(var(--dash-ink))]/75" : "text-[hsl(var(--dash-muted))]"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {showPayments && (
              <MenuLink
                href="/dash/payments/overview"
                icon={<CurrencyCircleDollar size={20} weight="fill" />}
                label={t('common.payments')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/payments')}
              />
            )}

            {/* Organization with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-[hsl(var(--dash-muted))] font-medium">{t('common.organization')}</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/general" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Gear size={16} weight="fill" />
                      <span>{t('dashboard.organization.settings.tabs.general')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/branding" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Palette size={16} weight="fill" />
                      <span>{t('dashboard.organization.settings.tabs.branding')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/landing" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Rocket size={16} weight="fill" />
                      <span>{t('dashboard.organization.settings.tabs.landing')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/seo" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <MagnifyingGlass size={16} weight="fill" />
                      <span>SEO</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/ai" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Robot size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.organization.settings.tabs.ai')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/domains" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <LinkSimple size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.organization.settings.tabs.domains')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/api" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Key size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.organization.settings.tabs.api')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/sso" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Lock size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.organization.settings.tabs.sso')}<PlanBadge currentPlan={plan} requiredPlan="enterprise" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/usage" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <ChartBar size={16} weight="fill" />
                      <span>{t('dashboard.organization.settings.tabs.usage') || 'Usage'}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/org/settings/other" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <Wrench size={16} weight="fill" />
                      <span>{t('dashboard.organization.settings.tabs.other')}</span>
                    </Link>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/org')
                return (
                  <Link
                    href="/dash/org/settings/general"
                    aria-label="Open organization menu"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "bg-[hsl(var(--dash-canvas))] font-medium text-[hsl(var(--dash-ink))]"
                        : "text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                                        <span className="relative flex items-center justify-center">
                      <Buildings size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -right-2.5", active ? "text-[hsl(var(--dash-muted))]" : "text-[hsl(var(--dash-muted))]/70")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{t('common.organization')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-[hsl(var(--dash-ink))]/75" : "text-[hsl(var(--dash-muted))]"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Analytics with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-[hsl(var(--dash-muted))] font-medium">Analytics</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <ChartBar size={16} weight="fill" />
                      <span>{t('analytics.tabs.overview')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                      <ChartLine size={16} weight="fill" />
                      <span className="flex items-center">{t('analytics.tabs.advanced')}<PlanBadge currentPlan={plan} requiredPlan="enterprise" variant="light" /></span>
                    </Link>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/analytics')
                return (
                  <Link
                    href="/dash/analytics"
                    aria-label="Analytics"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "bg-[hsl(var(--dash-canvas))] font-medium text-[hsl(var(--dash-ink))]"
                        : "text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                                        <span className="relative flex items-center justify-center">
                      <ChartBar size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -right-2.5", active ? "text-[hsl(var(--dash-muted))]" : "text-[hsl(var(--dash-muted))]/70")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{t('common.analytics')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-[hsl(var(--dash-ink))]/75" : "text-[hsl(var(--dash-muted))]"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Disabled features shown in an "Other" hover menu */}
            {(!showCommunities || !showPodcasts || !showBoards || !showPlaygrounds || !showPayments) && (
              <HoverMenu
                content={
                  <HoverMenuContent className="w-64">
                    <HoverMenuLabel className="flex items-center justify-between text-[hsl(var(--dash-muted))] font-medium">
                      <span>{t('common.other')}</span>
                      <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-muted))]/60">
                        {t('common.disabled')}
                      </span>
                    </HoverMenuLabel>
                    <HoverMenuSeparator />
                    {!showCommunities && (
                      <HoverMenuItem asChild>
                        <Link href="/dash/communities" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                          <ChatsCircle size={16} weight="fill" />
                          <span>{t('communities.title')}</span>
                        </Link>
                      </HoverMenuItem>
                    )}
                    {!showPodcasts && (
                      <HoverMenuItem asChild>
                        <Link href="/dash/podcasts" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                          <Headphones size={16} weight="fill" />
                          <span>{t('podcasts.podcasts')}</span>
                        </Link>
                      </HoverMenuItem>
                    )}
                    {!showBoards && (
                      <HoverMenuItem asChild>
                        <Link href="/dash/boards" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                          <ChalkboardSimple size={16} weight="fill" />
                          <span>{t('common.boards')}</span>
                        </Link>
                      </HoverMenuItem>
                    )}
                    {!showPlaygrounds && (
                      <HoverMenuItem asChild>
                        <Link href="/dash/playgrounds" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                          <Cube size={16} weight="fill" />
                          <span>{t('common.playgrounds')}</span>
                        </Link>
                      </HoverMenuItem>
                    )}
                    {!showPayments && (
                      <HoverMenuItem asChild>
                        <Link href="/dash/payments/overview" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                          <CurrencyCircleDollar size={16} weight="fill" />
                          <span>{t('common.payments')}</span>
                        </Link>
                      </HoverMenuItem>
                    )}
                  </HoverMenuContent>
                }
              >
                <button
                  aria-label="Other"
                  className={cn(
                    "flex items-center w-full rounded-lg text-[hsl(var(--dash-muted))]/70 hover:text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all",
                    isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <DotsThree size={20} weight="bold" />
                    {isCollapsed && (
                      <CaretDown aria-hidden="true" size={8} weight="bold" className="absolute -right-2.5 text-[hsl(var(--dash-muted))]/50" />
                    )}
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{t('common.other')}</span>
                      <CaretDown aria-hidden="true" size={14} weight="bold" className="text-[hsl(var(--dash-muted))]/50" />
                    </>
                  )}
                </button>
              </HoverMenu>
            )}
            </NavSection>
          </div>
        </AdminAuthorization>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-[hsl(var(--dash-border))] py-3 px-3 shrink-0">
        <div className="space-y-1">
          {/* Expand button when collapsed */}
          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label="Expand sidebar"
                  onClick={toggleCollapse}
                  className="flex items-center justify-center w-full h-10 rounded-lg text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all"
                >
                  <SidebarSimple size={20} weight="fill" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="z-tooltip border-transparent bg-[hsl(var(--dash-ink))] px-2 py-1 text-xs text-white shadow-lg">
                {t('common.expand')}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Language Switcher with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-64 max-h-96 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <HoverMenuLabel className="flex items-center gap-2 text-[hsl(var(--dash-muted))] font-medium">
                  <Globe size={16} weight="fill" />
                  <span>{t('common.language')}</span>
                </HoverMenuLabel>
                <HoverMenuSeparator />
                {AVAILABLE_LANGUAGES.map((language) => (
                  <HoverMenuItem
                    key={language.code}
                    onClick={() => changeLanguage(language.code)}
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{language.nativeName}</span>
                      <span className="text-xs text-[hsl(var(--dash-muted))]">{t(language.translationKey)}</span>
                    </div>
                    {i18n.language.split('-')[0] === language.code && (
                      <Check size={16} weight="bold" className="text-green-500" />
                    )}
                  </HoverMenuItem>
                ))}
              </HoverMenuContent>
            }
          >
            <button aria-label="Open language menu" className={cn(
              "flex items-center w-full rounded-lg text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <Globe size={20} weight="fill" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{t('common.language')}</span>
              )}
            </button>
          </HoverMenu>

          {/* Help with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-56">
                <HoverMenuLabel className="flex items-center gap-2 text-[hsl(var(--dash-muted))] font-medium">
                  <Question size={16} weight="fill" />
                  <span>{t('common.help')}</span>
                </HoverMenuLabel>
                <HoverMenuSeparator />
                <HoverMenuItem asChild>
                  <a
                    href="https://docs.omnilearn.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                  >
                    <Book size={16} weight="fill" />
                    <span>{t('common.help_menu.documentation')}</span>
                  </a>
                </HoverMenuItem>
                <HoverMenuItem asChild>
                  <a
                    href="https://omnilearn.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                  >
                    <Globe size={16} weight="fill" />
                    <span>{t('common.help_menu.website')}</span>
                  </a>
                </HoverMenuItem>
                <HoverMenuItem asChild>
                  <a
                    href="https://discord.gg/omnilearn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                  >
                    <DiscordIcon size={16} />
                    <span>{t('common.help_menu.discord')}</span>
                  </a>
                </HoverMenuItem>
                <HoverMenuSeparator />
                <HoverMenuItem
                  onClick={() => setFeedbackModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                >
                  <ChatCircleDots size={16} weight="fill" />
                  <span>{t('common.help_menu.report_feedback')}</span>
                </HoverMenuItem>
              </HoverMenuContent>
            }
          >
            <button aria-label="Open help menu" className={cn(
              "flex items-center w-full rounded-lg text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <Question size={20} weight="fill" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{t('common.help')}</span>
              )}
            </button>
          </HoverMenu>

          {/* User Menu with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{session?.data?.user?.username}</p>
                  <p className="text-xs text-[hsl(var(--dash-muted))]">{session?.data?.user?.email}</p>
                </div>
                <HoverMenuSeparator />
                <HoverMenuItem asChild>
                  <Link href="/account/general" className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                    <Gear size={16} weight="fill" />
                    <span>{t('common.settings')}</span>
                  </Link>
                </HoverMenuItem>
                <HoverMenuItem asChild>
                  <Link href={getUriWithOrg(org?.slug, '/account/purchases')} className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors">
                    <ShoppingBag size={16} weight="fill" />
                    <span>{t('account.purchases')}</span>
                  </Link>
                </HoverMenuItem>
                <HoverMenuSeparator />
                <HoverMenuItem
                  onClick={() => logOutUI()}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-[hsl(var(--dash-accent-soft))] cursor-pointer transition-colors"
                >
                  <SignOut size={16} weight="fill" />
                  <span>{t('user.sign_out')}</span>
                </HoverMenuItem>
              </HoverMenuContent>
            }
          >
            <button className={cn(
              "flex items-center w-full rounded-lg text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))] transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <UserAvatar width={24} rounded="rounded-full" shadow="shadow-none" />
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="text-sm font-medium truncate text-[hsl(var(--dash-ink))]">{session?.data?.user?.username}</span>
                  <span className="text-xs text-[hsl(var(--dash-muted))] truncate">{session?.data?.user?.email}</span>
                </div>
              )}
            </button>
          </HoverMenu>
        </div>
      </div>
    </nav>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        theme="light"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />
    </TooltipProvider>
  )
}

const MenuLink = ({ href, icon, label, isCollapsed, isExternal, active, onClick }: {
  href: string
  icon: React.ReactNode
  label: string
  isCollapsed: boolean
  isExternal?: boolean
  active?: boolean
  onClick?: () => void
}) => {
  const content = (
    <div
      className={cn(
        "relative flex w-full items-center rounded-xl transition-all",
        active
          ? "bg-[hsl(var(--dash-canvas))] font-medium text-[hsl(var(--dash-ink))]"
          : "text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]",
        isCollapsed ? "h-10 justify-center" : "gap-3 px-3 py-2.5"
      )}
    >
      {icon}
      {!isCollapsed && (
        <span className="text-sm">{label}</span>
      )}
    </div>
  )

  const ariaCurrent = active ? 'page' : undefined
  const linkElement = isExternal ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link aria-label={label} aria-current={ariaCurrent} href={href} onClick={onClick}>
      {content}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {linkElement}
        </TooltipTrigger>
        <TooltipContent side="right" className="z-tooltip border-transparent bg-[hsl(var(--dash-ink))] px-2 py-1 text-xs text-white shadow-lg">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkElement
}

function NavSection({
  label,
  isCollapsed,
  children,
}: {
  label: string
  isCollapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      {!isCollapsed && (
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]/80">
          {label}
        </p>
      )}
      {isCollapsed && (
        <div className="mx-auto my-1 h-px w-6 bg-[hsl(var(--dash-border))]" aria-hidden="true" />
      )}
      {children}
    </div>
  )
}

export default DashLeftMenu
