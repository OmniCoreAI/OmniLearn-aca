/**
 * omnilearn-analytics — the single import surface for product analytics.
 *
 *   import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'
 *   const { track } = useOmniLearnAnalytics('learner')
 *   track(AnalyticsEvent.CourseStarted, { course_uuid })
 */
export { AnalyticsEvent } from './events'
export { useOmniLearnAnalytics, type EventProps } from './useOmniLearnAnalytics'
export { useTrackView } from './useTrackView'
export { useStandardProps, type StandardProps } from './context'
