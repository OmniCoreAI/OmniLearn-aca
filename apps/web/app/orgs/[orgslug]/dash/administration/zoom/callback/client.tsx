'use client'
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getUriWithOrg } from '@services/config/config'
import { completeZoomConnect } from '@services/integrations/zoom'
import { zoomErrorMessage } from '@components/Objects/OnlineMeetings/meetingUtils'

/** Zoom redirects here after the admin approves the app; the backend checks
 *  the signed state and exchanges the code (the code never reaches Zoom twice). */
export default function ZoomOAuthCallback({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { orgId, access_token, ready } = useAdminContext()
  const [failure, setFailure] = useState<string | null>(null)
  const sent = useRef(false)
  const code = params.get('code')
  const state = params.get('state')
  // Zoom sends ?error=access_denied when the admin declines.
  const error =
    failure || (!code || !state ? params.get('error_description') || t('online_meetings.errors.zoom_oauth_failed') : null)

  useEffect(() => {
    if (!ready || sent.current || !code || !state) return
    sent.current = true
    completeZoomConnect(orgId, code, state, access_token)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ['zoom', 'connection'] })
        toast.success(t('online_meetings.admin.connected_toast'))
        router.replace(getUriWithOrg(orgslug, '/dash/administration/zoom'))
      })
      .catch((err) => setFailure(zoomErrorMessage(err, t)))
  }, [ready, code, state, orgId, access_token, orgslug, queryClient, router, t])

  return (
    <AcademicPageShell>
      <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
        {error ? (
          <>
            <WarningCircle size={32} className="text-red-500" />
            <p className="text-sm text-[hsl(var(--dash-ink))]">{error}</p>
            <Link
              href={getUriWithOrg(orgslug, '/dash/administration/zoom')}
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t('online_meetings.admin.back_to_settings')}
            </Link>
          </>
        ) : (
          <>
            <CircleNotch size={28} className="animate-spin text-[hsl(var(--dash-muted))]" />
            <p className="text-sm text-[hsl(var(--dash-muted))]">{t('online_meetings.admin.finishing')}</p>
          </>
        )}
      </div>
    </AcademicPageShell>
  )
}
