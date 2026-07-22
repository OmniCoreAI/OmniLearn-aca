'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { MoreVertical, Trash2, Pencil, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@components/Dashboard/Shared/DashMotion'

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
    <div className="col-span-full flex items-center justify-center py-16">
      <div className="rounded-[var(--dash-radius)] border border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-8 py-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
        {description && (
          <p className="mb-6 text-sm text-[hsl(var(--dash-muted))]">{description}</p>
        )}
        {action}
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
  const [menuOpen, setMenuOpen] = React.useState(false)
  const hasMenu = !!onEdit || !!onDelete
  const image = thumbnailUrl || '/empty_thumbnail.png'

  return (
    <div className="dash-lift group relative flex w-full flex-col overflow-hidden rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))] nice-shadow">
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
            aria-label="Program actions"
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
                    <Pencil className="h-3.5 w-3.5" /> Edit
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
                    <Trash2 className="h-3.5 w-3.5" /> Delete
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
        {thumbnailUrl ? (
          <div
            className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${image})` }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[hsl(var(--dash-accent-soft))] to-[hsl(var(--dash-canvas))]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent))]/10 text-[hsl(var(--dash-accent))]">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="px-3 text-center text-[11px] font-medium text-[hsl(var(--dash-muted))] line-clamp-1">
              {title}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
        {badges && badges.length > 0 && (
          <div className="absolute bottom-2 left-2 flex max-w-[90%] flex-wrap gap-1">
            {badges.slice(0, 3).map((b, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  b.className || 'bg-white/90 text-[hsl(var(--dash-ink))]'
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </Link>

      <div className="flex flex-col space-y-1.5 p-3">
        <Link
          href={getUriWithOrg(orgslug, href)}
          className="line-clamp-1 text-base font-bold leading-tight text-[hsl(var(--dash-ink))] transition-colors hover:text-[hsl(var(--dash-accent))]"
        >
          {title}
        </Link>
        {subtitle ? (
          <p className="min-h-[1.5rem] line-clamp-2 text-[11px] text-[hsl(var(--dash-muted))]">
            {subtitle}
          </p>
        ) : null}
        <div className="flex items-center justify-between border-t border-[hsl(var(--dash-border))] pt-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--dash-muted))]">
            {footerLabel || 'Program'}
          </span>
          <Link
            href={getUriWithOrg(orgslug, href)}
            className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-accent))]"
          >
            Open →
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
        'dash-lift inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] transition-colors hover:brightness-110',
        className
      )}
      {...props}
    />
  )
}
