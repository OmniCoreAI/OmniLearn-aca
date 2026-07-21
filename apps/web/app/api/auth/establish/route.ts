import { NextRequest, NextResponse } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  getCookieOptions,
} from '@services/auth/cookies'

/**
 * Establish an OmniLearn session from tokens already obtained elsewhere
 * (e.g. Academy portal login). Sets the same httpOnly cookies as /api/auth/login.
 */
export async function POST(request: NextRequest) {
  let body: {
    access_token?: string
    refresh_token?: string
    expiry?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const accessToken = body.access_token?.trim()
  const refreshToken = body.refresh_token?.trim()

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: 'access_token and refresh_token are required' },
      { status: 400 }
    )
  }

  // Basic JWT shape check (three base64url segments)
  if (accessToken.split('.').length !== 3 || refreshToken.split('.').length !== 3) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
  }

  const cookieOptions = getCookieOptions(request)
  const response = NextResponse.json({ ok: true, expiry: body.expiry ?? null })

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })
  response.cookies.set('OL_session', '1', {
    ...cookieOptions,
    httpOnly: false,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })

  return response
}
