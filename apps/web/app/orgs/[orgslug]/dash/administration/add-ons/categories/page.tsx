import React from 'react'
import AddOnCategoriesPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <AddOnCategoriesPage orgslug={orgslug} />
}

export default Page
