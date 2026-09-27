import React from 'react'
import FinanceDefaultsSettings from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <FinanceDefaultsSettings orgslug={orgslug} />
}

export default Page
