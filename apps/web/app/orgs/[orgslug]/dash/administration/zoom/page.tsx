import React from 'react'
import ZoomAdminPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <ZoomAdminPage orgslug={orgslug} />
}

export default Page
