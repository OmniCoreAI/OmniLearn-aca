'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { cn } from '@/lib/utils'

/* Building blocks shared by the Postgraduate Studies screens. */

export function useAcademicContext() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token: string = session?.data?.tokens?.access_token
  return { org, orgId: org?.id as number, access_token, ready: !!org?.id && !!access_token }
}

/** Section navigation for the Postgraduate Studies module. */
export function PostgradTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const pathname = usePathname() || ''
  const base = '/dash/postgraduate'
  const tabs = [
    { href: base, label: t('academic.tab_programs', 'Programs'), match: (p: string) => isProgramPath(p) },
    { href: `${base}/courses`, label: t('academic.tab_catalog', 'Course Catalog') },
    { href: `${base}/offerings`, label: t('academic.tab_offerings', 'Course Offerings') },
    { href: `${base}/students`, label: t('academic.tab_students', 'Students') },
    { href: `${base}/calendar`, label: t('academic.tab_calendar', 'Academic Calendar') },
  ]

  function isProgramPath(p: string) {
    const rest = p.split(base)[1] || ''
    return !['/courses', '/offerings', '/students', '/calendar'].some((s) => rest.startsWith(s))
  }

  return (
    <div className="mb-6 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-1">
      {tabs.map((tab) => {
        const active = tab.match ? tab.match(pathname) : pathname.includes(tab.href)
        return (
          <Link
            key={tab.href}
            href={getUriWithOrg(orgslug, tab.href)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
                : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

const STATUS_TONES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  open: 'bg-emerald-100 text-emerald-800',
  registered: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-sky-100 text-sky-800',
  registration: 'bg-sky-100 text-sky-800',
  exams: 'bg-violet-100 text-violet-800',
  completed: 'bg-slate-200 text-slate-800',
  graduated: 'bg-violet-100 text-violet-800',
  planned: 'bg-amber-100 text-amber-800',
  draft: 'bg-amber-100 text-amber-800',
  upcoming: 'bg-amber-100 text-amber-800',
  deferred: 'bg-amber-100 text-amber-800',
  suspended: 'bg-orange-100 text-orange-800',
  dropped: 'bg-orange-100 text-orange-800',
  withdrawn: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  retired: 'bg-slate-200 text-slate-700',
  closed: 'bg-slate-200 text-slate-700',
  archived: 'bg-slate-200 text-slate-700',
  required: 'bg-sky-100 text-sky-800',
  elective: 'bg-violet-100 text-violet-800',
}

export function StatusPill({ status, label }: { status?: string | null; label?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  const key = String(status).toLowerCase()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        STATUS_TONES[key] || 'bg-slate-100 text-slate-700'
      )}
    >
      {label || t(`academic.state_${key}`, key.replace(/_/g, ' '))}
    </span>
  )
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 sm:p-5',
        className
      )}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
          {description && <p className="text-xs text-[hsl(var(--dash-muted))]">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-[hsl(var(--dash-ink))]">{value ?? '—'}</div>
    </div>
  )
}

export function DataTable({
  headers,
  children,
  empty,
}: {
  headers: React.ReactNode[]
  children: React.ReactNode
  empty?: string
}) {
  const rows = React.Children.toArray(children)
  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--dash-border))]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[hsl(var(--dash-canvas))] text-[11px] uppercase tracking-wider text-[hsl(var(--dash-muted))]">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--dash-border))]">
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-[hsl(var(--dash-muted))]">
                {empty || '—'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export const tdCls = 'px-3 py-2 align-middle text-[hsl(var(--dash-ink))]'

export function GhostButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))] disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function IconButton({
  className,
  tone = 'default',
  ...props
}: React.ComponentProps<'button'> & { tone?: 'default' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
        tone === 'danger'
          ? 'text-[hsl(var(--dash-muted))] hover:bg-red-50 hover:text-red-600'
          : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]',
        className
      )}
      {...props}
    />
  )
}

export function selectCls(extra?: string) {
  return cn(
    'rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:border-[hsl(var(--dash-accent))]/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30',
    extra
  )
}
