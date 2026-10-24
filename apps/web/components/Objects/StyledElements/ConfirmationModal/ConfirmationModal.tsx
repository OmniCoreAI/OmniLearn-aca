'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { AlertTriangle, Info } from 'lucide-react'

type ModalParams = {
  confirmationMessage: string
  confirmationButtonText: string
  dialogTitle: string
  functionToExecute: any
  dialogTrigger?: React.ReactNode
  status?: 'warning' | 'info'
  buttonid?: string
  /** Controlled mode (e.g. opened from a row action menu) — omit to use `dialogTrigger`. */
  open?: boolean
  onOpenChange?: (_open: boolean) => void
  cancelButtonText?: string
}

const ConfirmationModal = (params: ModalParams) => {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const controlled = params.open !== undefined
  const isDialogOpen = controlled ? !!params.open : internalOpen
  const setOpen = React.useCallback(
    (open: boolean) => {
      if (controlled) params.onOpenChange?.(open)
      else setInternalOpen(open)
    },
    [controlled, params]
  )
  const isWarning = params.status === 'warning'

  const handleConfirm = React.useCallback(() => {
    params.functionToExecute()
    setOpen(false)
  }, [params, setOpen])

  return (
    <Modal
      isDialogOpen={isDialogOpen}
      onOpenChange={setOpen}
      dialogTrigger={params.dialogTrigger}
      noPadding
      customWidth="sm:max-w-[480px]"
      dialogContent={
        <div className="flex gap-4 p-6 pe-10">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isWarning
                ? 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]'
                : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
            }`}
          >
            {isWarning ? <AlertTriangle size={20} /> : <Info size={20} />}
          </span>
          <div className="min-w-0 grow">
            <div className="text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{params.dialogTitle}</div>
            <div className="mt-1 text-sm leading-relaxed text-[hsl(var(--dash-muted))]">{params.confirmationMessage}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-sm font-medium text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
              >
                {params.cancelButtonText || t('administration.common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                id={params.buttonid}
                onClick={handleConfirm}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                  isWarning ? 'bg-[hsl(var(--dash-warn))]' : 'bg-[hsl(var(--dash-ink))]'
                }`}
              >
                {params.confirmationButtonText}
              </button>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default ConfirmationModal
