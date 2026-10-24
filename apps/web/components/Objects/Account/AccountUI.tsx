'use client'
import React from 'react'

/** White section card used across the settings form. */
export function SettingsCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[1.25rem] border border-[hsl(var(--dash-border))]/70 bg-white p-5 shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
            {icon}
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
