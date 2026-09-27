import React from 'react'
import GeneralConfiguration from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <GeneralConfiguration orgslug={orgslug} />
}

export default Page
