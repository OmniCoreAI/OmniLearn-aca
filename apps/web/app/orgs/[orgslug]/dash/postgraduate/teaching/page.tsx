import React from 'react'
import MyTeaching from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <MyTeaching orgslug={orgslug} />
}

export default Page
