'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'

/* Shared form primitives for academic / instructor / CMS dashboard forms. */

export const inputCls =
  'w-full px-3 py-2 bg-[hsl(var(--dash-surface))] border border-[hsl(var(--dash-border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30 focus:border-[hsl(var(--dash-accent))]/50'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</label>
      {children}
    </div>
  )
}

export function SubmitRow({ saving }: { saving: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end pt-2">
      <button
        type="submit"
        disabled={saving}
        className="dash-lift rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] hover:brightness-110 disabled:opacity-50"
      >
        {saving ? '…' : t('academic.save')}
      </button>
    </div>
  )
}
