'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  MoreVertical,
  Newspaper,
  Pencil,
  Trash2,
} from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

type NewsCardProps = {
  orgslug: string
  href: string
  title: string
  dateLabel?: string | null
  excerpt?: string
  published: boolean
  thumbnailUrl?: string | null
  onEdit?: () => void
  onDelete?: () => void
}

export default function NewsCard({
  orgslug,
  href,
  title,
  dateLabel,
  excerpt,
  published,
  thumbnailUrl,
  onEdit,
  onDelete,
}: NewsCardProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const hasMenu = !!onEdit || !!onDelete
  const fullHref = getUriWithOrg(orgslug, href)

  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--dash-accent))]/30 hover:shadow-md">
      {hasMenu && (
        <div
          className={cn(
            'absolute right-2 top-2 z-20 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="rounded-full bg-white/95 p-1.5 text-[hsl(var(--dash-ink))] shadow-md backdrop-blur-sm hover:bg-white"
            aria-label={t('cms.news.card_actions', 'Article actions')}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] py-1 shadow-lg">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('common.edit', 'Edit')}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('common.delete', 'Delete')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <Link href={fullHref} className="relative block aspect-[16/10] overflow-hidden bg-[hsl(var(--dash-canvas))]">
        {thumbnailUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
              style={{ backgroundImage: `url(${thumbnailUrl})` }}
              role="img"
              aria-label={title}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[hsl(var(--dash-accent-soft))] to-[hsl(var(--dash-canvas))]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent))]/10 text-[hsl(var(--dash-accent))]">
              <Newspaper className="h-6 w-6" aria-hidden />
            </div>
          </div>
        )}

        <span
          className={cn(
            'absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm',
            published
              ? 'bg-emerald-500/90 text-white'
              : 'bg-white/90 text-[hsl(var(--dash-muted))]'
          )}
        >
          {published
            ? t('cms.news.published', 'Published')
            : t('cms.news.draft', 'Draft')}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {dateLabel ? (
          <div className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
            <Calendar className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{dateLabel}</span>
          </div>
        ) : null}

        <Link
          href={fullHref}
          className="line-clamp-2 text-base font-semibold leading-snug text-[hsl(var(--dash-ink))] transition-colors group-hover:text-[hsl(var(--dash-accent))]"
        >
          {title}
        </Link>

        {excerpt ? (
          <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-[hsl(var(--dash-muted))]">
            {excerpt}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-1 flex items-center justify-between border-t border-[hsl(var(--dash-border))] pt-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--dash-muted))]">
            {t('cms.news.title', 'News')}
          </span>
          <Link
            href={fullHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-canvas))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-ink))] transition-all hover:bg-[hsl(var(--dash-accent))] hover:text-white"
          >
            {t('cms.news.open', 'Open')}
            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  )
}
