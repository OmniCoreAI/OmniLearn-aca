'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Award, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  CalendarBlank,
  CalendarCheck,
  CalendarPlus,
  Coins,
  EyeSlash,
  Certificate,
  ChartBarHorizontal,
  CheckCircle,
  Confetti,
  GraduationCap,
  Kanban,
  Lightning,
  MapPin,
  MicrophoneStage,
  PlayCircle,
  PresentationChart,
  SquaresFour,
  Timer,
  Toolbox,
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
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { RowActionsMenu, ToolbarSearch, type DashRowAction } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AdminDrawer, CurrencySelect, PersonAvatar, useConfirm, useFinanceDefaults, useStoredView } from '@components/Dashboard/Pages/Administration/AdminUI'
import { Switch } from '@components/ui/switch'
import { getTrainingPrograms, createTrainingProgram, updateTrainingProgram, deleteTrainingProgram } from '@services/academic/academic'
import { getTrainingProgramThumbnailMediaDirectory } from '@services/media/media'
import { FacilitySelect } from '@components/Dashboard/Pages/Administration/Pickers'
import { cn } from '@/lib/utils'

const TYPES = ['training_course', 'workshop', 'event', 'bootcamp', 'conference', 'seminar', 'certification_program']

const TYPE_ICONS: Record<string, React.ElementType> = {
  training_course: GraduationCap,
  workshop: Toolbox,
  event: Confetti,
  bootcamp: Lightning,
  conference: MicrophoneStage,
  seminar: PresentationChart,
  certification_program: Certificate,
}

/** Cover colour per program type: rich, dark tones that carry white text and the gold accents. */
const TYPE_TONES: Record<string, { cover: string; dot: string }> = {
  training_course: { cover: 'linear-gradient(135deg, hsl(220 30% 22%), hsl(222 35% 9%))', dot: 'hsl(220 45% 45%)' },
  workshop: { cover: 'linear-gradient(135deg, hsl(32 45% 27%), hsl(28 40% 10%))', dot: 'hsl(32 60% 45%)' },
  event: { cover: 'linear-gradient(135deg, hsl(350 45% 29%), hsl(348 40% 11%))', dot: 'hsl(350 55% 48%)' },
  bootcamp: { cover: 'linear-gradient(135deg, hsl(172 32% 21%), hsl(178 35% 8%))', dot: 'hsl(172 45% 36%)' },
  conference: { cover: 'linear-gradient(135deg, hsl(262 25% 27%), hsl(265 30% 10%))', dot: 'hsl(262 35% 52%)' },
  seminar: { cover: 'linear-gradient(135deg, hsl(200 30% 23%), hsl(205 35% 9%))', dot: 'hsl(200 45% 42%)' },
  certification_program: { cover: 'linear-gradient(135deg, hsl(43 45% 27%), hsl(38 40% 10%))', dot: 'hsl(43 70% 48%)' },
}
const toneOf = (type: string) => TYPE_TONES[type] || TYPE_TONES.training_course

type Phase = 'running' | 'upcoming' | 'finished' | 'unscheduled'
type Column = 'draft' | 'upcoming' | 'running' | 'done'
type View = 'catalog' | 'timeline' | 'board'

const DAY = 86_400_000
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

/** "YYYY-MM-DD" → local midnight (no timezone shift). */
function parseDay(value?: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
function rangeOf(p: any): { start: Date; end: Date } | null {
  const start = parseDay(p.start_date)
  if (!start) return null
  const end = parseDay(p.end_date) || start
  return { start, end: end < start ? start : end }
}
function phaseOf(p: any, today: Date): Phase {
  const range = rangeOf(p)
  if (!range) return 'unscheduled'
  if (today < range.start) return 'upcoming'
  if (today > range.end) return 'finished'
  return 'running'
}
function columnOf(p: any, today: Date): Column {
  if (!p.published) return 'draft'
  const phase = phaseOf(p, today)
  return phase === 'running' ? 'running' : phase === 'finished' ? 'done' : 'upcoming'
}
const idOf = (p: any) => String(p.trainingprogram_uuid).replace('trainingprogram_', '')

function useProgramText() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const today = todayStart()
  const fmt = (d: Date, withYear = false) =>
    new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })

  const dates = (p: any) => {
    const range = rangeOf(p)
    if (!range) return t('training.no_dates', 'No dates yet')
    const differentYear = range.start.getFullYear() !== today.getFullYear()
    if (range.start.getTime() === range.end.getTime()) return fmt(range.start, differentYear)
    return `${fmt(range.start)} – ${fmt(range.end, differentYear || range.end.getFullYear() !== today.getFullYear())}`
  }
  /** Where the program is on its calendar, in words, plus a 0–100 progress while it runs. */
  const progress = (p: any): { label: string; pct: number | null } => {
    const range = rangeOf(p)
    if (!range) return { label: t('training.not_scheduled', 'Not scheduled yet'), pct: null }
    const phase = phaseOf(p, today)
    if (phase === 'upcoming') {
      const days = Math.round((range.start.getTime() - today.getTime()) / DAY)
      const text = rtf.format(days, 'day')
      return { label: t('training.starts_in', 'Starts {{when}}', { when: text }), pct: null }
    }
    if (phase === 'finished') return { label: t('training.ended_on', 'Ended {{date}}', { date: fmt(range.end) }), pct: 100 }
    const total = Math.round((range.end.getTime() - range.start.getTime()) / DAY) + 1
    const day = Math.round((today.getTime() - range.start.getTime()) / DAY) + 1
    return { label: t('training.day_of', 'Day {{day}} of {{total}}', { day, total }), pct: Math.round((day / total) * 100) }
  }
  const venue = (p: any) => p.facility?.name || p.location || ''
  const seats = (p: any) => (p.capacity != null ? t('training.seats', '{{count}} seats', { count: p.capacity }) : t('training.open_seats', 'Open seats'))
  const price = (p: any) =>
    p.is_paid && p.price != null ? `${Number(p.price).toLocaleString(lang)} ${p.currency || ''}`.trim() : t('academic.free', 'Free')
  const typeLabel = (p: any) => String(t(`academic.type_${p.training_type}`, { defaultValue: p.training_type || '' }))
  const phaseLabel = (phase: Phase) =>
    ({
      running: t('training.phase_running', 'Running'),
      upcoming: t('training.phase_upcoming', 'Upcoming'),
      finished: t('training.phase_finished', 'Finished'),
      unscheduled: t('training.phase_unscheduled', 'Not scheduled'),
    })[phase]
  return { t, today, dates, progress, venue, seats, price, typeLabel, phaseLabel }
}

/** Cover image, or a dark cover with the program type's icon. */
function ProgramCover({
  p,
  orgUuid,
  className,
  iconSize = 40,
  accentIcon = true,
}: {
  p: any
  orgUuid?: string
  className?: string
  iconSize?: number
  /** Small gold type icon in the corner (off when something else sits there). */
  accentIcon?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const Icon = TYPE_ICONS[p.training_type] || Certificate
  const src = p.thumbnail_image && orgUuid ? getTrainingProgramThumbnailMediaDirectory(orgUuid, p.trainingprogram_uuid, p.thumbnail_image) : null
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: toneOf(p.training_type).cover }}>
      {src && !failed ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
          />
          <Icon size={iconSize} weight="duotone" className="absolute -bottom-3 end-2 text-white opacity-[0.14]" aria-hidden="true" />
          {accentIcon ? <Icon size={Math.round(iconSize * 0.42)} weight="duotone" className="absolute bottom-3 end-3 text-[hsl(43_80%_62%)]" aria-hidden="true" /> : null}
        </>
      )}
    </div>
  )
}

function PhaseBadge({ phase, draft }: { phase: Phase; draft: boolean }) {
  const { phaseLabel, t } = useProgramText()
  if (draft) {
    return <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-muted))] shadow-sm">{t('academic.draft', 'Draft')}</span>
  }
  const tone =
    phase === 'running'
      ? `${GOLD} text-[hsl(var(--dash-ink))]`
      : phase === 'upcoming'
        ? 'bg-white/95 text-[hsl(var(--dash-ink))]'
        : 'bg-white/80 text-[hsl(var(--dash-muted))]'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm', tone)}>
      {phase === 'running' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--dash-ink))]" /> : null}
      {phaseLabel(phase)}
    </span>
  )
}

/** Catalog card: toned cover with a date tile, status line, a 2×2 info grid and the coordinator. */
function ProgramCard({
  p,
  orgslug,
  orgUuid,
  actions,
  onEdit,
}: {
  p: any
  orgslug: string
  orgUuid?: string
  actions: DashRowAction[]
  onEdit: () => void
}) {
  const { i18n } = useTranslation()
  const { today, dates, progress, venue, seats, price, typeLabel, t } = useProgramText()
  const phase = phaseOf(p, today)
  const prog = progress(p)
  const range = rangeOf(p)
  const href = getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)
  const Icon = TYPE_ICONS[p.training_type] || Certificate
  const coordinator = p.coordinator ? `${p.coordinator.first_name || ''} ${p.coordinator.last_name || ''}`.trim() || p.coordinator.username : ''
  const info: { Icon: React.ElementType; text: string; muted?: boolean }[] = [
    { Icon: CalendarBlank, text: dates(p), muted: !range },
    { Icon: MapPin, text: venue(p) || t('training.no_venue', 'No venue yet'), muted: !venue(p) },
    { Icon: Users, text: seats(p) },
    { Icon: Coins, text: price(p) },
  ]
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))]/70 bg-white shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(var(--dash-border))] hover:shadow-[0_20px_40px_-20px_hsl(220_30%_20%/0.4)]">
      <Link href={href} className="relative block h-36 overflow-hidden" aria-label={p.name}>
        <ProgramCover p={p} orgUuid={orgUuid} iconSize={120} accentIcon={!range} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <div className="absolute start-3 top-3">
          <PhaseBadge phase={phase} draft={!p.published} />
        </div>
        <span className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--dash-ink))] shadow-sm">
          <Icon size={13} weight="bold" style={{ color: toneOf(p.training_type).dot }} /> {typeLabel(p)}
        </span>
        {range ? (
          <span className="absolute bottom-3 end-3 flex w-12 flex-col items-center overflow-hidden rounded-xl bg-white text-[hsl(var(--dash-ink))] shadow-[0_6px_16px_-6px_hsl(0_0%_0%/0.5)]">
            <span className="w-full py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white" style={{ background: toneOf(p.training_type).dot }}>
              {range.start.toLocaleDateString(i18n.language, { month: 'short' })}
            </span>
            <span className="py-1 text-lg font-bold leading-none tabular-nums">{range.start.getDate()}</span>
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

        {/* Where the program is on its calendar */}
        <div className="mt-2.5">
          {phase === 'running' && prog.pct != null ? (
            <>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-[hsl(var(--dash-accent))]">{prog.label}</span>
                <span className="tabular-nums text-[hsl(var(--dash-ink))]">{prog.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                <div className={cn('h-full rounded-full transition-[width] duration-700', GOLD)} style={{ width: `${prog.pct}%` }} />
              </div>
            </>
          ) : phase === 'unscheduled' ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              <CalendarPlus size={13} weight="bold" /> {t('training.add_dates', 'Add dates')}
            </button>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                phase === 'upcoming' ? 'bg-[hsl(var(--dash-ink))]/[0.06] text-[hsl(var(--dash-ink))]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
              )}
            >
              {phase === 'upcoming' ? <Timer size={13} weight="bold" /> : <CheckCircle size={13} weight="bold" />}
              {prog.label}
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          {info.map(({ Icon: InfoIcon, text, muted }, i) => (
            <div key={i} className="flex min-w-0 items-center gap-1.5">
              <InfoIcon size={14} className="shrink-0 text-[hsl(var(--dash-muted))]" />
              <span className={cn('truncate', muted ? 'text-[hsl(var(--dash-muted))]' : i === 3 ? 'font-semibold text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-ink))]/80')}>{text}</span>
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
  const { today, t } = useProgramText()
  const { i18n } = useTranslation()
  const rtf = new Intl.RelativeTimeFormat(i18n.language || 'en', { numeric: 'auto' })
  const byPhase = (phase: Phase) => programs.filter((p) => phaseOf(p, today) === phase)
  const running = byPhase('running')
  const upcoming = byPhase('upcoming').sort((a, b) => rangeOf(a)!.start.getTime() - rangeOf(b)!.start.getTime())
  const drafts = programs.filter((p) => !p.published)
  const paid = programs.filter((p) => p.is_paid).length
  const nextIn = upcoming[0] ? rtf.format(Math.round((rangeOf(upcoming[0])!.start.getTime() - today.getTime()) / DAY), 'day') : ''
  const segments: { key: string; label: string; count: number; hint: string; Icon: React.ElementType; live?: boolean }[] = [
    { key: 'all', label: t('training.all_programs', 'All programs'), count: programs.length, hint: t('training.free_paid', '{{free}} free · {{paid}} paid', { free: programs.length - paid, paid }), Icon: SquaresFour },
    { key: 'running', label: t('training.section_running', 'Running now'), count: running.length, hint: running.length ? t('training.in_session', 'In session today') : t('training.nothing_running', 'Nothing running'), Icon: PlayCircle, live: running.length > 0 },
    { key: 'upcoming', label: t('training.phase_upcoming', 'Upcoming'), count: upcoming.length, hint: nextIn ? t('training.next_starts', 'Next starts {{when}}', { when: nextIn }) : t('training.none_planned', 'None planned'), Icon: CalendarCheck },
    { key: 'unscheduled', label: t('training.phase_unscheduled', 'Not scheduled'), count: byPhase('unscheduled').length, hint: t('training.needs_dates', 'Needs dates'), Icon: CalendarPlus },
    { key: 'finished', label: t('training.phase_finished', 'Finished'), count: byPhase('finished').length, hint: t('training.completed_hint', 'Completed programs'), Icon: CheckCircle },
    { key: 'draft', label: t('training.drafts', 'Drafts'), count: drafts.length, hint: t('training.hidden_hint', 'Hidden from learners'), Icon: EyeSlash },
  ]
  return (
    <div className="dash-card mb-5 grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 sm:grid-cols-3 xl:grid-cols-6" role="tablist" aria-label={t('administration.common.status', 'Status')}>
      {segments.map(({ key, label, count, hint, Icon, live }) => {
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
                'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                active ? 'bg-white/10 text-[hsl(43_80%_62%)]' : live ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))] group-hover:bg-white group-hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              <Icon size={19} weight={active ? 'fill' : 'duotone'} />
              {live && !active ? <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--dash-warn))] ring-2 ring-white" /> : null}
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>{label}</span>
              <span className="block text-xl font-semibold leading-tight tabular-nums">{count}</span>
              <span className={cn('block truncate text-[10.5px]', active ? 'text-white/55' : 'text-[hsl(var(--dash-muted))]')}>{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Dark banner featuring what's running now, else what starts next. */
function Spotlight({ p, orgslug, orgUuid, onEdit }: { p: any; orgslug: string; orgUuid?: string; onEdit: () => void }) {
  const { today, dates, progress, venue, seats, price, typeLabel, t } = useProgramText()
  const phase = phaseOf(p, today)
  const prog = progress(p)
  const Icon = TYPE_ICONS[p.training_type] || Certificate
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
            {phase === 'running' ? <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(43_80%_60%)]" /> : <Timer size={14} weight="bold" />}
            {phase === 'running' ? t('training.running_now', 'Running now') : t('training.up_next', 'Up next')}
          </p>
          <h2 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{p.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <Icon size={15} /> {typeLabel(p)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={15} /> {dates(p)}
            </span>
            {venue(p) ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} /> {venue(p)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} /> {seats(p)}
            </span>
            <span className="font-semibold text-white">{price(p)}</span>
          </div>
          {prog.pct != null && phase === 'running' ? (
            <div className="mt-4 max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn('h-full rounded-full', GOLD)} style={{ width: `${prog.pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-white/55">{prog.label}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-[hsl(43_80%_64%)]">{prog.label}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)}
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

/** Programs as bars across the months, with a line for today. */
function TimelineView({ programs, orgslug }: { programs: any[]; orgslug: string }) {
  const { today, dates, typeLabel, t } = useProgramText()
  const { i18n } = useTranslation()
  const dated = programs.filter((p) => rangeOf(p)).sort((a, b) => rangeOf(a)!.start.getTime() - rangeOf(b)!.start.getTime())
  const undated = programs.filter((p) => !rangeOf(p))

  const window = useMemo(() => {
    let first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    let last = new Date(today.getFullYear(), today.getMonth() + 3, 0)
    for (const p of dated) {
      const r = rangeOf(p)!
      if (r.start < first) first = new Date(r.start.getFullYear(), r.start.getMonth(), 1)
      if (r.end > last) last = new Date(r.end.getFullYear(), r.end.getMonth() + 1, 0)
    }
    const months: { start: Date; days: number }[] = []
    for (let d = new Date(first); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      months.push({ start: d, days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() })
    }
    const totalDays = Math.round((last.getTime() - first.getTime()) / DAY) + 1
    return { first, months, totalDays }
  }, [dated, today])

  const pctOf = (d: Date) => (Math.round((d.getTime() - window.first.getTime()) / DAY) / window.totalDays) * 100
  const todayPct = pctOf(today)
  const monthFmt = new Intl.DateTimeFormat(i18n.language || 'en', { month: 'short', year: 'numeric' })

  if (!dated.length && !undated.length) return null
  return (
    <div className="dash-card overflow-hidden rounded-[1.25rem]">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 220 + window.months.length * 110 }}>
          {/* Month header */}
          <div className="grid grid-cols-[220px_minmax(0,1fr)] border-b border-[hsl(var(--dash-border))]/70 bg-[hsl(var(--dash-canvas))]/60">
            <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{t('training.program', 'Program')}</div>
            <div className="flex">
              {window.months.map((m) => (
                <div
                  key={m.start.toISOString()}
                  style={{ width: `${(m.days / window.totalDays) * 100}%` }}
                  className={cn(
                    'border-s border-[hsl(var(--dash-border))]/70 px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide',
                    m.start.getMonth() === today.getMonth() && m.start.getFullYear() === today.getFullYear() ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-muted))]'
                  )}
                >
                  {monthFmt.format(m.start)}
                </div>
              ))}
            </div>
          </div>
          {/* Rows */}
          {dated.map((p) => {
            const r = rangeOf(p)!
            const phase = phaseOf(p, today)
            const left = pctOf(r.start)
            const width = Math.max(((Math.round((r.end.getTime() - r.start.getTime()) / DAY) + 1) / window.totalDays) * 100, 1.2)
            const Icon = TYPE_ICONS[p.training_type] || Certificate
            return (
              <div key={p.trainingprogram_uuid} className="group grid grid-cols-[220px_minmax(0,1fr)] border-b border-[hsl(var(--dash-border))]/50 last:border-b-0 hover:bg-[hsl(var(--dash-canvas))]/40">
                <Link href={getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)} className="flex min-w-0 items-center gap-2.5 px-4 py-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))] group-hover:text-[hsl(var(--dash-ink))]">
                    <Icon size={16} weight="duotone" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]">{p.name}</span>
                    <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">{typeLabel(p)}</span>
                  </span>
                </Link>
                <div className="relative">
                  {window.months.slice(1).map((m) => (
                    <span key={m.start.toISOString()} className="absolute inset-y-0 w-px bg-[hsl(var(--dash-border))]/50" style={{ insetInlineStart: `${pctOf(m.start)}%` }} />
                  ))}
                  <span className="absolute inset-y-0 z-[1] w-0.5 bg-[hsl(var(--dash-warn))]/70" style={{ insetInlineStart: `${todayPct}%` }} aria-hidden="true" />
                  <Link
                    href={getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)}
                    title={`${p.name} · ${dates(p)}`}
                    aria-label={`${p.name} · ${dates(p)}`}
                    className={cn(
                      'absolute top-1/2 z-[2] h-7 -translate-y-1/2 rounded-lg transition-transform hover:scale-y-110',
                      !p.published
                        ? 'border border-dashed border-[hsl(var(--dash-muted))]/60 bg-white text-[hsl(var(--dash-muted))]'
                        : phase === 'running'
                          ? `${GOLD} text-[hsl(var(--dash-ink))] shadow-[0_6px_14px_-6px_hsl(43_80%_45%/0.8)]`
                          : phase === 'upcoming'
                            ? 'bg-[hsl(var(--dash-ink))] text-white'
                            : 'bg-[hsl(var(--dash-border))] text-[hsl(var(--dash-muted))]'
                    )}
                    style={{ insetInlineStart: `${left}%`, width: `${width}%`, minWidth: 14 }}
                  />
                  {/* Dates beside the bar: after it, or before it near the end of the window. */}
                  <span
                    className={cn(
                      'pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 whitespace-nowrap text-[11px] font-medium',
                      phase === 'running' ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-muted))]'
                    )}
                    style={
                      left + width > 72
                        ? { insetInlineEnd: `calc(${100 - left}% + 8px)` }
                        : { insetInlineStart: `calc(${left + width}% + 8px)` }
                    }
                  >
                    {dates(p)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {undated.length ? (
        <div className="border-t border-[hsl(var(--dash-border))]/70 bg-[hsl(var(--dash-canvas))]/40 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
            {t('training.not_scheduled', 'Not scheduled yet')} · {undated.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {undated.map((p) => (
              <Link
                key={p.trainingprogram_uuid}
                href={getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)}
                className="rounded-full border border-dashed border-[hsl(var(--dash-border))] bg-white px-3 py-1 text-xs font-medium text-[hsl(var(--dash-ink))] transition-colors hover:border-[hsl(var(--dash-accent))]/50"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const COLUMNS: { key: Column; dot: string }[] = [
  { key: 'draft', dot: 'bg-[hsl(var(--dash-muted))]/50' },
  { key: 'upcoming', dot: 'bg-[hsl(var(--dash-ink))]' },
  { key: 'running', dot: 'bg-[hsl(43_80%_52%)]' },
  { key: 'done', dot: 'bg-emerald-500' },
]

/** Draft → Upcoming → Running → Done columns. */
function BoardView({ programs, orgslug, actionsFor }: { programs: any[]; orgslug: string; actionsFor: (_p: any) => DashRowAction[] }) {
  const { today, dates, progress, seats, price, typeLabel, t } = useProgramText()
  const labels: Record<Column, string> = {
    draft: t('academic.draft', 'Draft'),
    upcoming: t('training.phase_upcoming', 'Upcoming'),
    running: t('training.phase_running', 'Running'),
    done: t('training.phase_finished', 'Finished'),
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = programs.filter((p) => columnOf(p, today) === col.key)
        return (
          <div key={col.key} className="flex min-h-[200px] flex-col rounded-[1.25rem] bg-[hsl(var(--dash-ink))]/[0.03] p-2">
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
              <span className={cn('h-2 w-2 rounded-full', col.dot)} />
              <span className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{labels[col.key]}</span>
              <span className="ms-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))] shadow-sm">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const Icon = TYPE_ICONS[p.training_type] || Certificate
                const prog = progress(p)
                return (
                  <div
                    key={p.trainingprogram_uuid}
                    className={cn(
                      'group relative rounded-2xl border bg-white p-3 shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(220_30%_20%/0.35)]',
                      col.key === 'running' ? 'border-[hsl(var(--dash-accent))]/40' : 'border-[hsl(var(--dash-border))]/70'
                    )}
                  >
                    <div className="absolute end-1.5 top-1.5">
                      <RowActionsMenu actions={actionsFor(p)} label={t('administration.table.actions', 'Actions')} />
                    </div>
                    <Link href={getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`)} className="block pe-8">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
                        <Icon size={13} weight="duotone" /> {typeLabel(p)}
                      </span>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[hsl(var(--dash-ink))]">{p.name}</p>
                      <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">{dates(p)}</p>
                      {col.key === 'running' && prog.pct != null ? (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                          <div className={cn('h-full rounded-full', GOLD)} style={{ width: `${prog.pct}%` }} />
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[hsl(var(--dash-muted))]">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} /> {seats(p)}
                        </span>
                        <span className="font-semibold text-[hsl(var(--dash-ink))]">{price(p)}</span>
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

function TrainingProgramsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [view, setView] = useStoredView<View>('training-programs-view', 'catalog')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [pricing, setPricing] = useState('all')

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['academic', 'training-programs', orgId],
    queryFn: () => getTrainingPrograms(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })
  const all = programs as any[]
  const today = todayStart()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'training-programs', orgId] })
  const openForm = (p: any) => {
    setEditing(p)
    setDrawerOpen(true)
  }

  const handleDelete = async (p: any) => {
    const ok = await confirm({
      title: t('training.delete_title', 'Delete {{name}}?', { name: p.name }),
      message: t('training.delete_message', 'The program, its schedule and enrollments are removed. To keep it on record, unpublish it instead.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deleteTrainingProgram(p.trainingprogram_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }
  const togglePublished = async (p: any) => {
    try {
      await updateTrainingProgram(p.trainingprogram_uuid, { published: !p.published, public: !p.published }, access_token)
      toast.success(p.published ? t('training.unpublished', 'Moved to drafts') : t('training.published_toast', 'Published'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }
  const actionsFor = (p: any): DashRowAction[] => [
    { label: t('training.open_program', 'Open program'), icon: <Eye className="h-3.5 w-3.5" />, href: getUriWithOrg(orgslug, `/dash/training-programs/${idOf(p)}`) },
    { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(p) },
    {
      label: p.published ? t('training.unpublish', 'Unpublish') : t('training.publish', 'Publish'),
      icon: p.published ? <EyeOff className="h-3.5 w-3.5" /> : <CheckCircle size={14} />,
      onSelect: () => togglePublished(p),
    },
    { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger', onSelect: () => handleDelete(p) },
  ]

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of all) counts.set(p.training_type, (counts.get(p.training_type) || 0) + 1)
    return counts
  }, [all])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((p) => {
      if (type !== 'all' && p.training_type !== type) return false
      if (pricing !== 'all' && (pricing === 'paid') !== !!p.is_paid) return false
      if (status === 'draft' && p.published) return false
      if (status !== 'all' && status !== 'draft' && phaseOf(p, today) !== status) return false
      if (q && !`${p.name} ${p.code || ''} ${p.location || ''} ${p.facility?.name || ''}`.toLowerCase().includes(q)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, type, status, pricing])
  const filtering = !!query || type !== 'all' || status !== 'all' || pricing !== 'all'

  const running = all.filter((p) => phaseOf(p, today) === 'running')
  const upcoming = all.filter((p) => phaseOf(p, today) === 'upcoming')
  const spotlight =
    [...running].sort((a, b) => rangeOf(a)!.end.getTime() - rangeOf(b)!.end.getTime())[0] ||
    [...upcoming].sort((a, b) => rangeOf(a)!.start.getTime() - rangeOf(b)!.start.getTime())[0]

  const sections: { key: Phase; title: string }[] = [
    { key: 'running', title: t('training.section_running', 'Running now') },
    { key: 'upcoming', title: t('training.section_upcoming', 'Upcoming') },
    { key: 'unscheduled', title: t('training.section_unscheduled', 'Not scheduled yet') },
    { key: 'finished', title: t('training.section_finished', 'Finished') },
  ]

  const createButton = (
    <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="training_programs" orgId={orgId!}>
      <AcademicPrimaryButton onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" /> {t('academic.new_training_program')}
      </AcademicPrimaryButton>
    </AuthenticatedClientElement>
  )
  const empty = (
    <div className="dash-card rounded-[1.25rem] px-6 py-14">
      <AcademicEmptyState
        compact
        icon={<Certificate size={24} />}
        title={filtering ? t('administration.common.no_matches', 'No matches') : t('academic.no_training_programs')}
        description={filtering ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.') : t('academic.no_training_programs_desc')}
        action={filtering ? undefined : createButton}
      />
    </div>
  )
  const viewOptions: { key: View; label: string; Icon: React.ElementType }[] = [
    { key: 'catalog', label: t('training.view_catalog', 'Catalog'), Icon: SquaresFour },
    { key: 'timeline', label: t('training.view_timeline', 'Timeline'), Icon: ChartBarHorizontal },
    { key: 'board', label: t('training.view_board', 'Board'), Icon: Kanban },
  ]
  const grid = (items: any[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((p) => (
        <ProgramCard key={p.trainingprogram_uuid} p={p} orgslug={orgslug} orgUuid={org?.org_uuid} actions={actionsFor(p)} onEdit={() => openForm(p)} />
      ))}
    </div>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs items={[{ label: t('academic.training_programs'), href: getUriWithOrg(orgslug, '/dash/training-programs'), icon: <Award size={14} /> }]} />
      <AcademicHeader
        title={t('academic.training_programs')}
        subtitle={t('training.subtitle', 'Workshops, bootcamps, events and certification programs — scheduled, staffed and priced.')}
        action={createButton}
      />

      <StatusStrip programs={all} value={status} onChange={setStatus} />

      {view === 'catalog' && spotlight && !filtering ? (
        <Spotlight p={spotlight} orgslug={orgslug} orgUuid={org?.org_uuid} onEdit={() => openForm(spotlight)} />
      ) : null}

      {/* Toolbar */}
      <div className="dash-card mb-5 space-y-3 rounded-[1.25rem] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch value={query} onChange={setQuery} placeholder={t('training.search', 'Search by name, code or venue')} className="min-w-[220px] flex-1 sm:max-w-sm" />
          <div className={cn(TAB_TRACK, 'p-0.5 shadow-none')} role="radiogroup" aria-label={t('training.price', 'Price')}>
            {[
              { key: 'all', label: t('training.any_price', 'Any price') },
              { key: 'free', label: t('academic.free', 'Free') },
              { key: 'paid', label: t('academic.paid', 'Paid') },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={pricing === option.key}
                onClick={() => setPricing(option.key)}
                className={tabItemClass(pricing === option.key, 'px-3 py-1 text-xs')}
              >
                {option.label}
              </button>
            ))}
          </div>
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
          {[{ key: 'all', count: all.length }, ...TYPES.filter((ty) => typeCounts.has(ty)).map((ty) => ({ key: ty, count: typeCounts.get(ty)! }))].map(({ key, count }) => {
            const Icon = key === 'all' ? SquaresFour : TYPE_ICONS[key] || Certificate
            const active = type === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  active
                    ? 'bg-[hsl(var(--dash-ink))] text-white'
                    : 'border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-ink))]/75 hover:-translate-y-0.5 hover:text-[hsl(var(--dash-ink))]'
                )}
              >
                {key === 'all' ? (
                  <Icon size={13} weight={active ? 'fill' : 'duotone'} />
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ background: toneOf(key).dot }} aria-hidden="true" />
                )}
                {key === 'all' ? t('training.all_types', 'All types') : t(`academic.type_${key}`)}
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
      ) : view === 'timeline' ? (
        <TimelineView programs={visible} orgslug={orgslug} />
      ) : view === 'board' ? (
        <BoardView programs={visible} orgslug={orgslug} actionsFor={actionsFor} />
      ) : status !== 'all' ? (
        grid(visible)
      ) : (
        <div className="space-y-8">
          {sections.map((section) => {
            const items = visible.filter((p) => phaseOf(p, today) === section.key)
            if (!items.length) return null
            return (
              <section key={section.key}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[hsl(var(--dash-ink))]">
                  {section.key === 'running' ? <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(43_80%_52%)]" /> : null}
                  {section.title}
                  <span className="rounded-full bg-[hsl(var(--dash-ink))]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">{items.length}</span>
                </h2>
                {grid(items)}
              </section>
            )
          })}
        </div>
      )}

      <AdminDrawer
        icon={<Certificate size={20} weight="duotone" />}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        width="sm:max-w-[640px]"
        title={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('academic.create_training_program')}
        description={t('training.form_desc', 'Name it, schedule it, set the venue and price, then publish when it is ready.')}
      >
        {drawerOpen ? (
          <TrainingProgramForm
            key={editing?.trainingprogram_uuid || 'new'}
            orgId={orgId!}
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

const switchCls = 'data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]'

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (_v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</span>
        {hint ? <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{hint}</span> : null}
      </span>
      <Switch className={switchCls} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function TrainingProgramForm({
  orgId,
  access_token,
  program,
  onDone,
  onCancel,
}: {
  orgId: number
  access_token: string
  program: any
  onDone: () => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const financeDefaults = useFinanceDefaults()
  const [name, setName] = useState(program?.name || '')
  const [description, setDescription] = useState(program?.description || '')
  const [code, setCode] = useState(program?.code || '')
  const [type, setType] = useState(program?.training_type || 'workshop')
  const [capacity, setCapacity] = useState<string>(program?.capacity != null ? String(program.capacity) : '')
  const [isPaid, setIsPaid] = useState(program?.is_paid ?? false)
  const [price, setPrice] = useState<string>(program?.price != null ? String(program.price) : '')
  const [currency, setCurrency] = useState(program?.currency || financeDefaults.default_currency)
  const [inPlan, setInPlan] = useState(program?.in_plan ?? true)
  const [location, setLocation] = useState(program?.location || '')
  const [facility, setFacility] = useState<string>(program?.facility?.facility_uuid || '')
  const [startDate, setStartDate] = useState(program?.start_date || '')
  const [endDate, setEndDate] = useState(program?.end_date || '')
  const [published, setPublished] = useState(program?.published ?? false)
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(program?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    program?.coordinator ? `${program.coordinator.first_name || ''} ${program.coordinator.last_name || ''}`.trim() || program.coordinator.username : undefined
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = String(t('administration.validation.required', 'Required'))
    if (startDate && endDate && endDate < startDate) next.endDate = String(t('administration.validation.date_range', 'End date must be on or after the start date'))
    if (capacity !== '' && Number(capacity) < 0) next.capacity = String(t('administration.validation.non_negative', 'Enter a number of 0 or more'))
    if (isPaid && (price === '' || Number(price) < 0)) next.price = String(t('training.price_required', 'Enter a price for a paid program'))
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        code,
        training_type: type,
        capacity: capacity === '' ? null : Number(capacity),
        is_paid: isPaid,
        price: isPaid && price !== '' ? Number(price) : null,
        currency: isPaid ? currency : null,
        in_plan: inPlan,
        location,
        facility_uuid: facility,
        start_date: startDate || null,
        end_date: endDate || null,
        published,
        public: published,
        coordinator_uuid: coordinatorUuid || '',
      }
      if (program) {
        await updateTrainingProgram(program.trainingprogram_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createTrainingProgram(orgId, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (program ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.name')} required error={errors.name} className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('academic.type')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`academic.type_${ty}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.code')} hint={t('training.code_hint', 'A short reference, e.g. CYB-101')}>
          <input className={cn(inputCls, 'font-mono')} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t('academic.description')} className="sm:col-span-2">
          <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
      </FormSection>

      <FormSection title={t('training.section_schedule', 'Schedule and venue')}>
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')} error={errors.endDate}>
          <input type="date" className={inputCls} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-invalid={!!errors.endDate} />
        </Field>
        <Field label={t('administration.facilities.venue', 'Venue (facility)')}>
          <FacilitySelect className={inputCls} value={facility} onChange={setFacility} current={program?.facility} />
        </Field>
        <Field label={t('academic.location')} hint={t('training.location_hint', 'Used when no facility is picked, e.g. an external venue')}>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label={t('academic.capacity')} error={errors.capacity} hint={t('training.capacity_hint', 'Leave empty for open seats')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-invalid={!!errors.capacity} />
        </Field>
      </FormSection>

      <FormSection title={t('training.section_pricing', 'Pricing')} columns={1}>
        <SwitchRow label={t('academic.paid')} hint={t('training.paid_hint', 'Participants pay to enroll')} checked={isPaid} onChange={setIsPaid} />
        {isPaid ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('academic.price')} required error={errors.price}>
              <input type="number" min={0} step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!errors.price} />
            </Field>
            <Field label={t('academic.currency')}>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
          </div>
        ) : null}
      </FormSection>

      <FormSection title={t('training.section_settings', 'Coordination and visibility')} columns={1}>
        <Field label={t('academic.coordinator')}>
          <CoordinatorPicker
            orgId={orgId}
            access_token={access_token}
            value={coordinatorUuid}
            selectedLabel={coordinatorLabel}
            onChange={(uuid, label) => {
              setCoordinatorUuid(uuid)
              setCoordinatorLabel(label)
            }}
          />
        </Field>
        <SwitchRow label={t('academic.in_plan')} hint={t('training.in_plan_hint', 'Counts toward this year’s training plan')} checked={inPlan} onChange={setInPlan} />
        <SwitchRow label={t('academic.published')} hint={t('training.published_hint', 'Visible to learners and open for enrollment')} checked={published} onChange={setPublished} />
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky={!!onCancel} />
    </form>
  )
}

export default TrainingProgramsHome
