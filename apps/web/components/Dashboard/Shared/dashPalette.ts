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
  stone: 'hsl(40 12% 88%)',
  stoneSoft: 'hsl(40 16% 94%)',
  ink: 'hsl(0 0% 8%)',
  muted: 'hsl(0 0% 45%)',
  grid: 'hsl(40 14% 90%)',
} as const

export type StatTone = 'rose' | 'stone' | 'gold' | 'sand'

/** Pastel stat-card tones, as on the dashboard home: card background + icon color. */
export const STAT_TONES: Record<StatTone, { bg: string; icon: string }> = {
  rose: { bg: DASH_COLORS.roseSoft, icon: DASH_COLORS.red },
  stone: { bg: DASH_COLORS.stone, icon: DASH_COLORS.ink },
  gold: { bg: DASH_COLORS.gold, icon: DASH_COLORS.goldDeep },
  sand: { bg: DASH_COLORS.goldSoft, icon: DASH_COLORS.goldDeep },
}

/** Order tones cycle through when a row doesn't set them explicitly. */
export const STAT_TONE_CYCLE: StatTone[] = ['rose', 'stone', 'gold', 'sand']
