'use client'

import { getOrgLogoMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'

type OrgLogoProps = {
  org: {
    name?: string
    org_uuid?: string
    logo_image?: string | null
  } | null | undefined
  className?: string
  imgClassName?: string
  /** Used when there is no uploaded logo */
  fallbackClassName?: string
  alt?: string
}

/**
 * Renders the organization logo uploaded in Branding settings.
 * Falls back to an initial mark — never the old LearnHouse / OmniLearn mark.
 */
export default function OrgLogo({
  org,
  className,
  imgClassName,
  fallbackClassName,
  alt,
}: OrgLogoProps) {
  const name = org?.name?.trim() || 'Organization'
  const initial = name.charAt(0).toUpperCase() || 'O'
  const hasLogo = Boolean(org?.org_uuid && org?.logo_image)

  if (hasLogo) {
    return (
      <img
        src={getOrgLogoMediaDirectory(org!.org_uuid!, org!.logo_image!)}
        alt={alt || name}
        className={cn('object-contain rounded-lg', className, imgClassName)}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={alt || name}
      className={cn(
        'flex items-center justify-center rounded-lg bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))] font-semibold select-none',
        className,
        fallbackClassName
      )}
    >
      {initial}
    </div>
  )
}
