'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@components/Contexts/AuthContext'
import { Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

type HandoffPayload = {
  access_token: string
  refresh_token: string
  expiry?: number
  user?: unknown
  next?: string
}

function parsePayload(): HandoffPayload | null {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  try {
    const json = decodeURIComponent(raw)
    const data = JSON.parse(json) as HandoffPayload
    if (!data.access_token || !data.refresh_token) return null
    return data
  } catch {
    try {
      const data = JSON.parse(atob(raw)) as HandoffPayload
      if (!data.access_token || !data.refresh_token) return null
      return data
    } catch {
      return null
    }
  }
}

export default function AuthHandoffPage() {
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const payload = parsePayload()
      // Clear tokens from the URL as soon as we read them
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      if (!payload) {
        if (!cancelled) setError('Missing or invalid handoff token. Please sign in again.')
        return
      }

      try {
        const establishRes = await fetch('/api/auth/establish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expiry: payload.expiry,
          }),
        })

        if (!establishRes.ok) {
          throw new Error('Failed to establish session cookies')
        }

        const next =
          payload.next && payload.next.startsWith('/')
            ? `${window.location.origin}${payload.next}`
            : `${window.location.origin}/redirect_from_auth`

        const result = await signIn('credentials', {
          redirect: false,
          sso: 'true',
          sso_access_token: payload.access_token,
          sso_refresh_token: payload.refresh_token,
          sso_expiry: payload.expiry,
          sso_user: payload.user ? JSON.stringify(payload.user) : undefined,
          callbackUrl: next,
        })

        if (cancelled) return

        if (result?.error) {
          setError('Failed to complete sign-in. Please try again.')
          return
        }

        window.location.href = next
      } catch {
        if (!cancelled) setError('Could not complete portal handoff. Please try again.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [signIn])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-lg font-medium text-neutral-800">{error}</p>
        <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      <p className="text-sm text-neutral-600">Opening your learning portal…</p>
    </div>
  )
}
