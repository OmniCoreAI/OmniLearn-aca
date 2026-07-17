import React from 'react'
import InstructorFinanceHome from './client'

async function InstructorFinancePage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <InstructorFinanceHome orgslug={orgslug} />
}

export default InstructorFinancePage
