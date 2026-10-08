'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import toast from 'react-hot-toast'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { FacilitySelect, saveWithConflictCheck } from '@components/Dashboard/Pages/Administration/Pickers'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  BOOKING_KINDS,
  createFacilityBooking,
  updateFacilityBooking,
  type BookingKind,
  type FacilityBooking,
} from '@services/administration/administration'
import { RoomAssist } from './RoomAssist'

export function bookingKindLabel(t: TFunction, kind: string) {
  return String(t(`administration.facilities.kind_${kind}`, kind))
}

/** Create or change a direct hall booking (event, exam, meeting, maintenance…). */
export function BookingForm({
  booking,
  initial,
  onDone,
  confirmConflict,
}: {
  booking?: FacilityBooking | null
  /** Prefill for a new booking (e.g. from a calendar slot). */
  initial?: { facility_uuid?: string; start?: string; end?: string }
  onDone: (_saved: FacilityBooking) => void
  confirmConflict: (_message: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const [room, setRoom] = useState(booking?.facility_uuid || initial?.facility_uuid || '')
  const [title, setTitle] = useState(booking?.title || '')
  const [kind, setKind] = useState<BookingKind>((booking?.kind as BookingKind) || 'event')
  const [start, setStart] = useState(booking?.starts_at || initial?.start || '')
  const [end, setEnd] = useState(booking?.ends_at || initial?.end || '')
  const [attendees, setAttendees] = useState(booking?.attendees != null ? String(booking.attendees) : '')
  const [notes, setNotes] = useState(booking?.notes || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!room) next.room = String(t('administration.halls.room_required', 'Choose a room'))
    if (!title.trim()) next.title = String(t('administration.halls.title_required', 'Give the booking a title'))
    if (!start) next.start = String(t('administration.halls.start_required', 'Choose when it starts'))
    if (!end || (start && end <= start)) next.end = String(t('academic.off.end_after_start', 'The end must be after the start'))
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        kind,
        start,
        end,
        attendees: attendees === '' ? null : Number(attendees),
        notes: notes.trim() || null,
      }
      const saved = await saveWithConflictCheck(
        (allow_conflict) =>
          booking
            ? updateFacilityBooking(booking.booking_uuid, { ...payload, facility_uuid: room, allow_conflict }, access_token)
            : createFacilityBooking(room, { ...payload, allow_conflict }, access_token),
        t('administration.facilities.book_anyway', 'Book the room anyway?'),
        confirmConflict
      )
      if (!saved) return
      toast.success(booking ? t('administration.common.updated', 'Saved') : t('administration.halls.booked', 'Room booked'))
      onDone(saved)
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.halls.section_when', 'What and when')}>
        <Field label={t('administration.halls.title', 'Title')} required error={errors.title} className="sm:col-span-2">
          <input
            className={inputCls}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('administration.halls.title_placeholder', 'Graduation ceremony')}
            aria-invalid={!!errors.title}
          />
        </Field>
        <Field label={t('administration.halls.kind', 'Type')}>
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as BookingKind)}>
            {BOOKING_KINDS.map((k) => (
              <option key={k} value={k}>
                {bookingKindLabel(t, k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.halls.attendees', 'Attendees')} hint={t('administration.halls.attendees_hint', 'Used to suggest a room that fits')}>
          <input type="number" min={0} className={inputCls} value={attendees} onChange={(e) => setAttendees(e.target.value)} />
        </Field>
        <Field label={t('academic.starts', 'Starts')} required error={errors.start}>
          <input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errors.start} />
        </Field>
        <Field label={t('academic.ends', 'Ends')} required error={errors.end}>
          <input type="datetime-local" className={inputCls} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.end} />
        </Field>
      </FormSection>
      <FormSection title={t('administration.facilities.room', 'Room')} columns={1}>
        <Field label={t('administration.facilities.room', 'Room')} required error={errors.room}>
          <FacilitySelect
            className={inputCls}
            value={room}
            onChange={setRoom}
            current={booking?.facility_uuid ? { facility_uuid: booking.facility_uuid, name: booking.facility_name || '' } : null}
            emptyLabel={t('administration.halls.choose_room', 'Choose a room…')}
          />
        </Field>
        <RoomAssist
          start={start}
          end={end}
          room={room}
          attendees={attendees === '' ? null : Number(attendees)}
          exclude={booking?.booking_uuid}
          onPickRoom={setRoom}
          onPickTime={(s, e) => {
            setStart(s)
            setEnd(e)
          }}
        />
        <Field label={t('administration.halls.notes', 'Notes')}>
          <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} submitLabel={booking ? undefined : t('administration.halls.book', 'Book room')} />
    </form>
  )
}
