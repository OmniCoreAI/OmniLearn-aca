import React, { Suspense } from 'react'
import { Metadata } from 'next'
import LearningReportPage from '@components/Dashboard/Reports/LearningReportPage'

export const metadata: Metadata = { title: 'Learning & completion report' }

export default function Page() {
  return (
    <Suspense>
      <LearningReportPage />
    </Suspense>
  )
}
