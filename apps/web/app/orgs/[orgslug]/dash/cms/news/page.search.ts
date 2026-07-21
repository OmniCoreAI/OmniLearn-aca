import { Newspaper } from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMeta: SearchMeta = {
  id: 'dash.cms.news',
  titleKey: 'cms.news.title',
  descriptionKey: 'cms.news.subtitle',
  keywordsKey: 'cms.news.keywords',
  icon: Newspaper,
  href: '/dash/cms/news',
  group: 'content',
}
