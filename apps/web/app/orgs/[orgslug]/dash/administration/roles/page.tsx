import React from 'react'
import RolesAndPortals from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <RolesAndPortals orgslug={orgslug} />
}

export default Page
