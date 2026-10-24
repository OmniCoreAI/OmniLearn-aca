'use client'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  SAMPLE_CERTIFICATE_VARIABLES,
  TemplateCertificate,
  certificateSize,
  downloadCertificatePdf,
} from '@components/Certificates/TemplateCertificate'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'

/** Sample values with the academy's own name. */
export function useSampleVariables() {
  const { org } = useAdminContext()
  return { ...SAMPLE_CERTIFICATE_VARIABLES, org_name: org?.name || SAMPLE_CERTIFICATE_VARIABLES.org_name }
}

/**
 * A certificate scaled to the width of its container (never above
 * `maxScale`), so previews stay crisp on any screen size.
 */
export function FitCertificate({
  template,
  maxScale = 1,
  className,
  zoom = 1,
  maxHeight,
}: {
  template: any
  maxScale?: number
  className?: string
  /** Also keep the certificate within this height (px). */
  maxHeight?: number
  /** Multiplier on the fitted scale (1 = fit width). */
  zoom?: number
}) {
  const { org } = useAdminContext()
  const variables = useSampleVariables()
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const size = certificateSize(template?.orientation)
  const fit = Math.min(maxScale, width / size.width, maxHeight ? maxHeight / size.height : Infinity)
  const scale = width ? fit * zoom : 0
  return (
    <div ref={box} className={className}>
      {scale ? (
        <div className="mx-auto w-fit shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]">
          <TemplateCertificate template={template} variables={variables} orgUuid={org?.org_uuid} orgLogo={org?.logo_image} scale={scale} />
        </div>
      ) : null}
    </div>
  )
}

/** Downloads a sample PDF of the template filled with sample data. */
export function useSamplePdf(template: any) {
  const { t } = useTranslation()
  const { org } = useAdminContext()
  const variables = useSampleVariables()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const download = async () => {
    if (!ref.current || !template) return
    setBusy(true)
    try {
      await downloadCertificatePdf(ref.current, template.orientation, `${template.name || 'certificate'}-sample.pdf`)
    } catch {
      toast.error(t('certificates.pdf_failed', 'The PDF could not be created'))
    } finally {
      setBusy(false)
    }
  }
  // Full-size, off-screen copy that html2canvas captures.
  const capture = template ? (
    <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden>
      <TemplateCertificate ref={ref} template={template} variables={variables} orgUuid={org?.org_uuid} orgLogo={org?.logo_image} />
    </div>
  ) : null
  return { download, busy, capture }
}

export function CertificatePreviewDialog({ template, onClose }: { template: any | null; onClose: () => void }) {
  const { t } = useTranslation()
  const pdf = useSamplePdf(template)
  // Room left for the certificate inside the dialog (header, padding, footer).
  const [maxHeight] = useState(() => (typeof window === 'undefined' ? 640 : Math.max(280, window.innerHeight * 0.9 - 215)))
  return (
    <Modal
      isDialogOpen={!!template}
      onOpenChange={(open) => !open && onClose()}
      minWidth="no-min"
      customWidth="md:w-[min(1040px,92vw)]"
      dialogTitle={template?.name}
      dialogContent={
        template ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[hsl(var(--dash-canvas))] p-4 sm:p-6">
              <FitCertificate template={template} maxScale={0.85} maxHeight={maxHeight} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[hsl(var(--dash-muted))]">{t('certificates.preview_hint', 'Shown with sample data. Real certificates use the learner, course and issue date.')}</p>
              <GhostButton onClick={pdf.download} disabled={pdf.busy}>
                <Download className="h-3.5 w-3.5" /> {pdf.busy ? '…' : t('certificates.sample_pdf', 'Sample PDF')}
              </GhostButton>
            </div>
            {pdf.capture}
          </div>
        ) : null
      }
    />
  )
}
