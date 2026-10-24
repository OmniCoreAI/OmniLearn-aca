import React from 'react'
import CertificateTemplateEditor from './client'

async function Page(props: { params: Promise<{ orgslug: string; templateuuid: string }> }) {
  const { orgslug, templateuuid } = await props.params
  return <CertificateTemplateEditor orgslug={orgslug} templateUuid={templateuuid} />
}

export default Page
