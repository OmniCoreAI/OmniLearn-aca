import React from 'react'
import ApplicationDetail from './client'

async function Page(props: { params: Promise<{ orgslug: string; applicationuuid: string }> }) {
  const { orgslug, applicationuuid } = await props.params
  return <ApplicationDetail orgslug={orgslug} applicationuuid={applicationuuid} />
}

export default Page
