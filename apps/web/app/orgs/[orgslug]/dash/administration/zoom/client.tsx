'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle, Copy, Link as LinkIcon, LinkBreak, VideoCamera, WarningCircle, XCircle } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { disconnectZoom, getZoomConnection, startZoomConnect } from '@services/integrations/zoom'
import { zoomErrorMessage } from '@components/Objects/OnlineMeetings/meetingUtils'

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {ok ? (
        <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-gray-300" />
      )}
      <span>
        <span className="block text-sm text-[hsl(var(--dash-ink))]">{label}</span>
        {hint && <span className="block text-xs text-[hsl(var(--dash-muted))]">{hint}</span>}
      </span>
    </li>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs text-gray-700">{value}</code>
        <button
          className="shrink-0 text-gray-500 hover:text-black"
          aria-label={t('online_meetings.actions.copy_link')}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            toast.success(t('online_meetings.link_copied'))
          }}
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  )
}

/** Administration → Online meetings: connect the academy's Zoom account. */
export default function ZoomAdminPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const { data: conn, error } = useQuery({
    queryKey: ['zoom', 'connection', orgId],
    queryFn: () => getZoomConnection(orgId, access_token),
    enabled: ready,
  })

  const connect = async () => {
    setBusy(true)
    try {
      const { authorize_url } = await startZoomConnect(orgId, access_token)
      window.location.href = authorize_url
    } catch (err: any) {
      toast.error(zoomErrorMessage(err, t))
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm(t('online_meetings.admin.confirm_disconnect'))) return
    setBusy(true)
    try {
      await disconnectZoom(orgId, access_token)
      await queryClient.invalidateQueries({ queryKey: ['zoom', 'connection'] })
      toast.success(t('online_meetings.admin.disconnected'))
    } catch (err: any) {
      toast.error(zoomErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${getAPIUrl()}integrations/zoom/webhook`
  const redirectUrl = `${origin}${getUriWithOrg(orgslug, '/dash/administration/zoom/callback').replace(/^https?:\/\/[^/]+/, '')}`

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('online_meetings.admin.title') }]} />
      <AcademicHeader title={t('online_meetings.admin.title')} subtitle={t('online_meetings.admin.subtitle')} />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{zoomErrorMessage(error, t)}</p>
      )}

      {conn && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))]">
                  <VideoCamera size={22} weight="duotone" />
                </span>
                <div>
                  <p className="text-base font-semibold text-[hsl(var(--dash-ink))]">
                    {conn.connected
                      ? t('online_meetings.state.connected')
                      : conn.status === 'reauth_required'
                        ? t('online_meetings.state.reconnect_needed')
                        : t('online_meetings.state.not_connected')}
                  </p>
                  {conn.zoom_email && (
                    <p className="text-sm text-[hsl(var(--dash-muted))]">
                      {conn.zoom_display_name ? `${conn.zoom_display_name} · ` : ''}
                      {conn.zoom_email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {conn.configured && (!conn.connected || conn.status === 'reauth_required') && (
                  <button
                    onClick={connect}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-bold text-[hsl(var(--dash-ink))] disabled:opacity-50"
                  >
                    <LinkIcon size={16} /> {conn.status ? t('online_meetings.admin.reconnect') : t('online_meetings.admin.connect')}
                  </button>
                )}
                {conn.status && (
                  <button
                    onClick={disconnect}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <LinkBreak size={16} /> {t('online_meetings.admin.disconnect')}
                  </button>
                )}
              </div>
            </div>

            {conn.status === 'reauth_required' && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <WarningCircle size={18} className="mt-0.5 shrink-0" />
                {t('online_meetings.admin.reauth_help')}
              </p>
            )}
            {!conn.configured && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <WarningCircle size={18} className="mt-0.5 shrink-0" />
                {t('online_meetings.admin.not_configured_help')}
              </p>
            )}

            <ul className="mt-5 divide-y divide-[hsl(var(--dash-border))]/60">
              <Check ok={conn.configured} label={t('online_meetings.admin.check_oauth')} hint={t('online_meetings.admin.check_oauth_hint')} />
              <Check ok={conn.sdk_configured} label={t('online_meetings.admin.check_sdk')} hint={t('online_meetings.admin.check_sdk_hint')} />
              <Check ok={conn.webhooks_configured} label={t('online_meetings.admin.check_webhooks')} hint={t('online_meetings.admin.check_webhooks_hint')} />
              <Check ok={conn.connected} label={t('online_meetings.admin.check_connected')} hint={t('online_meetings.admin.check_connected_hint')} />
            </ul>

            <p className="mt-5 text-sm text-[hsl(var(--dash-muted))]">
              {t('online_meetings.admin.how_it_works')}{' '}
              <Link href={getUriWithOrg(orgslug, '/dash/online-classes')} className="font-semibold text-[hsl(var(--dash-ink))] underline-offset-4 hover:underline">
                {t('online_meetings.dashboard.title')}
              </Link>
            </p>
          </section>

          <aside className="space-y-4 rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-5">
            <p className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('online_meetings.admin.zoom_app_settings')}</p>
            <CopyField label={t('online_meetings.admin.redirect_url')} value={redirectUrl} />
            <CopyField label={t('online_meetings.admin.webhook_url')} value={webhookUrl} />
            <p className="text-xs text-[hsl(var(--dash-muted))]">{t('online_meetings.admin.events_hint')}</p>
            {conn.scopes && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('online_meetings.admin.granted_scopes')}</p>
                <p className="break-words text-xs text-gray-600">{conn.scopes.split(' ').join(', ')}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </AcademicPageShell>
  )
}
