import React from 'react'
import FacilityDetail from './client'

async function Page(props: { params: Promise<{ orgslug: string; facilityuuid: string }> }) {
  const { orgslug, facilityuuid } = await props.params
  return <FacilityDetail orgslug={orgslug} facilityUuid={facilityuuid} />
}

export default Page
