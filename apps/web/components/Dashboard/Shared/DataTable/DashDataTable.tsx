'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { CaretDown, CaretLeft, CaretRight, CaretUp, CaretUpDown, DotsThree, MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The dashboard's data table: one card with an optional toolbar, sortable
 * headers, a row action menu, bulk selection, client-side paging, skeleton
 * rows and an empty state. Below `md` rows turn into stacked cards instead of
 * a horizontally scrolling table.
 */

export interface DashColumn<T> {
  key: string
  header: string
  cell: (_row: T) => React.ReactNode
  /** Enables header sorting on this value. */
  sortValue?: (_row: T) => string | number | null | undefined
  align?: 'start' | 'end' | 'center'
  /** Tailwind width class for the column, e.g. `w-[28%]`. */
  width?: string
  /** Hide on narrower desktop widths to keep the table readable. */
  hideBelow?: 'lg' | 'xl'
  /** The row's title in the mobile card layout (first column by default). */
  primary?: boolean
  /** Leave out of the mobile card details. */
  hideOnMobile?: boolean
}

export interface DashRowAction {
  label: string
  icon?: React.ReactNode
  onSelect?: () => void
  href?: string
  tone?: 'danger'
  disabled?: boolean
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

const HIDE_BELOW: Record<NonNullable<DashColumn<unknown>['hideBelow']>, string> = {
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}
const ALIGN = { start: 'text-start', end: 'text-end', center: 'text-center' } as const

function compare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function RowActionsMenu({ actions, label }: { actions: DashRowAction[]; label: string }) {
  if (!actions.length) return null
  const firstDanger = actions.findIndex((a) => a.tone === 'danger')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/40 data-[state=open]:bg-[hsl(var(--dash-canvas))]"
        >
          <DotsThree size={18} weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] rounded-xl p-1" onClick={(e) => e.stopPropagation()}>
        {actions.map((action, i) => {
          const item = (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              onSelect={() => action.onSelect?.()}
              asChild={!!action.href}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]',
                action.tone === 'danger' && 'text-[hsl(var(--dash-warn))] focus:bg-[hsl(var(--dash-warn-soft))] focus:text-[hsl(var(--dash-warn))]'
              )}
            >
              {action.href ? (
                <Link href={action.href}>
                  {action.icon}
                  {action.label}
                </Link>
              ) : (
                <>
                  {action.icon}
                  {action.label}
                </>
              )}
            </DropdownMenuItem>
          )
          return i === firstDanger && i > 0 ? (
            <React.Fragment key={action.label}>
              <DropdownMenuSeparator />
              {item}
            </React.Fragment>
          ) : (
            item
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------ toolbar parts */

export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (_v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 transition-colors focus-within:border-[hsl(var(--dash-accent))]/50 focus-within:ring-2 focus-within:ring-[hsl(var(--dash-accent))]/20 sm:w-64',
        className
      )}
    >
      <MagnifyingGlass size={15} className="shrink-0 text-[hsl(var(--dash-muted))]" />
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-[hsl(var(--dash-ink))] placeholder:text-[hsl(var(--dash-muted))] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear" className="text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]">
          <X size={13} weight="bold" />
        </button>
      ) : null}
    </label>
  )
}

/** Compact labelled filter dropdown ("Status: All"). */
export function ToolbarSelect<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: V
  onChange: (_v: V) => void
  options: { value: V; label: string }[]
}) {
  const active = value !== options[0]?.value
  return (
    <label
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center rounded-full border ps-3 pe-7 text-[13px] transition-colors',
        active
          ? 'border-[hsl(var(--dash-ink))]/20 bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
          : 'border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
      )}
    >
      <span className="me-1 whitespace-nowrap">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="max-w-[180px] cursor-pointer appearance-none truncate bg-transparent font-medium text-[hsl(var(--dash-ink))] [field-sizing:content] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown size={11} weight="bold" className="pointer-events-none absolute end-2.5 text-[hsl(var(--dash-muted))]" />
    </label>
  )
}

/* ------------------------------------------------------------------ table */

export default function DashDataTable<T>({
  rows,
  rowKey,
  columns,
  loading = false,
  toolbar,
  toolbarEnd,
  empty,
  rowHref,
  onRowClick,
  actions,
  selectable = false,
  bulkActions,
  pageSize = 20,
  initialSort = null,
  itemLabel,
  serverPaging,
  className,
}: {
  rows: T[]
  rowKey: (_row: T) => string
  columns: DashColumn<T>[]
  loading?: boolean
  /** Search/filters on the toolbar's start side. */
  toolbar?: React.ReactNode
  /** Buttons on the toolbar's end side (after the count). */
  toolbarEnd?: React.ReactNode
  empty?: React.ReactNode
  rowHref?: (_row: T) => string | undefined
  onRowClick?: (_row: T) => void
  actions?: (_row: T) => DashRowAction[]
  selectable?: boolean
  bulkActions?: (_selected: T[], _clear: () => void) => React.ReactNode
  pageSize?: number
  initialSort?: SortState
  /** "{{count}} instructors" style count label. */
  itemLabel?: (_count: number) => string
  /** For lists paged by the API: `rows` is the current page and the footer drives `onChange`. */
  serverPaging?: { page: number; pageSize: number; total: number; onChange: (_page: number) => void }
  className?: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [sort, setSort] = useState<SortState>(initialSort)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const getter = col.sortValue
    const out = [...rows].sort((a, b) => compare(getter(a), getter(b)))
    return sort!.dir === 'desc' ? out.reverse() : out
  }, [rows, sort, columns])

  const total = serverPaging ? serverPaging.total : sorted.length
  const size = serverPaging ? serverPaging.pageSize : pageSize
  const pages = Math.max(1, Math.ceil(total / size))
  const current = serverPaging ? Math.max(0, serverPaging.page - 1) : Math.min(page, pages - 1)
  const goTo = (next: number) => (serverPaging ? serverPaging.onChange(next + 1) : setPage(next))
  const visible = serverPaging ? sorted : sorted.slice(current * pageSize, current * pageSize + pageSize)
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(rowKey(r))), [rows, selected, rowKey])
  const allOnPage = visible.length > 0 && visible.every((r) => selected.has(rowKey(r)))
  const clear = () => setSelected(new Set())

  const toggleSort = (key: string) =>
    setSort((prev) => (prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null))
  const toggleRow = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of visible) {
        if (allOnPage) next.delete(rowKey(r))
        else next.add(rowKey(r))
      }
      return next
    })

  const primary = columns.find((c) => c.primary) ?? columns[0]!
  const detailColumns = columns.filter((c) => c !== primary && !c.hideOnMobile)
  const hasActions = !!actions
  const rowProps = (row: T) => {
    const href = rowHref?.(row)
    const clickable = !!href || !!onRowClick
    return { href, clickable }
  }
  const openRow = (row: T, href?: string) => {
    if (onRowClick) onRowClick(row)
    else if (href) router.push(href)
  }

  const checkbox = (checked: boolean, onChange: () => void, label: string) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-[hsl(var(--dash-border))] accent-[hsl(var(--dash-ink))]"
    />
  )

  const showToolbar = toolbar || toolbarEnd || itemLabel || (selectable && selectedRows.length > 0)

  return (
    <div className={cn('dash-card overflow-hidden rounded-[1.25rem]', className)}>
      {showToolbar ? (
        selectable && selectedRows.length > 0 ? (
          <div className="flex min-h-[60px] flex-wrap items-center gap-2 border-b border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-ink))] px-4 py-2.5 text-white">
            <span className="text-[13px] font-medium">
              {t('administration.table.selected', '{{count}} selected', { count: selectedRows.length })}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white hover:[&_button]:bg-white/20">
              {bulkActions?.(selectedRows, clear)}
            </div>
            <button type="button" onClick={clear} className="ms-auto rounded-full px-3 py-1 text-[12px] text-white/70 hover:bg-white/10 hover:text-white">
              {t('administration.table.clear_selection', 'Clear')}
            </button>
          </div>
        ) : (
          <div className="flex min-h-[60px] flex-wrap items-center gap-2 border-b border-[hsl(var(--dash-border))] px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
            <div className="flex items-center gap-2">
              {itemLabel && !loading ? (
                <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{itemLabel(total)}</span>
              ) : null}
              {toolbarEnd}
            </div>
          </div>
        )
      ) : null}

      {loading ? (
        <div className="divide-y divide-[hsl(var(--dash-border))]/70" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="dash-shimmer h-9 w-9 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="dash-shimmer h-3 w-1/3 rounded-full" />
                <div className="dash-shimmer h-2.5 w-1/5 rounded-full" />
              </div>
              <div className="dash-shimmer hidden h-3 w-20 rounded-full sm:block" />
              <div className="dash-shimmer hidden h-5 w-16 rounded-full md:block" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-14">{empty}</div>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--dash-canvas))]/60 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  {selectable ? <th className="w-10 py-2.5 ps-4 pe-2">{checkbox(allOnPage, togglePage, t('administration.table.select_all', 'Select all'))}</th> : null}
                  {columns.map((c) => {
                    const dir = sort?.key === c.key ? sort.dir : null
                    return (
                      <th
                        key={c.key}
                        aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                        className={cn('whitespace-nowrap px-3 py-2.5 font-semibold first:ps-4 last:pe-4', ALIGN[c.align ?? 'start'], c.width, c.hideBelow && HIDE_BELOW[c.hideBelow])}
                      >
                        {c.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className={cn(
                              'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-[hsl(var(--dash-ink))]',
                              dir && 'text-[hsl(var(--dash-ink))]'
                            )}
                          >
                            {c.header}
                            {dir === 'asc' ? <CaretUp size={11} weight="bold" /> : dir === 'desc' ? <CaretDown size={11} weight="bold" /> : <CaretUpDown size={11} className="opacity-50" />}
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    )
                  })}
                  {hasActions ? <th className="w-12 py-2.5 ps-1 pe-3" aria-label={t('administration.table.actions', 'Actions')} /> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const key = rowKey(row)
                  const { href, clickable } = rowProps(row)
                  return (
                    <tr
                      key={key}
                      onClick={clickable ? () => openRow(row, href) : undefined}
                      className={cn(
                        'border-t border-[hsl(var(--dash-border))]/70 transition-colors',
                        clickable && 'cursor-pointer hover:bg-[hsl(var(--dash-canvas))]/60',
                        selected.has(key) && 'bg-[hsl(var(--dash-accent-soft))]/40'
                      )}
                    >
                      {selectable ? <td className="py-3 ps-4 pe-2">{checkbox(selected.has(key), () => toggleRow(key), key)}</td> : null}
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn('px-3 py-3 align-middle text-[hsl(var(--dash-ink))] first:ps-4 last:pe-4', ALIGN[c.align ?? 'start'], c.hideBelow && HIDE_BELOW[c.hideBelow])}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                      {hasActions ? (
                        <td className="py-3 ps-1 pe-3 text-end">
                          <RowActionsMenu actions={actions!(row)} label={t('administration.table.actions', 'Actions')} />
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: stacked cards */}
          <ul className="divide-y divide-[hsl(var(--dash-border))]/70 md:hidden">
            {visible.map((row) => {
              const key = rowKey(row)
              const { href, clickable } = rowProps(row)
              return (
                <li
                  key={key}
                  onClick={clickable ? () => openRow(row, href) : undefined}
                  className={cn('flex gap-3 px-4 py-3.5', clickable && 'cursor-pointer active:bg-[hsl(var(--dash-canvas))]/60')}
                >
                  {selectable ? <div className="pt-1">{checkbox(selected.has(key), () => toggleRow(key), key)}</div> : null}
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">{primary.cell(row)}</div>
                    {detailColumns.length ? (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                        {detailColumns.map((c) => (
                          <div key={c.key} className="min-w-0">
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{c.header}</dt>
                            <dd className="min-w-0 truncate text-[hsl(var(--dash-ink))]">{c.cell(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  {hasActions ? <RowActionsMenu actions={actions!(row)} label={t('administration.table.actions', 'Actions')} /> : null}
                </li>
              )
            })}
          </ul>

          {pages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--dash-border))] px-4 py-2.5 text-[12px] text-[hsl(var(--dash-muted))]">
              <span className="tabular-nums">
                {t('administration.table.range', '{{from}}–{{to}} of {{total}}', {
                  from: current * size + 1,
                  to: Math.min(total, (current + 1) * size),
                  total,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                  aria-label={t('administration.table.previous', 'Previous page')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] disabled:opacity-40"
                >
                  <CaretLeft size={14} weight="bold" className="rtl:rotate-180" />
                </button>
                <span className="px-1 tabular-nums text-[hsl(var(--dash-ink))]">
                  {current + 1} / {pages}
                </span>
                <button
                  type="button"
                  disabled={current >= pages - 1}
                  onClick={() => goTo(current + 1)}
                  aria-label={t('administration.table.next', 'Next page')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] disabled:opacity-40"
                >
                  <CaretRight size={14} weight="bold" className="rtl:rotate-180" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
