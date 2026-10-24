import React from 'react'
import StudentsDirectory from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <StudentsDirectory orgslug={orgslug} />
}

export default Page
