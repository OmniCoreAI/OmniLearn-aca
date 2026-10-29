'use client'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { CheckCircle, CircleNotch, Eye, FileText, UploadSimple, WarningCircle, Hourglass, Plus } from '@phosphor-icons/react'
import { DOCUMENT_TYPES, openApplicationDocument, uploadApplicationDocument } from '@services/academic/core'
import { cn } from '@/lib/utils'

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,image/*'
const ACCEPTED_EXT = /\.(pdf|docx?|png|jpe?g|gif|webp|heic|bmp|tiff?)$/i

type Doc = { document_uuid: string; document_type: string; original_name: string; status: string; review_note?: string | null; creation_date?: string }
type Slot = { type: string; label?: string; required: boolean }

/** The latest upload decides the slot's state. */
function slotState(docs: Doc[]): 'missing' | 'pending' | 'verified' | 'rejected' {
  if (docs.some((d) => d.status === 'verified')) return 'verified'
  const latest = docs[docs.length - 1]
  if (!latest) return 'missing'
  return latest.status === 'rejected' ? 'rejected' : 'pending'
}

const STATE_STYLE = {
  missing: { ring: 'border-[hsl(var(--dash-border))]', icon: UploadSimple, tone: 'text-[hsl(var(--dash-muted))] bg-[hsl(var(--dash-canvas))]' },
  pending: { ring: 'border-amber-200', icon: Hourglass, tone: 'text-amber-700 bg-amber-50' },
  verified: { ring: 'border-emerald-200', icon: CheckCircle, tone: 'text-emerald-700 bg-emerald-50' },
  rejected: { ring: 'border-red-200', icon: WarningCircle, tone: 'text-red-700 bg-red-50' },
} as const

function DocumentSlot({
  slot,
  docs,
  canUpload,
  onUpload,
  onOpen,
}: {
  slot: Slot
  docs: Doc[]
  canUpload: boolean
  onUpload: (_type: string, _file: File) => Promise<void>
  onOpen: (_doc: Doc) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const state = slotState(docs)
  const style = STATE_STYLE[state]
  const Icon = style.icon
  const latest = docs[docs.length - 1]
  const typeLabel = String(t(`academic.doc_${slot.type}`, slot.type.replace(/_/g, ' ')))

  const take = async (file: File | undefined | null) => {
    if (!file || busy) return
    if (!ACCEPTED_EXT.test(file.name)) {
      toast.error(t('academic.docs.bad_type', 'Upload a PDF, Word document or image.'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('academic.docs.too_big', 'The file is larger than 15 MB.'))
      return
    }
    setBusy(true)
    try {
      await onUpload(slot.type, file)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const statusText = {
    missing: slot.required ? t('academic.docs.state_missing_required', 'Required — not uploaded yet') : t('academic.docs.state_missing', 'Not uploaded'),
    pending: t('academic.docs.state_pending', 'Uploaded — waiting for review'),
    verified: t('academic.docs.state_verified', 'Verified'),
    rejected: t('academic.docs.state_rejected', 'Rejected — please upload a new file'),
  }[state]

  return (
    <li
      onDragOver={(e) => {
        if (!canUpload) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canUpload) return
        e.preventDefault()
        setDragging(false)
        take(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-[hsl(var(--dash-surface))] p-4 transition-colors',
        style.ring,
        dragging && 'border-dashed border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))]/40'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.tone)}>
          {busy ? <CircleNotch size={20} className="animate-spin" /> : <Icon size={20} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {slot.label || typeLabel}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                slot.required ? 'bg-[hsl(var(--dash-ink))] text-white' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
              )}
            >
              {slot.required ? t('academic.docs.required', 'Required') : t('academic.optional', 'optional')}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]">{statusText}</p>
          {state === 'rejected' && latest?.review_note ? (
            <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-800">{latest.review_note}</p>
          ) : null}
        </div>
      </div>

      {docs.length > 0 && (
        <ul className="space-y-1">
          {[...docs].reverse().map((d) => (
            <li key={d.document_uuid}>
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors hover:bg-[hsl(var(--dash-canvas))]"
              >
                <FileText size={16} weight="duotone" className="shrink-0 text-[hsl(var(--dash-muted))]" />
                <span className="min-w-0 flex-1 truncate">{d.original_name}</span>
                <span className="shrink-0 text-[10px] uppercase text-[hsl(var(--dash-muted))]">
                  {String(t(`academic.docstatus_${d.status}`, d.status))}
                </span>
                <Eye size={14} className="shrink-0 text-[hsl(var(--dash-muted))]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {canUpload && state !== 'verified' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'mt-auto flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60',
            'border-[hsl(var(--dash-border))] text-[hsl(var(--dash-ink))]/80 hover:border-[hsl(var(--dash-ink))]/40 hover:bg-[hsl(var(--dash-canvas))]'
          )}
        >
          <UploadSimple size={14} weight="bold" />
          {busy
            ? t('academic.docs.uploading', 'Uploading…')
            : docs.length
              ? t('academic.docs.replace', 'Upload a new file')
              : t('academic.docs.choose', 'Choose a file or drop it here')}
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
    </li>
  )
}

/**
 * One card per document: what the program requires first, then anything
 * already uploaded, then optional extras the applicant adds. Each card uploads
 * on its own (choose or drag a file), so documents go up one by one.
 */
export function DocumentChecklist({
  applicationUuid,
  accessToken,
  documents,
  checks,
  canUpload,
  onChanged,
}: {
  applicationUuid: string
  accessToken: string
  documents: Doc[]
  checks: any[]
  canUpload: boolean
  onChanged: (_application: any) => void
}) {
  const { t } = useTranslation()
  const [extraTypes, setExtraTypes] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const required: Slot[] = []
  for (const c of checks) {
    if (c.requirement_type === 'document' && c.document_type && !required.some((s) => s.type === c.document_type)) {
      required.push({ type: c.document_type, label: c.label, required: !!c.mandatory })
    }
  }
  const listed = new Set(required.map((s) => s.type))
  const uploadedOther = [...new Set(documents.map((d) => d.document_type))].filter((type) => !listed.has(type))
  const slots: Slot[] = [
    ...required,
    ...[...uploadedOther, ...extraTypes.filter((x) => !uploadedOther.includes(x) && !listed.has(x))].map((type) => ({ type, required: false })),
  ]
  const shown = new Set(slots.map((s) => s.type))
  const addable = DOCUMENT_TYPES.filter((type) => !shown.has(type))

  const docsOf = (type: string) => documents.filter((d) => d.document_type === type)
  const mandatory = required.filter((s) => s.required)
  const mandatoryDone = mandatory.filter((s) => slotState(docsOf(s.type)) !== 'missing' && slotState(docsOf(s.type)) !== 'rejected').length

  const upload = async (type: string, file: File) => {
    try {
      const result = await uploadApplicationDocument(applicationUuid, type, file, accessToken)
      onChanged(result)
      toast.success(t('academic.docs.uploaded_named', '{{name}} uploaded', { name: String(t(`academic.doc_${type}`, type.replace(/_/g, ' '))) }))
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed', 'Could not save'))
    }
  }
  const open = (doc: Doc) =>
    openApplicationDocument(applicationUuid, doc.document_uuid, accessToken, doc.original_name).catch((e) => toast.error(e.message))

  return (
    <div className="space-y-4">
      {mandatory.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--dash-accent))] transition-all"
              style={{ width: `${(mandatoryDone / mandatory.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-[hsl(var(--dash-muted))]">
            {t('academic.docs.progress', '{{done}} of {{total}} required documents uploaded', { done: mandatoryDone, total: mandatory.length })}
          </span>
        </div>
      )}

      {slots.length === 0 && !canUpload ? (
        <p className="text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_documents', 'No documents uploaded.')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {slots.map((slot) => (
            <DocumentSlot
              key={slot.type}
              slot={slot}
              docs={docsOf(slot.type)}
              canUpload={canUpload}
              onUpload={upload}
              onOpen={open}
            />
          ))}
        </ul>
      )}

      {canUpload && addable.length > 0 && (
        <div>
          {adding ? (
            <div className="flex flex-wrap gap-2">
              {addable.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setExtraTypes((prev) => [...prev, type])
                    setAdding(false)
                  }}
                  className="rounded-full border border-[hsl(var(--dash-border))] px-3 py-1.5 text-xs font-medium hover:border-[hsl(var(--dash-ink))]/40 hover:bg-[hsl(var(--dash-canvas))]"
                >
                  {String(t(`academic.doc_${type}`, type.replace(/_/g, ' ')))}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))]/80 hover:text-[hsl(var(--dash-ink))]"
            >
              <Plus size={14} weight="bold" /> {t('academic.docs.add_other', 'Add another document')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
