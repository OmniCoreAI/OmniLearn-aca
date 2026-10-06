'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bell, BookOpen, ChalkboardTeacher, PencilSimple, UsersThree } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getInbox, markAllNotificationsRead, markNotificationRead } from '@services/notifications/inbox'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

type Item = {
  notification_uuid: string
  type: string
  title: string
  link?: string | null
  payload?: { role?: string; name?: string; kind?: string; due_date?: string } | null
  read_at?: string | null
  creation_date: string
}

const ICONS: Record<string, React.ElementType> = {
  teaching_assigned: ChalkboardTeacher,
  coordination_assigned: UsersThree,
  contributor_added: PencilSimple,
  course_assigned: BookOpen,
}

/** Render a notification in the viewer's language from its type + payload. */
function message(t: TFunction, item: Item): string {
  const p = item.payload || {}
  const role = p.role ? t(`inbox.roles.${p.role}`, p.role.replace(/_/g, ' ')) : ''
  switch (item.type) {
    case 'teaching_assigned':
    case 'coordination_assigned':
      return t('inbox.assigned', 'You are now {{role}} of {{name}}', { role, name: p.name })
    case 'contributor_added':
      return t('inbox.contributor_added', 'You can now edit {{name}}', { name: p.name })
    case 'course_assigned':
      return p.due_date
        ? t('inbox.course_assigned_due', 'New training assigned: {{name}} (due {{date}})', { name: p.name, date: p.due_date })
        : t('inbox.course_assigned', 'New training assigned: {{name}}', { name: p.name })
    default:
      return item.title
  }
}

function ago(value: string, locale: string): string {
  const then = new Date(value.replace(' ', 'T'))
  const minutes = Math.round((Date.now() - then.getTime()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.round(hours / 24), 'day')
}

/**
 * The notification bell: unread badge, latest notifications, mark as read.
 * `triggerClassName` lets each header style the button its own way.
 */
export default function NotificationBell({
  triggerClassName,
  iconSize = 20,
  align = 'end',
  side = 'bottom',
}: {
  triggerClassName?: string
  iconSize?: number
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string | undefined = session?.data?.tokens?.access_token
  const orgId: number | undefined = org?.id
  const [open, setOpen] = useState(false)

  const { data, mutate } = useSWR(
    token && orgId ? ['inbox', orgId] : null,
    () => getInbox(orgId!, token!),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  )
  const inbox = (data?.data ?? data) as { items: Item[]; unread: number } | undefined
  const items = inbox?.items ?? []
  const unread = inbox?.unread ?? 0

  if (!token || !orgId) return null

  const openItem = async (item: Item) => {
    setOpen(false)
    if (!item.read_at) {
      try {
        await markNotificationRead(item.notification_uuid, token)
      } finally {
        mutate()
      }
    }
    if (item.link) router.push(getUriWithOrg(org.slug, item.link))
  }

  const readAll = async () => {
    await markAllNotificationsRead(orgId, token)
    mutate()
  }

  const label = unread
    ? t('inbox.title_unread', 'Notifications ({{count}} unread)', { count: unread })
    : t('inbox.title', 'Notifications')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={label} className={cn('relative', triggerClassName)}>
          <Bell size={iconSize} weight={unread ? 'fill' : 'duotone'} />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--dash-warn))] px-1 text-[10px] font-bold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-[hsl(var(--dash-border))] px-4 py-3">
          <p className="text-sm font-semibold">{t('inbox.title', 'Notifications')}</p>
          {unread > 0 && (
            <button type="button" onClick={readAll} className="text-xs font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]">
              {t('inbox.mark_all_read', 'Mark all as read')}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[hsl(var(--dash-muted))]">
            {t('inbox.empty', 'No notifications yet.')}
          </p>
        ) : (
          <ul className="max-h-[380px] overflow-y-auto py-1">
            {items.map((item) => {
              const Icon = ICONS[item.type] || Bell
              return (
                <li key={item.notification_uuid}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
                      <Icon size={16} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] leading-snug', item.read_at ? 'text-[hsl(var(--dash-muted))]' : 'font-semibold text-[hsl(var(--dash-ink))]')}>
                        {message(t, item)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[hsl(var(--dash-muted))]">{ago(item.creation_date, i18n.language)}</span>
                    </span>
                    {!item.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--dash-accent))]" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
