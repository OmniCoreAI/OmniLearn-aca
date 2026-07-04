import React from 'react'
import ProgramDetail from './client'

async function ProgramDetailPage(props: {
  params: Promise<{ orgslug: string; programuuid: string }>
}) {
  const { orgslug, programuuid } = await props.params
  return <ProgramDetail orgslug={orgslug} programuuid={programuuid} />
}

export default ProgramDetailPage
