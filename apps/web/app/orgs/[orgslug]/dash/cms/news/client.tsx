'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicEmptyState,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { deleteNews, listAdminNews, type CMSNewsListItem } from '@services/cms/news'
import { getNewsCoverMediaDirectory } from '@services/media/media'
import NewsCard from './NewsCard'

const ITEMS_PER_PAGE = 12

function getItemDate(item: CMSNewsListItem): Date | null {
  const raw = item.published_at || item.creation_date
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function getItemYear(item: CMSNewsListItem): string {
  const d = getItemDate(item)
  return d ? String(d.getFullYear()) : ''
}

function filterItems(
  items: CMSNewsListItem[],
  opts: { query: string; dateFrom: string; dateTo: string; year: string }
): CMSNewsListItem[] {
  const q = opts.query.trim().toLowerCase()
  const from = opts.dateFrom ? new Date(opts.dateFrom) : null
  const to = opts.dateTo ? new Date(opts.dateTo) : null
  if (to) to.setHours(23, 59, 59, 999)

  return items.filter((item) => {
    if (q) {
      const haystack = [item.title, item.slug, item.excerpt].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (opts.year && getItemYear(item) !== opts.year) return false
    const itemDate = getItemDate(item)
    if (from && itemDate && itemDate < from) return false
    if (to && itemDate && itemDate > to) return false
    if ((from || to) && !itemDate) return false
    return true
  })
}

function getVisiblePageNumbers(current: number, total: number): (number | string)[] {
  const pages: (number | string)[] = []
  const maxVisible = 5
  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else if (current <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  } else if (current >= total - 2) {
    pages.push(1)
    pages.push('...')
    for (let i = total - 3; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    pages.push('...')
    for (let i = current - 1; i <= current + 1; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  }
  return pages
}

function NewsListClient({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const orgUuid = org?.org_uuid as string | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [deleteTarget, setDeleteTarget] = useState<{
    uuid: string
    title: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cms-news', orgId],
    queryFn: () => listAdminNews(orgId!, access_token, 1, 100),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const allItems = data?.items ?? []

  const yearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const item of allItems) {
      const y = getItemYear(item)
      if (y) years.add(y)
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [allItems])

  const filteredItems = useMemo(
    () =>
      filterItems(allItems, {
        query: searchQuery,
        dateFrom,
        dateTo,
        year: yearFilter,
      }),
    [allItems, searchQuery, dateFrom, dateTo, yearFilter]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateFrom, dateTo, yearFilter])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredItems.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredItems, safePage])

  const hasActiveFilters =
    searchQuery.trim() !== '' || dateFrom !== '' || dateTo !== '' || yearFilter !== ''

  const clearFilters = () => {
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setYearFilter('')
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cms-news', orgId] })

  const confirmDelete = async () => {
    if (!deleteTarget || !orgId || !access_token) return
    setDeleting(true)
    try {
      await deleteNews(orgId, deleteTarget.uuid, access_token)
      toast.success(t('cms.news.deleted', 'Article deleted'))
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error(t('cms.news.delete_failed', 'Could not delete article'))
    } finally {
      setDeleting(false)
    }
  }

  const coverUrl = (item: { news_uuid: string; cover_image: string }) => {
    if (!item.cover_image) return null
    if (!orgUuid) {
      return item.cover_image.startsWith('http') ? item.cover_image : null
    }
    return getNewsCoverMediaDirectory(orgUuid, item.news_uuid, item.cover_image)
  }

  const formatItemDate = (item: CMSNewsListItem) => {
    const d = getItemDate(item)
    if (!d) return null
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('cms.news.title', 'News'),
            href: getUriWithOrg(orgslug, '/dash/cms/news'),
            icon: <Newspaper size={14} />,
          },
        ]}
      />
      <AcademicHeader
        title={t('cms.news.title', 'News')}
        subtitle={t('cms.news.subtitle', 'Publish organization news articles')}
        action={
          <AdminAuthorization authorizationMode="component">
            <Link
              href={getUriWithOrg(orgslug, '/dash/cms/news/new')}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('cms.news.new', 'New article')}
            </Link>
          </AdminAuthorization>
        }
      />

      {!isLoading && allItems.length > 0 ? (
        <div className="mb-6 space-y-4 rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--dash-muted))]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cms.news.search_placeholder', 'Search by title, slug, or excerpt…')}
              className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] py-2.5 pl-10 pr-10 text-sm text-[hsl(var(--dash-ink))] outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
                aria-label={t('cms.news.clear_search', 'Clear search')}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))]">
                <CalendarRange className="size-3.5" />
                {t('cms.news.date_from', 'From date')}
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))]">
                <CalendarRange className="size-3.5" />
                {t('cms.news.date_to', 'To date')}
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))]">
                <Calendar className="size-3.5" />
                {t('cms.news.filter_year', 'Year')}
              </span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/20"
              >
                <option value="">{t('cms.news.all_years', 'All years')}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-4 py-2 text-sm font-semibold text-[hsl(var(--dash-muted))] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="size-4" />
                  {t('cms.news.clear_filters', 'Clear filters')}
                </button>
              ) : null}
            </div>
          </div>

          {hasActiveFilters ? (
            <p className="text-sm text-[hsl(var(--dash-muted))]">
              {t('cms.news.results_count', '{{count}} result(s)', {
                count: filteredItems.length,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <AcademicGrid>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] overflow-hidden"
            >
              <div className="aspect-video bg-[hsl(var(--dash-border))]/40" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-[hsl(var(--dash-border))]/40" />
                <div className="h-3 w-full rounded bg-[hsl(var(--dash-border))]/30" />
              </div>
            </div>
          ))
        ) : allItems.length === 0 ? (
          <AcademicEmptyState
            title={t('cms.news.none', 'No news yet')}
            description={t(
              'cms.news.none_desc',
              'Create an article to show on the public academy site.'
            )}
            action={
              <Link
                href={getUriWithOrg(orgslug, '/dash/cms/news/new')}
                className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white"
              >
                <Plus className="w-4 h-4" /> {t('cms.news.new', 'New article')}
              </Link>
            }
          />
        ) : filteredItems.length === 0 ? (
          <AcademicEmptyState
            title={t('cms.news.no_results', 'No matching articles')}
            description={t(
              'cms.news.no_results_desc',
              'Try changing your search or date filters.'
            )}
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] px-5 py-2 text-xs font-semibold"
                >
                  <X className="w-4 h-4" />
                  {t('cms.news.clear_filters', 'Clear filters')}
                </button>
              ) : undefined
            }
          />
        ) : (
          paginatedItems.map((item) => (
            <NewsCard
              key={item.news_uuid}
              orgslug={orgslug}
              href={`/dash/cms/news/${item.news_uuid}`}
              title={item.title}
              dateLabel={formatItemDate(item)}
              excerpt={item.excerpt || undefined}
              published={item.published}
              thumbnailUrl={coverUrl(item)}
              onEdit={() =>
                router.push(getUriWithOrg(orgslug, `/dash/cms/news/${item.news_uuid}`))
              }
              onDelete={() =>
                setDeleteTarget({ uuid: item.news_uuid, title: item.title })
              }
            />
          ))
        )}
      </AcademicGrid>

      {!isLoading && filteredItems.length > 0 && totalPages > 1 ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="flex items-center gap-1 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm font-medium text-[hsl(var(--dash-muted))] transition hover:bg-[hsl(var(--dash-canvas))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">
                {t('cms.news.pagination.previous', 'Previous')}
              </span>
            </button>

            <div className="flex items-center gap-1">
              {getVisiblePageNumbers(safePage, totalPages).map((page, index) =>
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-[hsl(var(--dash-muted))]">
                    …
                  </span>
                ) : (
                  <button
                    type="button"
                    key={page}
                    onClick={() => goToPage(page as number)}
                    className={`min-w-[2.25rem] rounded-lg px-3 py-2 text-sm font-medium transition ${
                      safePage === page
                        ? 'bg-[hsl(var(--dash-accent))] text-white'
                        : 'border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))]'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="flex items-center gap-1 rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm font-medium text-[hsl(var(--dash-muted))] transition hover:bg-[hsl(var(--dash-canvas))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="hidden sm:inline">
                {t('cms.news.pagination.next', 'Next')}
              </span>
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p className="text-sm text-[hsl(var(--dash-muted))] tabular-nums">
            {t('cms.news.pagination.page_of', 'Page {{current}} of {{total}}', {
              current: safePage,
              total: totalPages,
            })}
          </p>
        </div>
      ) : null}

      <Modal
        isDialogOpen={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        noPadding
        customWidth="sm:max-w-[520px] sm:min-w-[420px]"
        dialogTitle={t('cms.news.confirm_delete_title', 'Delete article')}
        dialogContent={
          <div className="space-y-4 p-5">
            <p className="text-sm text-gray-600">
              {t(
                'cms.news.confirm_delete',
                'Delete this article? This cannot be undone.'
              )}
            </p>
            {deleteTarget?.title ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                {deleteTarget.title}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting
                  ? '…'
                  : t('cms.news.confirm_delete_action', 'Delete')}
              </button>
            </div>
          </div>
        }
      />
    </AcademicPageShell>
  )
}

export default NewsListClient
