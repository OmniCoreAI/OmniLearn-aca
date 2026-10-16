'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  BellSimple,
  BookOpen,
  Check,
  CalendarCheck,
  ChalkboardTeacher,
  Exam,
  FileX,
  GraduationCap,
  PencilSimple,
  Seal,
  UsersThree,
} from '@phosphor-icons/react'
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
  body?: string | null
  link?: string | null
  payload?: {
    role?: string
    name?: string
    kind?: string
    due_date?: string
    number?: string
    student_number?: string
    document_type?: string
    when?: string
    moved?: boolean
  } | null
  read_at?: string | null
  creation_date: string
}

const ICONS: Record<string, React.ElementType> = {
  teaching_assigned: ChalkboardTeacher,
  coordination_assigned: UsersThree,
  contributor_added: PencilSimple,
  course_assigned: BookOpen,
  grades_submitted: Exam,
  grades_returned: Exam,
  grades_approved: Seal,
  result_published: Seal,
  application_submitted: GraduationCap,
  application_accepted: GraduationCap,
  application_rejected: GraduationCap,
  application_waitlisted: GraduationCap,
  application_enrolled: GraduationCap,
  application_withdrawn: GraduationCap,
  application_document_rejected: FileX,
  application_interview: CalendarCheck,
}

/** Which area a notification comes from — shown as "Area • 2h ago". */
function category(t: TFunction, type: string): string {
  if (type.startsWith('application_')) return t('inbox.categories.admissions', 'Admissions')
  if (type.startsWith('grades_') || type === 'result_published') return t('inbox.categories.grades', 'Grades')
  if (type === 'teaching_assigned' || type === 'coordination_assigned') return t('inbox.categories.assignments', 'Assignments')
  if (type === 'course_assigned' || type === 'contributor_added') return t('inbox.categories.courses', 'Courses')
  return t('inbox.categories.general', 'General')
}

/** The message with the subject's name in bold. */
function Emphasised({ text, name }: { text: string; name?: string }) {
  if (!name || !text.includes(name)) return <>{text}</>
  const [before, ...rest] = text.split(name)
  return (
    <>
      {before}
      <strong className="font-bold text-[hsl(var(--dash-ink))]">{name}</strong>
      {rest.join(name)}
    </>
  )
}

const PREVIEW = 4

// Types whose message only needs {{name}} / {{number}} from the payload.
const SIMPLE = new Set([
  'grades_submitted',
  'grades_returned',
  'grades_approved',
  'result_published',
  'application_submitted',
  'application_accepted',
  'application_rejected',
  'application_waitlisted',
  'application_withdrawn',
])

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
    case 'application_enrolled':
      return t('inbox.application_enrolled', 'You are now a student of {{name}} (student no. {{number}})', {
        name: p.name,
        number: p.student_number,
      })
    case 'application_document_rejected':
      return t('inbox.application_document_rejected', 'Please upload a new {{document}} for {{name}}', {
        name: p.name,
        document: String(t(`academic.doc_${p.document_type}`, (p.document_type || '').replace(/_/g, ' '))),
      })
    case 'application_interview':
      return p.moved
        ? t('inbox.application_interview_moved', 'Your interview for {{name}} was moved: {{when}}', { name: p.name, when: p.when })
        : t('inbox.application_interview', 'Interview scheduled for {{name}}: {{when}}', { name: p.name, when: p.when })
    default:
      return SIMPLE.has(item.type) ? t(`inbox.${item.type}`, item.title, { name: p.name, number: p.number }) : item.title
  }
}

function ago(value: string, locale: string): string {
  const then = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(then.getTime())) return ''
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
  const [showAll, setShowAll] = useState(false)

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
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setShowAll(false)
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={label} className={cn('relative', triggerClassName)}>
          <BellSimple size={iconSize} weight={unread ? 'bold' : 'regular'} />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(43_90%_58%),hsl(39_82%_46%))] px-1 text-[10.5px] font-bold leading-none text-[hsl(220_10%_8%)] ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={12}
        collisionPadding={16}
        className="w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-[1.5rem] border-0 p-0 shadow-[0_24px_60px_-18px_hsl(220_30%_10%/0.28),0_2px_8px_-2px_hsl(220_30%_10%/0.08)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--dash-border))]/80 px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-bold text-[hsl(var(--dash-ink))]">
            {t('inbox.title', 'Notifications')}
            {unread > 0 ? (
              <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[hsl(var(--dash-muted))]">{unread}</span>
            ) : null}
          </p>
          {unread > 0 && (
            <button
              type="button"
              onClick={readAll}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-[hsl(38_80%_38%)] transition-colors hover:bg-[hsl(43_85%_94%)]"
            >
              <Check size={14} weight="bold" />
              {t('inbox.mark_all_read', 'Mark all as read')}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
              <BellSimple size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('inbox.empty', 'No notifications yet.')}</p>
          </div>
        ) : (
          <>
            <ul className="max-h-[420px] divide-y divide-[hsl(var(--dash-border))]/70 overflow-y-auto">
              {(showAll ? items : items.slice(0, PREVIEW)).map((item) => {
                const Icon = ICONS[item.type] || BellSimple
                return (
                  <li key={item.notification_uuid}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        'relative flex w-full items-start gap-3.5 px-5 py-4 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]/70',
                        !item.read_at && 'bg-[hsl(43_85%_97%)]/60'
                      )}
                    >
                      <Icon size={24} className="mt-0.5 shrink-0 text-[hsl(var(--dash-ink))]/80" />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[14px] leading-relaxed', item.read_at ? 'text-[hsl(var(--dash-ink))]/70' : 'text-[hsl(var(--dash-ink))]')}>
                          <Emphasised text={message(t, item)} name={item.payload?.name} />
                        </span>
                        {item.body && item.type !== 'application_interview' && item.type !== 'application_enrolled' ? (
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-[hsl(var(--dash-muted))]">{item.body}</span>
                        ) : null}
                        <span className="mt-1.5 block text-[12.5px] font-medium text-[hsl(var(--dash-muted))]">
                          {category(t, item.type)} • {ago(item.creation_date, i18n.language)}
                        </span>
                      </span>
                      {!item.read_at && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(41_85%_50%)]" aria-label={t('inbox.unread', 'Unread')} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {items.length > PREVIEW ? (
              <div className="p-4 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full rounded-xl bg-[hsl(43_85%_88%)] py-3 text-[14px] font-bold text-[hsl(220_10%_10%)] transition-colors hover:bg-[hsl(43_85%_82%)]"
                >
                  {showAll ? t('inbox.show_less', 'Show less') : t('inbox.show_all', 'Show all')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
