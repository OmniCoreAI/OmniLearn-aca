'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { MoreVertical, Trash2, Pencil, ArrowRight, Inbox } from 'lucide-react'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { cn } from '@/lib/utils'
import { FadeIn } from '@components/Dashboard/Shared/DashMotion'
import { useTranslation } from 'react-i18next'

export function AcademicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full bg-[hsl(var(--dash-canvas))] px-4 text-[hsl(var(--dash-ink))] sm:px-10">
      <FadeIn className="mb-6 pt-6">{children}</FadeIn>
    </div>
  )
}

export function AcademicHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 mt-2 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))] sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[hsl(var(--dash-muted))]">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

export function AcademicGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

/**
 * Shimmer skeleton grid shown while a section's list is loading —
 * replaces the previous blank screen for perceived speed.
 */
export function AcademicGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))]"
        >
          <div className="dash-shimmer aspect-video w-full" />
          <div className="space-y-2 p-3">
            <div className="dash-shimmer h-4 w-3/4 rounded" />
            <div className="dash-shimmer h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AcademicEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="col-span-full flex items-center justify-center py-14">
      <div className="flex max-w-md flex-col items-center rounded-[var(--dash-radius)] border border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-10 py-12 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
          <Inbox className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[hsl(var(--dash-muted))]">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}

type Badge = { label: string; className?: string }

/**
 * Course-style academic card: aspect-video thumbnail, badges on media,
 * title/description, and hover edit/delete menu — same feel as CourseThumbnail.
 */
export function AcademicCard({
  orgslug,
  href,
  title,
  subtitle,
  badges,
  thumbnailUrl,
  footerLabel,
  onEdit,
  onDelete,
}: {
  orgslug: string
  href: string
  title: string
  subtitle?: string
  badges?: Badge[]
  thumbnailUrl?: string | null
  footerLabel?: string
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const hasMenu = !!onEdit || !!onDelete

  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-[hsl(var(--dash-surface))] shadow-[0_1px_2px_hsl(0_0%_8%/0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_hsl(0_0%_8%/0.18)]">
      {hasMenu && (
        <div
          className={cn(
            'absolute right-2 top-2 z-20 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="rounded-full bg-white/90 p-1.5 text-[hsl(var(--dash-ink))] shadow-md backdrop-blur-sm hover:bg-white"
            aria-label={t('academic.actions', 'Actions')}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] py-1 shadow-lg">
                {onEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {t('academic.edit', 'Edit')}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('academic.delete', 'Delete')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <Link
        href={getUriWithOrg(orgslug, href)}
        className="relative block aspect-video overflow-hidden bg-[hsl(var(--dash-canvas))]"
      >
        <CourseCover
          name={title}
          seed={href}
          src={thumbnailUrl}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
        {badges && badges.length > 0 && (
          <div className="absolute bottom-2.5 end-2.5 flex max-w-[85%] flex-wrap justify-end gap-1">
            {badges.map((b, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10.5px] font-semibold shadow-sm backdrop-blur',
                  b.className || 'bg-white/95 text-[hsl(var(--dash-ink))]'
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link
          href={getUriWithOrg(orgslug, href)}
          title={title}
          className="line-clamp-2 text-[15px] font-semibold leading-snug text-[hsl(var(--dash-ink))] transition-colors hover:text-[hsl(var(--dash-accent))]"
        >
          {title}
        </Link>
        <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-[hsl(var(--dash-muted))]">
          {subtitle || '\u00a0'}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-[hsl(var(--dash-border))]/60 pt-3">
          <span className="text-[11px] font-medium text-[hsl(var(--dash-muted))]">
            {footerLabel || t('academic.program', 'Program')}
          </span>
          <Link
            href={getUriWithOrg(orgslug, href)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
          >
            {t('academic.open', 'Open')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function AcademicPrimaryButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'dash-lift inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] transition-colors hover:brightness-110',
        className
      )}
      {...props}
    />
  )
}
