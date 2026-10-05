import React from 'react'
import EntitiesHome from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <EntitiesHome orgslug={orgslug} />
}

export default Page
