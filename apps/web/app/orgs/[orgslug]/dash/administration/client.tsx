'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Circle, Plus } from 'lucide-react'
import {
  Buildings,
  Certificate,
  ChalkboardTeacher,
  Door,
  EnvelopeSimple,
  Package,
  SlidersHorizontal,
  UsersThree,
} from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import DashStatCards, { type DashStat } from '@components/Dashboard/Shared/DashStatCards'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getAdminOverview } from '@services/administration/administration'
import { cn } from '@/lib/utils'

/**
 * The admin's "Create → Configure → Reuse → Assign" path. Each step is shown
 * only once the backend reports a count for it (i.e. the module exists), and
 * turns done when at least one record has been created.
 */
const STEPS: { key: string; href: string; labelKey: string; fallback: string; hintKey: string; hint: string }[] = [
  { key: 'instructor_categories', href: '/dash/instructors/categories', labelKey: 'administration.overview.step_instructor_categories', fallback: 'Create instructor categories', hintKey: 'administration.overview.hint_instructor_categories', hint: 'Senior, junior, external trainer… each with a default hourly rate.' },
  { key: 'instructors', href: '/dash/instructors', labelKey: 'administration.overview.step_instructors', fallback: 'Add instructors / trainers', hintKey: 'administration.overview.hint_instructors', hint: 'Profile, expertise, availability and an optional personal rate.' },
  { key: 'facilities', href: '/dash/administration/facilities', labelKey: 'administration.overview.step_facilities', fallback: 'Register rooms & facilities', hintKey: 'administration.overview.hint_facilities', hint: 'Capacity, equipment, availability and hourly cost.' },
  { key: 'addons', href: '/dash/administration/add-ons', labelKey: 'administration.overview.step_addons', fallback: 'Define add-ons', hintKey: 'administration.overview.hint_addons', hint: 'Meals, notebooks, training kits — priced once, attached anywhere.' },
  { key: 'entities', href: '/dash/administration/entities', labelKey: 'administration.overview.step_entities', fallback: 'Create organizations', hintKey: 'administration.overview.hint_entities', hint: 'Ministries, companies, universities… with their coordinator.' },
  { key: 'usergroups', href: '/dash/administration/user-groups', labelKey: 'administration.overview.step_usergroups', fallback: 'Organize user groups', hintKey: 'administration.overview.hint_usergroups', hint: 'Departments and groups that courses are assigned to.' },
  { key: 'email_templates', href: '/dash/administration/communication', labelKey: 'administration.overview.step_email_templates', fallback: 'Customize email & SMS templates', hintKey: 'administration.overview.hint_email_templates', hint: 'Welcome, enrollment, reminders — with dynamic variables.' },
  { key: 'certificate_templates', href: '/dash/administration/certificates', labelKey: 'administration.overview.step_certificate_templates', fallback: 'Design certificate templates', hintKey: 'administration.overview.hint_certificate_templates', hint: 'Logos, signatures, QR code and dynamic text.' },
  { key: 'courses', href: '/dash/courses', labelKey: 'administration.overview.step_courses', fallback: 'Create or select a course and assign everything', hintKey: 'administration.overview.hint_courses', hint: 'Pick the instructor, room, add-ons, audience and certificate.' },
]

const QUICK_CREATE: { href: string; labelKey: string; fallback: string; icon: React.ElementType }[] = [
  { href: '/dash/instructors', labelKey: 'administration.overview.new_instructor', fallback: 'Instructor', icon: ChalkboardTeacher },
  { href: '/dash/administration/facilities', labelKey: 'administration.overview.new_facility', fallback: 'Facility', icon: Door },
  { href: '/dash/administration/add-ons', labelKey: 'administration.overview.new_addon', fallback: 'Add-on', icon: Package },
  { href: '/dash/administration/entities', labelKey: 'administration.overview.new_org', fallback: 'Organization', icon: Buildings },
  { href: '/dash/administration/communication', labelKey: 'administration.overview.new_template', fallback: 'Email template', icon: EnvelopeSimple },
  { href: '/dash/administration/certificates', labelKey: 'administration.overview.new_certificate', fallback: 'Certificate', icon: Certificate },
]

function AdministrationOverview({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const { data: counts, isLoading } = useQuery({
    queryKey: ['administration', 'overview', orgId],
    queryFn: () => getAdminOverview(orgId, access_token),
    enabled: ready,
  })
  const count = (key: string) => counts?.[key] ?? 0

  const steps = STEPS.filter((s) => counts && s.key in counts)
  const done = steps.filter((s) => count(s.key) > 0).length
  const nextStep = steps.find((s) => count(s.key) === 0)

  const areas: DashStat[] = [
    { key: 'instructors', label: t('administration.nav.instructors', 'Instructors / Trainers'), value: count('instructors'), hint: t('administration.overview.categories_hint', '{{count}} categories', { count: count('instructor_categories') }), icon: ChalkboardTeacher, tone: 'rose', href: '/dash/instructors' },
    { key: 'facilities', label: t('administration.nav.facilities', 'Facilities & Rooms'), value: count('facilities'), hint: t('administration.overview.locations_hint', '{{count}} locations', { count: count('locations') }), icon: Door, tone: 'stone', href: '/dash/administration/facilities' },
    { key: 'entities', label: t('administration.nav.entities', 'Organizations'), value: count('entities'), hint: t('administration.overview.positions_hint', '{{count}} positions', { count: count('positions') }), icon: Buildings, tone: 'gold', href: '/dash/administration/entities' },
    { key: 'usergroups', label: t('administration.nav.user_groups', 'User groups'), value: count('usergroups'), icon: UsersThree, tone: 'sand', href: '/dash/administration/user-groups' },
    { key: 'addons', label: t('administration.nav.addons', 'Add-ons'), value: count('addons'), icon: Package, tone: 'rose', href: '/dash/administration/add-ons' },
    { key: 'email_templates', label: t('administration.overview.email_templates', 'Email templates'), value: count('email_templates'), hint: t('administration.overview.custom_hint', 'Customized'), icon: EnvelopeSimple, tone: 'stone', href: '/dash/administration/communication' },
    { key: 'certificate_templates', label: t('administration.overview.certificate_templates', 'Certificate templates'), value: count('certificate_templates'), icon: Certificate, tone: 'gold', href: '/dash/administration/certificates' },
    { key: 'settings', label: t('administration.nav.settings', 'General Configuration'), value: '—', hint: t('administration.overview.settings_hint', 'Lists, currencies & taxes'), icon: SlidersHorizontal, tone: 'sand', href: '/dash/administration/settings' },
  ]

  return (
    <AcademicPageShell>
      <AcademicHeader
        title={t('dashboard.home.nav.administration', 'Administration & Configuration')}
        subtitle={t('administration.overview.subtitle', 'Create reusable building blocks once, then select them everywhere — no development needed.')}
      />

      <DashStatCards loading={isLoading} stats={areas} className="mb-6 lg:grid-cols-4 2xl:grid-cols-4" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="dash-card rounded-[1.25rem] p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{t('administration.overview.setup_checklist', 'Setup checklist')}</h2>
              <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{t('administration.overview.quick_start_desc', 'Create → Configure → Reuse → Assign')}</p>
            </div>
            {steps.length > 0 && (
              <div className="flex min-w-[160px] items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                  <div className="h-full rounded-full bg-[hsl(var(--dash-accent))] transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold tabular-nums text-[hsl(var(--dash-ink))]">
                  {done}/{steps.length}
                </span>
              </div>
            )}
          </div>
          <ol className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {isLoading && Array.from({ length: 6 }, (_, i) => <li key={i} className="dash-shimmer my-1 h-12 rounded-xl" />)}
            {steps.map((step, index) => {
              const complete = count(step.key) > 0
              const isNext = step === nextStep
              return (
                <li key={step.key}>
                  <Link
                    href={getUriWithOrg(orgslug, step.href)}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]',
                      isNext && 'bg-[hsl(var(--dash-accent-soft))]/50'
                    )}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className={cn('h-[18px] w-[18px] shrink-0', isNext ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-border))]')} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[13px] font-medium', complete ? 'text-[hsl(var(--dash-muted))]' : 'text-[hsl(var(--dash-ink))]')}>
                        {index + 1}. {t(step.labelKey, step.fallback)}
                      </div>
                      <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{t(step.hintKey, step.hint)}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 rtl:rotate-180" />
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>

        <div className="space-y-5">
          <section className="dash-card rounded-[1.25rem] p-5">
            <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{t('administration.overview.quick_create', 'Quick create')}</h2>
            <p className="mb-3 mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{t('administration.overview.quick_create_desc', 'Jump straight to adding a new building block.')}</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CREATE.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={getUriWithOrg(orgslug, item.href)}
                    className="flex items-center gap-2 rounded-xl border border-[hsl(var(--dash-border))] px-3 py-2 text-[13px] font-medium text-[hsl(var(--dash-ink))] transition-colors hover:border-[hsl(var(--dash-accent))]/40 hover:bg-[hsl(var(--dash-accent-soft))]/40"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--dash-muted))]" />
                    <Icon size={15} className="shrink-0 text-[hsl(var(--dash-accent))]" />
                    <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="dash-card rounded-[1.25rem] p-5">
            <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{t('administration.overview.how_title', 'How it fits together')}</h2>
            <p className="mb-3 mt-0.5 text-xs text-[hsl(var(--dash-muted))]">
              {t('administration.overview.how_desc', 'Everything configured here is selected from lists when you build a course or training program.')}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {[
                t('administration.overview.chain_entity', 'Organization'),
                t('administration.overview.chain_group', 'User group'),
                t('administration.overview.chain_course', 'Course / program'),
                t('administration.overview.chain_instructor', 'Instructor'),
                t('administration.overview.chain_facility', 'Room'),
                t('administration.overview.chain_addons', 'Add-ons'),
                t('administration.overview.chain_certificate', 'Certificate'),
                t('administration.overview.chain_notifications', 'Notifications'),
              ].map((label, i, all) => (
                <React.Fragment key={label}>
                  <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2.5 py-1 font-medium text-[hsl(var(--dash-ink))]">{label}</span>
                  {i < all.length - 1 ? <ArrowRight className="h-3 w-3 text-[hsl(var(--dash-muted))] rtl:rotate-180" /> : null}
                </React.Fragment>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AcademicPageShell>
  )
}

export default AdministrationOverview
