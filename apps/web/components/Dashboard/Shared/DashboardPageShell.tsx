'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface DashboardPageShellProps {
  title: string
  description?: string
  actions?: React.ReactNode
  tabs?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Soft Academic Workspace page chrome — title, optional subtitle,
 * one primary action group, optional tabs, then content.
 */
export default function DashboardPageShell({
  title,
  description,
  actions,
  tabs,
  children,
  className,
  contentClassName,
}: DashboardPageShellProps) {
  return (
    <div
      className={cn(
        'min-h-full w-full bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]',
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-8 sm:px-10">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))] sm:text-[1.75rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-[hsl(var(--dash-muted))]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>

        {tabs ? <div className="mb-6">{tabs}</div> : null}

        <div className={cn('space-y-6', contentClassName)}>{children}</div>
      </div>
    </div>
  )
}

export function DashPrimaryButton({
  className,
  ...props
}: React.ComponentProps<'a'> & { href: string }) {
  return (
    <a
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--dash-accent))] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[hsl(170_78%_20%)]',
        className
      )}
      {...props}
    />
  )
}

export function DashSecondaryButton({
  className,
  ...props
}: React.ComponentProps<'a'> & { href: string }) {
  return (
    <a
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3.5 py-2 text-xs font-medium text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-accent-soft))]',
        className
      )}
      {...props}
    />
  )
}
