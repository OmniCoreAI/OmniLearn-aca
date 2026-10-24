import React from 'react'
import CommunicationEmailPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <CommunicationEmailPage orgslug={orgslug} />
}

export default Page
