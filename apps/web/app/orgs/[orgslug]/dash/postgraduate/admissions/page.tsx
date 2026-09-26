import React from 'react'
import AdmissionsList from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AdmissionsList orgslug={orgslug} />
}

export default Page
