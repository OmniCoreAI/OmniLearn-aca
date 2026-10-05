import React from 'react'
import CommunicationSmsPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <CommunicationSmsPage orgslug={orgslug} />
}

export default Page
