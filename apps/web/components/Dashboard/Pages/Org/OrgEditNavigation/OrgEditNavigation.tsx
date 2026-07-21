'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { revalidateTags } from '@services/utils/ts/requests'
import {
  updateOrgNavigation,
  NavigationConfig,
  NavItem,
  NavGroup,
  NavLink,
  QuickLink,
} from '@services/settings/org'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { Switch } from '@components/ui/switch'
import {
  FloppyDisk,
  Plus,
  Trash,
  CaretDown,
  CaretRight,
  List,
} from '@phosphor-icons/react'

function emptyNav(): NavigationConfig {
  return { items: [], quick_links: [] }
}

function loadStored(org: any): NavigationConfig {
  const raw =
    org?.config?.config?.customization?.navigation ??
    org?.config?.config?.general?.navigation ??
    null
  if (!raw || typeof raw !== 'object') return emptyNav()
  return {
    items: Array.isArray(raw.items) ? raw.items : [],
    quick_links: Array.isArray(raw.quick_links) ? raw.quick_links : [],
  }
}

function normalizeOrders(nav: NavigationConfig): NavigationConfig {
  return {
    items: nav.items.map((item, i) => ({
      ...item,
      order: i,
      children: (item.children || []).map((g, gi) => ({
        ...g,
        order: gi,
        links: (g.links || []).map((l, li) => ({ ...l, order: li })),
      })),
    })),
    quick_links: nav.quick_links.map((q, i) => ({ ...q, order: i })),
  }
}

function newItem(order: number): NavItem {
  return {
    key: `item-${Date.now()}`,
    label: 'New section',
    href: '/',
    order,
    enabled: true,
    panel: null,
    children: [],
  }
}

function newGroup(order: number): NavGroup {
  return { title: 'New group', order, links: [] }
}

function newLink(order: number): NavLink {
  return {
    label: 'New link',
    href: '/',
    icon: '',
    open_in_new_tab: false,
    order,
    enabled: true,
  }
}

function newQuickLink(order: number): QuickLink {
  return { label: 'Quick link', href: '/', icon: '', order, enabled: true }
}

const inputClass =
  'w-full px-3 py-2 text-sm bg-white nice-shadow rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/10'

const OrgEditNavigation: React.FC = () => {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const org = useOrg() as any
  const queryClient = useQueryClient()
  const { rights } = useAdminStatus()
  const canEdit = rights?.organizations?.action_update === true

  const stored = useMemo(() => loadStored(org), [org])
  const [nav, setNav] = useState<NavigationConfig>(emptyNav())
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setNav(normalizeOrders(loadStored(org)))
    setSelectedIdx(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stored)])

  const dirty = useMemo(
    () => JSON.stringify(normalizeOrders(stored)) !== JSON.stringify(normalizeOrders(nav)),
    [nav, stored]
  )

  const selected = nav.items[selectedIdx] ?? null

  const setItems = (items: NavItem[]) => setNav((prev) => ({ ...prev, items }))
  const setQuickLinks = (quick_links: QuickLink[]) => setNav((prev) => ({ ...prev, quick_links }))

  const updateSelected = (patch: Partial<NavItem>) => {
    if (!selected) return
    setItems(nav.items.map((it, i) => (i === selectedIdx ? { ...it, ...patch } : it)))
  }

  const addItem = () => {
    const items = [...nav.items, newItem(nav.items.length)]
    setItems(items)
    setSelectedIdx(items.length - 1)
  }

  const removeItem = (idx: number) => {
    const items = nav.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i }))
    setItems(items)
    setSelectedIdx((prev) => Math.max(0, Math.min(prev, items.length - 1)))
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= nav.items.length) return
    const items = [...nav.items]
    ;[items[idx], items[next]] = [items[next], items[idx]]
    setItems(items.map((it, i) => ({ ...it, order: i })))
    setSelectedIdx(next)
  }

  const addGroup = () => {
    if (!selected) return
    const children = [...(selected.children || []), newGroup(selected.children?.length || 0)]
    updateSelected({ children })
    setExpandedGroups((prev) => ({ ...prev, [children.length - 1]: true }))
  }

  const updateGroup = (gi: number, patch: Partial<NavGroup>) => {
    if (!selected) return
    const children = (selected.children || []).map((g, i) => (i === gi ? { ...g, ...patch } : g))
    updateSelected({ children })
  }

  const removeGroup = (gi: number) => {
    if (!selected) return
    const children = (selected.children || [])
      .filter((_, i) => i !== gi)
      .map((g, i) => ({ ...g, order: i }))
    updateSelected({ children })
  }

  const addLink = (gi: number) => {
    if (!selected) return
    const children = (selected.children || []).map((g, i) => {
      if (i !== gi) return g
      return { ...g, links: [...(g.links || []), newLink(g.links?.length || 0)] }
    })
    updateSelected({ children })
  }

  const updateLink = (gi: number, li: number, patch: Partial<NavLink>) => {
    if (!selected) return
    const children = (selected.children || []).map((g, i) => {
      if (i !== gi) return g
      return {
        ...g,
        links: (g.links || []).map((l, j) => (j === li ? { ...l, ...patch } : l)),
      }
    })
    updateSelected({ children })
  }

  const removeLink = (gi: number, li: number) => {
    if (!selected) return
    const children = (selected.children || []).map((g, i) => {
      if (i !== gi) return g
      return {
        ...g,
        links: (g.links || []).filter((_, j) => j !== li).map((l, j) => ({ ...l, order: j })),
      }
    })
    updateSelected({ children })
  }

  const save = async () => {
    if (!canEdit) {
      toast.error('Only organization admins can edit site navigation')
      return
    }
    setSaving(true)
    const tid = toast.loading('Saving navigation…')
    try {
      const payload = normalizeOrders(nav)
      await updateOrgNavigation(String(org.id), payload, access_token)
      await revalidateTags(['organizations'], org.slug)
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      toast.success('Navigation saved', { id: tid })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save navigation', { id: tid })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sm:mx-10 mx-0 min-w-0 bg-white rounded-xl nice-shadow overflow-x-hidden">
      <div className="pt-0.5">
        <div className="flex items-center justify-between bg-gray-50 px-5 py-3 mx-3 my-3 rounded-md gap-3">
          <div className="flex flex-col -space-y-1 min-w-0">
            <h1 className="font-bold text-xl text-gray-800">Site navigation</h1>
            <h2 className="text-gray-500 text-md truncate">
              Top-level sections, dropdown groups, and quick links for the public site
            </h2>
          </div>
          <button
            onClick={save}
            disabled={!canEdit || saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white nice-shadow hover:bg-neutral-800 transition-colors disabled:opacity-40 shrink-0"
          >
            <FloppyDisk size={16} weight="bold" />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="p-4 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Items list */}
        <div className="lg:col-span-4 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sections</p>
            <button
              type="button"
              onClick={addItem}
              disabled={!canEdit}
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black disabled:opacity-40"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {nav.items.length === 0 && (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
                No sections yet. Add a top-level nav item to get started.
              </p>
            )}
            {nav.items.map((item, idx) => (
              <button
                key={`${item.key}-${idx}`}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`w-full text-left rounded-lg p-3 nice-shadow transition-colors ${
                  selectedIdx === idx ? 'bg-black text-white' : 'bg-gray-50/80 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.label || item.key}</p>
                    <p className={`text-xs truncate ${selectedIdx === idx ? 'text-white/70' : 'text-gray-400'}`}>
                      {item.href || '—'} · {item.children?.length || 0} groups
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      item.enabled
                        ? selectedIdx === idx
                          ? 'text-emerald-300'
                          : 'text-emerald-600'
                        : selectedIdx === idx
                          ? 'text-white/50'
                          : 'text-gray-400'
                    }`}
                  >
                    {item.enabled ? 'On' : 'Off'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Quick links */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <List size={12} /> Quick links
              </p>
              <button
                type="button"
                onClick={() => setQuickLinks([...nav.quick_links, newQuickLink(nav.quick_links.length)])}
                disabled={!canEdit}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {nav.quick_links.map((ql, qi) => (
              <div key={qi} className="bg-gray-50 rounded-lg p-3 space-y-2 nice-shadow">
                <div className="flex items-center justify-between gap-2">
                  <Switch
                    checked={ql.enabled}
                    disabled={!canEdit}
                    onCheckedChange={(v) =>
                      setQuickLinks(
                        nav.quick_links.map((q, i) => (i === qi ? { ...q, enabled: v } : q))
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setQuickLinks(
                        nav.quick_links.filter((_, i) => i !== qi).map((q, i) => ({ ...q, order: i }))
                      )
                    }
                    className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={ql.label}
                  onChange={(e) =>
                    setQuickLinks(
                      nav.quick_links.map((q, i) => (i === qi ? { ...q, label: e.target.value } : q))
                    )
                  }
                  placeholder="Label"
                />
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={ql.href}
                  onChange={(e) =>
                    setQuickLinks(
                      nav.quick_links.map((q, i) => (i === qi ? { ...q, href: e.target.value } : q))
                    )
                  }
                  placeholder="/path or https://"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          {!selected ? (
            <div className="bg-gray-50 rounded-lg p-10 text-center text-gray-400 text-sm">
              Select or add a section to edit its dropdown content.
            </div>
          ) : (
            <>
              <div className="bg-gray-50/80 rounded-lg p-4 nice-shadow space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Section settings
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || selectedIdx === 0}
                      onClick={() => moveItem(selectedIdx, -1)}
                      className="text-xs px-2 py-1 rounded bg-white nice-shadow disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || selectedIdx >= nav.items.length - 1}
                      onClick={() => moveItem(selectedIdx, 1)}
                      className="text-xs px-2 py-1 rounded bg-white nice-shadow disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-xs text-gray-500">Enabled</span>
                      <Switch
                        checked={selected.enabled}
                        disabled={!canEdit}
                        onCheckedChange={(v) => updateSelected({ enabled: v })}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => removeItem(selectedIdx)}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40 p-1"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Key</label>
                    <input
                      className={inputClass}
                      disabled={!canEdit}
                      value={selected.key}
                      onChange={(e) => updateSelected({ key: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Label</label>
                    <input
                      className={inputClass}
                      disabled={!canEdit}
                      value={selected.label}
                      onChange={(e) => updateSelected({ label: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Href</label>
                    <input
                      className={inputClass}
                      disabled={!canEdit}
                      value={selected.href || ''}
                      onChange={(e) => updateSelected({ href: e.target.value })}
                      placeholder="/about-academy"
                    />
                  </div>
                </div>
              </div>

              {/* Panel */}
              <div className="bg-gray-50/80 rounded-lg p-4 nice-shadow space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Featured panel (optional)
                  </p>
                  {selected.panel ? (
                    <button
                      type="button"
                      disabled={!canEdit}
                      className="text-xs text-red-500 disabled:opacity-40"
                      onClick={() => updateSelected({ panel: null })}
                    >
                      Remove panel
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canEdit}
                      className="text-xs font-medium text-gray-700 disabled:opacity-40"
                      onClick={() =>
                        updateSelected({
                          panel: { title: '', description: '', href: '', image_url: '' },
                        })
                      }
                    >
                      + Add panel
                    </button>
                  )}
                </div>
                {selected.panel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className={inputClass}
                      disabled={!canEdit}
                      placeholder="Title"
                      value={selected.panel.title}
                      onChange={(e) =>
                        updateSelected({ panel: { ...selected.panel!, title: e.target.value } })
                      }
                    />
                    <input
                      className={inputClass}
                      disabled={!canEdit}
                      placeholder="Href"
                      value={selected.panel.href}
                      onChange={(e) =>
                        updateSelected({ panel: { ...selected.panel!, href: e.target.value } })
                      }
                    />
                    <input
                      className={`${inputClass} sm:col-span-2`}
                      disabled={!canEdit}
                      placeholder="Description"
                      value={selected.panel.description}
                      onChange={(e) =>
                        updateSelected({
                          panel: { ...selected.panel!, description: e.target.value },
                        })
                      }
                    />
                    <input
                      className={`${inputClass} sm:col-span-2`}
                      disabled={!canEdit}
                      placeholder="Image URL (optional)"
                      value={selected.panel.image_url || ''}
                      onChange={(e) =>
                        updateSelected({
                          panel: { ...selected.panel!, image_url: e.target.value },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Groups */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dropdown groups
                  </p>
                  <button
                    type="button"
                    onClick={addGroup}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black disabled:opacity-40"
                  >
                    <Plus size={14} /> Add group
                  </button>
                </div>

                {(selected.children || []).length === 0 && (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
                    No groups — this section will render as a simple top link (like News).
                  </p>
                )}

                {(selected.children || []).map((group, gi) => {
                  const open = expandedGroups[gi] !== false
                  return (
                    <div key={gi} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                        <button
                          type="button"
                          className="text-gray-400"
                          onClick={() =>
                            setExpandedGroups((prev) => ({ ...prev, [gi]: !open }))
                          }
                        >
                          {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                        </button>
                        <input
                          className="flex-1 text-sm font-semibold bg-transparent border-0 focus:outline-none"
                          disabled={!canEdit}
                          value={group.title}
                          onChange={(e) => updateGroup(gi, { title: e.target.value })}
                        />
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => removeGroup(gi)}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                      {open && (
                        <div className="p-3 space-y-2">
                          {(group.links || []).map((link, li) => (
                            <div
                              key={li}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white rounded-lg p-2 nice-shadow"
                            >
                              <input
                                className={`${inputClass} sm:col-span-3`}
                                disabled={!canEdit}
                                placeholder="Label"
                                value={link.label}
                                onChange={(e) => updateLink(gi, li, { label: e.target.value })}
                              />
                              <input
                                className={`${inputClass} sm:col-span-4`}
                                disabled={!canEdit}
                                placeholder="Href"
                                value={link.href}
                                onChange={(e) => updateLink(gi, li, { href: e.target.value })}
                              />
                              <input
                                className={`${inputClass} sm:col-span-2`}
                                disabled={!canEdit}
                                placeholder="Icon"
                                value={link.icon || ''}
                                onChange={(e) => updateLink(gi, li, { icon: e.target.value })}
                              />
                              <div className="sm:col-span-2 flex items-center justify-end gap-2">
                                <Switch
                                  checked={link.enabled}
                                  disabled={!canEdit}
                                  onCheckedChange={(v) => updateLink(gi, li, { enabled: v })}
                                />
                                <button
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => removeLink(gi, li)}
                                  className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => addLink(gi)}
                            className="text-sm font-medium text-gray-600 hover:text-black disabled:opacity-40"
                          >
                            + Add link
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrgEditNavigation
