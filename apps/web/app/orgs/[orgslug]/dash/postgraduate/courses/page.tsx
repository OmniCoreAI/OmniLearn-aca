import React from 'react'
import CourseCatalog from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <CourseCatalog orgslug={orgslug} />
}

export default Page
