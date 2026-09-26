'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarBlank,
  Clock,
  GraduationCap,
  MapPin,
  UserCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@services/calendar/calendar'
import {
  EVENT_STYLES,
  eventEnd,
  eventHref,
  eventStart,
  formatTimeRange,
  kindLabel,
  sameDay,
  statusLabel,
} from './calendarUtils'

/** Compact row used in agenda lists and the day panel. */
export function CalendarEventRow({
  event,
  active,
  onClick,
  showDate,
}: {
  event: CalendarEvent
  active?: boolean
  onClick: () => void
  showDate?: boolean
}) {
  const { t, i18n } = useTranslation()
  const style = EVENT_STYLES[event.type]
  const Icon = style.icon
  const start = eventStart(event)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border p-2.5 text-start transition-all',
        active
          ? 'border-[hsl(var(--dash-ink))]/15 bg-[hsl(var(--dash-surface))] shadow-[0_4px_14px_hsl(0_0%_8%/0.08)]'
          : 'border-transparent bg-[hsl(var(--dash-canvas))] hover:border-[hsl(var(--dash-border))] hover:bg-[hsl(var(--dash-surface))]'
      )}
    >
      {showDate ? (
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_hsl(0_0%_8%/0.06)]">
          <span className="text-base font-semibold leading-none text-[hsl(var(--dash-ink))]">{start.getDate()}</span>
          <span className="mt-0.5 text-[9px] uppercase text-[hsl(var(--dash-muted))]">
            {start.toLocaleDateString(i18n.language, { month: 'short' })}
          </span>
        </span>
      ) : (
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: style.bg, color: style.fg }}
        >
          <Icon size={18} weight="duotone" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
          {kindLabel(t, event)}
        </span>
        <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]">{event.title}</span>
        <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
          {formatTimeRange(event, i18n.language, t)}
          {event.location ? ` · ${event.location}` : event.subtitle ? ` · ${event.subtitle}` : ''}
        </span>
      </span>
    </button>
  )
}

function DetailLine({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm text-[hsl(var(--dash-ink))]">
      <Icon size={18} className="mt-0.5 shrink-0 text-[hsl(var(--dash-muted))]" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Full detail view shown in the side panel when an event is selected. */
export function CalendarEventDetail({
  event,
  context,
  orgslug,
  onBack,
}: {
  event: CalendarEvent
  context: 'dash' | 'portal'
  orgslug: string
  onBack: () => void
}) {
  const { t, i18n } = useTranslation()
  const style = EVENT_STYLES[event.type]
  const Icon = style.icon
  const href = eventHref(event, context, orgslug)
  const start = eventStart(event)
  const end = eventEnd(event)
  const multiDay = event.end && !sameDay(start, end)
  const status = statusLabel(t, event.status)
  const longDate = (d: Date) => d.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-xs font-medium text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        {t('calendar.back_to_day', 'Back to day')}
      </button>

      <div className="rounded-2xl p-4" style={{ background: style.bg }}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
          <Icon size={16} weight="duotone" />
          {kindLabel(t, event)}
          {status && (
            <span className="ms-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] normal-case tracking-normal text-[hsl(var(--dash-ink))]">
              {status}
            </span>
          )}
        </div>
        <h3 className="mt-2 text-lg font-semibold leading-snug text-[hsl(var(--dash-ink))]">{event.title}</h3>
        {event.subtitle && <p className="mt-0.5 text-xs text-[hsl(var(--dash-ink))]/70">{event.subtitle}</p>}
      </div>

      <div className="mt-4 space-y-3.5 overflow-y-auto pe-1">
        <DetailLine icon={CalendarBlank}>
          {multiDay ? `${longDate(start)} – ${longDate(end)}` : longDate(start)}
        </DetailLine>
        {!event.all_day && (
          <DetailLine icon={Clock}>{formatTimeRange(event, i18n.language, t)}</DetailLine>
        )}
        {event.location && <DetailLine icon={MapPin}>{event.location}</DetailLine>}
        {event.instructor && (
          <DetailLine icon={UserCircle}>
            <span className="text-xs text-[hsl(var(--dash-muted))]">
              {event.type === 'program' ? t('calendar.coordinator', 'Coordinator') : t('calendar.instructor', 'Instructor')}
            </span>
            <span className="block">{event.instructor}</span>
          </DetailLine>
        )}
        {event.subtitle && event.type !== 'term' && (
          <DetailLine icon={GraduationCap}>{event.subtitle}</DetailLine>
        )}
        {event.description && (
          <p className="whitespace-pre-line rounded-xl bg-[hsl(var(--dash-canvas))] p-3 text-xs leading-relaxed text-[hsl(var(--dash-ink))]/80">
            {event.description}
          </p>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--dash-ink))] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('calendar.open', 'Open')}
          <ArrowSquareOut size={16} />
        </Link>
      )}
    </div>
  )
}
