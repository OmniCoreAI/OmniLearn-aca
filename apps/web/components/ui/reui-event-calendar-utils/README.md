# ReUI event calendar (vendored)

Support modules for `components/ui/reui-event-calendar.tsx`, the headless
event calendar from [ReUI](https://github.com/keenthemes/reui) (MIT,
© Keenthemes Inc). Taken from the Base UI + "nova" style build at upstream
commit `6e433dd` (`public/r/styles/base-nova/event-calendar.json`), plus the
shadcn Base UI primitives it depends on (`registry/bases/base/ui`).

Kept private to this folder so they don't clash with the app's Radix-based
`components/ui` primitives:

- `event-calendar-*.tsx`, `icon-stack.tsx`: ReUI calendar modules
- `button`, `calendar`, `card`, `dropdown-menu`, `popover`, `scroll-area`,
  `tooltip`: shadcn Base UI primitives, styled by `style-nova.css`
- `style-nova.css`: the `cn-*` rules from ReUI `registry/styles/style-nova.css`
  used by those primitives (imported by the root calendar module)

Local changes from upstream:

- Import paths rewritten to this folder; ReUI's icon placeholders resolved to
  `lucide-react`; shadcn create-time markers (`cn-rtl-flip`, `cn-menu-*`,
  `cn-font-heading`) resolved or dropped.
- `style-nova.css`: colors use the `--color-*` theme tokens, since this app's
  raw tokens are HSL triplets.
- Nav prev/next chevrons mirror in RTL (`rtl:rotate-180`).
- Month view: with `maxEventsPerCell="auto"`, overflowing bars give up a row to
  the "+N more" indicator instead of squeezing it to zero height.
- Removed a few unused imports/declarations flagged by lint.

Dependencies: `@base-ui/react`, `date-fns`, `@date-fns/tz`, `react-day-picker`,
`lucide-react`.
