'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ProhibitInset } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { ModuleKey, useModules } from '@/lib/modules'

/**
 * Renders its children only while `module` is switched on in the `.env` file.
 * Used on learner-portal pages, which have no sidebar route guard.
 */
export default function ModuleGate({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { isModuleEnabled } = useModules()

  if (isModuleEnabled(module)) return <>{children}</>

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <ProhibitInset size={36} weight="duotone" className="text-neutral-400" />
      <h1 className="text-lg font-semibold text-neutral-900">{t('modules.disabled_title', 'This section is turned off')}</h1>
      <p className="text-sm text-neutral-500">{t('modules.disabled_body', 'It is not available on this platform right now.')}</p>
      <Link href={getUriWithOrg(org?.slug, '/')} className="mt-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
        {t('modules.back_home', 'Back to home')}
      </Link>
    </div>
  )
}
