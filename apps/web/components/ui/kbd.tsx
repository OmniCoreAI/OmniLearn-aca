'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const kbdVariants = cva(
  'inline-flex items-center justify-center rounded-md border border-b-2 font-sans font-medium select-none transition-all duration-75',
  {
    variants: {
      variant: {
        default: 'border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
        outline: 'border-[hsl(var(--dash-border))] bg-transparent text-[hsl(var(--dash-ink))]',
        solid: 'border-[hsl(var(--dash-ink))] bg-[hsl(var(--dash-ink))] text-white',
      },
      size: {
        xs: 'h-5 min-w-5 px-1.5 text-[10px]',
        sm: 'h-6 min-w-6 px-2 text-xs',
        md: 'h-7 min-w-7 px-2.5 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
  }
)

export interface KbdProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof kbdVariants> {
  /** Several keys, rendered as separate caps joined by "+". */
  keys?: string[]
}

/** A keyboard key cap, e.g. ⌘K. Always laid out left-to-right. */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, variant, size, keys, children, ...props }, ref) => {
  if (keys && keys.length > 0) {
    return (
      <span className="inline-flex items-center gap-1" dir="ltr" ref={ref as React.Ref<HTMLSpanElement>}>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <kbd className={cn(kbdVariants({ variant, size }), className)} {...props}>
              {key}
            </kbd>
            {index < keys.length - 1 && <span className="px-0.5 text-xs text-[hsl(var(--dash-muted))]">+</span>}
          </React.Fragment>
        ))}
      </span>
    )
  }
  return (
    <kbd className={cn(kbdVariants({ variant, size }), className)} dir="ltr" ref={ref} {...props}>
      {children}
    </kbd>
  )
})
Kbd.displayName = 'Kbd'

export { Kbd, kbdVariants }
