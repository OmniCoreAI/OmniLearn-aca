import React from 'react'
import EquipmentPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <EquipmentPage orgslug={orgslug} />
}

export default Page
