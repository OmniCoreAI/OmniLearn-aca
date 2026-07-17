'use client'
import React, { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PlanLevel } from '@services/plans/plans'
import PlanBadge from '@components/Dashboard/Shared/PlanRestricted/PlanBadge'
import { usePlan } from '@components/Hooks/usePlan'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { cn } from '@/lib/utils'

export interface DashTabItem {
  key: string
  label: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  active: boolean
  disabled?: boolean
  disabledTooltip?: React.ReactNode
  requiresPlan?: PlanLevel
}

interface DashTabBarProps {
  tabs: DashTabItem[]
}

export function DashTabBar({ tabs }: DashTabBarProps) {
  const currentPlan = usePlan()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState])

  const activeKey = tabs.find((t) => t.active)?.key
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const activeEl = container.querySelector('[data-tab-active]') as HTMLElement | null
    if (!activeEl) return
    const left = activeEl.offsetLeft
    const right = left + activeEl.offsetWidth
    const cLeft = container.scrollLeft
    const cRight = cLeft + container.clientWidth
    if (left < cLeft) {
      container.scrollTo({ left: Math.max(0, left - 8) })
    } else if (right > cRight) {
      container.scrollTo({ left: right - container.clientWidth + 8 })
    }
  }, [activeKey])

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -140 : 140, behavior: 'smooth' })
  }, [])

  return (
    <div className="relative min-w-0 overflow-hidden">
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center bg-gradient-to-r from-[hsl(var(--dash-surface))] to-transparent transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
      >
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll tabs left"
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] text-[hsl(var(--dash-muted))] shadow-sm hover:text-[hsl(var(--dash-ink))]"
        >
          <ChevronLeft size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto text-sm font-medium scrollbar-hide"
      >
        {tabs.map((tab) => {
          const inner = (
            <div className="mx-1 flex items-center gap-2 px-3 py-2">
              {tab.icon}
              <div className="flex items-center whitespace-nowrap">
                {tab.label}
                {tab.requiresPlan && (
                  <PlanBadge currentPlan={currentPlan} requiredPlan={tab.requiresPlan} />
                )}
              </div>
            </div>
          )

          if (tab.disabled) {
            const el = (
              <div className="w-fit cursor-not-allowed rounded-full text-center opacity-30">
                {inner}
              </div>
            )
            return tab.disabledTooltip ? (
              <ToolTip key={tab.key} content={tab.disabledTooltip}>
                {el}
              </ToolTip>
            ) : (
              <div key={tab.key}>{el}</div>
            )
          }

          const tabClass = cn(
            'w-fit cursor-pointer rounded-full text-center transition-all',
            tab.active
              ? 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
              : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
          )

          if (tab.href) {
            return (
              <Link key={tab.key} href={tab.href} prefetch={false}>
                <div className={tabClass} {...(tab.active ? { 'data-tab-active': '' } : {})}>
                  {inner}
                </div>
              </Link>
            )
          }

          if (tab.onClick) {
            return (
              <button key={tab.key} onClick={tab.onClick}>
                <div className={tabClass} {...(tab.active ? { 'data-tab-active': '' } : {})}>
                  {inner}
                </div>
              </button>
            )
          }

          return null
        })}
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-[hsl(var(--dash-surface))] to-transparent transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
      >
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll tabs right"
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] text-[hsl(var(--dash-muted))] shadow-sm hover:text-[hsl(var(--dash-ink))]"
        >
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
