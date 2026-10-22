import { NextRequest } from 'next/server'
import { isSubdomainOf, isSameHost, isLocalhost, stripPort } from '@services/utils/ts/hostUtils'
import { getConfig } from '@services/config/config'

export const ACCESS_TOKEN_COOKIE = 'OL_access'
export const REFRESH_TOKEN_COOKIE = 'OL_refresh'
export const ACCESS_TOKEN_MAX_AGE = 8 * 60 * 60 // 8 hours
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export function getDomainFromRequest(request: NextRequest): { domain: string; topDomain: string } {
  const envDomain = getConfig('NEXT_PUBLIC_OMNILEARN_DOMAIN')
  const envTopDomain = getConfig('NEXT_PUBLIC_OMNILEARN_TOP_DOMAIN')
  if (envDomain) {
    return {
      domain: envDomain,
      topDomain: stripPort(envTopDomain || envDomain),
    }
  }

  const cookieDomain = request.cookies.get('OL_frontend_domain')?.value
  const cookieTopDomain = request.cookies.get('OL_top_domain')?.value
  if (cookieDomain) {
    return {
      domain: cookieDomain,
      topDomain: stripPort(cookieTopDomain || cookieDomain),
    }
  }

  return { domain: 'localhost', topDomain: 'localhost' }
}

export function getCookieDomain(request: NextRequest): string | undefined {
  // Tenancy is the source of truth: in single mode cookies are always
  // host-only on whatever Host the request arrived with, regardless of
  // whether that's localhost or a self-hosted VPS hostname — unless the API
  // configured a shared parent domain (OMNILEARN_COOKIE_DOMAIN, passed on by
  // proxy.ts as OL_cookie_domain) so the main website's login reaches us.
  // In multi mode we use the configured top domain so subdomains share the
  // session.
  const tenancy = request.cookies.get('OL_tenancy')?.value || 'single'
  const host = request.headers.get('host')
  if (tenancy === 'single') {
    const shared = request.cookies.get('OL_cookie_domain')?.value
    if (shared && isSubdomainOf(host, shared.replace(/^\./, ''))) return shared
    return undefined
  }

  const { domain, topDomain } = getDomainFromRequest(request)

  if (isLocalhost(host)) return undefined
  if (topDomain === 'localhost') return undefined
  if (isSubdomainOf(host, domain) || isSameHost(host, domain)) {
    return `.${topDomain}`
  }
  // Custom (per-org) domain in multi mode → host-only.
  return undefined
}

export function getCookieOptions(request: NextRequest) {
  const isSecure = request.nextUrl.protocol === 'https:'
  const domain = getCookieDomain(request)
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  }
}
