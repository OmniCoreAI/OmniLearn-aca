import React from 'react'
import PositionsPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <PositionsPage orgslug={orgslug} />
}

export default Page
