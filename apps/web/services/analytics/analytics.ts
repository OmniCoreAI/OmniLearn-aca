import { getAPIUrl } from '@services/config/config'

// lgtm[js/hardcoded-credentials] -- not a secret, just a sessionStorage key name
const SESSION_KEY = 'lh_analytics_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Events the API stores (apps/api src/services/analytics/events.py,
 * ALLOWED_FRONTEND_EVENTS). Anything else is rejected with 400, so it only
 * goes to PostHog.
 */
export const BACKEND_EVENTS: ReadonlySet<string> = new Set([
  'page_view',
  'course_view',
  'activity_view',
  'search_query',
  'time_on_activity',
])

export async function trackEvent(
  eventName: string,
  orgId: number,
  properties: Record<string, unknown>,
  accessToken: string
): Promise<void> {
  if (!BACKEND_EVENTS.has(eventName)) return
  try {
    const url = `${getAPIUrl()}analytics/events`
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        event_name: eventName,
        org_id: orgId,
        session_id: getSessionId(),
        properties,
      }),
      keepalive: true,
    })
  } catch {
    // Silently swallow — analytics should never break the app
  }
}
