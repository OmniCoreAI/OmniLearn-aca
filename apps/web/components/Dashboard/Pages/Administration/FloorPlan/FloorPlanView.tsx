'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import FloorPlanSvg, { Icon } from './FloorPlanSvg'
import { RENDER_STATUSES, normalizePlan, iconFor, facilityRenderStatus, type RenderStatus } from './geometry'
import { useFloorPlanLabels } from './labels'
import './floorplan.css'

/* =====================================================================
   <FloorPlanView />  — read-only, interactive viewer (live availability)
   ---------------------------------------------------------------------
   <FloorPlanView plan={plan} getStatus={(room, floor) => ...}
                  selectedRoomId onRoomSelect floorId onFloorChange
                  showToolbar showFloorSelector />
   ===================================================================== */


function FloorSelector({ floors, activeId, counts, onChange, ariaLabel, metaLabel }: any) {
  return (
    <nav className="fp-floors" aria-label={ariaLabel}>
      {[...floors].reverse().map((f: any) => {
        const c = counts[f.id], total = c.available + c.booked + c.maintenance || 1;
        return (
          <button key={f.id} type="button" className={`fp-floor-btn${f.id === activeId ? ' is-active' : ''}`} onClick={() => onChange(f.id)}>
            <span className="fp-floor-name">{f.name}</span>
            <span className="fp-floor-meta">{metaLabel(c)}</span>
            <span className="fp-floor-bar" aria-hidden="true">
              <i className="a" style={{ width: `${(c.available / total) * 100}%` }} />
              <i className="b" style={{ width: `${(c.booked / total) * 100}%` }} />
              <i className="m" style={{ width: `${(c.maintenance / total) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Tooltip({ data, bounds, L }: any) {
  if (!data) return null;
  const { room, status, x, y } = data;
  const flip = bounds && x > bounds.width - 240;
  return (
    <div className={`fp-tooltip fp-${status}`} style={{ left: flip ? x - 232 : x + 14, top: y + 14 }} role="tooltip">
      <div className="fp-tt-head"><span className="fp-tt-dot" /><strong>{room.name}</strong><span className="fp-tt-status">{L.status(status)}</span></div>
      <div className="fp-tt-row"><Icon name="users" size={13} /> {L.seats(room.capacity)}</div>
      {room.facilities?.length > 0 && <div className="fp-tt-fac">{room.facilities.map((f: string) => <span key={f}><Icon name={iconFor(f)} size={11} /> {f}</span>)}</div>}
      {room.note && <div className="fp-tt-note">{room.note}</div>}
    </div>
  );
}

export default function FloorPlanView({
  plan: raw, floorId, defaultFloorId, onFloorChange, selectedRoomId: selectedProp, onRoomSelect,
  getStatus = facilityRenderStatus, showToolbar = true, showSearch = true, showFloorSelector = true, roomFilter, statusLabel, legend = RENDER_STATUSES, className = ''
}: {
  plan: any; floorId?: string; defaultFloorId?: string; onFloorChange?: (_floor: any) => void;
  selectedRoomId?: string | null; onRoomSelect?: (_room: any, _floor: any) => void;
  getStatus?: (_room: any, _floor: any) => RenderStatus; showToolbar?: boolean; showFloorSelector?: boolean;
  /** Hide the room search when the page already has one. */
  showSearch?: boolean;
  /** Rooms failing it are dimmed, like the toolbar's own search (memoize it). */
  roomFilter?: ((_room: any) => boolean) | null;
  /** Override the status names (e.g. a picker calls 'inactive' "Too small"). */
  statusLabel?: (_s: RenderStatus) => string; legend?: RenderStatus[]; className?: string
}) {
  const { t } = useTranslation();
  const baseLabels = useFloorPlanLabels();
  const L = useMemo(() => (statusLabel ? { ...baseLabels, status: statusLabel } : baseLabels), [baseLabels, statusLabel]);
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts));
  const building = useMemo(() => normalizePlan(raw), [raw]);
  const { floors, appearance } = building;

  const [innerFloor, setInnerFloor] = useState(defaultFloorId || floors[0]?.id);
  const floor = floors.find((f: any) => f.id === (floorId ?? innerFloor)) || floors[0];
  const changeFloor = (id: string) => { setInnerFloor(id); onFloorChange?.(floors.find((f: any) => f.id === id)); };

  const [innerSel, setInnerSel] = useState<string | null>(null);
  const selectedRoomId = selectedProp !== undefined ? selectedProp : innerSel;
  const selectedIds = useMemo(() => new Set(selectedRoomId ? [selectedRoomId] : []), [selectedRoomId]);

  const [query, setQuery] = useState('');
  const [minCap, setMinCap] = useState('');
  const [activeFac, setActiveFac] = useState<Set<string>>(() => new Set());
  const toggleFac = (f: string) => setActiveFac(p => { const n = new Set(p); n.has(f) ? n.delete(f) : n.add(f); return n; });

  const counts = useMemo(() => Object.fromEntries(floors.map((f: any) => {
    const c = { available: 0, booked: 0, maintenance: 0 };
    // Inactive rooms count with maintenance: neither can be booked.
    f.rooms.filter((r: any) => r.kind === 'room').forEach((r: any) => { const s = getStatus(r, f); c[s === 'inactive' ? 'maintenance' : s]++; });
    return [f.id, c];
  })), [floors, getStatus]);
  const facilities = useMemo(() => [...new Set<string>(floors.flatMap((f: any) => f.rooms.flatMap((r: any) => r.facilities || [])))], [floors]);

  const bookable = floor ? floor.rooms.filter((r: any) => r.kind === 'room') : [];
  const filtering = query.trim() || minCap !== '' || activeFac.size > 0 || !!roomFilter;
  const matches = useMemo(() => {
    if (!filtering || !floor) return null;
    const q = query.trim().toLowerCase();
    return new Set<string>(bookable.filter((r: any) => (!roomFilter || roomFilter(r)) &&
      (!q || r.name.toLowerCase().includes(q)) && (minCap === '' || (+r.capacity || 0) >= +minCap) &&
      [...activeFac].every(f => (r.facilities || []).includes(f))).map((r: any) => r.id));
  }, [filtering, floor, query, minCap, activeFac, roomFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<any>(null);
  const [bounds, setBounds] = useState<DOMRectReadOnly | null>(null);
  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setBounds(e.contentRect));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);

  const handlers = useMemo(() => ({
    onClick: (e: React.SyntheticEvent, room: any) => { if (room.kind !== 'room') return; setInnerSel(room.id); onRoomSelect?.(room, floor); },
    onHover: (room: any, status: RenderStatus, e: React.MouseEvent) => {
      if (room.kind !== 'room' || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setHover({ room, status, x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    onLeave: () => setHover(null)
  }), [floor, onRoomSelect]);

  if (!floor) return <div className={`fp ${className}`}><div className="fp-empty">{tr('no_floors', 'No floors drawn yet.')}</div></div>;

  return (
    <div className={`fp ${className}`}>
      {showToolbar && (
        <div className="fp-toolbar">
          <div className="fp-toolbar-filters">
          {showSearch && <div className="fp-search"><Icon name="search" size={14} /><input type="search" placeholder={tr('search_rooms', 'Search rooms…')} value={query} onChange={e => setQuery(e.target.value)} aria-label={tr('search_rooms', 'Search rooms…')} /></div>}
          <label className="fp-cap"><Icon name="users" size={14} /><span>{tr('min', 'min')}</span><input type="number" min="0" value={minCap} onChange={e => setMinCap(e.target.value)} aria-label={tr('min_capacity', 'Minimum capacity')} /></label>
          {facilities.length > 0 && <div className="fp-chips fp-chips-scroll" role="group" aria-label={tr('equipment', 'Equipment')}>
            {facilities.map(f => <button key={f} type="button" aria-pressed={activeFac.has(f)} className={`fp-chip${activeFac.has(f) ? ' is-on' : ''}`} onClick={() => toggleFac(f)}><Icon name={iconFor(f)} size={12} /> {f}</button>)}
          </div>}
          </div>
          <div className="fp-toolbar-meta">
          <div className="fp-stats"><strong>{matches ? matches.size : bookable.length}</strong> / {tr('n_rooms', '{{count}} rooms', { count: bookable.length })}</div>
          <ul className="fp-legend" aria-label={tr('legend', 'Legend')}>{legend.map(s => <li key={s} className={`fp-${s}`}><i />{L.status(s)}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="fp-body">
        {showFloorSelector && floors.length > 1 && <FloorSelector floors={floors} activeId={floor.id} counts={counts} onChange={changeFloor}
          ariaLabel={tr('floors', 'Floors')} metaLabel={(c: any) => tr('floor_meta', '{{free}} free · {{booked}} booked', { free: c.available, booked: c.booked })} />}
        <div className="fp-canvas" ref={wrapRef}>
          <div className="fp-canvas-head">
            <strong>{floor.name}</strong>
            <span>{tr('canvas_caption', '{{rooms}} rooms · {{seats}} seats', { rooms: bookable.length, seats: bookable.reduce((n: number, r: any) => n + (+r.capacity || 0), 0) })}</span>
          </div>
          <FloorPlanSvg floor={floor} appearance={appearance} statusOf={getStatus} selectedIds={selectedIds} dimmedIds={matches} viewer handlers={handlers}
            statusLabel={L.status} seatsLabel={L.seats} />
          <Tooltip data={hover} bounds={bounds} L={L} />
        </div>
      </div>
    </div>
  );
}
