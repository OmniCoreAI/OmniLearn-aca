import React from 'react'
import AddOnsHome from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AddOnsHome orgslug={orgslug} />
}

export default Page
