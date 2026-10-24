'use client'

import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getActivityMediaDirectory } from '@services/media/media'
import React, { useEffect, useMemo, useState } from 'react'
import { Download, FileText, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function resolveFilename(content: any): string | null {
  if (!content) return null
  const parsed = typeof content === 'string' ? (() => {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  })() : content
  return parsed?.filename || parsed?.file_id || null
}

/**
 * PDF document activity viewer.
 *
 * Activity PDFs live behind auth. A bare <iframe src="…/content/…"> cannot
 * send the Bearer token, so private courses return 401 and the viewer looks
 * blank. We fetch with the session token and display via a blob URL instead.
 */
function DocumentPdfActivity({
  activity,
  course,
  orgUuid,
  className,
}: {
  activity: any
  course: any
  orgUuid?: string
  className?: string
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  const resolvedOrgUuid = orgUuid || org?.org_uuid
  const filename = resolveFilename(activity?.content)

  const remoteUrl = useMemo(() => {
    if (!resolvedOrgUuid || !course?.course_uuid || !activity?.activity_uuid || !filename) {
      return null
    }
    return getActivityMediaDirectory(
      resolvedOrgUuid,
      course.course_uuid,
      activity.activity_uuid,
      filename,
      'documentpdf'
    )
  }, [resolvedOrgUuid, course?.course_uuid, activity?.activity_uuid, filename])

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!remoteUrl) {
      setLoading(false)
      setError(t('activities.pdf.missing_file', 'PDF file is missing'))
      return
    }
    if (!token) {
      setLoading(false)
      setError(t('activities.pdf.auth_required', 'Sign in to view this PDF'))
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      setLoading(true)
      setError(null)
      setBlobUrl(null)
      try {
        const res = await fetch(remoteUrl!, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? t('activities.pdf.access_denied', 'You do not have access to this PDF')
              : t('activities.pdf.load_failed', 'Could not load PDF ({{status}})', {
                  status: res.status,
                })
          )
        }
        const raw = await res.blob()
        const pdfBlob =
          raw.type === 'application/pdf'
            ? raw
            : new Blob([raw], { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(pdfBlob)
        if (!cancelled) {
          setBlobUrl(objectUrl)
          setLoading(false)
        } else {
          URL.revokeObjectURL(objectUrl)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || t('activities.pdf.load_failed_generic', 'Could not load PDF'))
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [remoteUrl, token, t])

  const shellClass =
    className ?? 'm-0 mt-0 bg-zinc-900 sm:m-8 sm:mt-14 sm:rounded-md'
  const frameClass = className
    ? 'h-full w-full'
    : 'h-[85vh] w-full sm:h-[900px] sm:rounded-lg'

  if (loading) {
    return (
      <div className={`${shellClass} flex items-center justify-center ${className ? 'h-full' : 'h-[85vh] sm:h-[900px]'}`}>
        <div className="flex flex-col items-center gap-3 text-white/70">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm">{t('activities.pdf.loading', 'Loading PDF…')}</p>
        </div>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div className={`${shellClass} flex items-center justify-center ${className ? 'h-full' : 'h-[85vh] sm:h-[900px]'}`}>
        <div className="mx-4 max-w-md rounded-2xl bg-white px-6 py-8 text-center shadow-lg">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="text-sm font-medium text-zinc-800">
            {error || t('activities.pdf.unavailable', 'PDF unavailable')}
          </p>
          {remoteUrl && token && (
            <a
              href={remoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              onClick={async (e) => {
                // Open authenticated download via blob instead of raw link
                e.preventDefault()
                try {
                  const res = await fetch(remoteUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                  })
                  if (!res.ok) return
                  const b = await res.blob()
                  const u = URL.createObjectURL(b)
                  const a = document.createElement('a')
                  a.href = u
                  a.download = filename || 'document.pdf'
                  a.click()
                  URL.revokeObjectURL(u)
                } catch {
                  /* ignore */
                }
              }}
            >
              <Download size={14} />
              {t('activities.pdf.download', 'Download PDF')}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-zinc-950/80 px-3 py-2 sm:rounded-t-md">
        <span className="inline-flex items-center gap-2 truncate text-xs font-medium text-white/80">
          <FileText size={14} />
          {filename || t('activities.pdf.document', 'Document')}
        </span>
        <a
          href={blobUrl}
          download={filename || 'document.pdf'}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
        >
          <Download size={12} />
          {t('activities.pdf.download', 'Download')}
        </a>
      </div>
      <iframe
        className={frameClass}
        src={`${blobUrl}#toolbar=1&navpanes=0`}
        title={filename || 'PDF document'}
      />
    </div>
  )
}

export default DocumentPdfActivity
