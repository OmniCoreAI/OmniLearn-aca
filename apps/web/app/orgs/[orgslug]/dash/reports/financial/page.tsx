import React, { Suspense } from 'react'
import { Metadata } from 'next'
import FinancialReportPage from '@components/Dashboard/Reports/FinancialReportPage'

export const metadata: Metadata = { title: 'Financial report' }

export default function Page() {
  return (
    <Suspense>
      <FinancialReportPage />
    </Suspense>
  )
}
