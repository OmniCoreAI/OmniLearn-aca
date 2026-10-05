import React from 'react'
import CertificateTemplatesPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <CertificateTemplatesPage orgslug={orgslug} />
}

export default Page
