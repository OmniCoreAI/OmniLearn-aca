import React from 'react'
import TrainingProgramDetail from './client'

async function TrainingProgramDetailPage(props: {
  params: Promise<{ orgslug: string; tpuuid: string }>
}) {
  const { orgslug, tpuuid } = await props.params
  return <TrainingProgramDetail orgslug={orgslug} tpuuid={tpuuid} />
}

export default TrainingProgramDetailPage
