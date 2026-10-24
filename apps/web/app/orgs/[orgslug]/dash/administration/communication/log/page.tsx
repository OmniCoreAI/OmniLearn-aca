import React from 'react'
import DeliveryLogPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <DeliveryLogPage orgslug={orgslug} />
}

export default Page
