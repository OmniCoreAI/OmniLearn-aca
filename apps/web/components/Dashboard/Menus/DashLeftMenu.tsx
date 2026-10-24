'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { signOut } from '@components/Contexts/AuthContext'
import {
  House,
  Chalkboard,
  Files,
  Users,
  UsersThree,
  CurrencyCircleDollar,
  Buildings,
  Globe,
  Question,
  Gear,
  SignOut,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  Plus,
  PencilSimple,
  Book,
  ChatCircleDots,
  ChartBar,
  DotsThree,
  Shield,
  UserPlus,
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
  Certificate,
  Newspaper,
  CalendarBlank,
  CalendarDots,
  IdentificationCard,
} from '@phosphor-icons/react'
import { DiscordIcon } from '@components/Objects/Icons/DiscordIcon'
import CommandPaletteTrigger from '@components/Dashboard/CommandPalette/CommandPaletteTrigger'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LayoutGroup, MotionConfig, motion } from 'motion/react'
import UserAvatar from '../../Objects/UserAvatar'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
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
import { cn } from '@/lib/utils'
import OrgLogo from '@components/Dashboard/Shared/OrgLogo'
import { getAssignmentsFromACourse } from '@services/courses/assignments'
import { getOrgCourses } from '@services/courses/courses'
import { getUpgradeUrl } from '@services/config/config'
import PlanBadge from '@components/Dashboard/Shared/PlanRestricted/PlanBadge'
import { usePlan } from '@components/Hooks/usePlan'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'
import { ADMIN_NAV_LINKS, isAdminLinkActive } from '@components/Dashboard/Menus/adminNavItems'
import { POSTGRAD_BASE, POSTGRAD_NAV_GROUPS, pickCurrentTerm, termProgress } from '@components/Dashboard/Menus/postgradNavItems'
import { useQuery } from '@tanstack/react-query'
import { getApplications, getTerms } from '@services/academic/core'

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

  // Lazy-load courses + assignments only when the assignments hover menu is opened.
  // Nothing is fetched on mount — keeps the sidebar off the critical path.
  const [assignmentsFetched, setAssignmentsFetched] = useState(false)

  const fetchAssignments = () => {
    if (assignmentsFetched || !org?.slug || !access_token) return
    setAssignmentsFetched(true)
    getOrgCourses(org.slug, null, access_token)
      .then((courses: any[]) => {
        const coursesToFetch = (courses ?? []).slice(0, 5)
        return Promise.all(
          coursesToFetch.map((course: any) =>
            getAssignmentsFromACourse(course.course_uuid, access_token).then((res: any) =>
              (res?.data ?? []).map((assignment: any) => ({
                ...assignment,
                courseName: course.name,
              }))
            )
          )
        )
      })
      .then((results) => {
        setRecentAssignments(results.flat().slice(0, 8))
      })
      .catch(() => {})
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
  // Hooks must run on every render — keep this above the early return.
  const { isItemVisible } = usePortalNavVisibility()
  const postgrad = usePostgradSignals(org?.id, access_token, isItemVisible('postgraduate') && !isCollapsed)
  // Keep the current page in view inside the scrolling link list (e.g. a deep link into a long section).
  // Clicked links are already on screen, so this only moves the list on a fresh load.
  const navScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reveal = () => {
      const list = navScrollRef.current
      const current = list?.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!list || !current) return
      const box = list.getBoundingClientRect()
      const item = current.getBoundingClientRect()
      if (item.top >= box.top && item.bottom <= box.bottom) return
      list.scrollTo({ top: list.scrollTop + item.top - box.top - (box.height - item.height) / 2 })
    }
    // Once after the entrance animations, and again once section heights settle (collapsing unfolds sections).
    const timers = [setTimeout(reveal, 450), setTimeout(reveal, 1000)]
    return () => timers.forEach(clearTimeout)
  }, [pathname, isCollapsed])

  if (!org || !session) return null
  // Feature visibility from API resolved_features
  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const showHome = isItemVisible('home')
  const showCalendar = isItemVisible('calendar')
  const showMyEntity = isItemVisible('my-entity')
  const showPostgraduate = isItemVisible('postgraduate')
  const showTrainingPrograms = isItemVisible('training-programs')
  const showFinance = isItemVisible('finance')
  const showCmsNews = isItemVisible('cms-news')
  const showMyTeaching = isItemVisible('postgraduate-teaching')
  const showAssignments = isItemVisible('assignments')
  const showLibrary = isEnabled('folders') && isItemVisible('library')
  const showBoards = isEnabled('boards') && isItemVisible('boards')
  const showPlaygrounds = isEnabled('playgrounds') && isItemVisible('playgrounds')
  const showUsers = isItemVisible('users')
  const showPayments = isEnabled('payments') && isItemVisible('payments')
  const showOrganization = isItemVisible('organization')
  const showAnalytics = isItemVisible('analytics')

  const showAcademicSection = showTrainingPrograms || showFinance || showCmsNews
  const adminLinks = ADMIN_NAV_LINKS.filter((link) => isItemVisible(link.navId))
  const showTeachingSection = showMyTeaching || showAssignments || showLibrary || showBoards || showPlaygrounds
  // "My Teaching" lives under /dash/postgraduate but is its own sidebar entry.
  const inMyTeaching = isActivePath('/dash/postgraduate/teaching')
  const showManageSection = showUsers || showPayments || showOrganization || showAnalytics
  // Feature-disabled-but-otherwise-visible items shown in the "Other" menu —
  // still requires role visibility for that item.
  const showOtherBoards = !isEnabled('boards') && isItemVisible('boards')
  const showOtherPlaygrounds = !isEnabled('playgrounds') && isItemVisible('playgrounds')
  const showOtherPayments = !isEnabled('payments') && isItemVisible('payments')

  const user = session?.data?.user
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || ''
  const hour = new Date().getHours()
  const greeting =
    hour < 5 || hour >= 18
      ? t('dashboard.sidebar.greeting_evening', 'Good evening')
      : hour < 12
        ? t('dashboard.sidebar.greeting_morning', 'Good morning')
        : t('dashboard.sidebar.greeting_afternoon', 'Good afternoon')
  const count = (...flags: boolean[]) => flags.filter(Boolean).length
  const icon = (Icon: React.ElementType, active: boolean) => <Icon size={18} weight={active ? 'fill' : 'duotone'} />

  const usersMenu = (
    <HoverMenuContent className="w-64">
      <HoverMenuLabel className="font-medium text-[hsl(var(--dash-muted))]">{t('common.users')}</HoverMenuLabel>
      <HoverMenuSeparator />
      <HoverMenuItem asChild>
        <Link href="/dash/users/settings/users" className={menuLinkCls}>
          <Users size={16} weight="fill" />
          <span>{t('dashboard.users.settings.tabs.users')}</span>
        </Link>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <Link href="/dash/users/settings/usergroups" className={menuLinkCls}>
          <UsersThree size={16} weight="fill" />
          <span className="flex items-center">{t('dashboard.users.settings.tabs.usergroups')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="light" /></span>
        </Link>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <Link href="/dash/users/settings/roles" className={menuLinkCls}>
          <Shield size={16} weight="fill" />
          <span className="flex items-center">{t('dashboard.users.settings.tabs.roles')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="light" /></span>
        </Link>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <Link href="/dash/users/settings/add" className={menuLinkCls}>
          <UserPlus size={16} weight="fill" />
          <span>{t('dashboard.users.settings.tabs.add')}</span>
        </Link>
      </HoverMenuItem>
    </HoverMenuContent>
  )

  const orgSettingsLinks: { href: string; Icon: React.ElementType; label: string; plan?: string }[] = [
    { href: '/dash/org/settings/general', Icon: Gear, label: t('dashboard.organization.settings.tabs.general') },
    { href: '/dash/org/settings/branding', Icon: Palette, label: t('dashboard.organization.settings.tabs.branding') },
    { href: '/dash/org/settings/landing', Icon: Rocket, label: t('dashboard.organization.settings.tabs.landing') },
    { href: '/dash/org/settings/seo', Icon: MagnifyingGlass, label: 'SEO' },
    { href: '/dash/org/settings/ai', Icon: Robot, label: t('dashboard.organization.settings.tabs.ai'), plan: 'standard' },
    { href: '/dash/org/settings/domains', Icon: LinkSimple, label: t('dashboard.organization.settings.tabs.domains'), plan: 'standard' },
    { href: '/dash/org/settings/api', Icon: Key, label: t('dashboard.organization.settings.tabs.api'), plan: 'pro' },
    { href: '/dash/org/settings/sso', Icon: Lock, label: t('dashboard.organization.settings.tabs.sso'), plan: 'enterprise' },
    { href: '/dash/org/settings/usage', Icon: ChartBar, label: t('dashboard.organization.settings.tabs.usage') || 'Usage' },
    { href: '/dash/org/settings/other', Icon: Wrench, label: t('dashboard.organization.settings.tabs.other') },
  ]
  const orgMenu = (
    <HoverMenuContent className="w-64">
      <HoverMenuLabel className="font-medium text-[hsl(var(--dash-muted))]">{t('common.academy_settings', 'Academy settings')}</HoverMenuLabel>
      <HoverMenuSeparator />
      {orgSettingsLinks.map(({ href, Icon, label, plan: required }) => (
        <HoverMenuItem key={href} asChild>
          <Link href={href} className={menuLinkCls}>
            <Icon size={16} weight="fill" />
            <span className="flex items-center">
              {label}
              {required ? <PlanBadge currentPlan={plan} requiredPlan={required as any} variant="light" /> : null}
            </span>
          </Link>
        </HoverMenuItem>
      ))}
    </HoverMenuContent>
  )

  const analyticsMenu = (
    <HoverMenuContent className="w-64">
      <HoverMenuLabel className="font-medium text-[hsl(var(--dash-muted))]">{t('common.analytics')}</HoverMenuLabel>
      <HoverMenuSeparator />
      <HoverMenuItem asChild>
        <Link href="/dash/analytics" className={menuLinkCls}>
          <ChartBar size={16} weight="fill" />
          <span>{t('analytics.tabs.overview')}</span>
        </Link>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <Link href="/dash/analytics" className={menuLinkCls}>
          <ChartLine size={16} weight="fill" />
          <span className="flex items-center">{t('analytics.tabs.advanced')}<PlanBadge currentPlan={plan} requiredPlan="enterprise" variant="light" /></span>
        </Link>
      </HoverMenuItem>
    </HoverMenuContent>
  )

  const assignmentsMenu = (
    <HoverMenuContent className="w-72">
      <HoverMenuLabel className="font-medium text-[hsl(var(--dash-muted))]">{t('common.assignments')}</HoverMenuLabel>
      <HoverMenuSeparator />
      <HoverMenuItem asChild>
        <Link href="/dash/assignments" className={menuLinkCls}>
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
              <Link href={`/dash/assignments/${assignment.assignment_uuid.replace('assignment_', '')}?subpage=editor`} className={menuLinkCls}>
                <PencilSimple size={14} className="text-[hsl(var(--dash-muted))]" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{assignment.title}</span>
                  <span className="truncate text-xs text-[hsl(var(--dash-muted))]/70">{assignment.courseName}</span>
                </div>
              </Link>
            </HoverMenuItem>
          ))}
        </>
      )}
    </HoverMenuContent>
  )

  const otherMenu = (
    <HoverMenuContent className="w-64">
      <HoverMenuLabel className="flex items-center justify-between font-medium text-[hsl(var(--dash-muted))]">
        <span>{t('common.other')}</span>
        <span className="rounded bg-[hsl(var(--dash-accent-soft))] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--dash-muted))]/60">{t('common.disabled')}</span>
      </HoverMenuLabel>
      <HoverMenuSeparator />
      {showOtherBoards && (
        <HoverMenuItem asChild>
          <Link href="/dash/boards" className={cn(menuLinkCls, 'text-[hsl(var(--dash-muted))]/70')}>
            <ChalkboardSimple size={16} weight="fill" />
            <span>{t('common.boards')}</span>
          </Link>
        </HoverMenuItem>
      )}
      {showOtherPlaygrounds && (
        <HoverMenuItem asChild>
          <Link href="/dash/playgrounds" className={cn(menuLinkCls, 'text-[hsl(var(--dash-muted))]/70')}>
            <Cube size={16} weight="fill" />
            <span>{t('common.playgrounds')}</span>
          </Link>
        </HoverMenuItem>
      )}
      {showOtherPayments && (
        <HoverMenuItem asChild>
          <Link href="/dash/payments/overview" className={cn(menuLinkCls, 'text-[hsl(var(--dash-muted))]/70')}>
            <CurrencyCircleDollar size={16} weight="fill" />
            <span>{t('common.payments')}</span>
          </Link>
        </HoverMenuItem>
      )}
    </HoverMenuContent>
  )

  const accountMenu = (
    <HoverMenuContent className="w-60">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-[hsl(var(--dash-ink))]">{displayName}</p>
        <p className="truncate text-xs text-[hsl(var(--dash-muted))]">{user?.email}</p>
      </div>
      <HoverMenuSeparator />
      <HoverMenuItem asChild>
        <Link href="/account/general" className={menuLinkCls}>
          <Gear size={16} weight="fill" />
          <span>{t('common.settings')}</span>
        </Link>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <Link href={getUriWithOrg(org?.slug, '/account/purchases')} className={menuLinkCls}>
          <ShoppingBag size={16} weight="fill" />
          <span>{t('account.purchases')}</span>
        </Link>
      </HoverMenuItem>
      <HoverMenuSeparator />
      <HoverMenuItem onClick={() => logOutUI()} className={cn(menuLinkCls, 'text-red-600 hover:bg-red-50 hover:text-red-600')}>
        <SignOut size={16} weight="fill" />
        <span>{t('user.sign_out')}</span>
      </HoverMenuItem>
    </HoverMenuContent>
  )

  const languageMenu = (
    <HoverMenuContent className="max-h-96 w-64 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <HoverMenuLabel className="flex items-center gap-2 font-medium text-[hsl(var(--dash-muted))]">
        <Globe size={16} weight="fill" />
        <span>{t('common.language')}</span>
      </HoverMenuLabel>
      <HoverMenuSeparator />
      {AVAILABLE_LANGUAGES.map((language) => (
        <HoverMenuItem
          key={language.code}
          onClick={() => changeLanguage(language.code)}
          className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-[hsl(var(--dash-ink))]/75 transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">{language.nativeName}</span>
            <span className="text-xs text-[hsl(var(--dash-muted))]">{t(language.translationKey)}</span>
          </div>
          {i18n.language.split('-')[0] === language.code && <Check size={16} weight="bold" className="text-green-500" />}
        </HoverMenuItem>
      ))}
    </HoverMenuContent>
  )

  const helpMenu = (
    <HoverMenuContent className="w-56">
      <HoverMenuLabel className="flex items-center gap-2 font-medium text-[hsl(var(--dash-muted))]">
        <Question size={16} weight="fill" />
        <span>{t('common.help')}</span>
      </HoverMenuLabel>
      <HoverMenuSeparator />
      <HoverMenuItem asChild>
        <a href="https://docs.omnilearn.app" target="_blank" rel="noopener noreferrer" className={menuLinkCls}>
          <Book size={16} weight="fill" />
          <span>{t('common.help_menu.documentation')}</span>
        </a>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <a href="https://omnilearn.app" target="_blank" rel="noopener noreferrer" className={menuLinkCls}>
          <Globe size={16} weight="fill" />
          <span>{t('common.help_menu.website')}</span>
        </a>
      </HoverMenuItem>
      <HoverMenuItem asChild>
        <a href="https://discord.gg/omnilearn" target="_blank" rel="noopener noreferrer" className={menuLinkCls}>
          <DiscordIcon size={16} />
          <span>{t('common.help_menu.discord')}</span>
        </a>
      </HoverMenuItem>
      <HoverMenuSeparator />
      <HoverMenuItem onClick={() => setFeedbackModalOpen(true)} className={menuLinkCls}>
        <ChatCircleDots size={16} weight="fill" />
        <span>{t('common.help_menu.report_feedback')}</span>
      </HoverMenuItem>
    </HoverMenuContent>
  )

  const settingsCount = 4
  const deskActive = isActivePath('/dash') || isActivePath('/dash/calendar') || isActivePath('/dash/my-entity')
  const academicActive = isActivePath('/dash/training-programs') || isActivePath('/dash/finance') || isActivePath('/dash/cms/news')
  const postgradActive = isActivePath(POSTGRAD_BASE) && !inMyTeaching
  const classroomActive =
    inMyTeaching || isActivePath('/dash/assignments') || isActivePath('/dash/library') || isActivePath('/dash/boards') || isActivePath('/dash/playgrounds')
  const manageActive = isActivePath('/dash/users') || isActivePath('/dash/payments') || isActivePath('/dash/org') || isActivePath('/dash/analytics')
  const adminActive = adminLinks.some((link) => isAdminLinkActive(link, pathname))

  return (
    <MotionConfig reducedMotion="user">
    <LayoutGroup id="dash-sidebar">
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="Dashboard sidebar navigation"
        className={cn(
          'sticky top-0 z-overlay h-screen shrink-0 self-start p-3 text-[hsl(var(--dash-ink))] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isCollapsed ? 'w-[92px]' : 'w-[288px]'
        )}
      >
        <div className="relative flex h-full flex-col rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,hsl(0_0%_100%/0.94),hsl(220_24%_97%/0.94))] shadow-[0_18px_50px_-22px_hsl(220_30%_20%/0.28),0_2px_6px_-2px_hsl(220_30%_20%/0.06)] backdrop-blur-xl">
          {/* Edge tab that collapses / expands the panel */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}
            aria-expanded={!isCollapsed}
            className="absolute -end-2.5 top-[34px] z-10 flex h-7 w-5 items-center justify-center rounded-lg border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-muted))] shadow-sm transition-all hover:scale-110 hover:text-[hsl(var(--dash-ink))]"
          >
            <CaretLeft size={12} weight="bold" className={cn('transition-transform rtl:rotate-180', isCollapsed && 'rotate-180 rtl:rotate-0')} />
          </button>

          {/* Academy */}
          <div className={cn('shrink-0 pt-4', isCollapsed ? 'px-2' : 'px-4')}>
            <Link
              href="/"
              aria-label={org?.name}
              className={cn('flex items-center gap-3 rounded-2xl transition-opacity hover:opacity-80', isCollapsed && 'justify-center')}
            >
              <OrgLogo org={org} className={isCollapsed ? 'h-12 w-12' : 'h-16 w-16'} fallbackClassName="text-base" />
              {!isCollapsed && (
                <span className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">{org?.name}</span>
              )}
            </Link>
          </div>

          <div className="mx-4 mt-3 h-px shrink-0 bg-[hsl(var(--dash-border))]/80" aria-hidden="true" />

          <div className={cn('shrink-0 px-3 pt-3', isCollapsed && 'px-2')}>
            <CommandPaletteTrigger isCollapsed={isCollapsed} />
          </div>

          {/* Navigation */}
          <div ref={navScrollRef} className={cn('flex-1 overflow-y-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', isCollapsed ? 'px-2' : 'px-3')}>
            <AdminAuthorization authorizationMode="component">
              {(showHome || showCalendar || showMyEntity) && (
                <NavGroup id="desk" index={0} hasActive={deskActive} label={t('dashboard.home.nav.overview', 'My desk')} count={count(showHome, showCalendar, showMyEntity)} isCollapsed={isCollapsed}>
                  {showHome && (
                    <NavItem href="/dash" icon={icon(House, isActivePath('/dash'))} label={t('common.home')} isCollapsed={isCollapsed} active={isActivePath('/dash')} onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'home' })} />
                  )}
                  {showCalendar && (
                    <NavItem
                      href="/dash/calendar"
                      icon={icon(CalendarBlank, isActivePath('/dash/calendar'))}
                      label={t('calendar.title', 'Calendar')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/calendar')}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'calendar' })}
                    />
                  )}
                  {showMyEntity && (
                    <NavItem
                      href="/dash/my-entity"
                      icon={icon(IdentificationCard, isActivePath('/dash/my-entity'))}
                      label={t('entities.portal.nav', 'My organization')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/my-entity')}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'my-entity' })}
                    />
                  )}
                </NavGroup>
              )}

              {showPostgraduate && (
                <NavGroup
                  id="postgraduate"
                  index={1}
                  hasActive={postgradActive}
                  label={t('academic.postgraduate_studies', 'Postgraduate Studies')}
                  count={POSTGRAD_NAV_GROUPS.reduce((n, group) => n + group.links.length, 0)}
                  isCollapsed={isCollapsed}
                >
                  {!isCollapsed && postgrad.term ? <TermCard term={postgrad.term} /> : null}
                  {POSTGRAD_NAV_GROUPS.map((group, i) => (
                    <React.Fragment key={group.key}>
                      {group.labelKey ? (
                        <NavSubLabel label={t(group.labelKey, group.fallback)} isCollapsed={isCollapsed} first={i === 0 && !(postgrad.term && !isCollapsed)} />
                      ) : null}
                      {group.links.map((link) => {
                        const active = !inMyTeaching && link.isActive(pathname)
                        return (
                          <NavItem
                            key={link.key}
                            href={link.href}
                            icon={icon(link.Icon, active)}
                            label={t(link.labelKey, link.fallback)}
                            isCollapsed={isCollapsed}
                            active={active}
                            badge={link.key === 'admissions' ? postgrad.pendingApplications : undefined}
                            badgeLabel={t('academic.nav.pending_review', '{{count}} awaiting review', { count: postgrad.pendingApplications })}
                            onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: `postgraduate_${link.key}` })}
                          />
                        )
                      })}
                    </React.Fragment>
                  ))}
                </NavGroup>
              )}

              {showAcademicSection && (
                <NavGroup
                  id="academic"
                  index={2}
                  hasActive={academicActive}
                  label={t('dashboard.home.nav.academic', 'Academic')}
                  count={count(showTrainingPrograms, showFinance, showCmsNews)}
                  isCollapsed={isCollapsed}
                >
                  {showTrainingPrograms && (
                    <NavItem
                      href="/dash/training-programs"
                      icon={icon(Certificate, isActivePath('/dash/training-programs'))}
                      label={t('academic.training_programs', 'Training Programs')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/training-programs')}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'training_programs' })}
                    />
                  )}
                  {showFinance && (
                    <NavItem
                      href="/dash/finance"
                      icon={icon(CurrencyCircleDollar, isActivePath('/dash/finance'))}
                      label={t('common.finance', 'Finance')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/finance')}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'finance' })}
                    />
                  )}
                  {showCmsNews && (
                    <NavItem
                      href="/dash/cms/news"
                      icon={icon(Newspaper, isActivePath('/dash/cms/news'))}
                      label={t('cms.news.title', 'News')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/cms/news')}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'cms_news' })}
                    />
                  )}
                </NavGroup>
              )}

              {showTeachingSection && (
                <NavGroup
                  id="classroom"
                  index={3}
                  hasActive={classroomActive}
                  label={t('dashboard.home.nav.teaching', 'Classroom')}
                  count={count(showMyTeaching, showAssignments, showLibrary, showBoards, showPlaygrounds)}
                  isCollapsed={isCollapsed}
                >
                  {showMyTeaching && (
                    <NavItem
                      href="/dash/postgraduate/teaching"
                      icon={icon(Chalkboard, inMyTeaching)}
                      label={t('academic.my_teaching', 'My Teaching')}
                      isCollapsed={isCollapsed}
                      active={inMyTeaching}
                      onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'my_teaching' })}
                    />
                  )}
                  {showAssignments && (
                    <div onMouseEnter={fetchAssignments}>
                      <HoverMenu content={assignmentsMenu}>
                        <NavItem
                          href="/dash/assignments"
                          icon={icon(Files, isActivePath('/dash/assignments'))}
                          label={t('common.assignments')}
                          isCollapsed={isCollapsed}
                          active={isActivePath('/dash/assignments')}
                          hasMenu
                        />
                      </HoverMenu>
                    </div>
                  )}
                  {showLibrary && (
                    <NavItem href="/dash/library" icon={icon(FolderSimple, isActivePath('/dash/library'))} label={t('library.library')} isCollapsed={isCollapsed} active={isActivePath('/dash/library')} />
                  )}
                  {showBoards && (
                    <NavItem href="/dash/boards" icon={icon(ChalkboardSimple, isActivePath('/dash/boards'))} label={t('boards.boards')} isCollapsed={isCollapsed} active={isActivePath('/dash/boards')} />
                  )}
                  {showPlaygrounds && (
                    <NavItem href="/dash/playgrounds" icon={icon(Cube, isActivePath('/dash/playgrounds'))} label={t('common.playgrounds')} isCollapsed={isCollapsed} active={isActivePath('/dash/playgrounds')} />
                  )}
                </NavGroup>
              )}

              {showManageSection && (
                <NavGroup
                  id="manage"
                  index={4}
                  hasActive={manageActive}
                  label={t('dashboard.home.nav.manage', 'Manage')}
                  count={count(showUsers, showPayments, showOrganization, showAnalytics)}
                  isCollapsed={isCollapsed}
                >
                  {showUsers && (
                    <HoverMenu content={usersMenu}>
                      <NavItem href="/dash/users/settings/users" icon={icon(Users, isActivePath('/dash/users'))} label={t('common.users')} isCollapsed={isCollapsed} active={isActivePath('/dash/users')} hasMenu />
                    </HoverMenu>
                  )}
                  {showPayments && (
                    <NavItem
                      href="/dash/payments/overview"
                      icon={icon(CurrencyCircleDollar, isActivePath('/dash/payments'))}
                      label={t('common.payments')}
                      isCollapsed={isCollapsed}
                      active={isActivePath('/dash/payments')}
                    />
                  )}
                  {showOrganization && (
                    <HoverMenu content={orgMenu}>
                      <NavItem
                        href="/dash/org/settings/general"
                        icon={icon(Buildings, isActivePath('/dash/org'))}
                        label={t('common.academy_settings', 'Academy settings')}
                        isCollapsed={isCollapsed}
                        active={isActivePath('/dash/org')}
                        hasMenu
                      />
                    </HoverMenu>
                  )}
                  {showAnalytics && (
                    <HoverMenu content={analyticsMenu}>
                      <NavItem href="/dash/analytics" icon={icon(ChartBar, isActivePath('/dash/analytics'))} label={t('common.analytics')} isCollapsed={isCollapsed} active={isActivePath('/dash/analytics')} hasMenu />
                    </HoverMenu>
                  )}
                  {(showOtherBoards || showOtherPlaygrounds || showOtherPayments) && (
                    <HoverMenu content={otherMenu}>
                      <NavItem href="#" icon={<DotsThree size={18} weight="bold" />} label={t('common.other')} isCollapsed={isCollapsed} hasMenu muted asButton />
                    </HoverMenu>
                  )}
                </NavGroup>
              )}

              {adminLinks.length > 0 && (
                <NavGroup
                  id="admin"
                  index={5}
                  hasActive={adminActive}
                  label={t('dashboard.home.nav.administration', 'Administration & Configuration')}
                  count={adminLinks.length}
                  isCollapsed={isCollapsed}
                >
                  {adminLinks.map((link) => {
                    const active = isAdminLinkActive(link, pathname)
                    return (
                      <NavItem
                        key={link.href}
                        href={link.href}
                        icon={link.icon(18)}
                        label={t(link.labelKey, link.fallback)}
                        isCollapsed={isCollapsed}
                        active={active}
                        onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: link.navId })}
                      />
                    )
                  })}
                </NavGroup>
              )}
            </AdminAuthorization>
          </div>

          {/* Settings row + create card */}
          <div className={cn('shrink-0 space-y-3 pb-3 pt-1', isCollapsed ? 'px-2' : 'px-3')}>
            <div>
              {!isCollapsed && <GroupLabel label={t('common.settings', 'Settings')} count={settingsCount} />}
              <div
                className={cn(
                  'rounded-2xl bg-white p-1.5 shadow-[0_1px_3px_hsl(220_30%_20%/0.06)] ring-1 ring-[hsl(var(--dash-border))]/60',
                  isCollapsed ? 'flex flex-col items-center gap-1' : 'grid grid-cols-4 gap-1'
                )}
              >
                <HoverMenu align="end" content={languageMenu}>
                  <SettingsButton label={t('common.language')} isCollapsed={isCollapsed}>
                    <Globe size={18} weight="duotone" />
                  </SettingsButton>
                </HoverMenu>
                <HoverMenu align="end" content={helpMenu}>
                  <SettingsButton label={t('common.help')} isCollapsed={isCollapsed}>
                    <Question size={18} weight="duotone" />
                  </SettingsButton>
                </HoverMenu>
                <SettingsButton label={t('user.user_settings', 'User settings')} href="/account/general" isCollapsed={isCollapsed}>
                  <Gear size={18} weight="duotone" />
                </SettingsButton>
                <SettingsButton label={t('user.sign_out')} onClick={() => logOutUI()} isCollapsed={isCollapsed} danger>
                  <SignOut size={18} weight="duotone" className="rtl:rotate-180" />
                </SettingsButton>
              </div>
            </div>
            <CreateCard plan={plan} orgSlug={org?.slug} isCollapsed={isCollapsed} />

            {/* Signed-in person */}
            <HoverMenu align="end" content={accountMenu}>
              <button
                type="button"
                aria-label={t('user.account_menu', 'Account menu')}
                className={cn(
                  'flex w-full items-center rounded-2xl text-start transition-colors',
                  isCollapsed
                    ? 'justify-center p-1 hover:bg-white/80'
                    : 'gap-3 bg-white p-2 shadow-[0_1px_3px_hsl(220_30%_20%/0.06)] ring-1 ring-[hsl(var(--dash-border))]/60 hover:bg-[hsl(var(--dash-canvas))]'
                )}
              >
                <span className="relative shrink-0 rounded-full ring-2 ring-white shadow-[0_4px_12px_-4px_hsl(220_30%_20%/0.35)]">
                  <UserAvatar width={isCollapsed ? 40 : 36} rounded="rounded-full" shadow="shadow-none" />
                  <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
                </span>
                {!isCollapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-[hsl(var(--dash-muted))]" suppressHydrationWarning>
                        {greeting} <span aria-hidden="true">👋</span>
                      </span>
                      <span className="block truncate text-sm font-bold capitalize leading-tight">{displayName}</span>
                    </span>
                    <DotsThree size={18} weight="bold" className="shrink-0 text-[hsl(var(--dash-muted))]" />
                  </>
                )}
              </button>
            </HoverMenu>
          </div>
        </div>
      </nav>

      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        theme="light"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />
    </TooltipProvider>
    </LayoutGroup>
    </MotionConfig>
  )
}

const menuLinkCls =
  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))]/75 transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]'

const tooltipCls = 'z-tooltip border-transparent bg-[hsl(var(--dash-ink))] px-2 py-1 text-xs text-white shadow-lg'

/** One sidebar entry: label row when expanded, centred icon square when collapsed. */
function NavItem({
  href,
  icon,
  label,
  isCollapsed,
  active = false,
  onClick,
  hasMenu = false,
  muted = false,
  asButton = false,
  badge,
  badgeLabel,
}: {
  href: string
  icon: React.ReactNode
  label: string
  isCollapsed: boolean
  active?: boolean
  onClick?: () => void
  hasMenu?: boolean
  muted?: boolean
  asButton?: boolean
  /** A count of things waiting here (e.g. applications to review); hidden at 0. */
  badge?: number
  badgeLabel?: string
}) {
  const showBadge = !!badge && badge > 0
  const className = cn(
    'group/item relative flex items-center rounded-xl text-[13px] font-medium transition-colors duration-200',
    isCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 w-full gap-3 px-3',
    active
      ? 'text-[hsl(var(--dash-ink))]'
      : cn(muted ? 'text-[hsl(var(--dash-muted))]/80' : 'text-[hsl(var(--dash-ink))]/65', 'hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]')
  )
  const inner = (
    <>
      {/* One shared pill that glides to whichever item is active. */}
      {active && (
        <motion.span
          layoutId="dash-nav-active-pill"
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))] shadow-[0_8px_18px_-8px_hsl(43_80%_45%/0.75)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span
        className={cn(
          'relative flex shrink-0 items-center transition-transform duration-200 ease-out group-hover/item:scale-110',
          !active && 'text-[hsl(var(--dash-ink))]/55 group-hover/item:text-[hsl(var(--dash-ink))]'
        )}
      >
        {icon}
      </span>
      {!isCollapsed && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-w-0 flex-1 truncate text-start transition-transform duration-200 group-hover/item:translate-x-0.5 rtl:group-hover/item:-translate-x-0.5"
        >
          {label}
        </motion.span>
      )}
      {!isCollapsed && hasMenu && (
        <CaretRight
          size={12}
          weight="bold"
          className={cn(
            'relative shrink-0 transition-transform duration-200 group-hover/item:translate-x-0.5 rtl:rotate-180 rtl:group-hover/item:-translate-x-0.5',
            active ? 'text-[hsl(var(--dash-ink))]/60' : 'text-[hsl(var(--dash-muted))]/70'
          )}
        />
      )}
      {isCollapsed && hasMenu && <span className="absolute bottom-1.5 end-1.5 h-1 w-1 rounded-full bg-current opacity-40" aria-hidden="true" />}
      {showBadge && !isCollapsed ? (
        <span
          title={badgeLabel}
          className={cn(
            'relative shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
            active ? 'bg-[hsl(var(--dash-ink))] text-white' : 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]'
          )}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {showBadge && isCollapsed ? (
        <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-[hsl(var(--dash-accent))] ring-2 ring-white" aria-hidden="true" />
      ) : null}
    </>
  )
  const ariaLabel = showBadge && badgeLabel ? `${label}, ${badgeLabel}` : label
  const element = asButton ? (
    <button type="button" aria-label={label} className={cn(className, 'w-full')}>
      {inner}
    </button>
  ) : (
    <Link href={href} aria-label={ariaLabel} aria-current={active ? 'page' : undefined} onClick={onClick} className={className}>
      {inner}
    </Link>
  )
  if (!isCollapsed || hasMenu) return element
  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent side="right" className={tooltipCls}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** A small heading between groups of links inside a section card (a divider when the panel is collapsed). */
function NavSubLabel({ label, isCollapsed, first = false }: { label: string; isCollapsed: boolean; first?: boolean }) {
  if (isCollapsed) return first ? null : <div className="mx-auto my-1.5 h-px w-6 bg-[hsl(var(--dash-border))]" aria-hidden="true" />
  return (
    <p className={cn('flex items-center gap-2 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]/80', first ? 'pt-1' : 'pt-3')}>
      <span className="truncate">{label}</span>
      <span className="h-px flex-1 bg-[hsl(var(--dash-border))]/70" aria-hidden="true" />
    </p>
  )
}

/** Current academic term at the top of the Postgraduate section: name, week and progress through the term. */
function TermCard({ term }: { term: any }) {
  const { t } = useTranslation()
  const progress = termProgress(term)
  return (
    <Link
      href={`${POSTGRAD_BASE}/calendar`}
      className="group/term relative mb-1 block overflow-hidden rounded-xl bg-[linear-gradient(135deg,hsl(0_0%_14%),hsl(0_0%_6%))] px-3 py-2.5 text-white transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.6)] to-transparent" />
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[hsl(43_80%_62%)]">
          <CalendarDots size={16} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[hsl(43_80%_64%)]">{t('academic.nav.current_term', 'Current term')}</span>
          <span className="block truncate text-[13px] font-semibold leading-tight">{term.name}</span>
        </span>
        <CaretRight size={12} weight="bold" className="shrink-0 text-white/40 transition-transform group-hover/term:translate-x-0.5 rtl:rotate-180 rtl:group-hover/term:-translate-x-0.5" />
      </span>
      {progress ? (
        <>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,hsl(43_85%_60%),hsl(40_78%_49%))]" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </span>
          <span className="mt-1 flex items-center justify-between text-[10.5px] text-white/55">
            <span>{t('academic.nav.week_of', 'Week {{week}} of {{total}}', { week: progress.week, total: progress.totalWeeks })}</span>
            {term.academic_year_code ? <span className="tabular-nums">{term.academic_year_code}</span> : null}
          </span>
        </>
      ) : null}
    </Link>
  )
}

/**
 * Live bits of the Postgraduate section: today's term and applications waiting
 * for review. Fetched only while the section can show them, cached for minutes.
 */
function usePostgradSignals(orgId: number | undefined, token: string | undefined, enabled: boolean) {
  const ready = enabled && !!orgId && !!token
  const { data: terms } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId!, token!),
    enabled: ready,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const { data: pending } = useQuery({
    queryKey: ['academic', 'applications', orgId, 'pending-count'],
    queryFn: async () => {
      const lists = await Promise.all(['submitted', 'under_review'].map((status) => getApplications(orgId!, token!, { status })))
      return lists.reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0)
    },
    enabled: ready,
    staleTime: 2 * 60_000,
    retry: false,
  })
  return { term: Array.isArray(terms) ? pickCurrentTerm(terms) : null, pendingApplications: pending ?? 0 }
}

function GroupLabel({ label, count }: { label: string; count: number }) {
  return (
    <p className="truncate px-3 pb-1.5 pt-3 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
      {label}: <span className="font-semibold text-[hsl(var(--dash-ink))]">{count}</span>
    </p>
  )
}

const GROUP_STATE_EVENT = 'dash-nav-groups-change'

/** Remembers which sidebar sections are folded (per browser). */
function useGroupOpen(id: string): [boolean, (_open: boolean) => void] {
  const key = `dash-nav-group:${id}`
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener('storage', notify)
    window.addEventListener(GROUP_STATE_EVENT, notify)
    return () => {
      window.removeEventListener('storage', notify)
      window.removeEventListener(GROUP_STATE_EVENT, notify)
    }
  }, [])
  const read = () => {
    try {
      return localStorage.getItem(key) !== 'closed'
    } catch {
      return true
    }
  }
  const open = useSyncExternalStore(subscribe, read, () => true)
  const setOpen = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? 'open' : 'closed')
      } catch {
        /* private mode: the choice just isn't remembered */
      }
      window.dispatchEvent(new Event(GROUP_STATE_EVENT))
    },
    [key]
  )
  return [open, setOpen]
}

type PreviewItem = { href: string; icon: React.ReactNode; label: string; active: boolean }

/** The section's links (NavItems, possibly wrapped in hover menus), for the folded preview. */
function collectItems(children: React.ReactNode): PreviewItem[] {
  const items: PreviewItem[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as any
    if (child.type === NavItem) {
      if (!props.asButton) items.push({ href: props.href, icon: props.icon, label: props.label, active: !!props.active })
      return
    }
    if (props?.children) items.push(...collectItems(props.children))
  })
  return items
}

const PREVIEW_LIMIT = 6

/**
 * A sidebar section: "Label: count" heading that folds the section, and its
 * items grouped on a white card. Folded, it becomes a small card: the name and
 * count on top and a row of icon shortcuts to its pages. Folding animates the height.
 */
function NavGroup({
  id,
  index,
  label,
  count,
  isCollapsed,
  hasActive = false,
  children,
}: {
  id: string
  index: number
  label: string
  count: number
  isCollapsed: boolean
  hasActive?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [storedOpen, setOpen] = useGroupOpen(id)
  const open = isCollapsed || storedOpen
  const preview = open ? [] : collectItems(children)
  // Keep the current page visible in the preview even when it isn't among the first icons.
  const shown = preview.slice(0, PREVIEW_LIMIT)
  const activeItem = preview.find((item) => item.active)
  if (activeItem && !shown.includes(activeItem)) shown[shown.length - 1] = activeItem
  const hidden = preview.length - shown.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(!open && 'pt-2')}
    >
      {isCollapsed ? (
        <p className="pb-1 pt-3 text-center text-[10px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]" title={label}>
          {count}
        </p>
      ) : open ? (
        <motion.button
          key="open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          className="group/head flex w-full items-center gap-1.5 px-3 pb-1.5 pt-3 text-start text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-ink))]"
        >
          <span className="truncate">
            {label}: <span className="font-semibold text-[hsl(var(--dash-ink))]">{count}</span>
          </span>
          <CaretDown size={11} weight="bold" className="ms-auto shrink-0 opacity-60 transition-transform duration-300 group-hover/head:opacity-100" />
        </motion.button>
      ) : (
        <motion.div
          key="folded"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'group/fold rounded-2xl bg-white/75 p-1.5 shadow-[0_1px_2px_hsl(220_30%_20%/0.05)] ring-1 transition-all duration-200 hover:bg-white hover:shadow-[0_8px_20px_-10px_hsl(220_30%_20%/0.3)]',
            hasActive ? 'ring-[hsl(var(--dash-accent))]/40' : 'ring-[hsl(var(--dash-border))]/60'
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-1 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]/70"
          >
            <span className="truncate text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]">{label}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
                hasActive ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
              )}
            >
              {count}
            </span>
            <span className="ms-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[hsl(var(--dash-muted))] transition-colors group-hover/fold:text-[hsl(var(--dash-ink))]">
              <CaretDown size={11} weight="bold" className="-rotate-90 transition-transform duration-300 group-hover/fold:rotate-0 rtl:rotate-90 rtl:group-hover/fold:rotate-0" />
            </span>
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-0.5 px-1">
            {shown.map((item, i) => (
              <Tooltip key={item.href + item.label}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={item.active ? 'page' : undefined}
                    style={{ transitionDelay: `${i * 25}ms` }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 hover:-translate-y-0.5',
                      item.active
                        ? 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))] text-[hsl(var(--dash-ink))] shadow-[0_4px_10px_-4px_hsl(43_80%_45%/0.8)]'
                        : 'text-[hsl(var(--dash-ink))]/50 hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
                    )}
                  >
                    {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { size: 15 }) : item.icon}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className={tooltipCls}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
            {hidden > 0 ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[10px] font-semibold tabular-nums text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
                aria-label={t('common.expand', 'Expand')}
              >
                +{hidden}
              </button>
            ) : null}
          </div>
        </motion.div>
      )}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="min-h-0 overflow-hidden px-0.5 pb-1" inert={!open}>
          <div className="space-y-0.5 rounded-2xl bg-white p-1.5 shadow-[0_1px_3px_hsl(220_30%_20%/0.06)] ring-1 ring-[hsl(var(--dash-border))]/60">{children}</div>
        </div>
      </div>
    </motion.div>
  )
}

function SettingsButton({
  label,
  isCollapsed,
  href,
  onClick,
  danger = false,
  children,
}: {
  label: string
  isCollapsed: boolean
  href?: string
  onClick?: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  const className = cn(
    'flex h-9 items-center justify-center rounded-xl text-[hsl(var(--dash-ink))]/60 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0',
    isCollapsed ? 'w-10' : 'w-full',
    danger ? 'hover:bg-[hsl(var(--dash-warn-soft))] hover:text-[hsl(var(--dash-warn))]' : 'hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
  )
  const element = href ? (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={className}>
      {children}
    </button>
  )
  // Hover menus (language, help) show their own panel; plain actions get a tooltip.
  if (!href && !onClick) return element
  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent side={isCollapsed ? 'right' : 'top'} className={tooltipCls}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The upgrade page opens in a new tab; "new course" stays in the app. */
function CreateLink({ upgradeUrl, title, className, children }: { upgradeUrl: string | null; title: string; className: string; children: React.ReactNode }) {
  return upgradeUrl ? (
    <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" aria-label={title} className={className}>
      {children}
    </a>
  ) : (
    <Link href="/dash/courses?new=true" aria-label={title} className={className}>
      {children}
    </Link>
  )
}

/**
 * "Create" card at the bottom of the panel. Free SaaS orgs get the upgrade
 * prompt; everyone else gets a shortcut to start a new course.
 */
function CreateCard({ plan, orgSlug, isCollapsed }: { plan: string; orgSlug?: string; isCollapsed: boolean }) {
  const { t } = useTranslation()
  const upgradeUrl = plan === 'free' ? getUpgradeUrl(orgSlug || 'default') : null
  const title = upgradeUrl ? t('dashboard.sidebar.promo.upgrade_title', 'Upgrade your plan') : t('dashboard.sidebar.create_title', 'Create new course')
  const button = (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))] text-[hsl(var(--dash-ink))] shadow-[0_10px_22px_-8px_hsl(43_80%_45%/0.8)] transition-transform group-hover/create:scale-105">
      {upgradeUrl ? (
        <Rocket size={20} weight="fill" className="transition-transform duration-300 group-hover/create:-translate-y-0.5" />
      ) : (
        <Plus size={20} weight="bold" className="transition-transform duration-300 group-hover/create:rotate-90" />
      )}
    </span>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex justify-center">
            <CreateLink upgradeUrl={upgradeUrl} title={title} className="group/create">
              {button}
            </CreateLink>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className={tooltipCls}>
          {title}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-[0_1px_3px_hsl(220_30%_20%/0.06)] ring-1 ring-[hsl(var(--dash-border))]/60 [@media(max-height:820px)]:hidden">
      <CreateLink upgradeUrl={upgradeUrl} title={title} className="group/create mx-auto flex w-fit flex-col items-center">
        {button}
        <span className="mt-2.5 text-sm font-semibold text-[hsl(var(--dash-ink))]">{title}</span>
      </CreateLink>
      <p className="mt-0.5 text-[11px] text-[hsl(var(--dash-muted))]">
        {upgradeUrl ? (
          t('dashboard.sidebar.promo.upgrade_body', 'Unlock premium features and grow your academy.')
        ) : (
          <>
            {t('dashboard.sidebar.create_or', 'or')}{' '}
            <Link href="/dash/courses" className="font-semibold text-[hsl(var(--dash-accent))] hover:underline">
              {t('dashboard.sidebar.create_browse', 'browse all courses')}
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

export default DashLeftMenu
