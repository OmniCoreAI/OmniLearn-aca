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
      className="lh-modal-overlay fixed inset-0 bg-black/30"
      style={{ zIndex: 'var(--z-modal-backdrop)' as any }}
    />
    <DialogPrimitive.Content
      ref={ref}
      style={{ zIndex: 'var(--z-modal)' as any }}
      className={cn(
        'lh-sheet-content fixed inset-y-0 end-0 flex h-dvh w-full flex-col border-s border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] shadow-[-24px_0_60px_-30px_hsl(220_30%_10%/0.35)] focus:outline-none',
        width,
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute end-4 top-4 rounded-lg p-1.5 text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/40"
        aria-label="Close"
      >
        <Cross2Icon className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

function SheetHeader({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b border-[hsl(var(--dash-border))] px-6 py-5 pe-14">
      <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-sm text-[hsl(var(--dash-muted))]">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader }
