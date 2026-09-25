import React from 'react'
import OfferingDetail from './client'

async function Page(props: { params: Promise<{ orgslug: string; offeringuuid: string }> }) {
  const { orgslug, offeringuuid } = await props.params
  return <OfferingDetail orgslug={orgslug} offeringuuid={offeringuuid} />
}

export default Page
