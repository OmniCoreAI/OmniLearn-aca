import React from 'react'
import GraduateOffice from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <GraduateOffice orgslug={orgslug} />
}

export default Page
