import React from 'react'
import FinanceClient from './client'

async function FinancePage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <FinanceClient orgslug={orgslug} />
}

export default FinancePage
