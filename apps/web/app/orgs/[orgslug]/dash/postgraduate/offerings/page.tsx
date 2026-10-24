import React from 'react'
import OfferingsList from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <OfferingsList orgslug={orgslug} />
}

export default Page
