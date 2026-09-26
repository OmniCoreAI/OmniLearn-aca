'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'

/* Building blocks of the learner-facing academic portal (My academics / Admissions). */

export function SignInPrompt({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] p-10 text-center">
      <p className="mb-4 text-sm text-[hsl(var(--dash-muted))]">
        {t('academic.portal_sign_in', 'Sign in to see your programs, courses and applications.')}
      </p>
      <Link href={getUriWithOrg(orgslug, '/login')} className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))]">
        {t('auth.login', 'Log in')}
      </Link>
    </div>
  )
}

export function PortalHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent))]/10 text-[hsl(var(--dash-accent))]">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[hsl(var(--dash-muted))]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
