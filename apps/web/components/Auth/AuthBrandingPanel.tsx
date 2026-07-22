'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Landmark, LockKeyhole } from 'lucide-react'
import { getOrgLogoMediaDirectory, getOrgAuthBackgroundMediaDirectory } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface AuthBrandingPanelProps {
  org: any
  welcomeText?: string
}

export default function AuthBrandingPanel({ org, welcomeText }: AuthBrandingPanelProps) {
  const { t } = useTranslation()
  const [logoFailed, setLogoFailed] = useState(false)
  const authBranding = org?.config?.config?.customization?.auth_branding || org?.config?.config?.general?.auth_branding || {}
  const {
    welcome_message = '',
    background_type = 'gradient',
    background_image = '',
    text_color = 'light',
    unsplash_photographer_name = '',
    unsplash_photographer_url = '',
    unsplash_photo_url = '',
  } = authBranding
  const UNSPLASH_UTM = '?utm_source=OmniLearn&utm_medium=referral'
  const withUtm = (url: string) => (url ? `${url}${UNSPLASH_UTM}` : '')

  const isDefaultGradient = background_type === 'gradient' || !background_image
  const hasCustomBackground = !isDefaultGradient && Boolean(background_image)
  const showLogo = Boolean(org?.org_uuid && org?.logo_image) && !logoFailed
  const initial = (org?.name?.trim()?.charAt(0) || 'O').toUpperCase()

  const getBackgroundStyle = (): React.CSSProperties => {
    if (isDefaultGradient) return {}
    if (background_type === 'custom' && background_image) {
      return {
        backgroundImage: `url(${getOrgAuthBackgroundMediaDirectory(org?.org_uuid, background_image)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    if (background_type === 'unsplash' && background_image) {
      return {
        backgroundImage: `url(${background_image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return {}
  }

  const displayMessage =
    welcome_message ||
    welcomeText ||
    t('auth.institutional_tagline', 'Secure learning portal for authorized personnel')

  const lightText = text_color === 'light' || isDefaultGradient

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden',
        isDefaultGradient && 'auth-brand-panel'
      )}
      style={getBackgroundStyle()}
    >
      {isDefaultGradient && (
        <>
          <div aria-hidden className="auth-flag-stripes absolute inset-y-0 start-0 w-2.5" />
          <div aria-hidden className="auth-orb -start-16 top-10 h-56 w-56 bg-[hsl(var(--auth-gold)/0.22)]" />
          <div aria-hidden className="auth-orb -end-10 bottom-20 h-72 w-72 bg-[hsl(var(--auth-flag-red)/0.16)]" />
          <div aria-hidden className="auth-grid-overlay absolute inset-0" />
          <div aria-hidden className="auth-scanline absolute inset-0 opacity-80" />
          <div aria-hidden className="pointer-events-none absolute inset-8 border border-[hsl(var(--auth-gold)/0.18)]" />
          <div aria-hidden className="pointer-events-none absolute start-8 top-8 h-5 w-5 border-s-2 border-t-2 border-[hsl(var(--auth-gold)/0.7)]" />
          <div aria-hidden className="pointer-events-none absolute end-8 top-8 h-5 w-5 border-e-2 border-t-2 border-[hsl(var(--auth-gold)/0.7)]" />
          <div aria-hidden className="pointer-events-none absolute bottom-8 start-8 h-5 w-5 border-b-2 border-s-2 border-[hsl(var(--auth-gold)/0.7)]" />
          <div aria-hidden className="pointer-events-none absolute bottom-8 end-8 h-5 w-5 border-b-2 border-e-2 border-[hsl(var(--auth-gold)/0.7)]" />
        </>
      )}

      {hasCustomBackground && <div className="absolute inset-0 bg-[hsl(0_0%_0%/0.55)]" />}

      <div className="relative z-10 flex h-full flex-col p-10 xl:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 ring-1 ring-inset ring-[hsl(var(--auth-gold)/0.35)]">
            <Landmark className="h-4 w-4 text-[hsl(var(--auth-gold))]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', lightText ? 'text-white/55' : 'text-gray-600')}>
              {t('auth.official_portal', 'Official Learning Portal')}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Link prefetch href={getUriWithOrg(org?.slug, '/')} className="group">
            <div className="relative mx-auto mb-8">
              <div
                aria-hidden
                className="absolute -inset-5 rounded-[1.75rem] bg-[hsl(var(--auth-gold)/0.18)] blur-xl transition-opacity group-hover:opacity-100"
              />
              <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white shadow-[0_16px_48px_hsl(0_0%_0%/0.45)] ring-2 ring-[hsl(var(--auth-gold)/0.5)] sm:h-44 sm:w-44">
                {showLogo ? (
                  <img
                    src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
                    alt={org.name}
                    className="h-full w-full object-contain p-4"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="text-5xl font-semibold tracking-tight text-[hsl(var(--auth-navy))]">
                    {initial}
                  </span>
                )}
              </div>
            </div>
          </Link>

          <div className={cn('max-w-md space-y-3', lightText ? 'text-white' : 'text-gray-900')}>
            <h1 className="text-3xl font-semibold tracking-tight xl:text-[2.15rem] xl:leading-tight">
              {org?.name}
            </h1>
            {displayMessage && (
              <p className={cn('mx-auto max-w-sm text-base leading-relaxed', lightText ? 'text-white/70' : 'text-gray-600')}>
                {displayMessage}
              </p>
            )}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
            <TrustChip icon={<ShieldCheck className="h-3.5 w-3.5" />} label={t('auth.trust_secure', 'Secure access')} light={lightText} />
            <TrustChip icon={<LockKeyhole className="h-3.5 w-3.5" />} label={t('auth.trust_authorized', 'Authorized users only')} light={lightText} />
          </div>
        </div>

        <div className={cn('flex items-center justify-between gap-4 text-[11px]', lightText ? 'text-white/45' : 'text-gray-500')}>
          <span className="tracking-wide">{t('auth.footer_rights', 'Restricted institutional system')}</span>
          <span className="hidden h-px flex-1 bg-current/20 sm:block" />
          <span className="font-mono tracking-wider opacity-80">TLS · SSO ready</span>
        </div>

        {background_type === 'unsplash' && background_image && unsplash_photographer_name && (
          <div className={cn('absolute bottom-3 start-4 end-4 z-10 text-[11px] leading-tight', lightText ? 'text-white/70' : 'text-gray-700')}>
            Photo by{' '}
            <a
              href={withUtm(unsplash_photographer_url) || withUtm(unsplash_photo_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline opacity-90 hover:opacity-100"
            >
              {unsplash_photographer_name}
            </a>{' '}
            on{' '}
            <a
              href={`https://unsplash.com/${UNSPLASH_UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline opacity-90 hover:opacity-100"
            >
              Unsplash
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function TrustChip({
  icon,
  label,
  light,
}: {
  icon: React.ReactNode
  label: string
  light: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium tracking-wide ring-1 ring-inset',
        light
          ? 'bg-white/[0.06] text-white/80 ring-[hsl(var(--auth-gold)/0.25)]'
          : 'bg-black/[0.04] text-gray-700 ring-black/10'
      )}
    >
      <span className={light ? 'text-[hsl(var(--auth-gold))]' : 'text-[hsl(var(--auth-focus))]'}>{icon}</span>
      {label}
    </span>
  )
}
