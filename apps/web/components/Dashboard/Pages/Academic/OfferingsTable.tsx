'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import { DataTable, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { displayName, stripPrefix } from '@services/academic/core'

export function OfferingsTable({ orgslug, offerings, empty }: { orgslug: string; offerings: any[]; empty?: string }) {
  const { t } = useTranslation()
  return (
    <DataTable
      headers={[
        t('academic.offering', 'Offering'),
        t('academic.course', 'Course'),
        t('academic.term', 'Term'),
        t('academic.cohort', 'Cohort'),
        t('academic.instructor', 'Instructor'),
        t('academic.enrolled_col', 'Enrolled'),
        t('academic.status'),
      ]}
      empty={empty || t('academic.no_offerings', 'No course offerings yet.')}
    >
      {offerings.map((o) => (
        <tr key={o.offering_uuid}>
          <td className={`${tdCls} font-mono text-xs`}>
            <Link
              className="font-semibold hover:text-[hsl(var(--dash-accent))]"
              href={getUriWithOrg(orgslug, `/dash/postgraduate/offerings/${stripPrefix(o.offering_uuid, 'offering')}`)}
            >
              {o.code}
            </Link>
          </td>
          <td className={tdCls}>
            <div className="font-medium">{o.course_name}</div>
            <div className="text-xs text-[hsl(var(--dash-muted))]">
              {o.course_code} · {o.credits} {t('academic.credits', 'Credits').toLowerCase()}
              {o.requirement && (
                <>
                  {' '}
                  · <StatusPill status={o.requirement} />
                </>
              )}
            </div>
          </td>
          <td className={`${tdCls} font-mono text-xs`}>{o.term_code}</td>
          <td className={`${tdCls} text-xs`}>{o.cohort_code || o.cohort_name || t('academic.open_offering', 'Open')}</td>
          <td className={`${tdCls} text-xs`}>{o.instructor ? displayName(o.instructor) : '—'}</td>
          <td className={tdCls}>
            {o.enrolled_count}
            {o.capacity != null ? `/${o.capacity}` : ''}
          </td>
          <td className={tdCls}>
            <StatusPill status={o.status} />
          </td>
        </tr>
      ))}
    </DataTable>
  )
}
