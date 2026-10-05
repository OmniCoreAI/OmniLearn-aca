'use client'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { AdminDrawer } from '@components/Dashboard/Pages/Administration/AdminUI'
import { cn } from '@/lib/utils'

/**
 * Postgraduate forms open in the side drawer. Same props as the old centred
 * `Modal`, so a screen switches by changing the import; `minWidth` picks the
 * drawer width.
 */
export function PostgradDrawer({
  isDialogOpen,
  onOpenChange,
  dialogTitle,
  dialogDescription,
  dialogContent,
  minWidth = 'sm',
  icon,
}: {
  isDialogOpen: boolean
  onOpenChange: (_open: boolean) => void
  dialogTitle: React.ReactNode
  dialogDescription?: string
  dialogContent: React.ReactNode
  minWidth?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}) {
  const width = minWidth === 'lg' ? 'sm:max-w-[820px]' : minWidth === 'md' ? 'sm:max-w-[680px]' : 'sm:max-w-[540px]'
  return (
    <AdminDrawer open={isDialogOpen} onOpenChange={onOpenChange} title={String(dialogTitle ?? '')} description={dialogDescription} icon={icon} width={width}>
      {isDialogOpen ? dialogContent : null}
    </AdminDrawer>
  )
}

type Tone = 'warning' | 'danger' | 'info' | 'success'

export interface ActionDialogOptions {
  title: string
  message?: React.ReactNode
  confirmText: string
  tone?: Tone
  /** Show a text box (e.g. a reason that goes into the audit trail). */
  noteLabel?: string
  notePlaceholder?: string
  noteRequired?: boolean
}

const TONES: Record<Tone, { tile: string; button: string; Icon: React.ElementType }> = {
  warning: { tile: 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]', button: 'bg-[hsl(var(--dash-warn))]', Icon: WarningCircle },
  danger: { tile: 'bg-red-50 text-red-600', button: 'bg-red-600', Icon: WarningCircle },
  info: { tile: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]', button: 'bg-[hsl(var(--dash-ink))]', Icon: Info },
  success: { tile: 'bg-emerald-50 text-emerald-600', button: 'bg-emerald-600', Icon: CheckCircle },
}

/**
 * Confirmation with an optional note — replaces `window.confirm` and
 * `window.prompt`. `await ask({...})` resolves to the note ('' without a note
 * field) when confirmed, or `null` when cancelled.
 */
export function useActionDialog() {
  const { t } = useTranslation()
  const [state, setState] = useState<ActionDialogOptions | null>(null)
  const [note, setNote] = useState('')
  const resolver = useRef<((_value: string | null) => void) | null>(null)

  const ask = useCallback(
    (opts: ActionDialogOptions) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve
        setNote('')
        setState(opts)
      }),
    []
  )
  const settle = (value: string | null) => {
    resolver.current?.(value)
    resolver.current = null
    setState(null)
  }

  const tone = TONES[state?.tone || 'info']
  const blocked = !!state?.noteLabel && !!state?.noteRequired && !note.trim()
  const dialog = (
    <Modal
      isDialogOpen={!!state}
      onOpenChange={(open) => {
        if (!open) settle(null)
      }}
      noPadding
      customWidth="sm:max-w-[500px]"
      dialogContent={
        state ? (
          <form
            className="flex gap-4 p-6 pe-10"
            onSubmit={(e) => {
              e.preventDefault()
              if (!blocked) settle(note.trim())
            }}
          >
            <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone.tile)}>
              <tone.Icon size={22} weight="duotone" />
            </span>
            <div className="min-w-0 grow">
              <div className="text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{state.title}</div>
              {state.message ? <div className="mt-1 text-sm leading-relaxed text-[hsl(var(--dash-muted))]">{state.message}</div> : null}
              {state.noteLabel ? (
                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-semibold text-[hsl(var(--dash-ink))]">
                    {state.noteLabel}
                    {state.noteRequired ? <span className="text-red-500"> *</span> : null}
                  </span>
                  <textarea
                    autoFocus
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={state.notePlaceholder}
                    className="w-full resize-none rounded-xl border border-[hsl(var(--dash-border))] bg-white px-3 py-2 text-sm focus:border-[hsl(var(--dash-ink))]/30 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-ink))]/10"
                  />
                </label>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => settle(null)}
                  className="rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-sm font-medium text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  {t('administration.common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={blocked}
                  autoFocus={!state.noteLabel}
                  className={cn('rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40', tone.button)}
                >
                  {state.confirmText}
                </button>
              </div>
            </div>
          </form>
        ) : null
      }
    />
  )
  return { ask, dialog }
}
