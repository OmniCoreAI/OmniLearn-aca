'use client'
import React, { forwardRef, useEffect, useState } from 'react'
import { getOrgContentUrl, getOrgLogoMediaDirectory } from '@services/media/media'

/*
  Draws a certificate from an Administration → Certificates template.
  One renderer for the editor preview, the course Certification tab, the
  learner's PDF download and the public verification page. Everything uses
  inline styles and fixed pixel sizes so html2canvas output matches the screen.
*/

export interface CertificateDesign {
  primary_color: string
  accent_color: string
  text_color: string
  background_color: string
  background_image?: string | null
  border_style: 'none' | 'single' | 'double' | 'ornate'
  font_family: string
  direction: 'ltr' | 'rtl'
  show_org_logo: boolean
  secondary_logo?: string | null
  title_text: string
  subtitle_text: string
  body_text: string
  footer_text: string
  show_qr: boolean
  show_certificate_id: boolean
  signatures: { name: string; title: string; image?: string | null }[]
}

export interface CertificateTemplateLike {
  layout: string
  orientation: string
  design: CertificateDesign
}

export const CERTIFICATE_FONTS = ['Cairo', 'Tajawal', 'Amiri', 'Inter', 'Playfair Display', 'Georgia']
export const CERTIFICATE_LAYOUTS = ['classic', 'modern', 'minimal', 'bordered']

export const SAMPLE_CERTIFICATE_VARIABLES: Record<string, string> = {
  student_name: 'Mona Ali Hassan',
  course_name: 'Cybersecurity Fundamentals',
  program_name: 'Digital Skills Track',
  completion_date: '2026-10-15',
  issue_date: '2026-10-15',
  certificate_id: 'EACA-2026-00042',
  instructor_name: 'Dr. Hany Mostafa',
  org_name: 'Egyptian Academy',
  certification_name: 'Certified Security Practitioner',
}

export const CERTIFICATE_VARIABLES = Object.keys(SAMPLE_CERTIFICATE_VARIABLES)

export function certificateSize(orientation: string) {
  return orientation === 'portrait' ? { width: 794, height: 1123 } : { width: 1123, height: 794 }
}

export function fillCertificateText(text: string, variables: Record<string, string>) {
  return (text || '').replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, name) => variables[name] ?? '')
}

function useGoogleFont(family: string) {
  useEffect(() => {
    if (!family || family === 'Georgia' || typeof document === 'undefined') return
    const id = `cert-font-${family.replace(/\s+/g, '-')}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700&display=swap`
    document.head.appendChild(link)
  }, [family])
}

function useQrCode(value?: string) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!value) return
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(value, { width: 180, margin: 1, errorCorrectionLevel: 'M' }))
      .then((data) => !cancelled && setUrl(data))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [value])
  return url
}

const assetUrl = (orgUuid: string, path?: string | null) =>
  path ? getOrgContentUrl(orgUuid, `certificates/templates/${path}`) : ''

function Border({ style, color, accent }: { style: string; color: string; accent: string }) {
  if (style === 'none') return null
  const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none', borderRadius: 4 }
  if (style === 'single') return <div style={{ ...base, inset: 24, border: `3px solid ${color}` }} />
  if (style === 'double')
    return (
      <>
        <div style={{ ...base, inset: 20, border: `4px solid ${color}` }} />
        <div style={{ ...base, inset: 32, border: `1.5px solid ${accent}` }} />
      </>
    )
  return (
    <>
      <div style={{ ...base, inset: 16, border: `10px double ${color}` }} />
      <div style={{ ...base, inset: 40, border: `2px dashed ${accent}` }} />
      {[
        { top: 22, left: 22 },
        { top: 22, right: 22 },
        { bottom: 22, left: 22 },
        { bottom: 22, right: 22 },
      ].map((pos, i) => (
        <div key={i} style={{ ...base, ...pos, width: 34, height: 34, background: accent, transform: 'rotate(45deg)' }} />
      ))}
    </>
  )
}

export const TemplateCertificate = forwardRef<
  HTMLDivElement,
  {
    template: CertificateTemplateLike
    variables: Record<string, string>
    orgUuid: string
    orgLogo?: string | null
    verifyUrl?: string
    /** Visual scale for previews (the DOM keeps the real size for PDF capture). */
    scale?: number
  }
>(function TemplateCertificate({ template, variables, orgUuid, orgLogo, verifyUrl, scale = 1 }, ref) {
  const d = template.design
  const { width, height } = certificateSize(template.orientation)
  const qr = useQrCode(d.show_qr ? verifyUrl || variables.certificate_id : undefined)
  useGoogleFont(d.font_family)
  const rtl = d.direction === 'rtl'
  const text = (value: string) => fillCertificateText(value, variables)
  const modern = template.layout === 'modern'
  const minimal = template.layout === 'minimal'
  const logo = d.show_org_logo && orgLogo ? getOrgLogoMediaDirectory(orgUuid, orgLogo) : ''
  const secondary = assetUrl(orgUuid, d.secondary_logo)
  const signatures = (d.signatures || []).filter((s) => s.name || s.title || s.image)

  const sheet: React.CSSProperties = {
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
    background: d.background_color,
    backgroundImage: d.background_image ? `url("${assetUrl(orgUuid, d.background_image)}")` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: d.text_color,
    fontFamily: `'${d.font_family}', 'Cairo', Arial, sans-serif`,
    direction: d.direction,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ width: width * scale, height: height * scale, overflow: 'hidden' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
        <div ref={ref} style={sheet}>
          {modern && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                [rtl ? 'right' : 'left']: 0,
                width: 150,
                background: `linear-gradient(180deg, ${d.primary_color}, ${d.accent_color})`,
              }}
            />
          )}
          {!minimal && <Border style={d.border_style} color={d.primary_color} accent={d.accent_color} />}
          <div
            style={{
              position: 'absolute',
              inset: modern ? (rtl ? '70px 210px 70px 80px' : '70px 80px 70px 210px') : minimal ? '80px 110px' : '80px 100px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: modern ? (rtl ? 'flex-end' : 'flex-start') : 'center',
              textAlign: modern ? (rtl ? 'right' : 'left') : 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: 80 }}>
              {logo && <img src={logo} alt="" crossOrigin="anonymous" style={{ maxHeight: 76, maxWidth: 200, objectFit: 'contain' }} />}
              {secondary && <img src={secondary} alt="" crossOrigin="anonymous" style={{ maxHeight: 76, maxWidth: 200, objectFit: 'contain' }} />}
            </div>
            <div style={{ marginTop: 24, fontSize: minimal ? 40 : 46, fontWeight: 700, letterSpacing: rtl ? 0 : 1, color: d.primary_color, lineHeight: 1.2 }}>
              {text(d.title_text)}
            </div>
            {!minimal && <div style={{ width: 120, height: 3, background: d.accent_color, margin: '18px 0' }} />}
            <div style={{ fontSize: 20, opacity: 0.8, marginTop: minimal ? 18 : 0 }}>{text(d.subtitle_text)}</div>
            <div style={{ fontSize: 44, fontWeight: 700, margin: '14px 0', color: d.text_color, fontFamily: `'${d.font_family}', 'Amiri', serif` }}>
              {variables.student_name || '—'}
            </div>
            <div style={{ fontSize: 19, lineHeight: 1.6, maxWidth: modern ? 760 : 820, whiteSpace: 'pre-line' }}>{text(d.body_text)}</div>
            {d.footer_text && <div style={{ fontSize: 15, opacity: 0.75, marginTop: 14, whiteSpace: 'pre-line' }}>{text(d.footer_text)}</div>}

            <div style={{ flex: 1 }} />
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 24,
                flexDirection: rtl ? 'row-reverse' : 'row',
              }}
            >
              <div style={{ display: 'flex', gap: 36, flexDirection: rtl ? 'row-reverse' : 'row' }}>
                {signatures.map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', minWidth: 170 }}>
                    <div style={{ height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      {s.image && <img src={assetUrl(orgUuid, s.image)} alt="" crossOrigin="anonymous" style={{ maxHeight: 54, maxWidth: 170, objectFit: 'contain' }} />}
                    </div>
                    <div style={{ borderTop: `1.5px solid ${d.text_color}`, marginTop: 4, paddingTop: 6, fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{s.title}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexDirection: rtl ? 'row-reverse' : 'row' }}>
                {d.show_certificate_id && (
                  <div style={{ fontSize: 12, opacity: 0.75, textAlign: rtl ? 'left' : 'right' }}>
                    <div>{variables.issue_date}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{variables.certificate_id}</div>
                  </div>
                )}
                {d.show_qr && qr && <img src={qr} alt="" style={{ width: 92, height: 92 }} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

/** Capture a rendered certificate (the ref's element) into a PDF download. */
export async function downloadCertificatePdf(element: HTMLElement, orientation: string, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    await (document as any).fonts.ready
  }
  const { width, height } = certificateSize(orientation)
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: null, width, height })
  const landscape = orientation !== 'portrait'
  const pdf = new jsPDF(landscape ? 'landscape' : 'portrait', 'mm', 'a4')
  const pageWidth = landscape ? 297 : 210
  const pageHeight = landscape ? 210 : 297
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight)
  pdf.save(filename)
}

export interface CertificateRender {
  template: CertificateTemplateLike & { name?: string }
  variables: Record<string, string>
  org_uuid: string
}

export interface TemplateCertificateHandle {
  download: (_filename: string) => Promise<void>
}

/** A scaled on-screen certificate plus a hidden full-size copy for PDF capture. */
export const TemplateCertificateView = forwardRef<
  TemplateCertificateHandle,
  { render: CertificateRender; verifyUrl?: string; orgLogo?: string | null; scale?: number }
>(function TemplateCertificateView({ render, verifyUrl, orgLogo, scale }, ref) {
  const captureRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => ({
    download: async (filename: string) => {
      if (captureRef.current) await downloadCertificatePdf(captureRef.current, render.template.orientation, filename)
    },
  }))
  const portrait = render.template.orientation === 'portrait'
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="mx-auto w-fit shadow-md">
        <TemplateCertificate
          template={render.template}
          variables={render.variables}
          orgUuid={render.org_uuid}
          orgLogo={orgLogo}
          verifyUrl={verifyUrl}
          scale={scale ?? (portrait ? 0.5 : 0.62)}
        />
      </div>
      <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden>
        <TemplateCertificate
          ref={captureRef}
          template={render.template}
          variables={render.variables}
          orgUuid={render.org_uuid}
          orgLogo={orgLogo}
          verifyUrl={verifyUrl}
        />
      </div>
    </div>
  )
})
