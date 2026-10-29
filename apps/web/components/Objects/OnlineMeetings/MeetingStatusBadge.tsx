'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { MeetingStatus } from '@services/integrations/zoom'
import { STATUS_STYLE } from './meetingUtils'

export function MeetingStatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        STATUS_STYLE[status],
        className
      )}
    >
      {status === 'live' && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
        </span>
      )}
      {t(`online_meetings.status.${status}`)}
    </span>
  )
}
