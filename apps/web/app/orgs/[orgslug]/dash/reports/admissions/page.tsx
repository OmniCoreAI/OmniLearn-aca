import React, { Suspense } from 'react'
import { Metadata } from 'next'
import AdmissionsReportPage from '@components/Dashboard/Reports/AdmissionsReportPage'

export const metadata: Metadata = { title: 'Admissions report' }

export default function Page() {
  return (
    <Suspense>
      <AdmissionsReportPage />
    </Suspense>
  )
}
