/* =====================================================================
   Floor plan data model, defaults and layout helpers.
   ---------------------------------------------------------------------
   plan = {
     appearance: { radius, wallWidth, showChips, showCapacity, grid },
     floors: [{
       id, name, canvas: { w, h },
       rooms: [{ id, facility_uuid?, name, kind: 'room'|'reception'|'lobby', capacity,
                 status: 'active'|'maintenance'|'inactive', room_number, facility_type_uuid,
                 equipment: [lookup_uuid], facilities: [equipment name], note,
                 rect: { x, y, w, h }, doors: [{ side, pos: 0..1 }] }],
       fixtures: [{ id, type: 'corridor'|'entrance'|'stairs'|'lift'|'wc'|'label', rect, label }]
     }]
   }
   A bookable room (kind 'room') is a Facility; the API creates/updates it
   when the plan is saved. Rooms written without `rect` are auto-laid out.
   ===================================================================== */

export type RenderStatus = 'available' | 'booked' | 'maintenance' | 'inactive'
export type FacilityStatus = 'active' | 'maintenance' | 'inactive'

export const RENDER_STATUSES: RenderStatus[] = ['available', 'booked', 'maintenance']
export const FACILITY_STATUSES: FacilityStatus[] = ['active', 'maintenance', 'inactive']
export const ROOM_KINDS = ['room', 'reception', 'lobby'] as const
export const FIXTURE_TYPES = ['corridor', 'entrance', 'stairs', 'lift', 'wc', 'label'] as const

/** How a room looks when nothing is booked: its facility status. */
export const facilityRenderStatus = (room: any): RenderStatus =>
  room.status === 'maintenance' ? 'maintenance' : room.status === 'inactive' ? 'inactive' : 'available'

export const DEFAULT_APPEARANCE = { radius: 8, wallWidth: 6, showChips: true, showCapacity: true, grid: 20 }
export const DEFAULT_CANVAS = { w: 800, h: 500 }

export const slug = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 8)}`
export const snap = (v: number, g: number) => Math.round(v / g) * g
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/* ---------- auto layout for floors written without geometry ---------- */
export function autoLayout(floor: any) {
  const perRow = floor.roomsPerRow || 4,
    rowH = 150,
    hallH = 60
  const RX0 = 40,
    RX1 = 640,
    CX0 = 640,
    CX1 = 700,
    KX0 = 700,
    KX1 = 760
  const rooms: any[] = floor.rooms || []
  const chunks: any[][] = []
  for (let i = 0; i < rooms.length; i += perRow) chunks.push(rooms.slice(i, i + perRow))
  if (!chunks.length) chunks.push([])

  const out: any[] = [],
    fixtures: any[] = []
  let y = 40
  const placeRow = (list: any[], y0: number, doorSide: string) => {
    const sum = list.reduce((s, r) => s + (+r.size || 1), 0) || 1
    let x = RX0
    list.forEach((r) => {
      const w = Math.max(40, Math.round(((RX1 - RX0) * ((+r.size || 1) / sum)) / 20) * 20)
      out.push({ ...r, rect: { x, y: y0, w, h: rowH }, doors: r.doors || [{ side: doorSide, pos: 0.5 }] })
      x += w
    })
  }
  for (let i = 0; i < chunks.length; i += 2) {
    placeRow(chunks[i], y, 'bottom')
    y += rowH
    fixtures.push({ id: uid('fx'), type: 'corridor', rect: { x: RX0, y, w: CX1 - RX0, h: hallH } })
    y += hallH
    if (chunks[i + 1]) {
      placeRow(chunks[i + 1], y, 'top')
      y += rowH
    }
  }
  const h = y + 40
  const half = Math.round((h - 80) / 2)
  fixtures.push({ id: uid('fx'), type: 'corridor', rect: { x: CX0, y: 40, w: CX1 - CX0, h: h - 80 } })
  fixtures.push({ id: uid('fx'), type: 'lift', rect: { x: KX0, y: 40, w: KX1 - KX0, h: half } })
  fixtures.push({ id: uid('fx'), type: 'stairs', rect: { x: KX0, y: 40 + half, w: KX1 - KX0, h: h - 80 - half } })
  if (floor.entrance) fixtures.push({ id: uid('fx'), type: 'entrance', rect: { x: (CX0 + CX1) / 2 - 30, y: h - 40 - 8, w: 60, h: 16 } })
  return { canvas: { w: 800, h }, rooms: out, fixtures }
}

/* ---------- normalize: ids, geometry, defaults ---------- */
export function normalizePlan(input: any) {
  const b = input || {}
  const appearance = { ...DEFAULT_APPEARANCE, ...(b.appearance || {}) }
  const floors = (b.floors || []).map((f: any, i: number) => {
    const needsLayout = (f.rooms || []).some((r: any) => !r.rect)
    const base = needsLayout
      ? autoLayout(f)
      : { canvas: f.canvas || { ...DEFAULT_CANVAS }, rooms: f.rooms || [], fixtures: f.fixtures || [] }
    return {
      ...f,
      id: f.id || slug(f.name) || `floor-${i + 1}`,
      name: f.name || `Floor ${i + 1}`,
      canvas: base.canvas,
      rooms: base.rooms.map((r: any) => ({
        kind: 'room',
        status: 'active',
        facilities: [],
        equipment: [],
        doors: [],
        ...r,
        id: r.id || slug(r.name) || uid('room'),
        rect: { x: r.rect.x, y: r.rect.y, w: r.rect.w, h: r.rect.h },
      })),
      fixtures: base.fixtures.map((x: any) => ({ ...x, id: x.id || uid('fx') })),
    }
  })
  return { ...b, appearance, floors }
}

export const emptyPlan = (floorName: string) =>
  normalizePlan({ floors: [{ id: 'ground', name: floorName, canvas: { ...DEFAULT_CANVAS }, rooms: [], fixtures: [] }] })

/* ---------- door geometry: hinge transform for a door on a room edge ---------- */
export function doorPlacement(rect: any, door: any, width = 28) {
  const { x, y, w, h } = rect
  const dw = Math.min(width, (door.side === 'left' || door.side === 'right' ? h : w) * 0.5)
  const pos = clamp(door.pos ?? 0.5, 0.05, 0.95)
  switch (door.side) {
    case 'top':
      return { dw, transform: `translate(${x + pos * w - dw / 2},${y}) scale(1,-1)` }
    case 'left':
      return { dw, transform: `translate(${x},${y + pos * h - dw / 2}) rotate(90)` }
    case 'right':
      return { dw, transform: `translate(${x + w},${y + pos * h + dw / 2}) rotate(-90)` }
    default:
      return { dw, transform: `translate(${x + pos * w - dw / 2},${y + h})` }
  }
}

/* ---------- which outer wall is a fixture (entrance) closest to ---------- */
export function nearestSide(rect: any, canvas: any) {
  const cx = rect.x + rect.w / 2,
    cy = rect.y + rect.h / 2
  const d: [string, number][] = [
    ['top', cy],
    ['bottom', canvas.h - cy],
    ['left', cx],
    ['right', canvas.w - cx],
  ]
  return d.sort((a, b) => a[1] - b[1])[0][0]
}

/* ---------- equipment name → icon name ---------- */
const ICON_RULES: [string, string[]][] = [
  ['projector', ['projector', 'screen', 'beamer']],
  ['board', ['whiteboard', 'smartboard', 'flipchart', 'board']],
  ['monitor', ['computer', 'pc', 'laptop', 'tv', 'display', 'monitor']],
  ['snow', ['ac', 'air', 'cooling', 'climate', 'conditioning']],
  ['wifi', ['wifi', 'internet', 'network']],
  ['video', ['video', 'camera', 'conference', 'zoom', 'teams']],
  ['audio', ['audio', 'sound', 'speaker', 'microphone', 'mic']],
  ['stage', ['stage', 'podium', 'lectern']],
  ['access', ['accessible', 'wheelchair']],
  ['coffee', ['coffee', 'catering', 'kitchen']],
  ['phone', ['phone', 'telephone']],
  ['lab', ['lab', 'equipment', 'workbench']],
]
/** Short keywords ("ac", "pc", "tv") only match whole words, so "interactive" is not air conditioning. */
export const iconFor = (f: unknown) => {
  const s = String(f).toLowerCase()
  const words = s.split(/[^a-z0-9]+/)
  const hit = ICON_RULES.find(([, keys]) => keys.some((k) => (k.length <= 3 ? words.includes(k) : s.includes(k))))
  return hit ? hit[0] : 'dot'
}
