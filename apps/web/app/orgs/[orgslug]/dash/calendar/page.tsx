import React from 'react'
import { Metadata } from 'next'
import DashCalendarClient from './client'

export const metadata: Metadata = {
  title: 'Calendar',
}

async function DashCalendarPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <DashCalendarClient orgslug={orgslug} />
}

export default DashCalendarPage
