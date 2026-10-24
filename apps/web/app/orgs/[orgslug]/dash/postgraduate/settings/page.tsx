import React from 'react'
import AcademicSettings from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AcademicSettings orgslug={orgslug} />
}

export default Page
