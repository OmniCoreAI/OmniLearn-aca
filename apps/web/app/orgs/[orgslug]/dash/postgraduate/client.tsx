'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  ArrowRight,
  Buildings,
  CalendarBlank,
  CheckCircle,
  ClockCountdown,
  Coins,
  GraduationCap as GraduationCapIcon,
  Kanban,
  ListBullets,
  NotePencil,
  PauseCircle,
  PlayCircle,
  SquaresFour,
  Student,
  Timer,
  Users,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { PostgradTabs } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { RowActionsMenu, ToolbarSearch, type DashRowAction } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AdminDrawer, PersonAvatar, useConfirm, useStoredView } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getPrograms, updateProgram, deleteProgram } from '@services/academic/academic'
import { cn } from '@/lib/utils'
import { ProgramForm } from '@components/Dashboard/Pages/Academic/ProgramForm'
import { ProgramCover, levelStyle } from '@components/Dashboard/Pages/Academic/ProgramVisuals'

const LEVELS = ['phd', 'masters', 'diploma'] as const
const STATUSES = ['active', 'draft', 'suspended', 'archived'] as const
type Status = (typeof STATUSES)[number]
type View = 'catalog' | 'board' | 'list'


const STATUS_STYLE: Record<Status, { dot: string; Icon: React.ElementType }> = {
  active: { dot: 'bg-emerald-500', Icon: PlayCircle },
  draft: { dot: 'bg-slate-400', Icon: NotePencil },
  suspended: { dot: 'bg-amber-500', Icon: PauseCircle },
  archived: { dot: 'bg-transparent ring-[1.5px] ring-inset ring-slate-400', Icon: Archive },
}
const statusOf = (p: any): Status => (STATUSES as readonly string[]).includes(p.status) ? p.status : 'draft'
const idOf = (p: any) => String(p.program_uuid).replace('program_', '')
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'
const parseDay = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null)
const todayStart = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function useProgramText() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const levelLabel = (p: any) => String(t(`academic.level_${p.program_level}`, { defaultValue: p.program_level || '' }))
  const statusLabel = (s: Status) => String(t(`academic.pstatus_${s}`, { defaultValue: s }))
  const unit = (p: any) => [p.faculty, p.department].filter(Boolean).join(' · ')
  const duration = (p: any) => {
    if (p.duration_months == null) return ''
    const base = t('postgrad.months', '{{count}} months', { count: p.duration_months })
    return p.max_duration_months ? `${base} · ${t('postgrad.max_short', 'max {{count}}', { count: p.max_duration_months })}` : base
  }
  const credits = (p: any) => (p.min_credits != null ? t('postgrad.credits', '{{count}} credits', { count: p.min_credits }) : '')
  const seats = (p: any) => (p.capacity != null ? t('training.seats', '{{count}} seats', { count: p.capacity }) : t('training.open_seats', 'Open seats'))
  const fee = (p: any) => (p.is_paid && p.price != null ? `${Number(p.price).toLocaleString(lang)} ${p.currency || ''}`.trim() : t('academic.free', 'Free'))
  const intake = (p: any) => {
    const d = parseDay(p.start_date)
    return d ? d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  }
  /** "Starts in 10 days" style countdown for an upcoming intake. */
  const countdown = (p: any) => {
    const d = parseDay(p.start_date)
    if (!d) return ''
    const days = Math.max(0, Math.round((d.getTime() - todayStart().getTime()) / 86_400_000))
    return t('postgrad.intake_in', 'Intake {{when}}', { when: new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(days, 'day') })
  }
  return { t, lang, levelLabel, statusLabel, unit, duration, credits, seats, fee, intake, countdown }
}


function StatusPill({ status, onCover = false }: { status: Status; onCover?: boolean }) {
  const { statusLabel } = useProgramText()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        onCover ? 'bg-white/95 text-[hsl(var(--dash-ink))] shadow-sm' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLE[status].dot, status === 'active' && 'animate-pulse')} />
      {statusLabel(status)}
    </span>
  )
}

/** Catalog card: level-toned cover, status, code, a 2×3 facts grid and the coordinator. */
function ProgramCard({ p, orgslug, orgUuid, actions }: { p: any; orgslug: string; orgUuid?: string; actions: DashRowAction[] }) {
  const { t, lang, levelLabel, unit, duration, credits, seats, fee } = useProgramText()
  const status = statusOf(p)
  const start = parseDay(p.start_date)
  const style = levelStyle(p.program_level)
  const href = getUriWithOrg(orgslug, `/dash/postgraduate/${idOf(p)}`)
  const coordinator = p.coordinator ? `${p.coordinator.first_name || ''} ${p.coordinator.last_name || ''}`.trim() || p.coordinator.username : ''
  const facts: { Icon: React.ElementType; text: string; strong?: boolean }[] = [
    { Icon: Buildings, text: unit(p) || t('postgrad.no_department', 'No department yet') },
    { Icon: ClockCountdown, text: duration(p) || t('postgrad.no_duration', 'Duration not set') },
    { Icon: Student, text: credits(p) || t('postgrad.no_credits', 'Credits not set') },
    { Icon: Users, text: seats(p) },
    { Icon: Coins, text: fee(p), strong: true },
  ]
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))]/70 bg-white shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(var(--dash-border))] hover:shadow-[0_20px_40px_-20px_hsl(220_30%_20%/0.4)]">
      <Link href={href} className="relative block h-36 overflow-hidden" aria-label={p.name}>
        <ProgramCover p={p} orgUuid={orgUuid} accentIcon={!start} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <div className="absolute start-3 top-3 flex items-center gap-1.5">
          <StatusPill status={status} onCover />
          {!p.published ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              <EyeOff className="h-3 w-3" /> {t('postgrad.hidden', 'Hidden')}
            </span>
          ) : null}
        </div>
        <span className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--dash-ink))] shadow-sm">
          <style.Icon size={13} weight="bold" style={{ color: style.dot }} /> {levelLabel(p)}
        </span>
        {start ? (
          <span
            className="absolute bottom-3 end-3 flex w-12 flex-col items-center overflow-hidden rounded-xl bg-white text-[hsl(var(--dash-ink))] shadow-[0_6px_16px_-6px_hsl(0_0%_0%/0.5)]"
            title={t('postgrad.intake', 'Intake')}
          >
            <span className="w-full py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white" style={{ background: style.dot }}>
              {start.toLocaleDateString(lang, { month: 'short' })}
            </span>
            <span className="py-1 text-lg font-bold leading-none tabular-nums">{start.getDate()}</span>
          </span>
        ) : null}
      </Link>
      <div className="absolute end-2 top-2 rounded-full bg-white/90 shadow-sm backdrop-blur">
        <RowActionsMenu actions={actions} label={t('administration.table.actions', 'Actions')} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug text-[hsl(var(--dash-ink))] transition-colors hover:text-[hsl(var(--dash-accent))]">
            {p.name}
          </Link>
          {p.code ? (
            <span className="mt-0.5 shrink-0 rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[hsl(var(--dash-muted))]">{p.code}</span>
          ) : null}
        </div>
        {p.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">{p.description}</p> : null}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          {facts.map(({ Icon, text, strong }, i) => (
            <div key={i} className={cn('flex min-w-0 items-center gap-1.5', i === 0 && 'col-span-2')}>
              <Icon size={14} className="shrink-0 text-[hsl(var(--dash-muted))]" />
              <span className={cn('truncate', strong ? 'font-semibold text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-ink))]/80')}>{text}</span>
            </div>
          ))}
        </dl>

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2 border-t border-[hsl(var(--dash-border))]/60 pt-3">
            {coordinator ? (
              <>
                <PersonAvatar name={coordinator} size={24} />
                <span className="min-w-0 truncate text-[12px] text-[hsl(var(--dash-ink))]/80">{coordinator}</span>
              </>
            ) : (
              <span className="text-[12px] text-[hsl(var(--dash-muted))]">{t('training.no_coordinator', 'No coordinator')}</span>
            )}
            <Link
              href={href}
              className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
            >
              {t('training.open', 'Open')}
              <ArrowRight size={13} weight="bold" className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Status overview that doubles as the status filter. */
function StatusStrip({ programs, value, onChange }: { programs: any[]; value: string; onChange: (_v: string) => void }) {
  const { t } = useProgramText()
  const count = (s: Status) => programs.filter((p) => statusOf(p) === s).length
  const byLevel = (l: string) => programs.filter((p) => p.program_level === l).length
  const published = programs.filter((p) => statusOf(p) === 'active' && p.published).length
  const segments: { key: string; label: string; count: number; hint: string; Icon: React.ElementType; live?: boolean }[] = [
    {
      key: 'all',
      label: t('training.all_programs', 'All programs'),
      count: programs.length,
      hint: t('postgrad.level_mix', '{{phd}} PhD · {{masters}} master’s · {{diploma}} diploma', { phd: byLevel('phd'), masters: byLevel('masters'), diploma: byLevel('diploma') }),
      Icon: SquaresFour,
    },
    { key: 'active', label: t('academic.pstatus_active', 'Active'), count: count('active'), hint: t('postgrad.published_count', '{{count}} visible to applicants', { count: published }), Icon: PlayCircle, live: count('active') > 0 },
    { key: 'draft', label: t('academic.pstatus_draft', 'Draft'), count: count('draft'), hint: t('postgrad.draft_hint', 'Being prepared'), Icon: NotePencil },
    { key: 'suspended', label: t('academic.pstatus_suspended', 'Suspended'), count: count('suspended'), hint: t('postgrad.suspended_hint', 'Intake paused'), Icon: PauseCircle },
    { key: 'archived', label: t('academic.pstatus_archived', 'Archived'), count: count('archived'), hint: t('postgrad.archived_hint', 'Kept for records'), Icon: Archive },
  ]
  return (
    <div className="dash-card mb-5 grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 sm:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label={t('administration.common.status', 'Status')}>
      {segments.map(({ key, label, count: n, hint, Icon, live }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-start transition-all duration-200',
              active ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_10px_24px_-12px_hsl(0_0%_8%/0.6)]' : 'hover:bg-[hsl(var(--dash-canvas))]'
            )}
          >
            <span
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                active
                  ? 'bg-white/10 text-[hsl(43_80%_62%)]'
                  : live
                    ? `${GOLD} text-[hsl(var(--dash-ink))]`
                    : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))] group-hover:bg-white group-hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              <Icon size={19} weight={active ? 'fill' : 'duotone'} />
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>{label}</span>
              <span className="block text-xl font-semibold leading-tight tabular-nums">{n}</span>
              <span className={cn('block truncate text-[10.5px]', active ? 'text-white/55' : 'text-[hsl(var(--dash-muted))]')}>{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Dark banner featuring the active program whose intake opens next. */
function Spotlight({ p, orgslug, orgUuid, onEdit }: { p: any; orgslug: string; orgUuid?: string; onEdit: () => void }) {
  const { t, levelLabel, unit, duration, seats, fee, intake, countdown } = useProgramText()
  const style = levelStyle(p.program_level)
  return (
    <section className="relative mb-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.5)] to-transparent" />
      <div className="relative grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(43_80%_64%)]">
            <Timer size={14} weight="bold" /> {t('postgrad.next_intake', 'Next intake')}
          </p>
          <h2 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{p.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <style.Icon size={15} /> {levelLabel(p)}
            </span>
            {unit(p) ? (
              <span className="inline-flex items-center gap-1.5">
                <Buildings size={15} /> {unit(p)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={15} /> {intake(p)}
            </span>
            {duration(p) ? (
              <span className="inline-flex items-center gap-1.5">
                <ClockCountdown size={15} /> {duration(p)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} /> {seats(p)}
            </span>
            <span className="font-semibold text-white">{fee(p)}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-[hsl(43_80%_64%)]">{countdown(p)}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={getUriWithOrg(orgslug, `/dash/postgraduate/${idOf(p)}`)}
              className="inline-flex items-center gap-2 rounded-full bg-[hsl(43_80%_56%)] px-5 py-2.5 text-sm font-semibold text-[hsl(0_0%_8%)] shadow-[0_8px_24px_-10px_hsl(43_80%_50%/0.7)] transition-all hover:-translate-y-0.5"
            >
              <PlayCircle size={16} weight="fill" /> {t('training.open_program', 'Open program')}
            </Link>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
            >
              <Pencil className="h-4 w-4" /> {t('administration.common.edit', 'Edit')}
            </button>
          </div>
        </div>
        <ProgramCover p={p} orgUuid={orgUuid} iconSize={96} className="hidden aspect-[4/3] rounded-2xl ring-1 ring-white/10 lg:block" />
      </div>
    </section>
  )
}

/** Draft → Active → Suspended → Archived columns. */
function BoardView({ programs, orgslug, actionsFor }: { programs: any[]; orgslug: string; actionsFor: (_p: any) => DashRowAction[] }) {
  const { t, levelLabel, statusLabel, duration, seats, fee } = useProgramText()
  const order: Status[] = ['draft', 'active', 'suspended', 'archived']
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {order.map((status) => {
        const items = programs.filter((p) => statusOf(p) === status)
        return (
          <div key={status} className="flex min-h-[200px] flex-col rounded-[1.25rem] bg-[hsl(var(--dash-ink))]/[0.03] p-2">
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
              <span className={cn('h-2 w-2 rounded-full', STATUS_STYLE[status].dot)} />
              <span className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{statusLabel(status)}</span>
              <span className="ms-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))] shadow-sm">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const style = levelStyle(p.program_level)
                return (
                  <div
                    key={p.program_uuid}
                    className={cn(
                      'group relative rounded-2xl border bg-white p-3 shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(220_30%_20%/0.35)]',
                      status === 'active' ? 'border-emerald-200' : 'border-[hsl(var(--dash-border))]/70'
                    )}
                  >
                    <div className="absolute end-1.5 top-1.5">
                      <RowActionsMenu actions={actionsFor(p)} label={t('administration.table.actions', 'Actions')} />
                    </div>
                    <Link href={getUriWithOrg(orgslug, `/dash/postgraduate/${idOf(p)}`)} className="block pe-8">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
                        <style.Icon size={13} weight="duotone" style={{ color: style.dot }} /> {levelLabel(p)}
                        {p.code ? <span className="font-mono text-[10px]">· {p.code}</span> : null}
                      </span>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[hsl(var(--dash-ink))]">{p.name}</p>
                      {duration(p) ? <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">{duration(p)}</p> : null}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[hsl(var(--dash-muted))]">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} /> {seats(p)}
                        </span>
                        <span className="font-semibold text-[hsl(var(--dash-ink))]">{fee(p)}</span>
                      </div>
                    </Link>
                  </div>
                )
              })}
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-3 py-6 text-center text-xs text-[hsl(var(--dash-muted))]">
                  {t('training.column_empty', 'Nothing here')}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProgramsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const text = useProgramText()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [view, setView] = useStoredView<View>('postgrad-programs-view', 'catalog')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [status, setStatus] = useState('all')

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })
  const all = programs as any[]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'programs', orgId] })
  const openForm = (p: any) => {
    setEditing(p)
    setDrawerOpen(true)
  }

  const handleDelete = async (p: any) => {
    const ok = await confirm({
      title: t('training.delete_title', 'Delete {{name}}?', { name: p.name }),
      message: t('postgrad.delete_hint', 'This only works while none of its cohorts has official results or admission decisions. Otherwise, archive it to keep the records.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteProgram(p.program_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }
  const update = async (p: any, patch: Record<string, unknown>, ok: string) => {
    try {
      await updateProgram(p.program_uuid, patch, access_token)
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }
  const actionsFor = (p: any): DashRowAction[] => {
    const s = statusOf(p)
    const actions: DashRowAction[] = [
      { label: t('training.open_program', 'Open program'), icon: <Eye className="h-3.5 w-3.5" />, href: getUriWithOrg(orgslug, `/dash/postgraduate/${idOf(p)}`) },
      { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(p) },
    ]
    if (s !== 'active') actions.push({ label: t('postgrad.activate', 'Activate'), icon: <PlayCircle size={14} />, onSelect: () => update(p, { status: 'active' }, t('administration.common.updated', 'Saved')) })
    if (s === 'active') actions.push({ label: t('postgrad.suspend', 'Suspend intake'), icon: <PauseCircle size={14} />, onSelect: () => update(p, { status: 'suspended' }, t('administration.common.updated', 'Saved')) })
    if (s !== 'archived') actions.push({ label: t('postgrad.archive', 'Archive'), icon: <Archive size={14} />, onSelect: () => update(p, { status: 'archived' }, t('administration.common.updated', 'Saved')) })
    actions.push({
      label: p.published ? t('training.unpublish', 'Unpublish') : t('training.publish', 'Publish'),
      icon: p.published ? <EyeOff className="h-3.5 w-3.5" /> : <CheckCircle size={14} />,
      onSelect: () => update(p, { published: !p.published, public: !p.published }, p.published ? t('postgrad.now_hidden', 'Hidden from applicants') : t('training.published_toast', 'Published')),
    })
    actions.push({ label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger', onSelect: () => handleDelete(p) })
    return actions
  }

  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of all) counts.set(p.program_level, (counts.get(p.program_level) || 0) + 1)
    return counts
  }, [all])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (p) =>
        (level === 'all' || p.program_level === level) &&
        (status === 'all' || statusOf(p) === status) &&
        (!q || `${p.name} ${p.code || ''} ${p.faculty || ''} ${p.department || ''}`.toLowerCase().includes(q))
    )
  }, [all, query, level, status])
  const filtering = !!query || level !== 'all' || status !== 'all'
  const today = todayStart()
  const spotlight = all
    .filter((p) => statusOf(p) === 'active' && (parseDay(p.start_date)?.getTime() ?? -1) >= today.getTime())
    .sort((a, b) => parseDay(a.start_date)!.getTime() - parseDay(b.start_date)!.getTime())[0]
  const sections: Status[] = ['active', 'draft', 'suspended', 'archived']
  const grid = (items: any[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((p) => (
        <ProgramCard key={p.program_uuid} p={p} orgslug={orgslug} orgUuid={org?.org_uuid} actions={actionsFor(p)} />
      ))}
    </div>
  )

  const createButton = (
    <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="programs" orgId={orgId!}>
      <AcademicPrimaryButton onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" /> {t('academic.new_program')}
      </AcademicPrimaryButton>
    </AuthenticatedClientElement>
  )
  const empty = (
    <div className="dash-card rounded-[1.25rem] px-6 py-14">
      <AcademicEmptyState
        compact
        icon={<GraduationCapIcon size={24} />}
        title={filtering ? t('administration.common.no_matches', 'No matches') : t('academic.no_programs')}
        description={filtering ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.') : t('academic.no_programs_desc')}
        action={filtering ? undefined : createButton}
      />
    </div>
  )
  const viewOptions: { key: View; label: string; Icon: React.ElementType }[] = [
    { key: 'catalog', label: t('training.view_catalog', 'Catalog'), Icon: SquaresFour },
    { key: 'board', label: t('training.view_board', 'Board'), Icon: Kanban },
    { key: 'list', label: t('postgrad.view_list', 'List'), Icon: ListBullets },
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs items={[{ label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> }]} />
      <AcademicHeader
        title={t('academic.postgraduate_studies')}
        subtitle={t('postgrad.subtitle', 'PhD, master’s and diploma programs — structure, intake, fees and coordination.')}
        action={createButton}
      />
      <PostgradTabs orgslug={orgslug} />

      <StatusStrip programs={all} value={status} onChange={setStatus} />

      {view === 'catalog' && spotlight && !filtering ? (
        <Spotlight p={spotlight} orgslug={orgslug} orgUuid={org?.org_uuid} onEdit={() => openForm(spotlight)} />
      ) : null}

      {/* Toolbar */}
      <div className="dash-card mb-5 space-y-3 rounded-[1.25rem] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch value={query} onChange={setQuery} placeholder={t('postgrad.search', 'Search by name, code, faculty or department')} className="min-w-[220px] flex-1 sm:max-w-md" />
          <div className={cn(TAB_TRACK, 'ms-auto p-0.5 shadow-none')} role="tablist" aria-label={t('administration.common.view', 'View')}>
            {viewOptions.map(({ key, label, Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={tabItemClass(view === key, 'inline-flex items-center gap-1.5 px-3 py-1 text-xs')}>
                <Icon size={14} weight={view === key ? 'fill' : 'regular'} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ key: 'all', count: all.length }, ...LEVELS.filter((l) => levelCounts.has(l)).map((l) => ({ key: l, count: levelCounts.get(l)! }))].map(({ key, count }) => {
            const active = level === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  active
                    ? 'bg-[hsl(var(--dash-ink))] text-white'
                    : 'border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-ink))]/75 hover:-translate-y-0.5 hover:text-[hsl(var(--dash-ink))]'
                )}
              >
                {key === 'all' ? (
                  <SquaresFour size={13} weight={active ? 'fill' : 'duotone'} />
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ background: levelStyle(key).dot }} aria-hidden="true" />
                )}
                {key === 'all' ? t('postgrad.all_levels', 'All levels') : t(`academic.level_${key}`)}
                <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-72 rounded-[1.25rem]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        empty
      ) : view === 'board' ? (
        <BoardView programs={visible} orgslug={orgslug} actionsFor={actionsFor} />
      ) : view === 'list' ? (
        <DashDataTable
          rows={visible}
          rowKey={(p: any) => p.program_uuid}
          rowHref={(p: any) => getUriWithOrg(orgslug, `/dash/postgraduate/${idOf(p)}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          itemLabel={(n) => t('postgrad.programs_count', '{{count}} programs', { count: n })}
          actions={actionsFor}
          columns={[
            {
              key: 'name',
              header: t('training.program', 'Program'),
              primary: true,
              sortValue: (p: any) => p.name,
              cell: (p: any) => {
                const style = levelStyle(p.program_level)
                return (
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[hsl(43_80%_62%)]" style={{ background: style.cover }}>
                      <style.Icon size={17} weight="duotone" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                        <span className="font-mono">{p.code}</span>
                        {text.unit(p) ? ` · ${text.unit(p)}` : ''}
                      </div>
                    </div>
                  </div>
                )
              },
            },
            { key: 'level', header: t('academic.level', 'Level'), sortValue: (p: any) => p.program_level, cell: (p: any) => <span className="whitespace-nowrap text-[13px]">{text.levelLabel(p)}</span> },
            { key: 'status', header: t('administration.common.status', 'Status'), sortValue: (p: any) => statusOf(p), cell: (p: any) => <StatusPill status={statusOf(p)} /> },
            {
              key: 'duration',
              header: t('postgrad.duration', 'Duration'),
              hideBelow: 'lg',
              hideOnMobile: true,
              sortValue: (p: any) => p.duration_months ?? -1,
              cell: (p: any) => <span className="whitespace-nowrap text-[13px]">{text.duration(p) || '—'}</span>,
            },
            { key: 'seats', header: t('academic.capacity', 'Capacity'), align: 'end', sortValue: (p: any) => p.capacity ?? -1, cell: (p: any) => <span className="tabular-nums">{p.capacity ?? '—'}</span> },
            { key: 'fee', header: t('postgrad.fee', 'Fee'), align: 'end', sortValue: (p: any) => (p.is_paid ? p.price ?? 0 : 0), cell: (p: any) => <span className="whitespace-nowrap font-medium">{text.fee(p)}</span> },
          ]}
        />
      ) : status !== 'all' ? (
        grid(visible)
      ) : (
        <div className="space-y-8">
          {sections.map((key) => {
            const items = visible.filter((p) => statusOf(p) === key)
            if (!items.length) return null
            return (
              <section key={key}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[hsl(var(--dash-ink))]">
                  <span className={cn('h-2 w-2 rounded-full', STATUS_STYLE[key].dot, key === 'active' && 'animate-pulse')} />
                  {text.statusLabel(key)}
                  <span className="rounded-full bg-[hsl(var(--dash-ink))]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">{items.length}</span>
                </h2>
                {grid(items)}
              </section>
            )
          })}
        </div>
      )}

      <AdminDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        width="sm:max-w-[680px]"
        icon={<GraduationCapIcon size={20} weight="duotone" />}
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('academic.create_program')}
        description={t('postgrad.form_desc', 'Define the degree, its structure and intake, then activate and publish it when applications open.')}
      >
        {drawerOpen ? (
          <ProgramForm
            key={editing?.program_uuid || 'new'}
            orgId={orgId!}
            orgUuid={org?.org_uuid}
            access_token={access_token}
            program={editing}
            onCancel={() => setDrawerOpen(false)}
            onDone={() => {
              setDrawerOpen(false)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </AcademicPageShell>
  )
}


export default ProgramsHome
