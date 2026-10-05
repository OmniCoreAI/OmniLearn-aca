/**
 * EACA dashboard palette — the single source for colors used from JS
 * (inline styles, Recharts). Literal values rather than CSS vars because
 * Recharts writes them into SVG presentation attributes, where var() does
 * not resolve. Tailwind classes keep using the --dash-* tokens in globals.css.
 */
export const DASH_COLORS = {
  gold: 'hsl(43 80% 56%)',
  goldDeep: 'hsl(43 72% 45%)',
  goldSoft: 'hsl(43 78% 88%)',
  rose: 'hsl(351 70% 84%)',
  roseSoft: 'hsl(351 72% 93%)',
  roseFaint: 'hsl(351 70% 97%)',
  red: 'hsl(351 84% 44%)',
  stone: 'hsl(220 13% 88%)',
  stoneSoft: 'hsl(220 14% 95%)',
  ink: 'hsl(0 0% 8%)',
  muted: 'hsl(220 9% 46%)',
  grid: 'hsl(220 13% 92%)',
} as const

export type StatTone = 'rose' | 'stone' | 'gold' | 'sand'

/** Order tones cycle through when a row doesn't set them explicitly. */
export const STAT_TONE_CYCLE: StatTone[] = ['rose', 'stone', 'gold', 'sand']
