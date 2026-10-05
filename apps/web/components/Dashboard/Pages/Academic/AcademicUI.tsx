'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { cn } from '@/lib/utils'
import { POSTGRAD_NAV_LINKS } from '@components/Dashboard/Menus/postgradNavItems'

/* Building blocks shared by the Postgraduate Studies screens. */

export function useAcademicContext() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token: string = session?.data?.tokens?.access_token
  return { org, orgId: org?.id as number, access_token, ready: !!org?.id && !!access_token }
}

/**
 * Section navigation for the Postgraduate Studies module on phones and tablets.
 * On desktop the same pages sit in the sidebar's Postgraduate Studies section.
 */
export function PostgradTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const pathname = usePathname() || ''
  return (
    <nav aria-label={t('academic.postgraduate_studies', 'Postgraduate Studies')} className={cn(TAB_TRACK, 'mb-6 min-[1025px]:hidden')}>
      {POSTGRAD_NAV_LINKS.map((link) => {
        const active = link.isActive(pathname)
        return (
          <Link
            key={link.key}
            href={getUriWithOrg(orgslug, link.href)}
            aria-current={active ? 'page' : undefined}
            className={tabItemClass(active, 'inline-flex items-center gap-1.5 px-3.5')}
          >
            <link.Icon size={15} weight={active ? 'fill' : 'duotone'} />
            {t(link.labelKey, link.fallback)}
          </Link>
        )
      })}
    </nav>
  )
}

type Tone = 'green' | 'sky' | 'violet' | 'amber' | 'orange' | 'red' | 'slate' | 'gold'

const TONE_CLASSES: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', dot: 'bg-emerald-500' },
  sky: { pill: 'bg-sky-50 text-sky-700 ring-sky-200/70', dot: 'bg-sky-500' },
  violet: { pill: 'bg-violet-50 text-violet-700 ring-violet-200/70', dot: 'bg-violet-500' },
  amber: { pill: 'bg-amber-50 text-amber-800 ring-amber-200/70', dot: 'bg-amber-500' },
  orange: { pill: 'bg-orange-50 text-orange-700 ring-orange-200/70', dot: 'bg-orange-500' },
  red: { pill: 'bg-red-50 text-red-700 ring-red-200/70', dot: 'bg-red-500' },
  slate: { pill: 'bg-slate-50 text-slate-600 ring-slate-200/80', dot: 'bg-slate-400' },
  gold: { pill: 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))] ring-[hsl(var(--dash-accent))]/20', dot: 'bg-[hsl(var(--dash-accent))]' },
}

/** Status → colour. Live/positive states are green, in-flight blue, waiting amber, problems red, finished slate. */
const STATUS_TONES: Record<string, Tone> = {
  active: 'green', open: 'green', registered: 'green', approved: 'green', accepted: 'green', met: 'green', verified: 'green', passed: 'green',
  in_progress: 'sky', registration: 'sky', submitted: 'sky', under_review: 'sky', scheduled: 'sky', required: 'sky',
  exams: 'violet', graduated: 'violet', enrolled: 'violet', elective: 'violet',
  planned: 'amber', draft: 'amber', upcoming: 'amber', deferred: 'amber', waitlisted: 'amber', pending: 'amber', pending_review: 'amber', on_leave: 'amber',
  suspended: 'orange', dropped: 'orange', returned: 'orange', pending_approval: 'orange', maintenance: 'orange',
  withdrawn: 'red', failed: 'red', cancelled: 'red', rejected: 'red', not_met: 'red', absent: 'red', no_show: 'red',
  completed: 'slate', retired: 'slate', closed: 'slate', archived: 'slate', inactive: 'slate',
  default: 'gold',
}

export function statusTone(status?: string | null): Tone {
  return STATUS_TONES[String(status || '').toLowerCase()] || 'slate'
}

/** The dot colour of a status, for legends and bars. */
export function statusDotClass(status?: string | null): string {
  return TONE_CLASSES[statusTone(status)].dot
}

export function StatusPill({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  const key = String(status).toLowerCase()
  const tone = TONE_CLASSES[statusTone(key)]
  const live = ['active', 'open', 'in_progress', 'under_review'].includes(key)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset first-letter:uppercase',
        tone.pill,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot, live && 'animate-pulse')} aria-hidden="true" />
      {label || t(`academic.state_${key}`, key.replace(/_/g, ' '))}
    </span>
  )
}

/** A white card section with an optional icon, count, description and actions. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  icon,
  count,
  id,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  count?: number
  id?: string
}) {
  return (
    <section id={id} className={cn('dash-card scroll-mt-6 rounded-[1.25rem] p-4 sm:p-5', className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[hsl(var(--dash-ink))]">
              {title}
              {count != null ? (
                <span className="rounded-full bg-[hsl(var(--dash-ink))]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">{count}</span>
              ) : null}
            </h2>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-[hsl(var(--dash-ink))]">{value ?? '—'}</div>
      {hint ? <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{hint}</div> : null}
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
  empty?: React.ReactNode
}) {
  const rows = React.Children.toArray(children)
  return (
    <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white">
      <table className="w-full min-w-[560px] text-start text-sm">
        <thead className="bg-[hsl(var(--dash-canvas))]/70 text-[11px] text-[hsl(var(--dash-muted))]">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--dash-border))]/60 [&>tr]:transition-colors [&>tr:hover]:bg-[hsl(var(--dash-canvas))]/40">
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-10 text-center text-sm text-[hsl(var(--dash-muted))]">
                {empty || '—'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export const tdCls = 'px-3 py-2.5 align-middle text-[hsl(var(--dash-ink))]'

export function GhostButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] shadow-[0_1px_2px_hsl(220_30%_20%/0.05)] transition-all hover:-translate-y-px hover:bg-[hsl(var(--dash-canvas))] disabled:pointer-events-none disabled:opacity-50',
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
