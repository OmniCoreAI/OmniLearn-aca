'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

/**
 * Side drawer on the same Radix dialog as `dialog.tsx` (same overlay, focus
 * trap and z-index tokens) — for medium-sized create/edit forms that would be
 * cramped in a centered modal. Slides in from the inline end, so it follows
 * RTL automatically.
 */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { width?: string }
>(({ className, children, width = 'sm:max-w-[560px]', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="lh-modal-overlay fixed inset-0 bg-[hsl(220_30%_8%/0.32)] backdrop-blur-[2px]"
      style={{ zIndex: 'var(--z-modal-backdrop)' as any }}
    />
    <DialogPrimitive.Content
      ref={ref}
      style={{ zIndex: 'var(--z-modal)' as any }}
      className={cn(
        // Floats inset from the edge on larger screens (like the dashboard sidebar); full screen on phones.
        // overflow-clip, not hidden: a hidden box can still be scrolled by focus/scrollIntoView.
        'lh-sheet-content fixed inset-y-0 end-0 flex h-dvh w-full flex-col overflow-clip bg-[hsl(var(--dash-surface))] shadow-[0_24px_70px_-24px_hsl(220_30%_10%/0.45)] focus:outline-none sm:inset-y-3 sm:end-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-[1.5rem] sm:border sm:border-white/80',
        width,
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute end-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-muted))] transition-all hover:rotate-90 hover:border-[hsl(var(--dash-ink))]/20 hover:text-[hsl(var(--dash-ink))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/40"
        aria-label="Close"
      >
        <Cross2Icon className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

function SheetHeader({
  title,
  description,
  icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('shrink-0 px-6 pb-4 pt-5', className)}>
      <div className="flex items-start gap-3.5 pe-12">
        {icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))] ring-1 ring-inset ring-[hsl(var(--dash-accent))]/20">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 pt-0.5">
          <DialogPrimitive.Title className="text-lg font-semibold leading-tight tracking-tight text-[hsl(var(--dash-ink))]">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--dash-muted))]">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
      </div>
    </div>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader }
