import React from 'react'
import LocationsPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <LocationsPage orgslug={orgslug} />
}

export default Page
