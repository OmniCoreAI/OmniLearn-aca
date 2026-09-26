import React from 'react'
import OfferingDetail from '../../../offerings/[offeringuuid]/client'

// The lecturer's view of an offering: the same page, reached from My Teaching
// (and guarded by the My Teaching navigation item instead of the admin module).
async function Page(props: { params: Promise<{ orgslug: string; offeringuuid: string }> }) {
  const { orgslug, offeringuuid } = await props.params
  return <OfferingDetail orgslug={orgslug} offeringuuid={offeringuuid} workspace="teaching" />
}

export default Page
