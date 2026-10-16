'use client'
import React from 'react'
import { iconFor, doorPlacement, nearestSide, type RenderStatus } from './geometry'
import './floorplan.css'

/* =====================================================================
   <FloorPlanSvg /> — pure SVG renderer for one floor (explicit geometry).
   Used by the live view (<FloorPlanView/>) and the editor (<FloorPlanEditor/>).
   ===================================================================== */

export function Icon({ name, size = 14, x = 0, y = 0, className }: { name: string; size?: number; x?: number; y?: number; className?: string }) {
  const P: Record<string, React.ReactNode> = {
    projector: <><rect x="2" y="7" width="20" height="10" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h4M14 14h4M6 17v2M18 17v2" /></>,
    monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    board: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M7 9h10M7 12h6M12 16v4M9 20h6" /></>,
    snow: <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />,
    wifi: <><path d="M2 9a14 14 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" /></>,
    video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3z" /></>,
    audio: <><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>,
    stage: <path d="M3 20h18M5 20V9l7-4 7 4v11M9 20v-6h6v6" />,
    access: <><circle cx="12" cy="4.5" r="2" /><path d="M11 8v6h6l2 6M7 11a5.5 5.5 0 1 0 8 6" /></>,
    coffee: <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8zM16 10h2a2 2 0 0 1 0 4h-2M6 2v3M10 2v3" />,
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    lab: <path d="M9 3h6M10 3v6l-5.5 9A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3" />,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13a6 6 0 0 1 4 6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5h10" /></>,
    undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
    redo: <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />,
    room: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h7V4" /></>,
    door: <path d="M4 20h16M6 20V4h9v16M12 12h1" />,
    entrance: <path d="M4 20h16M7 20V5h10v15M12 20v-6M9 14h6" />,
    stairs: <path d="M4 20h4v-4h4v-4h4V8h4" />,
    lift: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18M8 10l1.5-2 1.5 2M14 14l1.5 2 1.5-2" /></>,
    corridor: <path d="M3 8h18M3 16h18M8 12h2M14 12h2" />,
    wc: <><circle cx="8" cy="5" r="2" /><path d="M6 9h4v6H9v5H7v-5H6zM16 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M13.5 9h5l1 6h-2v5h-3v-5h-2z" /></>,
    label: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
    grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 19h16" />,
    upload: <path d="M12 15V3m-5 5 5-5 5 5M4 19h16" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    pencil: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
    link: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
    dot: <circle cx="12" cy="12" r="4" />
  };
  return (
    <svg className={className} x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || P.dot}
    </svg>
  );
}

/* ---------- small pieces ---------- */
function Door({ transform, width, wall }: { transform: string; width: number; wall: number }) {
  return (
    <g className="fp-door" transform={transform}>
      <rect className="fp-door-opening" x="0" y={-(wall / 2 + 1)} width={width} height={wall + 2} />
      <path className="fp-door-swing" d={`M0 ${-width} A${width} ${width} 0 0 1 ${width} 0`} />
      <line className="fp-door-leaf" x1="0" y1="0" x2="0" y2={-width} />
    </g>
  );
}

const DEFAULT_LABELS: Record<RenderStatus, string> = { available: 'Available', booked: 'Booked', maintenance: 'Maintenance', inactive: 'Inactive' }
const SHORT_LABELS: Partial<Record<RenderStatus, string>> = { available: 'FREE', maintenance: 'MAINT.', inactive: 'OFF' }

function RoomCard({ room, status, appearance, selected, dimmed, viewer, handlers, statusLabel, seatsLabel }: any) {
  const { rect } = room;
  const ww = appearance.wallWidth, inset = ww / 2 + 2, rx = appearance.radius;
  const x = rect.x + inset, y = rect.y + inset, w = rect.w - inset * 2, h = rect.h - inset * 2;
  const cx = x + w / 2, cy = y + h / 2;
  const kind = room.kind || 'room';
  const common = {
    'data-id': room.id, 'data-type': 'room',
    onPointerDown: handlers.onPointerDown && ((e: React.PointerEvent) => handlers.onPointerDown(e, room, 'room')),
    onClick: handlers.onClick && ((e: React.MouseEvent) => handlers.onClick(e, room, 'room')),
    onMouseEnter: handlers.onHover && ((e: React.MouseEvent) => handlers.onHover(room, status, e)),
    onMouseMove: handlers.onHover && ((e: React.MouseEvent) => handlers.onHover(room, status, e)),
    onMouseLeave: handlers.onLeave
  };

  if (kind !== 'room') {
    return (
      <g className={`fp-area fp-area-${kind}${selected ? ' is-selected' : ''}`} {...common}>
        <rect id={`room-${room.id}`} className="fp-room-shape" data-name={room.name} data-kind={kind} x={x} y={y} width={w} height={h} rx={rx} />
        <text className="fp-area-label" x={cx} y={y + 20}>{room.name}</text>
        {kind === 'reception' && w > 60 && h > 60 && (<>
          <rect className="fp-desk" x={cx - Math.min(44, w / 2 - 12)} y={cy - 4} width={Math.min(88, w - 24)} height="16" rx="6" />
          <circle className="fp-chair" cx={cx} cy={cy + 26} r="6" />
          <circle className="fp-plant" cx={x + w - 14} cy={y + h - 14} r="6" />
        </>)}
        {kind === 'lobby' && w > 90 && h > 50 && [0, 1, 2].map((i: number) => <rect key={i} className="fp-chair" x={cx - 30 + i * 22} y={cy + 4} width="16" height="12" rx="3" />)}
      </g>
    );
  }

  const facs: string[] = room.facilities || [];
  const compact = h < 90 || w < 90;
  const tiny = h < 56 || w < 64;
  let pill = String(statusLabel(status)).toUpperCase();
  const pw = (l: string) => l.length * 6.6 + 24;
  if (pw(pill) > w - 24) pill = SHORT_LABELS[status as RenderStatus] || pill;
  if (pw(pill) > w - 24 || tiny) pill = '';
  const pillW = pill ? pw(pill) : 18;
  const nameSize = Math.max(9, Math.min(15, (w - 16) / (String(room.name).length * 0.6)));
  const capText = seatsLabel(room.capacity);
  const capW = capText.length * 6.4 + 18;
  const chip = 22, gap = 4;
  const showChips = appearance.showChips && !compact && facs.length > 0;
  const maxChips = Math.max(0, Math.floor((w - 20 + gap) / (chip + gap)));
  const shown = facs.length > maxChips ? facs.slice(0, Math.max(0, maxChips - 1)) : facs;
  const over = facs.length - shown.length, total = shown.length + (over ? 1 : 0);
  const facX0 = cx - (total * chip + (total - 1) * gap) / 2;
  const showCap = appearance.showCapacity && !tiny;
  const nameY = tiny ? cy : compact ? cy - 7 : cy - 3;

  return (
    <g className={`fp-room fp-${status}${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      tabIndex={viewer && !dimmed ? 0 : undefined} role={viewer ? 'button' : undefined}
      aria-label={viewer ? `${room.name}, ${capText}, ${statusLabel(status)}` : undefined}
      onKeyDown={viewer && handlers.onClick ? ((e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.onClick(e, room, 'room'); } }) : undefined}
      {...common}>
      <defs><clipPath id={`clip-${room.id}`}><rect x={x} y={y} width={w} height={h} rx={rx} /></clipPath></defs>
      <rect id={`room-${room.id}`} className="fp-room-shape" x={x} y={y} width={w} height={h} rx={rx}
        data-name={room.name} data-capacity={room.capacity} data-status={status} data-facilities={facs.join('|')} />
      <rect className="fp-room-strip" x={x} y={y} width={w} height="6" clipPath={`url(#clip-${room.id})`} />
      {!tiny && (
        <g className="fp-pill" transform={`translate(${x + w - 9 - pillW},${y + 13})`}>
          <rect width={pillW} height="15" rx="7.5" />
          <circle cx="9" cy="7.5" r="2.5" />
          {pill && <text x="15" y="8">{pill}</text>}
        </g>
      )}
      <text className="fp-room-name" x={cx} y={nameY} style={{ fontSize: nameSize }}>{room.name}</text>
      {showCap && (
        <g className="fp-room-cap" transform={`translate(${cx - capW / 2},${nameY + 12})`}>
          <Icon name="users" size={13} />
          <text x="18" y="7">{capText}</text>
        </g>
      )}
      {showChips && total > 0 && (
        <g className="fp-fac" transform={`translate(${facX0},${y + h - chip - 9})`}>
          {shown.map((f: string, i: number) => (
            <g key={i} className="fp-fac-chip" transform={`translate(${i * (chip + gap)},0)`}>
              <title>{f}</title><rect width={chip} height={chip} rx="6" /><Icon name={iconFor(f)} size={13} x={4.5} y={4.5} />
            </g>
          ))}
          {over > 0 && (
            <g className="fp-fac-chip fp-fac-more" transform={`translate(${shown.length * (chip + gap)},0)`}>
              <title>{facs.slice(shown.length).join(', ')}</title><rect width={chip} height={chip} rx="6" /><text x={chip / 2} y={chip / 2 + 1}>+{over}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function Fixture({ fx, canvas, appearance, selected, handlers }: any) {
  const { rect, type } = fx;
  const { x, y, w, h } = rect;
  const cx = x + w / 2, cy = y + h / 2;
  const common = {
    'data-id': fx.id, 'data-type': 'fixture',
    className: `fp-fixture fp-fx-${type}${selected ? ' is-selected' : ''}`,
    onPointerDown: handlers.onPointerDown && ((e: React.PointerEvent) => handlers.onPointerDown(e, fx, 'fixture')),
    onClick: handlers.onClick && ((e: React.MouseEvent) => handlers.onClick(e, fx, 'fixture'))
  };
  const horizontal = w >= h;

  if (type === 'entrance') {
    const side = nearestSide(rect, canvas);
    const dw = 28, ww = appearance.wallWidth + 2;
    let a: string, b: string, lx = cx, ly = cy;
    if (side === 'bottom') { a = `translate(${cx - dw},${canvas.h})`; b = `translate(${cx + dw},${canvas.h}) scale(-1,1)`; ly = canvas.h + 18; }
    else if (side === 'top') { a = `translate(${cx - dw},0) scale(1,-1)`; b = `translate(${cx + dw},0) scale(-1,-1)`; ly = -11; }
    else if (side === 'left') { a = `translate(0,${cy - dw}) rotate(90)`; b = `translate(0,${cy + dw}) rotate(90) scale(-1,1)`; lx = -16; }
    else { a = `translate(${canvas.w},${cy + dw}) rotate(-90)`; b = `translate(${canvas.w},${cy - dw}) rotate(-90) scale(-1,1)`; lx = canvas.w + 16; }
    return (
      <g {...common}>
        <rect className="fp-fx-hit" x={x} y={y} width={w} height={h} rx="4" />
        <Door transform={a} width={dw} wall={ww} /><Door transform={b} width={dw} wall={ww} />
        <text className="fp-label" x={lx} y={ly} textAnchor="middle" transform={side === 'left' || side === 'right' ? `rotate(-90 ${lx} ${ly})` : undefined}>{fx.label || 'ENTRANCE'}</text>
      </g>
    );
  }
  if (type === 'corridor') {
    return (
      <g {...common}>
        <rect className="fp-corridor" x={x} y={y} width={w} height={h} />
        {horizontal ? <line className="fp-hall-line" x1={x + 12} y1={cy} x2={x + w - 12} y2={cy} /> : <line className="fp-hall-line" x1={cx} y1={y + 12} x2={cx} y2={y + h - 12} />}
        {fx.label && <text className="fp-label" x={cx} y={cy + 3} textAnchor="middle">{fx.label}</text>}
      </g>
    );
  }
  if (type === 'stairs') {
    const n = Math.max(3, Math.floor((horizontal ? w : h) / 12));
    return (
      <g {...common}>
        <rect className="fp-core" x={x} y={y} width={w} height={h} />
        {Array.from({ length: n + 1 }, (_, i) => horizontal
          ? <line key={i} className="fp-step" x1={x + 6 + ((w - 12) * i) / n} y1={y + 6} x2={x + 6 + ((w - 12) * i) / n} y2={y + h - 6} />
          : <line key={i} className="fp-step" x1={x + 6} y1={y + 6 + ((h - 12) * i) / n} x2={x + w - 6} y2={y + 6 + ((h - 12) * i) / n} />)}
        <text className="fp-label fp-label-bg" x={cx} y={cy + 3} textAnchor="middle">{fx.label || 'STAIRS'}</text>
      </g>
    );
  }
  if (type === 'lift') {
    return (
      <g {...common}>
        <rect className="fp-core" x={x} y={y} width={w} height={h} />
        <rect className="fp-lift" x={cx - 11} y={cy - 16} width="22" height="24" rx="2" />
        <line className="fp-lift-split" x1={cx} y1={cy - 16} x2={cx} y2={cy + 8} />
        <text className="fp-label" x={cx} y={cy + 22} textAnchor="middle">{fx.label || 'LIFT'}</text>
      </g>
    );
  }
  if (type === 'wc') {
    return (
      <g {...common}>
        <rect className="fp-core" x={x} y={y} width={w} height={h} rx="3" />
        <Icon name="wc" size={16} x={cx - 8} y={cy - 16} className="fp-fx-icon" />
        <text className="fp-label" x={cx} y={cy + 12} textAnchor="middle">{fx.label || 'WC'}</text>
      </g>
    );
  }
  return ( // label
    <g {...common}>
      <rect className="fp-fx-hit" x={x} y={y} width={w} height={h} rx="4" />
      <text className="fp-free-label" x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">{fx.label || 'Label'}</text>
    </g>
  );
}

/* ---------- main ---------- */
export default function FloorPlanSvg({
  floor, appearance, statusOf, selectedIds, dimmedIds, viewer = false,
  showGrid = false, grid = 20, handlers = {}, onBackgroundPointerDown, svgRef, children, className = '',
  statusLabel = (s: RenderStatus) => DEFAULT_LABELS[s] || s,
  seatsLabel = (n: number | null | undefined) => `${n ?? '—'} seats`,
  roomsOnly = false
}: {
  floor: any; appearance: any; statusOf?: (_room: any, _floor: any) => RenderStatus; selectedIds?: Set<string>; dimmedIds?: Set<string> | null;
  viewer?: boolean; showGrid?: boolean; grid?: number; handlers?: any; onBackgroundPointerDown?: (_e: React.PointerEvent<SVGSVGElement>) => void;
  svgRef?: React.Ref<SVGSVGElement>; children?: React.ReactNode; className?: string;
  statusLabel?: (_s: RenderStatus) => string; seatsLabel?: (_n: number | null | undefined) => string;
  /** Draw only the rooms, cropped to them and scaled to fill the box (pickers, previews). */
  roomsOnly?: boolean
}) {
  const { canvas } = floor;
  const ww = appearance.wallWidth;
  const pad = 26;
  const sel = (id: string) => !!selectedIds && selectedIds.has(id);
  // Pattern ids are document-global; keep two plans on one page from sharing one.
  const gridId = `fp-grid-${floor.id}`;
  let viewBox = `${-pad} ${-pad} ${canvas.w + pad * 2} ${canvas.h + pad * 2}`;
  if (roomsOnly && floor.rooms.length) {
    const xs = floor.rooms.flatMap((r: any) => [r.rect.x, r.rect.x + r.rect.w]);
    const ys = floor.rooms.flatMap((r: any) => [r.rect.y, r.rect.y + r.rect.h]);
    const m = 14;
    const minX = Math.min(...xs) - m, minY = Math.min(...ys) - m;
    const cw = Math.max(...xs) + m - minX, ch = Math.max(...ys) + m - minY;
    // Never zoom in past roughly the editor's scale: one small room stays room-sized, centred.
    const w = Math.max(cw, 560), h = Math.max(ch, 300);
    viewBox = `${minX - (w - cw) / 2} ${minY - (h - ch) / 2} ${w} ${h}`;
  }
  return (
    <svg ref={svgRef} className={`fp-svg ${roomsOnly ? 'fp-rooms-only' : ''} ${className}`} viewBox={viewBox}
      width="100%" height={roomsOnly ? '100%' : undefined} preserveAspectRatio="xMidYMid meet" role="img" data-floor-id={floor.id}
      onPointerDown={onBackgroundPointerDown}>
      <title>{floor.name}</title>
      <defs>
        <pattern id={gridId} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" className="fp-grid-line" />
        </pattern>
      </defs>
      {!roomsOnly && <rect className="fp-floor" x="0" y="0" width={canvas.w} height={canvas.h} rx="3" data-type="background" />}
      {showGrid && <rect x="0" y="0" width={canvas.w} height={canvas.h} fill={`url(#${gridId})`} pointerEvents="none" />}

      {/* fixtures first (corridors sit under rooms) */}
      <g className="fp-fixtures">
        {!roomsOnly && floor.fixtures.filter((f: any) => f.type !== 'entrance').map((fx: any) => (
          <Fixture key={fx.id} fx={fx} canvas={canvas} appearance={appearance} selected={sel(fx.id)} handlers={handlers} />
        ))}
      </g>

      {/* room walls */}
      <g className="fp-walls" style={{ strokeWidth: ww }}>
        {floor.rooms.map((r: any) => <rect key={r.id} className="fp-wall" x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} rx="2" />)}
      </g>
      {!roomsOnly && <rect className="fp-wall fp-wall-outer" x="0" y="0" width={canvas.w} height={canvas.h} rx="3" style={{ strokeWidth: ww + 2 }} />}

      <g className="fp-rooms">
        {[...floor.rooms].sort((a: any, b: any) => (sel(a.id) ? 1 : 0) - (sel(b.id) ? 1 : 0)).map((r: any) => (
          <RoomCard key={r.id} room={r} status={statusOf ? statusOf(r, floor) : 'available'} appearance={appearance}
            selected={sel(r.id)} dimmed={!!dimmedIds && !dimmedIds.has(r.id)} viewer={viewer} handlers={handlers}
            statusLabel={statusLabel} seatsLabel={seatsLabel} />
        ))}
      </g>

      <g className="fp-doors">
        {floor.rooms.flatMap((r: any) => (r.doors || []).map((d: any, i: number) => {
          const p = doorPlacement(r.rect, d);
          return <Door key={`${r.id}-${i}`} transform={p.transform} width={p.dw} wall={ww} />;
        }))}
        {!roomsOnly && floor.fixtures.filter((f: any) => f.type === 'entrance').map((fx: any) => (
          <Fixture key={fx.id} fx={fx} canvas={canvas} appearance={appearance} selected={sel(fx.id)} handlers={handlers} />
        ))}
      </g>
      {children}
    </svg>
  );
}
