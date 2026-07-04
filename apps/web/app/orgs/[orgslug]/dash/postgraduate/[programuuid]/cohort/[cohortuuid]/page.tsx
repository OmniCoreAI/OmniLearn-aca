import React from 'react'
import CohortDetail from './client'

async function CohortDetailPage(props: {
  params: Promise<{ orgslug: string; programuuid: string; cohortuuid: string }>
}) {
  const { orgslug, programuuid, cohortuuid } = await props.params
  return <CohortDetail orgslug={orgslug} programuuid={programuuid} cohortuuid={cohortuuid} />
}

export default CohortDetailPage
