import React from 'react'
import TrainingProgramsHome from './client'

async function TrainingProgramsPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <TrainingProgramsHome orgslug={orgslug} />
}

export default TrainingProgramsPage
