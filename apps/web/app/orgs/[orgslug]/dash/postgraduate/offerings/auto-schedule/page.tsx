import React from 'react'
import AutoSchedulePage from '@components/Dashboard/Pages/Academic/AutoSchedule/AutoSchedulePage'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AutoSchedulePage orgslug={orgslug} />
}

export default Page
