import React from 'react'
import EntityTypesPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <EntityTypesPage orgslug={orgslug} />
}

export default Page
