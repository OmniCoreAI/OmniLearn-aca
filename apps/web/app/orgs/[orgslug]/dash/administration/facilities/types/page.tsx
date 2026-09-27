import React from 'react'
import FacilityTypesPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <FacilityTypesPage orgslug={orgslug} />
}

export default Page
