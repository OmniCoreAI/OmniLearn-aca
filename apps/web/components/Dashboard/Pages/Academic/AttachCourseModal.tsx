'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Link2, Search } from 'lucide-react'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { searchMatchesAny } from '@/lib/search/normalize'

/*
  Shared "add course" experience for the Academic Management layer. It reuses
  the EXISTING course creation modal (no duplicated course logic) and, on
  success, hands the created course_uuid to `onLink` so the caller can attach
  it to a Semester or Training Program. It also supports attaching a course that
  already exists in the organization.
*/

type Props = {
  orgslug: string
  access_token: string
  linkedCourseUuids: string[]
  onLink: (_courseUuid: string) => Promise<void>
  onDone: () => void
}

function AttachCourseModal({ orgslug, access_token, linkedCourseUuids, onLink, onDone }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'select' | 'create' | 'existing'>('select')

  if (mode === 'create') {
    return (
      <CreateCourseModal
        orgslug={orgslug}
        onCreated={async (courseUuid: string) => {
          try {
            await onLink(courseUuid)
            onDone()
          } catch {
            toast.error(t('academic.link_failed'))
          }
        }}
      />
    )
  }

  if (mode === 'existing') {
    return (
      <ExistingCoursePicker
        orgslug={orgslug}
        access_token={access_token}
        linkedCourseUuids={linkedCourseUuids}
        onLink={onLink}
        onDone={onDone}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        onClick={() => setMode('create')}
        className="flex flex-col items-start gap-2 p-5 rounded-xl border border-gray-200 hover:border-[hsl(var(--dash-ink))] hover:shadow-sm transition-all text-left"
      >
        <div className="p-2 rounded-lg bg-[hsl(var(--dash-accent))] text-white">
          <Plus className="w-5 h-5" />
        </div>
        <span className="font-semibold text-gray-900">{t('academic.create_and_attach_course')}</span>
        <span className="text-sm text-gray-500">{t('academic.no_courses_desc')}</span>
      </button>
      <button
        onClick={() => setMode('existing')}
        className="flex flex-col items-start gap-2 p-5 rounded-xl border border-gray-200 hover:border-[hsl(var(--dash-ink))] hover:shadow-sm transition-all text-left"
      >
        <div className="p-2 rounded-lg bg-gray-100 text-gray-700">
          <Link2 className="w-5 h-5" />
        </div>
        <span className="font-semibold text-gray-900">{t('academic.attach_existing_course')}</span>
        <span className="text-sm text-gray-500">{t('academic.manage_courses')}</span>
      </button>
    </div>
  )
}

function ExistingCoursePicker({
  orgslug,
  access_token,
  linkedCourseUuids,
  onLink,
  onDone,
}: {
  orgslug: string
  access_token: string
  linkedCourseUuids: string[]
  onLink: (_courseUuid: string) => Promise<void>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [linking, setLinking] = useState<string | null>(null)

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['academic', 'org-courses', orgslug],
    queryFn: async () => {
      const url = `${getAPIUrl()}courses/org_slug/${orgslug}/page/1/limit/500?include_unpublished=true`
      const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, access_token))
      if (!res.ok) throw new Error('Failed to fetch courses')
      return res.json()
    },
    enabled: !!access_token,
  })

  const linkedSet = new Set(linkedCourseUuids)
  const available = (courses as any[]).filter((c) => !linkedSet.has(c.course_uuid))
  const filtered = query.trim()
    ? available.filter((c) => searchMatchesAny([c.name, c.description], query))
    : available

  const handleLink = async (courseUuid: string) => {
    setLinking(courseUuid)
    try {
      await onLink(courseUuid)
      toast.success(t('academic.updated'))
      onDone()
    } catch {
      toast.error(t('academic.link_failed'))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('academic.manage_courses')}
          className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]"
        />
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
        {isLoading && <div className="p-4 text-sm text-gray-400">…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">{t('academic.no_courses')}</div>
        )}
        {filtered.map((c) => (
          <div key={c.course_uuid} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              {c.description && <p className="text-xs text-gray-500 truncate">{c.description}</p>}
            </div>
            <button
              onClick={() => handleLink(c.course_uuid)}
              disabled={linking === c.course_uuid}
              className="shrink-0 px-3 py-1.5 bg-[hsl(var(--dash-accent))] text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              {t('academic.add_course')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AttachCourseModal
