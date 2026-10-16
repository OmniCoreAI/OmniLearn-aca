import React from 'react'
import HallCalendar from '@components/Dashboard/Pages/Administration/HallBooking/HallCalendar'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <HallCalendar orgslug={orgslug} />
}

export default Page
