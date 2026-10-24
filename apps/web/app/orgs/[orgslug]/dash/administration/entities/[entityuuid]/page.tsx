import React from 'react'
import EntityDetail from './client'

async function Page(props: { params: Promise<{ orgslug: string; entityuuid: string }> }) {
  const { orgslug, entityuuid } = await props.params
  return <EntityDetail orgslug={orgslug} entityUuid={entityuuid} />
}

export default Page
