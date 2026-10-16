"use client"

import * as React from "react"
import * as Portal from "@radix-ui/react-portal"
import { cn } from "@/lib/utils"
import { menuSurfaceClass } from "@/components/ui/dropdown-menu"

/** Compact menu row with a small nudge toward the reading end on hover. */
export const hoverMenuItemClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-[hsl(var(--dash-ink))]/85 transition-[background-color,color,translate] duration-150 hover:translate-x-0.5 hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] rtl:hover:-translate-x-0.5 [&>svg]:size-4 [&>svg]:shrink-0"

interface HoverMenuProps {
  children: React.ReactNode
  content: React.ReactNode
  contentClassName?: string
  align?: "start" | "center" | "end"
}

const HoverMenu = React.forwardRef<HTMLDivElement, HoverMenuProps>(
  ({ children, content, contentClassName, align = "start" }, ref) => {
    const triggerRef = React.useRef<HTMLDivElement>(null)
    const [isHovered, setIsHovered] = React.useState(false)
    const [position, setPosition] = React.useState<{ top: number; left?: number; right?: number } | null>(null)
    const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const leaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const updatePosition = React.useCallback(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        let top = rect.top

        if (align === "end") {
          top = rect.bottom
        } else if (align === "center") {
          top = rect.top + rect.height / 2
        }

        // Open beside the trigger on the inline-end side (left of it in RTL).
        const rtl = document.documentElement.dir === 'rtl'
        setPosition(
          rtl
            ? { top, right: window.innerWidth - rect.left + 8 }
            : { top, left: rect.right + 8 } // 8px gap (ml-2)
        )
      }
    }, [align])

    const handleMouseEnter = React.useCallback(() => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current)
        leaveTimeoutRef.current = null
      }
      // Update position immediately, then show after a brief delay
      updatePosition()
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true)
      }, 50)
    }, [updatePosition])

    const handleMouseLeave = React.useCallback(() => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      leaveTimeoutRef.current = setTimeout(() => {
        setIsHovered(false)
      }, 100)
    }, [])

    React.useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
      }
    }, [])

    // Don't render portal until we have a position
    const shouldRenderPortal = position !== null

    return (
      <>
        <div
          ref={triggerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
        {shouldRenderPortal && (
          <Portal.Root>
            <div
              ref={ref}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                right: position.right,
                transform: align === "end" ? "translateY(-100%)" : align === "center" ? "translateY(-50%)" : undefined,
                zIndex: "var(--z-modal-backdrop)",
              }}
              className={cn(
                // Springs in from the trigger side, like the dropdown menus.
                "pointer-events-none transition-[opacity,scale,translate] duration-200 ease-[cubic-bezier(0.22,1.4,0.36,1)]",
                isHovered
                  ? "pointer-events-auto translate-x-0 scale-100 opacity-100"
                  : "-translate-x-1.5 scale-95 opacity-0 rtl:translate-x-1.5",
                contentClassName
              )}
            >
              {/* Invisible bridge to prevent gap issues */}
              <div className="absolute -start-2 top-0 bottom-0 w-2" />
              {content}
            </div>
          </Portal.Root>
        )}
      </>
    )
  }
)
HoverMenu.displayName = "HoverMenu"

interface HoverMenuContentProps {
  children: React.ReactNode
  className?: string
}

const HoverMenuContent = React.forwardRef<HTMLDivElement, HoverMenuContentProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          menuSurfaceClass,
          "min-w-[200px]",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
HoverMenuContent.displayName = "HoverMenuContent"

interface HoverMenuItemProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  asChild?: boolean
}

const HoverMenuItem = React.forwardRef<HTMLDivElement, HoverMenuItemProps>(
  ({ children, className, onClick, asChild }, ref) => {
    if (asChild) {
      return (
        <div ref={ref} className={cn("hover-menu-item", className)}>
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          hoverMenuItemClass,
          className
        )}
      >
        {children}
      </div>
    )
  }
)
HoverMenuItem.displayName = "HoverMenuItem"

interface HoverMenuLabelProps {
  children: React.ReactNode
  className?: string
}

const HoverMenuLabel = React.forwardRef<HTMLDivElement, HoverMenuLabelProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "px-2.5 py-1.5 text-[11.5px] font-semibold text-[hsl(var(--dash-muted))]",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
HoverMenuLabel.displayName = "HoverMenuLabel"

const HoverMenuSeparator = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("-mx-1 my-1 h-px bg-[hsl(var(--dash-border))]/80", className)}
      />
    )
  }
)
HoverMenuSeparator.displayName = "HoverMenuSeparator"

export {
  HoverMenu,
  HoverMenuContent,
  HoverMenuItem,
  HoverMenuLabel,
  HoverMenuSeparator,
}
