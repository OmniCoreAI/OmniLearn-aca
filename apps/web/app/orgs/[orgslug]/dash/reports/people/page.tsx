import React, { Suspense } from 'react'
import { Metadata } from 'next'
import PeopleReportPage from '@components/Dashboard/Reports/PeopleReportPage'

export const metadata: Metadata = { title: 'Users & entities report' }

export default function Page() {
  return (
    <Suspense>
      <PeopleReportPage />
    </Suspense>
  )
}
