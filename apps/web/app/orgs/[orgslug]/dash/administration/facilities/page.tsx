import React from 'react'
import FacilitiesHome from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <FacilitiesHome orgslug={orgslug} />
}

export default Page
