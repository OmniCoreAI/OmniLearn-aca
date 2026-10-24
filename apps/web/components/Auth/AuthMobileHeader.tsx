'use client'
import React from 'react'
import Link from 'next/link'
import { getOrgLogoMediaDirectory, getOrgAuthBackgroundMediaDirectory } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

interface AuthMobileHeaderProps {
  org: any
}

export default function AuthMobileHeader({ org }: AuthMobileHeaderProps) {
  const authBranding = org?.config?.config?.customization?.auth_branding || org?.config?.config?.general?.auth_branding || {}
  const {
    background_type = 'gradient',
    background_image = '',
    unsplash_photographer_name = '',
    unsplash_photographer_url = '',
    unsplash_photo_url = '',
  } = authBranding
  const UNSPLASH_UTM = '?utm_source=OmniLearn&utm_medium=referral'
  const withUtm = (url: string) => (url ? `${url}${UNSPLASH_UTM}` : '')

  const isDefaultGradient = background_type === 'gradient' || !background_image
  const hasCustomBackground = !isDefaultGradient && Boolean(background_image)

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

  return (
    <div
      className={cn(
        'relative flex items-center gap-3.5 px-5 py-4',
        isDefaultGradient && 'auth-brand-panel'
      )}
      style={getBackgroundStyle()}
    >
      {isDefaultGradient && <div aria-hidden className="auth-grid-overlay absolute inset-0 opacity-60" />}
      {hasCustomBackground && <div className="absolute inset-0 bg-[hsl(215_58%_8%/0.55)]" />}

      <Link prefetch href={getUriWithOrg(org?.slug, '/')} className="relative z-10">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-white/20">
          {org?.logo_image ? (
            <img
              src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
              alt={org.name}
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <span className="text-sm font-semibold text-[hsl(var(--auth-navy))]">
              {(org?.name?.trim()?.charAt(0) || 'O').toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      <div className="relative z-10 min-w-0">
        <p className="truncate text-base font-semibold tracking-tight text-white">{org?.name}</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/50">
          Official portal
        </p>
      </div>

      {background_type === 'unsplash' && background_image && unsplash_photographer_name && (
        <span className="relative z-10 ms-auto max-w-[45%] truncate text-end text-[10px] leading-tight text-white/70">
          Photo by{' '}
          <a
            href={withUtm(unsplash_photographer_url) || withUtm(unsplash_photo_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {unsplash_photographer_name}
          </a>{' '}
          on{' '}
          <a
            href={`https://unsplash.com/${UNSPLASH_UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Unsplash
          </a>
        </span>
      )}
    </div>
  )
}
