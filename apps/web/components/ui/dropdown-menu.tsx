'use client'

/**
 * The app's dropdown menu (Radix + motion): springy open, a small nudge
 * toward the reading end on hover, optional `icon` / `shortcut` per item and
 * sub-menus. Compact by default (13px items, 16px icons).
 *
 * Backward compatible with the plain shadcn menu it replaced: items without
 * `icon` / `shortcut` render their children exactly as before, `asChild`
 * links stay links, and `className` overrides still win. RTL-aware.
 */

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { motion } from 'motion/react'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

type IconType = React.ElementType<{ size?: number; className?: string }>

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/** Shared pop-up surface — also used by the dashboard's hover menus. */
export const menuSurfaceClass =
  'min-w-[8rem] max-w-[95vw] overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/80 bg-white p-1 text-[hsl(var(--dash-ink))] shadow-[0_18px_44px_-14px_hsl(220_30%_10%/0.28),0_2px_6px_-2px_hsl(220_30%_10%/0.08)] outline-none'

/** Row content nudges toward the reading end while the item is highlighted. */
const nudge =
  '[&>*]:transition-transform [&>*]:duration-150 data-[highlighted]:[&>*]:translate-x-0.5 rtl:data-[highlighted]:[&>*]:-translate-x-0.5'

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 }

/* ----------------------------------------------------------------- content */

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, side = 'bottom', style, children, ...props }, ref) => {
  const from = side === 'top' ? { y: 6 } : side === 'right' ? { x: -6 } : side === 'left' ? { x: 6 } : { y: -6 }
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        side={side}
        sideOffset={sideOffset}
        className={cn(menuSurfaceClass, 'sm:max-w-[350px]', className)}
        style={{ zIndex: 'var(--z-dropdown)' as any, ...style }}
        asChild
        {...props}
      >
        <motion.div initial={{ opacity: 0, scale: 0.96, ...from }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} transition={spring}>
          {children}
        </motion.div>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, style, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(menuSurfaceClass, 'sm:max-w-[280px]', className)}
      style={{ zIndex: 'var(--z-dropdown)' as any, ...style }}
      asChild
      {...props}
    >
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
        {children}
      </motion.div>
    </DropdownMenuPrimitive.SubContent>
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

/* ------------------------------------------------------------------- items */

const dropdownMenuItemVariants = cva(
  cn(
    'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors touch-manipulation data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
    nudge
  ),
  {
    variants: {
      variant: {
        default:
          'text-[hsl(var(--dash-ink))]/85 focus:bg-[hsl(var(--dash-canvas))] focus:text-[hsl(var(--dash-ink))] data-[highlighted]:bg-[hsl(var(--dash-canvas))] data-[highlighted]:text-[hsl(var(--dash-ink))]',
        destructive:
          'text-[hsl(var(--dash-warn))] focus:bg-[hsl(var(--dash-warn-soft))] focus:text-[hsl(var(--dash-warn))] data-[highlighted]:bg-[hsl(var(--dash-warn-soft))] data-[highlighted]:text-[hsl(var(--dash-warn))]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

/** Icon + label (+ shortcut) row, used when an item is given `icon` or `shortcut`. */
function ItemRow({ icon: Icon, iconClassName, shortcut, children }: { icon?: IconType; iconClassName?: string; shortcut?: string; children: React.ReactNode }) {
  return (
    <>
      {Icon ? <Icon size={16} className={cn('shrink-0 opacity-80', iconClassName)} /> : null}
      <span className="min-w-0 flex-1 truncate text-start">{children}</span>
      {shortcut ? (
        <Kbd size="xs" className="ms-auto opacity-70">
          {shortcut}
        </Kbd>
      ) : null}
    </>
  )
}

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    icon?: IconType
    iconClassName?: string
    shortcut?: string
  } & VariantProps<typeof dropdownMenuItemVariants>
>(({ className, variant, inset, icon, iconClassName, shortcut, asChild, children, ...props }, ref) => {
  const classes = cn(dropdownMenuItemVariants({ variant }), inset && 'ps-8', className)
  const decorated = !!icon || !!shortcut

  // asChild: the child (e.g. <Link>) stays the element; with an icon/shortcut the row goes inside it.
  if (asChild && React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return (
      <DropdownMenuPrimitive.Item ref={ref} className={classes} asChild {...props}>
        {decorated
          ? React.cloneElement(
              children,
              undefined,
              <ItemRow icon={icon} iconClassName={iconClassName} shortcut={shortcut}>
                {children.props.children}
              </ItemRow>
            )
          : children}
      </DropdownMenuPrimitive.Item>
    )
  }
  return (
    <DropdownMenuPrimitive.Item ref={ref} className={classes} {...props}>
      {decorated ? (
        <ItemRow icon={icon} iconClassName={iconClassName} shortcut={shortcut}>
          {children}
        </ItemRow>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.Item>
  )
})
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean; icon?: IconType }
>(({ className, inset, icon: Icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(dropdownMenuItemVariants({ variant: 'default' }), 'data-[state=open]:bg-[hsl(var(--dash-canvas))]', inset && 'ps-8', className)}
    {...props}
  >
    {Icon ? <Icon size={16} className="shrink-0 opacity-80" /> : null}
    <span className="min-w-0 flex-1 truncate text-start">{children}</span>
    <ChevronRight className="ms-auto h-4 w-4 opacity-60 rtl:rotate-180" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

function Indicator({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute start-2.5 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.1 }} className="flex">
          {children}
        </motion.span>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  )
}

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & { icon?: IconType }
>(({ className, children, checked, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem ref={ref} className={cn(dropdownMenuItemVariants({ variant: 'default' }), 'ps-8', className)} checked={checked} {...props}>
    <Indicator>
      <Check className="h-4 w-4" />
    </Indicator>
    {icon ? <ItemRow icon={icon}>{children}</ItemRow> : children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & { icon?: IconType }
>(({ className, children, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(dropdownMenuItemVariants({ variant: 'default' }), 'ps-8', className)} {...props}>
    <Indicator>
      <Circle className="h-2 w-2 fill-current" />
    </Indicator>
    {icon ? <ItemRow icon={icon}>{children}</ItemRow> : children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

/* ------------------------------------------------------------------ extras */

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean; icon?: IconType }
>(({ className, inset, icon: Icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-[hsl(var(--dash-muted))]', inset && 'ps-8', className)}
    {...props}
  >
    {Icon ? <Icon size={14} className="shrink-0" /> : null}
    {children}
  </DropdownMenuPrimitive.Label>
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-[hsl(var(--dash-border))]/80', className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ms-auto text-xs tracking-widest opacity-60', className)} {...props} />
)
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  dropdownMenuItemVariants,
}
