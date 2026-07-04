import React from 'react'
import ProgramsHome from './client'

async function PostgraduatePage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <ProgramsHome orgslug={orgslug} />
}

export default PostgraduatePage
