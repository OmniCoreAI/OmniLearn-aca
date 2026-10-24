import { cn } from '@/lib/utils'

/**
 * Shared class recipes for the dashboard design language, so section tabs and
 * segmented switches look the same on every page: a white pill track with the
 * active item as a solid ink pill.
 */
export const TAB_TRACK =
  'flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-1 shadow-[0_1px_2px_hsl(220_30%_10%/0.04)] scrollbar-hide'

export function tabItemClass(active: boolean, className?: string) {
  return cn(
    'whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
    active
      ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_4px_12px_-4px_hsl(0_0%_8%/0.45)]'
      : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]',
    className
  )
}
