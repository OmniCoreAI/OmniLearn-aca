'use client'
import React, { useState } from 'react'
import { Books, Certificate, GraduationCap } from '@phosphor-icons/react'
import { getProgramThumbnailMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'

/* Shared look of a postgraduate program: colour and icon per degree level, and the cover. */

/** Cover colour and icon per degree level. */
export const LEVEL_STYLE: Record<string, { cover: string; dot: string; Icon: React.ElementType }> = {
  phd: { cover: 'linear-gradient(135deg, hsl(268 28% 28%), hsl(270 32% 10%))', dot: 'hsl(268 42% 56%)', Icon: GraduationCap },
  masters: { cover: 'linear-gradient(135deg, hsl(220 32% 25%), hsl(222 36% 9%))', dot: 'hsl(220 52% 52%)', Icon: Books },
  diploma: { cover: 'linear-gradient(135deg, hsl(172 32% 22%), hsl(178 35% 8%))', dot: 'hsl(172 45% 38%)', Icon: Certificate },
}
export const levelStyle = (level: string) => LEVEL_STYLE[level] || LEVEL_STYLE.masters

export function ProgramCover({ p, orgUuid, className, iconSize = 120, accentIcon = true }: { p: any; orgUuid?: string; className?: string; iconSize?: number; accentIcon?: boolean }) {
  const [failed, setFailed] = useState(false)
  const style = levelStyle(p.program_level)
  const src = p.thumbnail_image && orgUuid ? getProgramThumbnailMediaDirectory(orgUuid, p.program_uuid, p.thumbnail_image) : null
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: style.cover }}>
      {src && !failed ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
          />
          <style.Icon size={iconSize} weight="duotone" className="absolute -bottom-3 end-2 text-white opacity-[0.14]" aria-hidden="true" />
          {accentIcon ? (
            <style.Icon size={Math.round(iconSize * 0.36)} weight="duotone" className="absolute bottom-3 end-3 text-[hsl(43_80%_62%)]" aria-hidden="true" />
          ) : null}
        </>
      )}
    </div>
  )
}
