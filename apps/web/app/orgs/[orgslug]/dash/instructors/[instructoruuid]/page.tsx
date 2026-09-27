import React from 'react'
import InstructorDetail from './client'

async function Page(props: { params: Promise<{ orgslug: string; instructoruuid: string }> }) {
  const { orgslug, instructoruuid } = await props.params
  return <InstructorDetail orgslug={orgslug} instructorUuid={instructoruuid} />
}

export default Page
