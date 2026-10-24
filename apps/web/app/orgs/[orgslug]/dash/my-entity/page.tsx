import React from 'react'
import MyEntityPortal from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <MyEntityPortal orgslug={orgslug} />
}

export default Page
