'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BookOpenText,
  Books,
  CalendarBlank,
  CircleNotch,
  Exam,
  FolderSimple,
  MagnifyingGlass,
  Medal,
  PlayCircle,
  X,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { SEARCH_MIN_LENGTH, searchOrgContent } from '@services/search/search'
import { useDebounce } from '@/hooks/useDebounce'
import { useLearnerOverview } from '@/hooks/queries/useLearnerOverview'
import { cn } from '@/lib/utils'

type Item = {
  key: string
  group: 'mine' | 'catalog' | 'library' | 'shortcut'
  title: string
  subtitle?: string
  href: string
  icon: React.ReactNode
}

const strip = (uuid: string, prefix: string) => uuid.replace(`${prefix}_`, '')

/**
 * The portal's search: a rounded field with ⌘K, and a results panel that puts
 * the learner's own courses first, then the catalog and the library.
 */
export default function StudentSearch({ orgslug, className, autoFocus = false }: { orgslug: string; className?: string; autoFocus?: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebounce(query.trim(), 250)
  const [isMac, setIsMac] = useState(false)

  const { data: overview } = useLearnerOverview(org?.id)
  const { data: remote, isFetching } = useQuery({
    queryKey: ['student-search', orgslug, debounced],
    queryFn: async () => (await searchOrgContent(orgslug, debounced, 1, 5, null, token)).data as any,
    enabled: open && debounced.length >= SEARCH_MIN_LENGTH,
    staleTime: 30_000,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
  }, [])

  // ⌘K / Ctrl+K, or "/" outside a text field, jumps to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  const thumb = (uuid: string, image?: string | null) =>
    image ? getCourseThumbnailMediaDirectory(org?.org_uuid, uuid, image) : null
  const cover = (uuid: string, name: string, image?: string | null) => (
    <span className="relative block h-9 w-12 shrink-0 overflow-hidden rounded-lg">
      <CourseCover name={name} seed={uuid} src={thumb(uuid, image)} size="xs" />
    </span>
  )

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const mine = overview?.courses ?? []
    if (!q) {
      const shortcuts: Item[] = [
        { key: 's-assess', group: 'shortcut', title: t('student_portal.nav.assessments', 'Assessments'), href: '/assessments', icon: <Exam size={18} weight="duotone" /> },
        { key: 's-cal', group: 'shortcut', title: t('student_portal.nav.calendar', 'Calendar'), href: '/calendar', icon: <CalendarBlank size={18} weight="duotone" /> },
        { key: 's-cert', group: 'shortcut', title: t('student_portal.nav.certificates', 'Certificates'), href: '/certificates', icon: <Medal size={18} weight="duotone" /> },
        { key: 's-lib', group: 'shortcut', title: t('student_portal.nav.library', 'Library'), href: '/library', icon: <Books size={18} weight="duotone" /> },
      ]
      return [
        ...mine.slice(0, 3).map<Item>((c) => ({
          key: `m-${c.course_uuid}`,
          group: 'mine',
          title: c.name,
          subtitle: c.next_lesson ? `${t('student_portal.hero.next_lesson', 'Next lesson:')} ${c.next_lesson.name}` : `${c.progress}%`,
          href: c.next_lesson ? `/course/${strip(c.course_uuid, 'course')}/activity/${strip(c.next_lesson.activity_uuid, 'activity')}` : `/course/${strip(c.course_uuid, 'course')}`,
          icon: cover(c.course_uuid, c.name, c.thumbnail_image),
        })),
        ...shortcuts,
      ]
    }
    const mineMatches = mine.filter((c) => c.name.toLocaleLowerCase().includes(q) || c.next_lesson?.name.toLocaleLowerCase().includes(q) || c.code?.toLocaleLowerCase().includes(q))
    const mineIds = new Set(mineMatches.map((c) => c.course_uuid))
    const showRemote = debounced.length >= SEARCH_MIN_LENGTH && debounced.toLocaleLowerCase() === q
    return [
      ...mineMatches.slice(0, 4).map<Item>((c) => ({
        key: `m-${c.course_uuid}`,
        group: 'mine',
        title: c.name,
        subtitle: c.code ?? `${c.progress}%`,
        href: `/course/${strip(c.course_uuid, 'course')}`,
        icon: cover(c.course_uuid, c.name, c.thumbnail_image),
      })),
      ...(showRemote ? (remote?.courses ?? []) : [])
        .filter((c: any) => !mineIds.has(c.course_uuid))
        .slice(0, 5)
        .map((c: any): Item => ({
          key: `c-${c.course_uuid}`,
          group: 'catalog',
          title: c.name,
          subtitle: c.description || undefined,
          href: `/course/${strip(c.course_uuid, 'course')}`,
          icon: cover(c.course_uuid, c.name, c.thumbnail_image),
        })),
      ...(showRemote ? (remote?.folders ?? []) : []).slice(0, 3).map((f: any): Item => ({
        key: `f-${f.folder_uuid}`,
        group: 'library',
        title: f.name,
        subtitle: f.description || undefined,
        href: `/library/folder/${strip(f.folder_uuid, 'folder')}`,
        icon: (
          <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-[hsl(152_45%_93%)] text-[hsl(152_60%_28%)]">
            <FolderSimple size={18} weight="duotone" />
          </span>
        ),
      })),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, debounced, overview, remote, t])

  const groups: { id: Item['group']; label: string }[] = [
    { id: 'mine', label: query.trim() ? t('student_portal.search.my_courses', 'My courses') : t('student_portal.search.jump_back', 'Jump back in') },
    { id: 'catalog', label: t('student_portal.search.catalog', 'Courses') },
    { id: 'library', label: t('student_portal.search.library', 'Library') },
    { id: 'shortcut', label: t('student_portal.search.shortcuts', 'Go to') },
  ]

  const go = (href: string) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    router.push(getUriWithOrg(orgslug, href))
  }
  const seeAll = () => go(`/search?q=${encodeURIComponent(query.trim())}`)

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) go(items[active].href)
      else if (query.trim().length >= SEARCH_MIN_LENGTH) seeAll()
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const tooShort = query.trim().length > 0 && query.trim().length < SEARCH_MIN_LENGTH
  const loading = isFetching && !tooShort && query.trim().length >= SEARCH_MIN_LENGTH
  const noResults = !loading && !tooShort && query.trim().length >= SEARCH_MIN_LENGTH && items.length === 0
  let index = -1

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div
        className={cn(
          'group flex h-10 items-center gap-2 rounded-full border px-3.5 transition-all',
          open
            ? 'border-[hsl(var(--dash-border))] bg-white shadow-[0_0_0_4px_hsl(43_85%_55%/0.14)]'
            : 'border-transparent bg-[hsl(var(--dash-canvas))] hover:border-[hsl(var(--dash-border))]'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <MagnifyingGlass size={17} className={cn('shrink-0 transition-colors', open ? 'text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-muted))]')} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('student_portal.search_placeholder', 'Search for a course, lecture, assessment or content…')}
          aria-label={t('student_portal.search_placeholder', 'Search for a course, lecture, assessment or content…')}
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[hsl(var(--dash-ink))] outline-none placeholder:text-[hsl(var(--dash-muted))] [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? <CircleNotch size={16} className="shrink-0 animate-spin text-[hsl(var(--dash-muted))]" /> : null}
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label={t('student_portal.search.clear', 'Clear')}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
          >
            <X size={13} weight="bold" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-[hsl(var(--dash-border))] bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[hsl(var(--dash-muted))] sm:inline-flex" dir="ltr">
            {isMac ? '⌘' : 'Ctrl'} K
          </kbd>
        )}
      </div>

      {open ? (
        <div
          className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))] bg-white shadow-[0_24px_60px_-20px_hsl(220_30%_10%/0.35)]"
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          <div id={listId} role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            {tooShort ? (
              <p className="px-3 py-6 text-center text-[13px] text-[hsl(var(--dash-muted))]">
                {t('student_portal.search.min_chars', 'Type at least {{count}} characters', { count: SEARCH_MIN_LENGTH })}
              </p>
            ) : noResults ? (
              <div className="px-3 py-8 text-center">
                <p className="text-[14px] font-semibold text-[hsl(var(--dash-ink))]">{t('student_portal.search.no_results', 'No results for “{{q}}”', { q: query.trim() })}</p>
                <p className="mt-1 text-[12.5px] text-[hsl(var(--dash-muted))]">{t('student_portal.search.no_results_hint', 'Try a course name, a code or a different word.')}</p>
              </div>
            ) : (
              groups.map((g) => {
                const groupItems = items.filter((i) => i.group === g.id)
                if (!groupItems.length) return null
                return (
                  <div key={g.id} role="group" aria-label={g.label} className="pb-1">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-[hsl(var(--dash-muted))]">{g.label}</p>
                    {g.id === 'shortcut' ? (
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                        {groupItems.map((it) => {
                          index += 1
                          const i = index
                          return (
                            <button
                              key={it.key}
                              id={`${listId}-${i}`}
                              role="option"
                              aria-selected={active === i}
                              type="button"
                              onMouseEnter={() => setActive(i)}
                              onClick={() => go(it.href)}
                              className={cn(
                                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[hsl(var(--dash-ink))] transition-colors',
                                active === i ? 'bg-[hsl(var(--dash-canvas))]' : ''
                              )}
                            >
                              <span className="text-[hsl(38_75%_38%)]">{it.icon}</span>
                              {it.title}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      groupItems.map((it) => {
                        index += 1
                        const i = index
                        return (
                          <button
                            key={it.key}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={active === i}
                            type="button"
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(it.href)}
                            className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors', active === i ? 'bg-[hsl(var(--dash-canvas))]' : '')}
                          >
                            {it.icon}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold text-[hsl(var(--dash-ink))]" dir="auto">{it.title}</span>
                              {it.subtitle ? <span className="block truncate text-[12px] text-[hsl(var(--dash-muted))]" dir="auto">{it.subtitle}</span> : null}
                            </span>
                            {it.group === 'mine' ? (
                              <PlayCircle size={18} weight="fill" className={cn('shrink-0 text-[hsl(38_75%_42%)] transition-opacity', active === i ? 'opacity-100' : 'opacity-0')} />
                            ) : it.group === 'catalog' ? (
                              <BookOpenText size={16} className={cn('shrink-0 text-[hsl(var(--dash-muted))] transition-opacity', active === i ? 'opacity-100' : 'opacity-0')} />
                            ) : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                )
              })
            )}
          </div>
          {query.trim().length >= SEARCH_MIN_LENGTH ? (
            <button
              type="button"
              onClick={seeAll}
              className="flex w-full items-center justify-between gap-2 border-t border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/60 px-4 py-3 text-[13px] font-semibold text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]"
            >
              <span className="truncate">{t('student_portal.search.see_all', 'See all results for “{{q}}”', { q: query.trim() })}</span>
              <ArrowRight size={14} weight="bold" className="shrink-0 rtl:rotate-180" />
            </button>
          ) : (
            <p className="hidden items-center gap-3 border-t border-[hsl(var(--dash-border))] px-4 py-2.5 text-[11.5px] text-[hsl(var(--dash-muted))] sm:flex">
              <span><kbd className="font-sans font-semibold">↑↓</kbd> {t('student_portal.search.navigate', 'to move')}</span>
              <span><kbd className="font-sans font-semibold">Enter</kbd> {t('student_portal.search.open', 'to open')}</span>
              <span><kbd className="font-sans font-semibold">Esc</kbd> {t('student_portal.search.close', 'to close')}</span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
