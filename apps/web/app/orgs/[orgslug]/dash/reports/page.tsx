import React, { Suspense } from 'react'
import { Metadata } from 'next'
import ReportsHub from '@components/Dashboard/Reports/ReportsHub'

export const metadata: Metadata = { title: 'Reports' }

export default function Page() {
  return (
    <Suspense>
      <ReportsHub />
    </Suspense>
  )
}
