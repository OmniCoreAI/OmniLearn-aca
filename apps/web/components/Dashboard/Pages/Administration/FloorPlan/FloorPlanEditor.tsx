'use client'
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import FloorPlanSvg, { Icon } from './FloorPlanSvg'
import {
  FACILITY_STATUSES,
  FIXTURE_TYPES,
  ROOM_KINDS,
  DEFAULT_CANVAS,
  normalizePlan,
  uid,
  snap,
  clamp,
  nearestSide,
  iconFor,
  facilityRenderStatus,
} from './geometry'
import { useFloorPlanLabels } from './labels'
import './floorplan.css'

/* =====================================================================
   <FloorPlanEditor value={plan} onChange={setPlan} … />
   ---------------------------------------------------------------------
   Visual designer: drag & drop rooms/fixtures, resize, snap to grid,
   doors you drag along walls, an entrance that snaps to the outer wall,
   per-room properties, floors, undo/redo, import/export JSON.
   Bookable rooms are facilities: new ones are created when the plan is
   saved, and existing facilities can be dragged in from the side panel.
   ===================================================================== */

export interface LookupOption {
  lookup_uuid: string
  name: string
}
export interface UnplacedFacility {
  facility_uuid: string
  name: string
  capacity?: number | null
  status?: string
  room_number?: string | null
  facility_type?: { lookup_uuid: string } | null
  equipment?: { lookup_uuid: string; name: string }[]
  location_uuid?: string | null
}

const PALETTE = [
  { type: 'room', kind: 'room', icon: 'room', w: 160, h: 120 },
  { type: 'room', kind: 'reception', icon: 'users', w: 140, h: 120 },
  { type: 'room', kind: 'lobby', icon: 'coffee', w: 140, h: 100 },
  { type: 'fixture', kind: 'corridor', icon: 'corridor', w: 300, h: 60 },
  { type: 'fixture', kind: 'entrance', icon: 'entrance', w: 60, h: 16 },
  { type: 'fixture', kind: 'stairs', icon: 'stairs', w: 60, h: 120 },
  { type: 'fixture', kind: 'lift', icon: 'lift', w: 60, h: 80 },
  { type: 'fixture', kind: 'wc', icon: 'wc', w: 60, h: 60 },
  { type: 'fixture', kind: 'label', icon: 'label', w: 120, h: 24 },
]
type PaletteItem = (typeof PALETTE)[number]
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 24
const FACILITY_DRAG = 'text/fp-facility'

const snapEntrance = (rect: any, canvas: any) => {
  const side = nearestSide(rect, canvas)
  const r = { ...rect }
  if (side === 'top') r.y = 0
  else if (side === 'bottom') r.y = canvas.h - r.h
  else if (side === 'left') r.x = 0
  else r.x = canvas.w - r.w
  if (side === 'left' || side === 'right') {
    if (r.w > r.h) {
      ;[r.w, r.h] = [r.h, r.w]
      r.x = side === 'left' ? 0 : canvas.w - r.w
    }
  } else if (r.h > r.w) {
    ;[r.w, r.h] = [r.h, r.w]
    r.y = side === 'top' ? 0 : canvas.h - r.h
  }
  return r
}

/** A room for an existing facility, sized from its capacity. */
const roomFromFacility = (f: UnplacedFacility, x: number, y: number) => {
  const big = (f.capacity || 0) > 40
  return {
    id: uid('room'),
    facility_uuid: f.facility_uuid,
    kind: 'room',
    name: f.name,
    capacity: f.capacity ?? null,
    status: f.status || 'active',
    room_number: f.room_number || null,
    facility_type_uuid: f.facility_type?.lookup_uuid || null,
    equipment: (f.equipment || []).map((e) => e.lookup_uuid),
    facilities: (f.equipment || []).map((e) => e.name),
    note: '',
    rect: { x, y, w: big ? 220 : 160, h: big ? 160 : 120 },
    doors: [{ side: 'bottom', pos: 0.5 }],
  }
}

/** Copies never reuse a facility: the copy becomes a new room on save. */
const unlinkCopy = (room: any) => {
  const { facility_uuid: _drop, ...rest } = room
  return rest
}

/* ------------------------------ small UI bits ------------------------------ */
const Field = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
  <label className="fpe-field">
    <span>{label}</span>
    {children}
  </label>
)
const Num = ({ value, onChange, ...rest }: { value: any; onChange: (_v: number | '') => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) => (
  <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : +e.target.value)} {...rest} />
)

/* ------------------------------ main ------------------------------ */
export default function FloorPlanEditor({
  value,
  onChange,
  floorIdx: floorIdxProp,
  onFloorIdxChange,
  equipmentOptions = [],
  typeOptions = [],
  unplaced = [],
  facilityHref,
  equipmentHref,
  className = '',
}: {
  value: any
  onChange?: (_plan: any) => void
  floorIdx?: number
  onFloorIdxChange?: (_i: number) => void
  equipmentOptions?: LookupOption[]
  typeOptions?: LookupOption[]
  /** Facilities that can be placed on the plan (not on it yet). */
  unplaced?: UnplacedFacility[]
  facilityHref?: (_facilityUuid: string) => string
  equipmentHref?: string
  className?: string
}) {
  const { t } = useTranslation()
  const L = useFloorPlanLabels()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))

  const [building, setBuildingState] = useState(() => normalizePlan(value))
  const [innerFloorIdx, setInnerFloorIdx] = useState(0)
  const floorIdx = floorIdxProp ?? innerFloorIdx
  const setFloorIdx = (i: number) => {
    setInnerFloorIdx(i)
    onFloorIdxChange?.(i)
  }
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState('select')
  const [ui, setUi] = useState({ grid: true, snap: true })
  const history = useRef<{ past: any[]; future: any[] }>({ past: [], future: [] })
  const dragRef = useRef<any>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const grab = (e: React.SyntheticEvent) => {
    e.preventDefault()
    wrapRef.current?.focus({ preventScroll: true })
  }
  const [, bump] = useState(0)

  const floor = building.floors[Math.min(floorIdx, building.floors.length - 1)]
  const { appearance } = building
  const G = appearance.grid || 20
  const sn = (v: number) => (ui.snap ? snap(v, G) : Math.round(v))
  const equipmentName = useMemo(() => new Map(equipmentOptions.map((e) => [e.lookup_uuid, e.name])), [equipmentOptions])

  /* ---- state helpers ---- */
  const setBuilding = useCallback(
    (next: any, record = true) => {
      if (record) {
        history.current.past.push(building)
        if (history.current.past.length > 80) history.current.past.shift()
        history.current.future = []
      }
      setBuildingState(next)
      onChange?.(next)
    },
    [building, onChange]
  )
  const updateFloor = (fn: (_f: any) => any, record = true) =>
    setBuilding({ ...building, floors: building.floors.map((f: any, i: number) => (i === floorIdx ? fn(f) : f)) }, record)
  const undo = () => {
    const p = history.current.past.pop()
    if (!p) return
    history.current.future.push(building)
    setBuildingState(p)
    onChange?.(p)
    setSelection([])
  }
  const redo = () => {
    const n = history.current.future.pop()
    if (!n) return
    history.current.past.push(building)
    setBuildingState(n)
    onChange?.(n)
    setSelection([])
  }

  const items = useMemo(
    () => [...floor.rooms.map((r: any) => ({ ...r, _type: 'room' })), ...floor.fixtures.map((f: any) => ({ ...f, _type: 'fixture' }))],
    [floor]
  )
  const byId = (id: string) => items.find((i: any) => i.id === id)
  const patchItems = (ids: string[], fn: (_it: any, _type: string) => any, record = true) =>
    updateFloor(
      (f) => ({
        ...f,
        rooms: f.rooms.map((r: any) => (ids.includes(r.id) ? fn(r, 'room') : r)),
        fixtures: f.fixtures.map((x: any) => (ids.includes(x.id) ? fn(x, 'fixture') : x)),
      }),
      record
    )
  const patchRect = (ids: string[], fn: (_rect: any, _it: any) => any, record?: boolean) =>
    patchItems(
      ids,
      (it, type) => {
        let rect = fn(it.rect, it)
        rect = { ...rect, x: clamp(rect.x, 0, floor.canvas.w - rect.w), y: clamp(rect.y, 0, floor.canvas.h - rect.h) }
        if (type === 'fixture' && it.type === 'entrance') rect = snapEntrance(rect, floor.canvas)
        return { ...it, rect }
      },
      record
    )
  const deleteItems = (ids: string[]) => {
    updateFloor((f) => ({
      ...f,
      rooms: f.rooms.filter((r: any) => !ids.includes(r.id)),
      fixtures: f.fixtures.filter((x: any) => !ids.includes(x.id)),
    }))
    setSelection([])
  }
  const duplicateItems = (ids: string[]) => {
    const clones = ids
      .map(byId)
      .filter(Boolean)
      .map((it: any) => ({
        ...unlinkCopy(it),
        id: uid(it.kind || it.type),
        name: it.name ? tr('copy_of', '{{name}} copy', { name: it.name }) : it.name,
        rect: {
          ...it.rect,
          x: Math.min(it.rect.x + G, floor.canvas.w - it.rect.w),
          y: Math.min(it.rect.y + G, floor.canvas.h - it.rect.h),
        },
      }))
    updateFloor((f) => ({
      ...f,
      rooms: [...f.rooms, ...clones.filter((c: any) => c._type === 'room').map(({ _type, ...c }: any) => c)],
      fixtures: [...f.fixtures, ...clones.filter((c: any) => c._type === 'fixture').map(({ _type, ...c }: any) => c)],
    }))
    setSelection(clones.map((c: any) => c.id))
  }
  const makeItem = (p: PaletteItem, x: number, y: number, w?: number, h?: number) => {
    const rect = { x, y, w: w || p.w, h: h || p.h }
    if (p.type === 'room') {
      const n = floor.rooms.filter((r: any) => r.kind === 'room').length + 1
      const name = p.kind === 'room' ? tr('room_n', 'Room {{n}}', { n }) : L.kind(p.kind)
      return {
        id: uid(p.kind),
        name,
        kind: p.kind,
        capacity: p.kind === 'room' ? 10 : undefined,
        status: 'active',
        equipment: [],
        facilities: [],
        rect,
        doors: p.kind === 'room' ? [{ side: 'bottom', pos: 0.5 }] : [],
      }
    }
    return { id: uid(p.kind), type: p.kind, rect, label: p.kind === 'label' ? tr('label_default', 'Label') : undefined }
  }
  const insert = (item: any, isRoom: boolean) => {
    item.rect.x = clamp(item.rect.x, 0, floor.canvas.w - item.rect.w)
    item.rect.y = clamp(item.rect.y, 0, floor.canvas.h - item.rect.h)
    if (item.type === 'entrance') item.rect = snapEntrance(item.rect, floor.canvas)
    updateFloor((f) => (isRoom ? { ...f, rooms: [...f.rooms, item] } : { ...f, fixtures: [...f.fixtures, item] }))
    setSelection([item.id])
    setTool('select')
  }
  const addItem = (p: PaletteItem, x: number, y: number, w?: number, h?: number) =>
    insert(makeItem(p, sn(x), sn(y), w, h), p.type === 'room')
  const placeFacility = (f: UnplacedFacility, x?: number, y?: number) => {
    // Without a drop point, stack new rooms down the left side so they never land on top of each other.
    const n = floor.rooms.length
    const px = x ?? 20 + (n % 4) * 40
    const py = y ?? 20 + (n % 4) * 40
    const room = roomFromFacility(f, 0, 0)
    room.rect.x = sn(x != null ? px - room.rect.w / 2 : px)
    room.rect.y = sn(y != null ? py - room.rect.h / 2 : py)
    insert(room, true)
  }

  /* ---- pointer math ---- */
  const svgPoint = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }
  const beginHistory = () => {
    history.current.past.push(building)
    history.current.future = []
  }

  const handlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent, item: any) => {
        if (tool !== 'select') return
        e.stopPropagation()
        grab(e)
        const ids = e.shiftKey
          ? selection.includes(item.id)
            ? selection.filter((i) => i !== item.id)
            : [...selection, item.id]
          : selection.includes(item.id)
            ? selection
            : [item.id]
        setSelection(ids)
        const start = svgPoint(e)
        dragRef.current = { mode: 'move', start, ids, orig: Object.fromEntries(ids.map((id) => [id, byId(id)?.rect])), moved: false }
        svgRef.current!.setPointerCapture(e.pointerId)
      },
    }),
    [tool, selection, items] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element
    if (target.getAttribute('data-type') !== 'background' && target !== svgRef.current) return
    grab(e)
    const p = svgPoint(e)
    if (tool === 'select') {
      setSelection([])
      return
    }
    const pal = PALETTE.find((x) => `${x.type}:${x.kind}` === tool)
    dragRef.current = { mode: 'draw', pal, start: { x: sn(p.x), y: sn(p.y) }, cur: { x: sn(p.x), y: sn(p.y) } }
    svgRef.current!.setPointerCapture(e.pointerId)
    bump((n) => n + 1)
  }
  const onHandleDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation()
    grab(e)
    const id = selection[0]
    const it = byId(id)
    if (!it) return
    dragRef.current = { mode: 'resize', handle, id, start: svgPoint(e), orig: it.rect, moved: false }
    svgRef.current!.setPointerCapture(e.pointerId)
  }
  const onDoorDown = (e: React.PointerEvent, roomId: string, index: number) => {
    e.stopPropagation()
    grab(e)
    dragRef.current = { mode: 'door', id: roomId, index, moved: false }
    svgRef.current!.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const p = svgPoint(e)
    if (d.mode === 'move') {
      const dx = p.x - d.start.x,
        dy = p.y - d.start.y
      if (!d.moved && Math.hypot(dx, dy) < 2) return
      if (!d.moved) {
        d.moved = true
        beginHistory()
      }
      patchRect(d.ids, (r, it) => ({ ...d.orig[it.id], x: sn(d.orig[it.id].x + dx), y: sn(d.orig[it.id].y + dy) }), false)
    } else if (d.mode === 'resize') {
      if (!d.moved) {
        d.moved = true
        beginHistory()
      }
      const o = d.orig,
        h = d.handle
      let x = o.x,
        y = o.y,
        w = o.w,
        hgt = o.h
      const px = sn(p.x),
        py = sn(p.y)
      if (h.includes('e')) w = Math.max(MIN, px - o.x)
      if (h.includes('s')) hgt = Math.max(MIN, py - o.y)
      if (h.includes('w')) {
        const nx = Math.min(px, o.x + o.w - MIN)
        w = o.x + o.w - nx
        x = nx
      }
      if (h.includes('n')) {
        const ny = Math.min(py, o.y + o.h - MIN)
        hgt = o.y + o.h - ny
        y = ny
      }
      patchRect([d.id], () => ({ x, y, w, h: hgt }), false)
    } else if (d.mode === 'door') {
      const room = byId(d.id)
      if (!room) return
      if (!d.moved) {
        d.moved = true
        beginHistory()
      }
      const { x, y, w, h } = room.rect
      const dist: Record<string, number> = {
        top: Math.abs(p.y - y),
        bottom: Math.abs(p.y - (y + h)),
        left: Math.abs(p.x - x),
        right: Math.abs(p.x - (x + w)),
      }
      const side = Object.keys(dist).sort((a, b) => dist[a] - dist[b])[0]
      const pos = side === 'top' || side === 'bottom' ? clamp((p.x - x) / w, 0.08, 0.92) : clamp((p.y - y) / h, 0.08, 0.92)
      patchItems([d.id], (r) => ({ ...r, doors: r.doors.map((dr: any, i: number) => (i === d.index ? { side, pos: +pos.toFixed(3) } : dr)) }), false)
    } else if (d.mode === 'draw') {
      d.cur = { x: sn(p.x), y: sn(p.y) }
      bump((n) => n + 1)
    }
  }
  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.mode === 'draw') {
      const x = Math.min(d.start.x, d.cur.x),
        y = Math.min(d.start.y, d.cur.y)
      const w = Math.abs(d.cur.x - d.start.x),
        h = Math.abs(d.cur.y - d.start.y)
      addItem(d.pal, x, y, w >= MIN ? w : undefined, h >= MIN ? h : undefined)
    } else if (d.moved) {
      onChange?.(building)
    }
    bump((n) => n + 1)
  }

  /* ---- HTML5 drag from the palette or the existing-rooms list ---- */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const p = svgPoint(e)
    const facilityUuid = e.dataTransfer.getData(FACILITY_DRAG)
    if (facilityUuid) {
      const f = unplaced.find((u) => u.facility_uuid === facilityUuid)
      if (f) placeFacility(f, p.x, p.y)
      return
    }
    const key = e.dataTransfer.getData('text/fp-item')
    const pal = PALETTE.find((x) => `${x.type}:${x.kind}` === key)
    if (pal) addItem(pal, p.x - pal.w / 2, p.y - pal.h / 2)
  }

  /* ---- keyboard ---- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      redo()
      return
    }
    if (mod && e.key.toLowerCase() === 'd' && selection.length) {
      e.preventDefault()
      duplicateItems(selection)
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
      e.preventDefault()
      deleteItems(selection)
      return
    }
    if (e.key === 'Escape') {
      setSelection([])
      setTool('select')
      return
    }
    const step = e.shiftKey ? 1 : G
    const mv = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key]
    if (mv && selection.length) {
      e.preventDefault()
      patchRect(selection, (r) => ({ ...r, x: r.x + mv[0], y: r.y + mv[1] }))
    }
  }

  /* ---- floors ---- */
  const addFloor = () => {
    const f = {
      id: uid('floor'),
      name: tr('floor_n', 'Floor {{n}}', { n: building.floors.length }),
      canvas: { ...DEFAULT_CANVAS },
      rooms: [],
      fixtures: [],
    }
    setBuilding({ ...building, floors: [...building.floors, f] })
    setFloorIdx(building.floors.length)
    setSelection([])
  }
  const duplicateFloor = () => {
    const src = floor
    const f = { ...JSON.parse(JSON.stringify(src)), id: uid('floor'), name: tr('copy_of', '{{name}} copy', { name: src.name }) }
    f.rooms = f.rooms.map((r: any) => ({ ...unlinkCopy(r), id: uid(r.kind) }))
    f.fixtures.forEach((x: any) => {
      x.id = uid(x.type)
    })
    setBuilding({ ...building, floors: [...building.floors.slice(0, floorIdx + 1), f, ...building.floors.slice(floorIdx + 1)] })
    setFloorIdx(floorIdx + 1)
  }
  const deleteFloor = () => {
    if (building.floors.length <= 1) return
    setBuilding({ ...building, floors: building.floors.filter((_: any, i: number) => i !== floorIdx) })
    setFloorIdx(Math.max(0, floorIdx - 1))
    setSelection([])
  }
  const moveFloor = (dir: number) => {
    const j = floorIdx + dir
    if (j < 0 || j >= building.floors.length) return
    const fl = [...building.floors]
    ;[fl[floorIdx], fl[j]] = [fl[j], fl[floorIdx]]
    setBuilding({ ...building, floors: fl })
    setFloorIdx(j)
  }

  /* ---- import / export ---- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(building, null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'floor-plan.json' })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const parsed = normalizePlan(JSON.parse(text))
        if (!parsed.floors.length) throw new Error(tr('import_no_floors', 'The file has no floors'))
        // Imported rooms become new facilities unless they are already on this plan.
        const here = new Set(building.floors.flatMap((f: any) => f.rooms.map((r: any) => r.facility_uuid).filter(Boolean)))
        parsed.floors.forEach((f: any) => {
          f.rooms = f.rooms.map((r: any) => (r.facility_uuid && !here.has(r.facility_uuid) ? unlinkCopy(r) : r))
        })
        setBuilding(parsed)
        setFloorIdx(0)
        setSelection([])
      } catch (err: any) {
        toast.error(tr('import_invalid', 'Invalid floor plan file: {{error}}', { error: err.message }))
      }
    })
    e.target.value = ''
  }

  /* ---- selection overlay ---- */
  const selectedIds = useMemo(() => new Set(selection), [selection])
  const single = selection.length === 1 ? byId(selection[0]) : null
  const d = dragRef.current
  const overlay = (
    <g className="fpe-overlay">
      {selection.map((id) => {
        const it = byId(id)
        return it && <rect key={id} className="fpe-sel" x={it.rect.x} y={it.rect.y} width={it.rect.w} height={it.rect.h} />
      })}
      {single && (
        <>
          {HANDLES.map((h) => {
            const { x, y, w, h: hh } = single.rect
            const cx = h.includes('w') ? x : h.includes('e') ? x + w : x + w / 2
            const cy = h.includes('n') ? y : h.includes('s') ? y + hh : y + hh / 2
            return <rect key={h} className={`fpe-handle fpe-h-${h}`} x={cx - 4} y={cy - 4} width="8" height="8" onPointerDown={(e) => onHandleDown(e, h)} />
          })}
          {single._type === 'room' &&
            (single.doors || []).map((dr: any, i: number) => {
              const { x, y, w, h } = single.rect
              const cx = dr.side === 'left' ? x : dr.side === 'right' ? x + w : x + dr.pos * w
              const cy = dr.side === 'top' ? y : dr.side === 'bottom' ? y + h : y + dr.pos * h
              return (
                <g key={i} className="fpe-door-grip" onPointerDown={(e) => onDoorDown(e, single.id, i)}>
                  <circle cx={cx} cy={cy} r="7" />
                  <Icon name="door" size={10} x={cx - 5} y={cy - 5} />
                </g>
              )
            })}
          <text className="fpe-dim" x={single.rect.x + single.rect.w / 2} y={single.rect.y - 6} textAnchor="middle">
            {single.rect.w} × {single.rect.h}
          </text>
        </>
      )}
      {d && d.mode === 'draw' && (
        <rect
          className="fpe-draw"
          x={Math.min(d.start.x, d.cur.x)}
          y={Math.min(d.start.y, d.cur.y)}
          width={Math.abs(d.cur.x - d.start.x)}
          height={Math.abs(d.cur.y - d.start.y)}
        />
      )}
    </g>
  )

  useEffect(() => {
    if (floorIdx > building.floors.length - 1) setFloorIdx(0)
  }, [building.floors.length, floorIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- properties panel ---- */
  const setApp = (patch: any) => setBuilding({ ...building, appearance: { ...appearance, ...patch } })
  const toggleEquipment = (room: any, lookupUuid: string) => {
    const on = (room.equipment || []).includes(lookupUuid)
    const equipment = on ? room.equipment.filter((x: string) => x !== lookupUuid) : [...(room.equipment || []), lookupUuid]
    patchItems([room.id], (r) => ({ ...r, equipment, facilities: equipment.map((u: string) => equipmentName.get(u) || '').filter(Boolean) }))
  }
  const actions = (ids: string[]) => (
    <div className="fpe-actions">
      <button type="button" className="fpe-btn" onClick={() => duplicateItems(ids)}>
        <Icon name="copy" size={13} /> {tr('duplicate', 'Duplicate')}
      </button>
      <button type="button" className="fpe-btn is-danger" onClick={() => deleteItems(ids)}>
        <Icon name="trash" size={13} /> {tr('remove', 'Remove')}
      </button>
    </div>
  )

  const roomPanel = (room: any) => (
    <div className="fpe-panel">
      <h3>
        <Icon name="room" size={14} /> {L.kind(room.kind)}
      </h3>
      {room.kind === 'room' &&
        (room.facility_uuid ? (
          <div className="fpe-linked">
            <Icon name="link" size={14} />
            <span>
              {tr('linked_facility', 'Linked to its facility.')}{' '}
              {facilityHref ? (
                <a href={facilityHref(room.facility_uuid)} target="_blank" rel="noreferrer">
                  {tr('open_facility', 'Open details')}
                </a>
              ) : null}
            </span>
          </div>
        ) : (
          <div className="fpe-linked is-new">
            <Icon name="plus" size={14} />
            <span>{tr('new_facility_hint', 'A new facility is created for this room when you save.')}</span>
          </div>
        ))}
      <Field label={tr('name', 'Name')}>
        <input value={room.name} onChange={(e) => patchItems([room.id], (r) => ({ ...r, name: e.target.value }))} />
      </Field>
      <Field label={tr('kind', 'Kind')}>
        <select
          value={room.kind}
          onChange={(e) =>
            patchItems([room.id], (r) => ({
              ...r,
              kind: e.target.value,
              doors: e.target.value === 'room' && !r.doors.length ? [{ side: 'bottom', pos: 0.5 }] : r.doors,
            }))
          }
        >
          {ROOM_KINDS.map((k) => (
            <option key={k} value={k}>
              {L.kind(k)}
            </option>
          ))}
        </select>
      </Field>
      {room.kind === 'room' && (
        <>
          <div className="fpe-row">
            <Field label={tr('capacity', 'Capacity')}>
              <Num min="0" value={room.capacity} onChange={(v) => patchItems([room.id], (r) => ({ ...r, capacity: v === '' ? null : v }))} />
            </Field>
            <Field label={tr('room_number', 'Room no.')}>
              <input value={room.room_number || ''} onChange={(e) => patchItems([room.id], (r) => ({ ...r, room_number: e.target.value }))} />
            </Field>
          </div>
          <div className="fpe-row">
            <Field label={tr('facility_type', 'Facility type')}>
              <select
                value={room.facility_type_uuid || ''}
                onChange={(e) => patchItems([room.id], (r) => ({ ...r, facility_type_uuid: e.target.value || null }))}
              >
                <option value="">—</option>
                {typeOptions.map((o) => (
                  <option key={o.lookup_uuid} value={o.lookup_uuid}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('status', 'Status')}>
              <select value={room.status || 'active'} onChange={(e) => patchItems([room.id], (r) => ({ ...r, status: e.target.value }))}>
                {FACILITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {L.facilityStatus(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="fpe-field">
            <span>{tr('equipment', 'Equipment')}</span>
            {equipmentOptions.length ? (
              <div className="fpe-chips">
                {equipmentOptions.map((o) => (
                  <button
                    key={o.lookup_uuid}
                    type="button"
                    className={`fp-chip${(room.equipment || []).includes(o.lookup_uuid) ? ' is-on' : ''}`}
                    onClick={() => toggleEquipment(room, o.lookup_uuid)}
                  >
                    <Icon name={iconFor(o.name)} size={12} /> {o.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="fpe-hint">{tr('no_equipment', 'No equipment in the catalog yet.')}</p>
            )}
            {equipmentHref ? (
              <a className="fpe-hint" href={equipmentHref} style={{ marginTop: 6 }}>
                {tr('manage_equipment', 'Manage the equipment list →')}
              </a>
            ) : null}
          </div>
          <Field label={tr('note', 'Note (shown on hover)')}>
            <input value={room.note || ''} onChange={(e) => patchItems([room.id], (r) => ({ ...r, note: e.target.value }))} />
          </Field>
        </>
      )}
      <div className="fpe-field">
        <span>
          {tr('doors', 'Doors')} <small>{tr('doors_hint', 'drag the door grips on the plan, or edit here')}</small>
        </span>
        {(room.doors || []).map((dr: any, i: number) => (
          <div key={i} className="fpe-door-row">
            <select
              value={dr.side}
              onChange={(e) => patchItems([room.id], (r) => ({ ...r, doors: r.doors.map((x: any, j: number) => (j === i ? { ...x, side: e.target.value } : x)) }))}
            >
              {['top', 'bottom', 'left', 'right'].map((s) => (
                <option key={s} value={s}>
                  {L.side(s)}
                </option>
              ))}
            </select>
            <input
              type="range"
              min="0.08"
              max="0.92"
              step="0.01"
              value={dr.pos}
              onChange={(e) =>
                patchItems([room.id], (r) => ({ ...r, doors: r.doors.map((x: any, j: number) => (j === i ? { ...x, pos: +e.target.value } : x)) }), false)
              }
            />
            <button
              type="button"
              className="fpe-icon-btn"
              title={tr('remove_door', 'Remove door')}
              onClick={() => patchItems([room.id], (r) => ({ ...r, doors: r.doors.filter((_: any, j: number) => j !== i) }))}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        <button type="button" className="fpe-btn" onClick={() => patchItems([room.id], (r) => ({ ...r, doors: [...r.doors, { side: 'bottom', pos: 0.5 }] }))}>
          <Icon name="plus" size={13} /> {tr('add_door', 'Add door')}
        </button>
      </div>
      <RectFields it={room} label={tr('position_size', 'Position & size')} onChange={(rect) => patchRect([room.id], () => rect)} />
      {room.facility_uuid ? <p className="fpe-hint">{tr('remove_keeps_facility', 'Removing a room from the plan keeps its facility.')}</p> : null}
      {actions([room.id])}
    </div>
  )

  const fixturePanel = (fx: any) => (
    <div className="fpe-panel">
      <h3>
        <Icon name={fx.type} size={14} /> {L.fixture(fx.type)}
      </h3>
      <Field label={tr('kind', 'Kind')}>
        <select value={fx.type} onChange={(e) => patchItems([fx.id], (x) => ({ ...x, type: e.target.value }))}>
          {FIXTURE_TYPES.map((k) => (
            <option key={k} value={k}>
              {L.fixture(k)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tr('label', 'Label')}>
        <input value={fx.label || ''} placeholder={L.fixture(fx.type).toUpperCase()} onChange={(e) => patchItems([fx.id], (x) => ({ ...x, label: e.target.value }))} />
      </Field>
      {fx.type === 'entrance' && <p className="fpe-hint">{tr('entrance_hint', 'The entrance snaps to the nearest outer wall; drag it along the wall to move it.')}</p>}
      <RectFields it={fx} label={tr('position_size', 'Position & size')} onChange={(rect) => patchRect([fx.id], () => rect)} />
      {actions([fx.id])}
    </div>
  )

  const floorPanel = (
    <div className="fpe-panel">
      <h3>
        <Icon name="pencil" size={14} /> {floor.name}
      </h3>
      <Field label={tr('floor_name', 'Floor name')}>
        <input value={floor.name} onChange={(e) => updateFloor((f) => ({ ...f, name: e.target.value }))} />
      </Field>
      <div className="fpe-row">
        <Field label={tr('width', 'Width')}>
          <Num min="200" step={G} value={floor.canvas.w} onChange={(v) => v && updateFloor((f) => ({ ...f, canvas: { ...f.canvas, w: Math.max(200, v) } }))} />
        </Field>
        <Field label={tr('height', 'Height')}>
          <Num min="160" step={G} value={floor.canvas.h} onChange={(v) => v && updateFloor((f) => ({ ...f, canvas: { ...f.canvas, h: Math.max(160, v) } }))} />
        </Field>
      </div>
      <div className="fpe-actions">
        <button type="button" className="fpe-btn" onClick={() => moveFloor(-1)} disabled={floorIdx === 0}>
          ← {tr('move_earlier', 'Earlier')}
        </button>
        <button type="button" className="fpe-btn" onClick={() => moveFloor(1)} disabled={floorIdx === building.floors.length - 1}>
          {tr('move_later', 'Later')} →
        </button>
        <button type="button" className="fpe-btn" onClick={duplicateFloor}>
          <Icon name="copy" size={13} /> {tr('duplicate', 'Duplicate')}
        </button>
        <button type="button" className="fpe-btn is-danger" onClick={deleteFloor} disabled={building.floors.length <= 1}>
          <Icon name="trash" size={13} /> {tr('delete_floor', 'Delete floor')}
        </button>
      </div>

      <h4>{tr('existing_rooms', 'Existing rooms')}</h4>
      {unplaced.length ? (
        <div className="fpe-unplaced">
          <p className="fpe-hint" style={{ margin: 0 }}>
            {tr('existing_rooms_hint', 'Facilities that are not on the plan yet. Drag one onto the floor, or click to place it.')}
          </p>
          {unplaced.map((f) => (
            <div
              key={f.facility_uuid}
              className="fpe-unplaced-item"
              draggable
              role="button"
              tabIndex={0}
              onDragStart={(e) => {
                e.dataTransfer.setData(FACILITY_DRAG, f.facility_uuid)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => placeFacility(f)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') placeFacility(f)
              }}
            >
              <Icon name="room" size={14} />
              <strong>{f.name}</strong>
              <small>{f.location_uuid ? L.seats(f.capacity) : tr('unassigned', 'No building')}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="fpe-hint">{tr('existing_rooms_none', 'Every facility of this building is on the plan. Draw a Room to add a new one.')}</p>
      )}

      <h4>{tr('look', 'Look')}</h4>
      <div className="fpe-row">
        <Field label={tr('grid', 'Grid')}>
          <select value={G} onChange={(e) => setApp({ grid: +e.target.value })}>
            {[10, 20, 25, 40].map((g) => (
              <option key={g} value={g}>
                {g}px
              </option>
            ))}
          </select>
        </Field>
        <span />
      </div>
      <Field label={tr('wall_thickness', 'Wall thickness: {{n}}', { n: appearance.wallWidth })}>
        <input type="range" min="2" max="12" value={appearance.wallWidth} onChange={(e) => setApp({ wallWidth: +e.target.value })} />
      </Field>
      <Field label={tr('corner_radius', 'Corner radius: {{n}}', { n: appearance.radius })}>
        <input type="range" min="0" max="20" value={appearance.radius} onChange={(e) => setApp({ radius: +e.target.value })} />
      </Field>
      <div className="fpe-row">
        <label className="fpe-check">
          <input type="checkbox" checked={appearance.showCapacity} onChange={(e) => setApp({ showCapacity: e.target.checked })} /> {tr('show_capacity', 'Show capacity')}
        </label>
        <label className="fpe-check">
          <input type="checkbox" checked={appearance.showChips} onChange={(e) => setApp({ showChips: e.target.checked })} /> {tr('show_icons', 'Show equipment icons')}
        </label>
      </div>
      <p className="fpe-hint">{tr('tip', 'Tip: pick a tool on the left and click-drag on the plan to draw it at the size you want, or drag a tool straight onto the plan.')}</p>
    </div>
  )

  const panel = single
    ? single._type === 'room'
      ? roomPanel(single)
      : fixturePanel(single)
    : selection.length > 1
      ? (
        <div className="fpe-panel">
          <h3>{tr('n_selected', '{{count}} items selected', { count: selection.length })}</h3>
          <p className="fpe-hint">{tr('multi_hint', 'Drag to move them together. Arrow keys nudge, Ctrl+D duplicates.')}</p>
          {actions(selection)}
        </div>
      )
      : floorPanel

  const roomCount = floor.rooms.filter((r: any) => r.kind === 'room').length
  return (
    <div ref={wrapRef} className={`fp fpe ${className}`} onKeyDown={onKeyDown} tabIndex={0}>
      {/* top bar */}
      <div className="fpe-topbar">
        <div className="fpe-floortabs">
          {building.floors.map((f: any, i: number) => (
            <button
              key={f.id}
              type="button"
              className={`fp-chip${i === floorIdx ? ' is-on' : ''}`}
              onClick={() => {
                setFloorIdx(i)
                setSelection([])
              }}
            >
              {f.name}
            </button>
          ))}
          <button type="button" className="fp-chip" onClick={addFloor} title={tr('add_floor', 'Add floor')}>
            <Icon name="plus" size={12} /> {tr('floor', 'Floor')}
          </button>
        </div>
        <div className="fpe-tools">
          <button type="button" className="fpe-icon-btn" onClick={undo} disabled={!history.current.past.length} title={tr('undo', 'Undo (Ctrl+Z)')}>
            <Icon name="undo" size={15} />
          </button>
          <button type="button" className="fpe-icon-btn" onClick={redo} disabled={!history.current.future.length} title={tr('redo', 'Redo (Ctrl+Y)')}>
            <Icon name="redo" size={15} />
          </button>
          <span className="fpe-sep" />
          <button type="button" className={`fpe-icon-btn${ui.grid ? ' is-on' : ''}`} onClick={() => setUi((u) => ({ ...u, grid: !u.grid }))} title={tr('toggle_grid', 'Toggle grid')}>
            <Icon name="grid" size={15} />
          </button>
          <button type="button" className={`fpe-btn fpe-btn-sm${ui.snap ? ' is-on' : ''}`} onClick={() => setUi((u) => ({ ...u, snap: !u.snap }))} title={tr('snap_title', 'Snap to grid')}>
            {tr('snap', 'Snap')}
          </button>
          <span className="fpe-sep" />
          <button type="button" className="fpe-btn fpe-btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={13} /> {tr('import', 'Import')}
          </button>
          <button type="button" className="fpe-btn fpe-btn-sm" onClick={exportJson}>
            <Icon name="download" size={13} /> {tr('export', 'Export')}
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
        </div>
      </div>

      <div className="fpe-body">
        {/* palette */}
        <aside className="fpe-palette" aria-label={tr('tools', 'Tools')}>
          <button type="button" className={`fpe-tool${tool === 'select' ? ' is-on' : ''}`} onClick={() => setTool('select')}>
            <Icon name="pencil" size={16} />
            <span>{tr('select', 'Select')}</span>
          </button>
          {PALETTE.map((p) => {
            const key = `${p.type}:${p.kind}`
            return (
              <button
                key={key}
                type="button"
                draggable
                className={`fpe-tool${tool === key ? ' is-on' : ''}`}
                onClick={() => setTool(tool === key ? 'select' : key)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/fp-item', key)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <Icon name={p.icon} size={16} />
                <span>{p.type === 'room' ? L.kindShort(p.kind) : L.fixture(p.kind)}</span>
              </button>
            )
          })}
        </aside>

        {/* canvas */}
        <div
          className={`fp-canvas fpe-canvas${tool !== 'select' ? ' is-drawing' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={onDrop}
        >
          <FloorPlanSvg
            svgRef={svgRef}
            floor={floor}
            appearance={appearance}
            statusOf={facilityRenderStatus}
            statusLabel={L.status}
            seatsLabel={L.seats}
            selectedIds={selectedIds}
            showGrid={ui.grid}
            grid={G}
            handlers={handlers}
            onBackgroundPointerDown={onBackgroundPointerDown}
            className="fpe-svg"
          >
            {overlay}
          </FloorPlanSvg>
          <div className="fpe-canvas-foot">
            <span>
              {tr('canvas_stats', '{{rooms}} rooms · {{fixtures}} fixtures · {{w}}×{{h}}', {
                rooms: roomCount,
                fixtures: floor.fixtures.length,
                w: floor.canvas.w,
                h: floor.canvas.h,
              })}
            </span>
            <span>{tr('shortcuts', 'Del remove · Ctrl+D duplicate · Shift+click multi-select · arrows nudge')}</span>
          </div>
        </div>

        {/* properties */}
        <aside className="fpe-props">{panel}</aside>
      </div>
      <PointerBridge svgRef={svgRef} onMove={onPointerMove} onUp={onPointerUp} />
    </div>
  )
}

/* attach move/up listeners to the svg once it exists */
function PointerBridge({
  svgRef,
  onMove,
  onUp,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>
  onMove: (_e: PointerEvent) => void
  onUp: (_e: PointerEvent) => void
}) {
  const ref = useRef({ onMove, onUp })
  ref.current = { onMove, onUp }
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const mv = (e: PointerEvent) => ref.current.onMove(e),
      up = (e: PointerEvent) => ref.current.onUp(e)
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointermove', mv)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [svgRef])
  return null
}

function RectFields({ it, label, onChange }: { it: any; label: string; onChange: (_rect: any) => void }) {
  const r = it.rect
  const set = (k: string) => (v: number | '') => {
    if (v === '') return
    onChange({ ...r, [k]: Math.max(k === 'w' || k === 'h' ? MIN : 0, v) })
  }
  return (
    <div className="fpe-field">
      <span>{label}</span>
      <div className="fpe-rect">
        <label>
          X<Num value={r.x} onChange={set('x')} />
        </label>
        <label>
          Y<Num value={r.y} onChange={set('y')} />
        </label>
        <label>
          W<Num value={r.w} onChange={set('w')} />
        </label>
        <label>
          H<Num value={r.h} onChange={set('h')} />
        </label>
      </div>
    </div>
  )
}
