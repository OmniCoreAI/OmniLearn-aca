import React from 'react'
import InstructorCategoriesHome from './client'

async function InstructorCategoriesPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <InstructorCategoriesHome orgslug={orgslug} />
}

export default InstructorCategoriesPage
