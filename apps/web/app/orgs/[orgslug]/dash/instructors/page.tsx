import React from 'react'
import InstructorsHome from './client'

async function InstructorsPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <InstructorsHome orgslug={orgslug} />
}

export default InstructorsPage
