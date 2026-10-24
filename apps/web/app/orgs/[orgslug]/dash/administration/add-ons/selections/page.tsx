import React from 'react'
import AddOnSelectionsPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AddOnSelectionsPage orgslug={orgslug} />
}

export default Page
