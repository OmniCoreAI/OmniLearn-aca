import React from 'react'
import AcademicCalendar from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AcademicCalendar orgslug={orgslug} />
}

export default Page
