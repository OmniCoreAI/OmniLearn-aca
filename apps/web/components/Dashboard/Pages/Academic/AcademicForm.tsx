'use client'
import React, { createContext, useContext, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* Shared form primitives for academic / instructor / CMS / administration dashboard forms. */

/** True inside a side drawer: sections render as numbered cards and the action bar shows the save shortcut. */
export const DrawerFormContext = createContext(false)

export const inputCls =
  'w-full px-3 py-2 bg-[hsl(var(--dash-surface))] border border-[hsl(var(--dash-border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30 focus:border-[hsl(var(--dash-accent))]/50 aria-[invalid=true]:border-[hsl(var(--dash-warn))]/60 aria-[invalid=true]:focus:ring-[hsl(var(--dash-warn))]/20'

/**
 * Labelled form control. `required` adds the asterisk, `hint` a helper line,
 * and `error` an inline validation message (shown instead of the hint).
 */
export function Field({
  label,
  children,
  required,
  hint,
  error,
  className,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: React.ReactNode
  error?: string | null
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-sm font-medium text-[hsl(var(--dash-ink))]">
        {label}
        {required ? (
          <span className="ms-0.5 text-[hsl(var(--dash-warn))]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[hsl(var(--dash-warn))]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-[hsl(var(--dash-muted))]">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * A titled group of fields inside a longer form ("Basic information",
 * "Professional information", …) so forms read as sections, not one flat list.
 */
export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string
  description?: string
  children: React.ReactNode
  columns?: 1 | 2 | 3
}) {
  const inDrawer = useContext(DrawerFormContext)
  const id = useId()
  const grid = (
    <div className={cn('grid grid-cols-1 gap-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>{children}</div>
  )
  if (inDrawer) {
    // Numbered with a CSS counter reset by the drawer body; `data-form-section` feeds the drawer's section chips.
    return (
      <section
        id={`section-${id.replace(/:/g, '')}`}
        data-form-section={title}
        className="scroll-mt-4 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-4 shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] [counter-increment:form-section] sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--dash-ink))] text-[11px] font-semibold text-white before:content-[counter(form-section)]"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{description}</p> : null}
          </div>
        </div>
        {grid}
      </section>
    )
  }
  return (
    <section className="space-y-4 border-t border-[hsl(var(--dash-border))] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{description}</p> : null}
      </div>
      {grid}
    </section>
  )
}

export function SubmitRow({ saving, submitLabel, disabled = false }: { saving: boolean; submitLabel?: string; disabled?: boolean }) {
  const { t } = useTranslation()
  const inDrawer = useContext(DrawerFormContext)
  // In a side drawer the save bar sticks to the bottom so it is always reachable.
  if (inDrawer) return <FormActions saving={saving} submitLabel={submitLabel} disabled={disabled} sticky />
  return (
    <div className="flex justify-end pt-2">
      <button
        type="submit"
        disabled={saving || disabled}
        className="dash-lift rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))] shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] hover:brightness-110 disabled:opacity-50"
      >
        {saving ? '…' : submitLabel || t('academic.save')}
      </button>
    </div>
  )
}

/**
 * Cancel + Save bar. `sticky` pins it to the bottom of a scrolling drawer so
 * the primary action never scrolls out of reach.
 */
export function FormActions({
  saving,
  onCancel,
  submitLabel,
  sticky = false,
  disabled = false,
}: {
  saving: boolean
  onCancel?: () => void
  submitLabel?: string
  sticky?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const inDrawer = useContext(DrawerFormContext)
  return (
    <div
      data-sticky-actions={sticky || undefined}
      className={cn(
        'z-10 flex items-center justify-end gap-2 pt-2',
        // The drawer body drops its bottom padding when this is present, so the bar sits flush with the edge.
        sticky && 'sticky bottom-0 -mx-6 mt-6 border-t border-[hsl(var(--dash-border))]/80 bg-white/95 px-6 py-3.5 backdrop-blur-md'
      )}
    >
      {inDrawer && sticky ? (
        <span className="me-auto hidden items-center gap-1.5 text-[11px] text-[hsl(var(--dash-muted))] sm:inline-flex">
          <kbd className="rounded-md border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-sans text-[10px] font-semibold">⌘/Ctrl</kbd>
          <kbd className="rounded-md border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-sans text-[10px] font-semibold">Enter</kbd>
          {t('administration.form.to_save', 'to save')}
        </span>
      ) : null}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-sm font-medium text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
        >
          {t('administration.common.cancel', 'Cancel')}
        </button>
      ) : null}
      <button
        type="submit"
        disabled={saving || disabled}
        className="rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_hsl(0_0%_8%/0.6)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? t('administration.common.saving', 'Saving…') : submitLabel || t('academic.save', 'Save')}
      </button>
    </div>
  )
}
