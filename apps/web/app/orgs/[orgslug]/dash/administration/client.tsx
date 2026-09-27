'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getAdminOverview } from '@services/administration/administration'
import { cn } from '@/lib/utils'

/**
 * The admin's "Create → Configure → Reuse → Assign" path. Each step is shown
 * only once the backend reports a count for it (i.e. the module exists), and
 * turns done when at least one record has been created.
 */
const STEPS: { key: string; href: string; labelKey: string; fallback: string; hintKey: string; hint: string }[] = [
  {
    key: 'instructor_categories',
    href: '/dash/instructors/categories',
    labelKey: 'administration.overview.step_instructor_categories',
    fallback: 'Create instructor categories',
    hintKey: 'administration.overview.hint_instructor_categories',
    hint: 'Senior, junior, external trainer… each with a default hourly rate.',
  },
  {
    key: 'instructors',
    href: '/dash/instructors',
    labelKey: 'administration.overview.step_instructors',
    fallback: 'Add instructors / trainers',
    hintKey: 'administration.overview.hint_instructors',
    hint: 'Profile, expertise, availability and an optional personal rate.',
  },
  {
    key: 'facilities',
    href: '/dash/administration/facilities',
    labelKey: 'administration.overview.step_facilities',
    fallback: 'Register rooms & facilities',
    hintKey: 'administration.overview.hint_facilities',
    hint: 'Capacity, equipment, availability and hourly cost.',
  },
  {
    key: 'addons',
    href: '/dash/administration/add-ons',
    labelKey: 'administration.overview.step_addons',
    fallback: 'Define add-ons',
    hintKey: 'administration.overview.hint_addons',
    hint: 'Meals, notebooks, training kits — priced once, attached anywhere.',
  },
  {
    key: 'entities',
    href: '/dash/administration/entities',
    labelKey: 'administration.overview.step_entities',
    fallback: 'Create entities',
    hintKey: 'administration.overview.hint_entities',
    hint: 'Ministries, companies, universities… with their coordinator.',
  },
  {
    key: 'usergroups',
    href: '/dash/users/settings/usergroups',
    labelKey: 'administration.overview.step_usergroups',
    fallback: 'Organize user groups',
    hintKey: 'administration.overview.hint_usergroups',
    hint: 'Departments and groups that courses are assigned to.',
  },
  {
    key: 'email_templates',
    href: '/dash/administration/communication',
    labelKey: 'administration.overview.step_email_templates',
    fallback: 'Customize email & SMS templates',
    hintKey: 'administration.overview.hint_email_templates',
    hint: 'Welcome, enrollment, reminders — with dynamic variables.',
  },
  {
    key: 'certificate_templates',
    href: '/dash/administration/certificates',
    labelKey: 'administration.overview.step_certificate_templates',
    fallback: 'Design certificate templates',
    hintKey: 'administration.overview.hint_certificate_templates',
    hint: 'Logos, signatures, QR code and dynamic text.',
  },
  {
    key: 'courses',
    href: '/dash/courses',
    labelKey: 'administration.overview.step_courses',
    fallback: 'Create or select a course and assign everything',
    hintKey: 'administration.overview.hint_courses',
    hint: 'Pick the instructor, room, add-ons, audience and certificate.',
  },
]

function AdministrationOverview({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const { data: counts, isLoading } = useQuery({
    queryKey: ['administration', 'overview', orgId],
    queryFn: () => getAdminOverview(orgId, access_token),
    enabled: ready,
  })

  const steps = STEPS.filter((s) => counts && s.key in counts)
  const done = steps.filter((s) => (counts?.[s.key] ?? 0) > 0).length

  return (
    <AcademicPageShell>
      <AcademicHeader
        title={t('dashboard.home.nav.administration', 'Administration & Configuration')}
        subtitle={t(
          'administration.overview.subtitle',
          'Create reusable building blocks once, then select them everywhere — no development needed.'
        )}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{t('administration.overview.quick_start', 'Quick start')}</h2>
              <p className="text-xs text-[hsl(var(--dash-muted))]">
                {t('administration.overview.quick_start_desc', 'Create → Configure → Reuse → Assign')}
              </p>
            </div>
            {steps.length > 0 && (
              <span className="rounded-full bg-[hsl(var(--dash-accent-soft))] px-3 py-1 text-xs font-semibold text-[hsl(var(--dash-accent))]">
                {done}/{steps.length}
              </span>
            )}
          </div>
          <ol className="space-y-2">
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => <li key={i} className="dash-shimmer h-14 rounded-xl" />)}
            {steps.map((step, index) => {
              const count = counts?.[step.key] ?? 0
              const complete = count > 0
              return (
                <li key={step.key}>
                  <Link
                    href={getUriWithOrg(orgslug, step.href)}
                    className="group flex items-center gap-3 rounded-xl border border-[hsl(var(--dash-border))] px-3 py-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                  >
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[hsl(var(--dash-muted))]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium', complete && 'text-[hsl(var(--dash-muted))]')}>
                        {index + 1}. {t(step.labelKey, step.fallback)}
                      </div>
                      <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{t(step.hintKey, step.hint)}</div>
                    </div>
                    <span className="text-xs font-semibold text-[hsl(var(--dash-muted))]">{count}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--dash-muted))] transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold">{t('administration.overview.how_title', 'How it fits together')}</h2>
          <p className="mb-4 text-xs text-[hsl(var(--dash-muted))]">
            {t(
              'administration.overview.how_desc',
              'Everything configured here is selected from lists when you build a course or training program.'
            )}
          </p>
          <div className="space-y-2 text-sm">
            {[
              t('administration.overview.chain_entity', 'Entity'),
              t('administration.overview.chain_group', 'User group'),
              t('administration.overview.chain_course', 'Course / program'),
              t('administration.overview.chain_instructor', 'Instructor'),
              t('administration.overview.chain_facility', 'Room / facility'),
              t('administration.overview.chain_addons', 'Add-ons'),
              t('administration.overview.chain_certificate', 'Certificate'),
              t('administration.overview.chain_notifications', 'Email / SMS notifications'),
            ].map((label, i, all) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-1.5 text-center text-xs font-medium">
                  {label}
                </div>
                {i < all.length - 1 && <div className="h-2 w-px bg-[hsl(var(--dash-border))]" />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AcademicPageShell>
  )
}

export default AdministrationOverview
