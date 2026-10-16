'use client'

import * as React from 'react'
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion } from 'motion/react'
import {
  CalendarDays,
  FileText,
  Flag,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Palette,
  Plus,
  Server,
  Smartphone,
} from 'lucide-react'

/* ==========================================================================
   KanbanBoard

   A board of columns you can drag cards between.

   The drag is built on raw pointer events rather than a drag-and-drop
   library, so the whole gesture is ours to shape: the card lifts out of the
   list into an overlay that tracks the cursor, the gap it left collapses,
   a gap springs open wherever it would land, and every other card slides
   into its new place instead of jumping there.

   The insert position is worked out in a coordinate space that pretends the
   placeholder is not there. Without that the placeholder pushes cards past
   the pointer, which flips the decision back, which moves the placeholder,
   which flips it again. The card would sit and flicker between two slots.

   Everything also works from the keyboard: focus a card, press space to pick
   it up, move it with the arrow keys, space again to drop, escape to put it
   back. Each move is announced to screen readers.

   Built for real boards as well as the task demo:
   - `renderCard` draws your own card (links, menus…); the built-in task card
     is the fallback.
   - `canMove` says which columns a card may go to; the others dim while it
     is in the air. `onMove` saves the move (sync or async) and the board
     rolls back when it returns false or throws.
   - `reorderable={false}` for boards whose order inside a column comes from
     the data (dates, names): cards only move between columns.
   - A press only becomes a drag after a few pixels, so clicking a card still
     follows its link and buttons inside it still work.
   - Right-to-left aware: columns flow from the right and the arrow keys
     follow the reading direction.
   ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** iOS style continuous corners, degrading to a plain radius. */
const SQUIRCLE = '[corner-shape:squircle]'

/** One chip. Fixed height and no line box, so the icon and label sit dead centre. */
const CHIP = 'inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] leading-none'

/** Vertical space between cards, in px. Needed in maths, not just in CSS. */
const GAP = 8

/** How far a press must travel before it becomes a drag (clicks stay clicks). */
const DRAG_THRESHOLD = 5

const LIFT_SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const
const FLOW_SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const

export type Priority = 'urgent' | 'high' | 'normal' | 'low'

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: 'bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300',
  high: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300',
  normal: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300',
  low: 'bg-neutral-100 text-neutral-500 dark:bg-white/[0.07] dark:text-neutral-400',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

/** Accent used by a column's status dot. */
export type Accent = 'slate' | 'violet' | 'blue' | 'amber' | 'emerald' | 'rose' | 'gold'

const ACCENT_DOT: Record<Accent, string> = {
  slate: 'bg-neutral-400',
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  gold: 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]',
}

export interface KanbanAssignee {
  name: string
  /** Portrait URL. Falls back to initials on a colour picked from the name. */
  avatar?: string
}

export interface KanbanTask {
  id: string
  title: string
  /** One supporting line under the title. */
  note?: string
  priority?: Priority
  /** Short label with an icon, e.g. "Web app". */
  category?: string
  /** Icon key, or your own node. */
  icon?: IconKey | React.ReactNode
  assignees?: KanbanAssignee[]
  /** Free text, e.g. "25 Apr" or "Tomorrow". */
  due?: string
  /** Paints the due date amber. Use it for today, tomorrow and overdue. */
  dueSoon?: boolean
  /** 0 to 100. Drawn as a ring next to the date. */
  progress?: number
  /** Your own record, handed back to `renderCard`, `canMove` and `onMove`. */
  data?: any
}

export interface KanbanColumn {
  id: string
  name: string
  accent?: Accent
  /** Optional icon shown before the name instead of the dot. */
  icon?: React.ReactNode
  tasks: KanbanTask[]
}

export interface KanbanBoardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'onChange'> {
  columns: KanbanColumn[]
  /** Fires after every move with the whole board. */
  onChange?: (_columns: KanbanColumn[]) => void
  /** Draw a card yourself; defaults to the built-in task card. */
  renderCard?: (_task: KanbanTask, _state: { floating: boolean }) => React.ReactNode
  /** May this card go to that column? Columns that say no dim while it is in the air. */
  canMove?: (_task: KanbanTask, _from: string, _to: string) => boolean
  /** Short reason shown on a column that refuses the card in the air. */
  blockedHint?: (_task: KanbanTask, _from: string, _to: string) => string | undefined
  /**
   * Save a move. Return (or resolve to) false, or throw, to put the card back.
   * Only called when the card changes column, or position when reorderable.
   */
  onMove?: (_task: KanbanTask, _from: string, _to: string, _index: number) => void | boolean | Promise<void | boolean>
  /** Cards keep their place inside a column; they only move between columns. */
  reorderable?: boolean
  /** Fixed column width in px, or "fill" to share the width (scrolls below `minColumnWidth`). */
  columnWidth?: number | 'fill'
  minColumnWidth?: number
  /** Adds an "Add task" button at the foot of each column. */
  onAddTask?: (_columnId: string) => void
  addTaskLabel?: string
  /** Rendered at the end of each column header, e.g. a menu. */
  renderColumnAction?: (_column: KanbanColumn) => React.ReactNode
  /** Shown in a column with no cards. */
  emptyLabel?: React.ReactNode
  /** Accessible name for the scrolling region. */
  label?: string
  /** Announcement / aria text; override to translate. */
  messages?: Partial<KanbanMessages>
}

export interface KanbanMessages {
  pickUp: (_title: string) => string
  pickedUp: (_title: string) => string
  moved: (_title: string, _column: string, _position: number) => string
  dropped: (_title: string, _column: string, _position: number) => string
  cancelled: (_title: string) => string
  notAllowed: (_title: string, _column: string) => string
  draggableCard: string
}

const DEFAULT_MESSAGES: KanbanMessages = {
  pickUp: (title) => `${title}. Press space to pick up.`,
  pickedUp: (title) => `Picked up ${title}. Use the arrow keys to move it.`,
  moved: (title, column, position) => `${title} moved to ${column}, position ${position}.`,
  dropped: (title, column, position) => `Dropped ${title} in ${column}, position ${position}.`,
  cancelled: (title) => `Cancelled. ${title} is back where it started.`,
  notAllowed: (title, column) => `${title} cannot go to ${column}.`,
  draggableCard: 'Draggable card',
}

type DragState = {
  taskId: string
  fromCol: string
  width: number
  height: number
  /** Where inside the card the pointer grabbed it. */
  offsetX: number
  offsetY: number
  /** Its place before the drag, where it returns when dropped somewhere it may not go. */
  fromIndex: number
}

type Pending = DragState & { startX: number; startY: number; pointerId: number; target: HTMLElement }

type Slot = { col: string; index: number }

/** Presses that start on these never become drags. */
const INTERACTIVE = 'button, input, select, textarea, [role="menuitem"], [data-kanban-ignore]'

export const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(function KanbanBoard(
  {
    columns,
    onChange,
    renderCard,
    canMove,
    blockedHint,
    onMove,
    reorderable = true,
    columnWidth = 286,
    minColumnWidth = 240,
    onAddTask,
    addTaskLabel = 'Add task',
    renderColumnAction,
    emptyLabel,
    label = 'Board',
    messages: messagesProp,
    className,
    style,
    ...props
  },
  ref
) {
  const messages = React.useMemo(() => ({ ...DEFAULT_MESSAGES, ...messagesProp }), [messagesProp])
  const [cols, setCols] = React.useState<KanbanColumn[]>(columns)
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [slot, setSlot] = React.useState<Slot | null>(null)
  const [grabbed, setGrabbed] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState('')
  const [atStart, setAtStart] = React.useState(true)
  const [atEnd, setAtEnd] = React.useState(true)
  const [rtl, setRtl] = React.useState(false)
  const reduceMotion = useReducedMotion()

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const listRefs = React.useRef(new Map<string, HTMLDivElement>())
  const colRefs = React.useRef(new Map<string, HTMLDivElement>())
  const cardRefs = React.useRef(new Map<string, HTMLDivElement>())
  const dragRef = React.useRef<DragState | null>(null)
  const pendingRef = React.useRef<Pending | null>(null)
  const slotRef = React.useRef<Slot | null>(null)
  const suppressClick = React.useRef(false)
  const autoScroll = React.useRef(0)
  const rafRef = React.useRef<number | null>(null)
  const colsRef = React.useRef(cols)
  React.useLayoutEffect(() => {
    colsRef.current = cols
  }, [cols])

  // New data from the parent replaces the local copy (derived state, no effect).
  const [seenColumns, setSeenColumns] = React.useState(columns)
  if (seenColumns !== columns) {
    setSeenColumns(columns)
    setCols(columns)
  }

  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  React.useEffect(() => {
    if (rootRef.current) setRtl(getComputedStyle(rootRef.current).direction === 'rtl')
  }, [])

  /*
    The track fades into the page background on whichever side still has
    columns hidden past the edge. In right-to-left the scroll position runs
    from 0 down to negative, so work with its distance from the start.
  */
  const syncEdges = React.useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const from = Math.abs(el.scrollLeft)
    setAtStart(from < 8)
    setAtEnd(from + el.clientWidth >= el.scrollWidth - 8)
  }, [])

  React.useEffect(() => {
    syncEdges()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(syncEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncEdges, cols.length])

  const fade = '24px'
  const [leftOpen, rightOpen] = rtl ? [atEnd, atStart] : [atStart, atEnd]
  const maskStops = [`transparent 0%, #000 ${leftOpen ? '0%' : fade}`, `#000 ${rightOpen ? '100%' : `calc(100% - ${fade})`}, transparent 100%`].join(', ')
  const mask = atStart && atEnd ? undefined : `linear-gradient(to right, ${maskStops})`

  /*
    A keyboard move re-mounts the card inside another column, which drops
    focus on the floor and swallows every key after the first. Put it back
    on the card that is still being carried.
  */
  React.useEffect(() => {
    if (!grabbed) return
    const el = cardRefs.current.get(grabbed)
    if (el && document.activeElement !== el) el.focus({ preventScroll: true })
  }, [cols, grabbed])

  /* ---------------------------------------------------------------- move */

  const locate = React.useCallback((list: KanbanColumn[], taskId: string) => {
    for (const c of list) {
      const i = c.tasks.findIndex((t) => t.id === taskId)
      if (i > -1) return { col: c.id, index: i, task: c.tasks[i] }
    }
    return null
  }, [])

  const allowed = React.useCallback(
    (task: KanbanTask, from: string, to: string) => from === to || !canMove || canMove(task, from, to),
    [canMove]
  )

  /** Apply a move locally, then let `onMove` keep it or roll it back. */
  const move = React.useCallback(
    (taskId: string, to: Slot, opts: { persist: boolean } = { persist: true }) => {
      const prev = colsRef.current
      const found = locate(prev, taskId)
      if (!found) return
      if (found.col === to.col && (found.index === to.index || !reorderable)) return
      if (!allowed(found.task, found.col, to.col)) return

      const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }))
      const from = next.find((c) => c.id === found.col)!
      from.tasks.splice(found.index, 1)
      const dest = next.find((c) => c.id === to.col)!
      dest.tasks.splice(Math.min(to.index, dest.tasks.length), 0, found.task)
      setCols(next)
      onChange?.(next)

      if (!opts.persist || !onMove) return
      const rollback = () => {
        setCols(prev)
        onChange?.(prev)
      }
      try {
        const result = onMove(found.task, found.col, to.col, to.index)
        if (result === false) rollback()
        else if (result && typeof (result as Promise<unknown>).then === 'function') {
          ;(result as Promise<void | boolean>).then((ok) => ok === false && rollback(), rollback)
        }
      } catch {
        rollback()
      }
    },
    [allowed, locate, onChange, onMove, reorderable]
  )

  /* -------------------------------------------------------- hit testing */

  /**
   * Card midpoints per column, measured once at drag start and stored as
   * offsets from the top of each list.
   *
   * Measuring live during the drag looks simpler and is wrong twice over.
   * The cards are mid-spring, so their boxes are somewhere between where
   * they were and where they are going; and the placeholder pushes them
   * past the pointer, which flips the decision, which moves the
   * placeholder, which flips it back. A snapshot of the layout without
   * the dragged card in it has neither problem.
   */
  const snapRef = React.useRef(new Map<string, number[]>())

  const snapshot = React.useCallback((taskId: string, fromCol: string) => {
    const map = new Map<string, number[]>()
    listRefs.current.forEach((list, colId) => {
      const listTop = list.getBoundingClientRect().top
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-kanban-card]'))
      let removed = -1
      let removedH = 0
      const rows = cards.map((el, i) => {
        const r = el.getBoundingClientRect()
        const isDragged = colId === fromCol && el.dataset.kanbanCard === taskId
        if (isDragged) {
          removed = i
          removedH = r.height
        }
        return { top: r.top - listTop, h: r.height, isDragged }
      })
      const mids = rows
        .filter((row) => !row.isDragged)
        .map((row, i) => {
          // close the gap the dragged card leaves behind
          const shift = removed > -1 && i >= removed ? removedH + GAP : 0
          return row.top - shift + row.h / 2
        })
      map.set(colId, mids)
    })
    snapRef.current = map
  }, [])

  /** Which slot is the pointer over? Columns that refuse the card are skipped. */
  const slotAt = React.useCallback(
    (clientX: number, clientY: number): Slot | null => {
      const d = dragRef.current
      if (!d) return null
      const found = locate(colsRef.current, d.taskId)
      if (!found) return null

      let inside = ''
      colRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect()
        if (clientX >= r.left && clientX <= r.right) inside = id
      })
      // Between columns: keep the current slot so the placeholder does not flicker.
      if (!inside) return slotRef.current
      // Over a column that says no: the card would go back where it came from.
      if (!allowed(found.task, d.fromCol, inside)) return { col: d.fromCol, index: d.fromIndex }
      const colId = inside

      if (!reorderable) {
        const len = (colsRef.current.find((c) => c.id === colId)?.tasks.length ?? 0) - (colId === d.fromCol ? 1 : 0)
        return { col: colId, index: colId === d.fromCol ? found.index : len }
      }

      const list = listRefs.current.get(colId)
      if (!list) return { col: colId, index: 0 }
      const listTop = list.getBoundingClientRect().top
      const mids = snapRef.current.get(colId) ?? []
      let index = mids.length
      for (let i = 0; i < mids.length; i++) {
        if (clientY < listTop + mids[i]) {
          index = i
          break
        }
      }
      return { col: colId, index }
    },
    [allowed, locate, reorderable]
  )

  /* ------------------------------------------------------ pointer drag */

  const endDrag = React.useCallback(() => {
    const d = dragRef.current
    const s = slotRef.current
    if (d && s) move(d.taskId, s)
    dragRef.current = null
    slotRef.current = null
    autoScroll.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setDrag(null)
    setSlot(null)
  }, [move])

  const beginDrag = React.useCallback(
    (p: Pending) => {
      const state: DragState = {
        taskId: p.taskId,
        fromCol: p.fromCol,
        width: p.width,
        height: p.height,
        offsetX: p.offsetX,
        offsetY: p.offsetY,
        fromIndex: p.fromIndex,
      }
      snapshot(p.taskId, p.fromCol)
      dragRef.current = state
      slotRef.current = { col: p.fromCol, index: p.fromIndex }
      suppressClick.current = true
      setDrag(state)
      setSlot({ col: p.fromCol, index: p.fromIndex })
      setGrabbed(null)
    },
    [snapshot]
  )

  // A press waits here until it travels far enough to count as a drag.
  React.useEffect(() => {
    const onMovePending = (e: PointerEvent) => {
      const p = pendingRef.current
      if (!p || dragRef.current) return
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return
      pendingRef.current = null
      x.set(e.clientX - p.offsetX)
      y.set(e.clientY - p.offsetY)
      beginDrag(p)
    }
    const onUpPending = () => {
      pendingRef.current = null
    }
    window.addEventListener('pointermove', onMovePending)
    window.addEventListener('pointerup', onUpPending)
    window.addEventListener('pointercancel', onUpPending)
    return () => {
      window.removeEventListener('pointermove', onMovePending)
      window.removeEventListener('pointerup', onUpPending)
      window.removeEventListener('pointercancel', onUpPending)
    }
  }, [beginDrag, x, y])

  React.useEffect(() => {
    if (!drag) return

    const onMovePointer = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      x.set(e.clientX - d.offsetX)
      y.set(e.clientY - d.offsetY)

      const next = slotAt(e.clientX, e.clientY)
      const cur = slotRef.current
      if (next && (!cur || cur.col !== next.col || cur.index !== next.index)) {
        slotRef.current = next
        setSlot(next)
      }

      // nudge the track along when you drag near either edge
      const track = trackRef.current
      if (track) {
        const r = track.getBoundingClientRect()
        const edge = 72
        autoScroll.current = e.clientX < r.left + edge ? -14 : e.clientX > r.right - edge ? 14 : 0
      }
    }

    const onUp = () => endDrag()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      slotRef.current = null
      endDrag()
    }

    window.addEventListener('pointermove', onMovePointer)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)

    const tick = () => {
      if (autoScroll.current && trackRef.current) trackRef.current.scrollLeft += autoScroll.current
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [drag, endDrag, slotAt, x, y])

  const pressCard = (e: React.PointerEvent, task: KanbanTask, colId: string, index: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    suppressClick.current = false
    pendingRef.current = {
      taskId: task.id,
      fromCol: colId,
      width: r.width,
      height: r.height,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      startX: e.clientX,
      startY: e.clientY,
      fromIndex: index,
      pointerId: e.pointerId,
      target: el,
    }
  }

  // A drag that ends over its own card must not also follow the card's link.
  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  /* ---------------------------------------------------------- keyboard */

  const originRef = React.useRef<Slot | null>(null)
  const colName = (id: string) => cols.find((c) => c.id === id)?.name ?? id

  const onCardKeyDown = (e: React.KeyboardEvent, task: KanbanTask) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE) && e.target !== e.currentTarget) return
    const isGrabbed = grabbed === task.id

    // Space picks up and drops; Enter stays free to open the card.
    if (e.key === ' ' || (e.key === 'Enter' && isGrabbed)) {
      e.preventDefault()
      const at = locate(cols, task.id)
      if (isGrabbed) {
        setGrabbed(null)
        if (at && originRef.current && (at.col !== originRef.current.col || at.index !== originRef.current.index) && onMove) {
          // keyboard moves are local until the drop, then saved once
          const origin = originRef.current
          const keep = cols
          const result = (() => {
            try {
              return onMove(at.task, origin.col, at.col, at.index)
            } catch {
              return false
            }
          })()
          const rollback = () => {
            const back = keep.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== task.id) }))
            const dest = back.find((c) => c.id === origin.col)!
            dest.tasks.splice(origin.index, 0, at.task)
            setCols(back)
            onChange?.(back)
          }
          if (result === false) rollback()
          else if (result && typeof (result as Promise<unknown>).then === 'function') {
            ;(result as Promise<void | boolean>).then((ok) => ok === false && rollback(), rollback)
          }
        }
        setAnnouncement(at ? messages.dropped(task.title, colName(at.col), at.index + 1) : '')
      } else {
        originRef.current = at ? { col: at.col, index: at.index } : null
        setGrabbed(task.id)
        setAnnouncement(messages.pickedUp(task.title))
      }
      return
    }

    if (e.key === 'Escape' && isGrabbed) {
      e.preventDefault()
      if (originRef.current) move(task.id, originRef.current, { persist: false })
      setGrabbed(null)
      setAnnouncement(messages.cancelled(task.title))
      return
    }

    if (!isGrabbed) return
    const at = locate(cols, task.id)
    if (!at) return
    const colIndex = cols.findIndex((c) => c.id === at.col)
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft'
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight'

    let to: Slot | null = null
    if (reorderable && e.key === 'ArrowUp') to = { col: at.col, index: Math.max(0, at.index - 1) }
    if (reorderable && e.key === 'ArrowDown') to = { col: at.col, index: Math.min(cols[colIndex].tasks.length - 1, at.index + 1) }
    const step = e.key === prevKey ? -1 : e.key === nextKey ? 1 : 0
    if (step) {
      // skip over columns the card may not enter
      for (let i = colIndex + step; i >= 0 && i < cols.length; i += step) {
        if (allowed(task, originRef.current?.col ?? at.col, cols[i].id)) {
          to = { col: cols[i].id, index: reorderable ? Math.min(at.index, cols[i].tasks.length) : cols[i].tasks.length }
          break
        }
      }
      if (!to) {
        e.preventDefault()
        setAnnouncement(messages.notAllowed(task.title, cols[colIndex + step]?.name ?? ''))
        return
      }
    }

    if (to) {
      e.preventDefault()
      move(task.id, to, { persist: false })
      setAnnouncement(messages.moved(task.title, colName(to.col), to.index + 1))
    }
  }

  /* ------------------------------------------------------------ render */

  const dragged = drag ? locate(cols, drag.taskId) : null
  const fill = columnWidth === 'fill'

  return (
    <div
      ref={setRoot}
      style={style}
      className={cn(
        // a board is dragged, not read: stop drags painting text selection
        'w-full select-none text-neutral-950 antialiased dark:text-neutral-50',
        className
      )}
      onClickCapture={onClickCapture}
      {...props}
    >
      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        onScroll={syncEdges}
        style={mask ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties) : undefined}
        className={cn(
          'flex items-start gap-3 overflow-x-auto pb-1',
          // the native bar is hidden; ScrollRail below draws our own
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        <LayoutGroup>
          {cols.map((col) => {
            const isTarget = slot?.col === col.id && !!drag
            const refuses = !!drag && !!dragged && !allowed(dragged.task, drag.fromCol, col.id)
            const hint = refuses && blockedHint && dragged ? blockedHint(dragged.task, drag!.fromCol, col.id) : undefined
            const visible = col.tasks.filter((t) => t.id !== drag?.taskId)
            return (
              <div
                key={col.id}
                data-kanban-column={col.id}
                ref={(el) => {
                  if (el) colRefs.current.set(col.id, el)
                  else colRefs.current.delete(col.id)
                }}
                style={fill ? { minWidth: minColumnWidth } : { width: columnWidth }}
                className={cn(
                  'group/col shrink-0 rounded-[16px] p-2.5 transition-[background-color,opacity] duration-200',
                  fill && 'flex-1 basis-0',
                  'bg-neutral-100/70 dark:bg-white/[0.04]',
                  isTarget && drag!.fromCol !== col.id && 'bg-neutral-200/70 ring-2 ring-inset ring-neutral-900/10 dark:bg-white/[0.08]',
                  refuses && 'opacity-45',
                  SQUIRCLE
                )}
              >
                <ColumnHeader
                  col={col}
                  /* while a card is in the air the counts show where it
                     would land, not where it came from */
                  count={col.tasks.length - (drag && drag.fromCol === col.id ? 1 : 0) + (drag && slot?.col === col.id ? 1 : 0)}
                  action={renderColumnAction?.(col)}
                />

                <div
                  ref={(el) => {
                    if (el) listRefs.current.set(col.id, el)
                    else listRefs.current.delete(col.id)
                  }}
                  className="mt-2.5 flex min-h-[56px] flex-col gap-2"
                >
                  {/*
                    The card in the air is taken out of the list, so the
                    placeholder has to be placed against the list without
                    it. Measuring in one index space and rendering in the
                    other is what makes same-column reordering quietly do
                    nothing.
                  */}
                  {visible.map((task, i) => (
                    <React.Fragment key={task.id}>
                      {isTarget && slot!.index === i && <Placeholder height={drag!.height} />}
                      <Card
                        task={task}
                        grabbed={grabbed === task.id}
                        reduceMotion={!!reduceMotion}
                        ariaLabel={messages.pickUp(task.title)}
                        roleDescription={messages.draggableCard}
                        elRef={(el) => {
                          if (el) cardRefs.current.set(task.id, el)
                          else cardRefs.current.delete(task.id)
                        }}
                        onPointerDown={(e) => pressCard(e, task, col.id, i)}
                        onKeyDown={(e) => onCardKeyDown(e, task)}
                      >
                        {renderCard ? renderCard(task, { floating: false }) : <CardShell task={task} />}
                      </Card>
                    </React.Fragment>
                  ))}
                  {isTarget && slot!.index >= visible.length && <Placeholder height={drag!.height} />}
                  {!visible.length && !isTarget ? (
                    <div
                      className={cn(
                        'grid min-h-[56px] place-items-center rounded-[12px] border border-dashed px-3 py-4 text-center text-[12px]',
                        'border-neutral-300/80 text-neutral-500 dark:border-white/15 dark:text-neutral-400',
                        SQUIRCLE
                      )}
                    >
                      {hint ?? emptyLabel ?? '—'}
                    </div>
                  ) : hint ? (
                    <p className="px-1 text-center text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">{hint}</p>
                  ) : null}
                </div>

                {onAddTask ? (
                  <button
                    type="button"
                    onClick={() => onAddTask(col.id)}
                    className={cn(
                      'mt-2 flex w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-[12.5px] font-medium',
                      'text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-800',
                      'dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100',
                      SQUIRCLE
                    )}
                  >
                    <Plus aria-hidden className="h-3.5 w-3.5" />
                    {addTaskLabel}
                  </button>
                ) : null}
              </div>
            )
          })}
        </LayoutGroup>
      </div>

      <ScrollRail trackRef={trackRef} rtl={rtl} />

      {/* the card riding the cursor */}
      <AnimatePresence>
        {drag && dragged && (
          <motion.div
            style={{ x, y, width: drag.width }}
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: reduceMotion ? 1 : 1.03, rotate: reduceMotion ? 0 : rtl ? -1.6 : 1.6 }}
            exit={{ scale: 1, rotate: 0, opacity: 0 }}
            transition={LIFT_SPRING}
            className="pointer-events-none fixed left-0 top-0 z-[9999] origin-top-left"
          >
            <div className="rounded-[12px] shadow-[0_18px_36px_-12px_rgb(0_0_0/0.3)]">
              {renderCard ? renderCard(dragged.task, { floating: true }) : <CardShell task={dragged.task} floating />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
})

/* ------------------------------------------------------------------ parts */

/**
 * Our own horizontal scrollbar.
 *
 * The native one is no help here: on macOS, and in most headless browsers,
 * it is an overlay that stays hidden until you are already scrolling, which
 * is the one moment you no longer need to be told the board scrolls. This
 * one is always visible while there is somewhere to go, and you can drag it.
 */
function ScrollRail({ trackRef, rtl }: { trackRef: React.RefObject<HTMLDivElement | null>; rtl: boolean }) {
  const railRef = React.useRef<HTMLDivElement>(null)
  const [geom, setGeom] = React.useState({ ratio: 1, offset: 0 })
  const [held, setHeld] = React.useState(false)

  const sync = React.useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const ratio = el.clientWidth / el.scrollWidth
    const max = el.scrollWidth - el.clientWidth
    setGeom({ ratio, offset: max > 0 ? Math.abs(el.scrollLeft) / max : 0 })
  }, [trackRef])

  React.useEffect(() => {
    const el = trackRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    Array.from(el.children).forEach((c) => ro.observe(c))
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [sync, trackRef])

  const scrollTo = React.useCallback(
    (clientX: number) => {
      const rail = railRef.current
      const el = trackRef.current
      if (!rail || !el) return
      const r = rail.getBoundingClientRect()
      const thumbW = r.width * geom.ratio
      const fromStart = rtl ? r.right - clientX : clientX - r.left
      const p = Math.max(0, Math.min(1, (fromStart - thumbW / 2) / (r.width - thumbW)))
      el.scrollLeft = (rtl ? -1 : 1) * p * (el.scrollWidth - el.clientWidth)
    },
    [geom.ratio, rtl, trackRef]
  )

  React.useEffect(() => {
    if (!held) return
    const onMove = (e: PointerEvent) => scrollTo(e.clientX)
    const onUp = () => setHeld(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [held, scrollTo])

  if (geom.ratio >= 0.999) return null

  return (
    <div
      ref={railRef}
      onPointerDown={(e) => {
        setHeld(true)
        scrollTo(e.clientX)
      }}
      className="mt-3 h-[6px] w-full cursor-pointer rounded-full bg-black/[0.05] dark:bg-white/[0.07]"
    >
      <div
        style={{ width: `${geom.ratio * 100}%`, marginInlineStart: `${geom.offset * (100 - geom.ratio * 100)}%` }}
        className={cn(
          'h-full rounded-full transition-colors',
          held ? 'bg-black/40 dark:bg-white/50' : 'bg-black/20 hover:bg-black/30 dark:bg-white/25 dark:hover:bg-white/40'
        )}
      />
    </div>
  )
}

function ColumnHeader({ col, count, action }: { col: KanbanColumn; count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1">
      {col.icon ? (
        <span className="flex shrink-0 text-neutral-500 dark:text-neutral-400">{col.icon}</span>
      ) : (
        <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT_DOT[col.accent ?? 'slate'])} />
      )}
      <h3 className="m-0 truncate text-[13px] font-semibold tracking-[-0.005em]">{col.name}</h3>
      <motion.span
        key={count}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={FLOW_SPRING}
        className={cn(
          'ms-auto grid h-[20px] min-w-[20px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums shadow-sm',
          'text-neutral-500 dark:bg-white/[0.09] dark:text-neutral-400'
        )}
      >
        {count}
      </motion.span>
      {action ? <span className="flex items-center">{action}</span> : null}
    </div>
  )
}

function Placeholder({ height }: { height: number }) {
  return (
    <motion.div
      layout
      data-kanban-placeholder
      initial={{ opacity: 0, scaleY: 0.7 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.7 }}
      transition={FLOW_SPRING}
      style={{ height }}
      className={cn('origin-top rounded-[12px] border border-dashed', 'border-neutral-300 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.03]', SQUIRCLE)}
    />
  )
}

function Card({
  task,
  grabbed,
  reduceMotion,
  ariaLabel,
  roleDescription,
  elRef,
  onPointerDown,
  onKeyDown,
  children,
}: {
  task: KanbanTask
  grabbed: boolean
  reduceMotion: boolean
  ariaLabel: string
  roleDescription: string
  elRef: (_el: HTMLDivElement | null) => void
  onPointerDown: (_e: React.PointerEvent) => void
  onKeyDown: (_e: React.KeyboardEvent) => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      ref={elRef}
      layout
      data-kanban-card={task.id}
      tabIndex={0}
      aria-roledescription={roleDescription}
      aria-pressed={grabbed}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      transition={reduceMotion ? { duration: 0 } : FLOW_SPRING}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        'cursor-grab touch-none active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/25 dark:focus-visible:ring-white/30',
        grabbed && 'ring-2 ring-neutral-900/40 dark:ring-white/50',
        'rounded-[12px]',
        SQUIRCLE
      )}
    >
      {children}
    </motion.div>
  )
}

function CardShell({ task, floating }: { task: KanbanTask; floating?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[12px] border p-3',
        'border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-neutral-900',
        floating ? 'shadow-[0_16px_32px_-12px_rgb(0_0_0/0.28)]' : 'shadow-[0_1px_2px_rgb(0_0_0/0.05)]',
        SQUIRCLE
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span className={cn(CHIP, 'font-medium', PRIORITY_STYLES[task.priority], SQUIRCLE)}>
            <Flag aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span>{PRIORITY_LABELS[task.priority]}</span>
          </span>
        )}
        {task.category && (
          <span className={cn(CHIP, 'font-normal', 'bg-neutral-100 text-neutral-600 dark:bg-white/[0.07] dark:text-neutral-300', SQUIRCLE)}>
            <TaskIcon icon={task.icon} />
            <span>{task.category}</span>
          </span>
        )}
      </div>

      <p className="m-0 mt-2.5 text-[14px] font-medium leading-snug tracking-[-0.005em]">{task.title}</p>

      {task.note && <p className="m-0 mt-1 text-[12px] font-normal leading-snug text-neutral-500 dark:text-neutral-400">{task.note}</p>}

      {(task.assignees?.length || task.due || task.progress != null) && (
        <>
          <div className="mt-3 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {task.due && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11.5px] font-normal tabular-nums',
                    task.dueSoon ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'
                  )}
                >
                  <CalendarDays aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                  {task.due}
                </span>
              )}
              {task.progress != null && <ProgressRing value={task.progress} />}
            </div>
            <AvatarStack people={task.assignees ?? []} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * A callout that points at whatever it is wrapped around, on hover or focus.
 * The tail is a rotated square sitting half outside the bubble, so it reads
 * as one shape rather than a label floating nearby.
 */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const skin = 'bg-neutral-900 dark:bg-neutral-100'
  return (
    <span className="group/tip relative flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2',
          'translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'group-hover/tip:translate-y-0 group-hover/tip:opacity-100',
          'group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100'
        )}
      >
        <span
          className={cn(
            'block whitespace-nowrap rounded-[7px] px-2 py-1 text-[11px] font-medium leading-none',
            'text-white dark:text-neutral-900',
            skin,
            'shadow-[0_6px_16px_-4px_rgb(0_0_0/0.3)]',
            SQUIRCLE
          )}
        >
          {label}
        </span>
        <span aria-hidden className={cn('absolute left-1/2 top-full h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]', skin)} />
      </span>
    </span>
  )
}

function AvatarStack({ people }: { people: KanbanAssignee[] }) {
  const shown = people.slice(0, 3)
  const rest = people.slice(3)
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name + i} className={cn(i > 0 && '-ms-1.5')}>
          <Tooltip label={p.name}>
            <span
              tabIndex={0}
              aria-label={p.name}
              className={cn(
                'grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full',
                'ring-2 ring-white dark:ring-neutral-900',
                'focus-visible:outline-none focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
              )}
            >
              {p.avatar ? <img src={p.avatar} alt="" draggable={false} className="h-full w-full object-cover" /> : <Initials name={p.name} />}
            </span>
          </Tooltip>
        </span>
      ))}
      {rest.length > 0 && (
        <span className="-ms-1.5">
          <Tooltip label={rest.map((p) => p.name).join(', ')}>
            <span
              tabIndex={0}
              className={cn(
                'grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-medium',
                'bg-neutral-200 text-neutral-600 ring-2 ring-white',
                'dark:bg-white/15 dark:text-neutral-200 dark:ring-neutral-900',
                'focus-visible:outline-none focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
              )}
            >
              +{rest.length}
            </span>
          </Tooltip>
        </span>
      )}
    </div>
  )
}

const INITIAL_TINTS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500']

function Initials({ name }: { name: string }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return <span className={cn('grid h-full w-full place-items-center text-[9.5px] font-medium text-white', INITIAL_TINTS[h % INITIAL_TINTS.length])}>{initials}</span>
}

function ProgressRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const r = 6
  const c = 2 * Math.PI * r
  const done = v >= 100
  return (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="0 0 16 16" aria-hidden className="h-[14px] w-[14px] -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-black/[0.09] dark:stroke-white/15" />
        <motion.circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * v) / 100 }}
          transition={FLOW_SPRING}
          className={done ? 'stroke-emerald-500' : 'stroke-neutral-900 dark:stroke-neutral-100'}
        />
      </svg>
      <span className="text-[11.5px] font-normal tabular-nums text-neutral-500 dark:text-neutral-400">{v}%</span>
    </span>
  )
}

/* ------------------------------------------------------------------ icons */

export type IconKey = 'web' | 'dashboard' | 'mobile' | 'brand' | 'infra' | 'docs'

/** Category icons, from lucide, each with the tint it wears in the chip. */
const CATEGORY_ICONS: Record<IconKey, { Icon: LucideIcon; tint: string }> = {
  web: { Icon: Monitor, tint: 'text-blue-500' },
  dashboard: { Icon: LayoutDashboard, tint: 'text-emerald-500' },
  mobile: { Icon: Smartphone, tint: 'text-violet-500' },
  brand: { Icon: Palette, tint: 'text-rose-500' },
  infra: { Icon: Server, tint: 'text-amber-500' },
  docs: { Icon: FileText, tint: 'text-teal-500' },
}

function TaskIcon({ icon }: { icon?: IconKey | React.ReactNode }) {
  if (icon && typeof icon !== 'string') return <>{icon}</>
  const { Icon, tint } = CATEGORY_ICONS[(icon as IconKey) ?? 'web'] ?? CATEGORY_ICONS.web
  // lucide strokes are sized for 24px; nudge them up so they hold at 12px
  return <Icon aria-hidden className={cn('h-3 w-3 shrink-0', tint)} strokeWidth={2.25} />
}

export default KanbanBoard

export { KanbanBoard as Component }
