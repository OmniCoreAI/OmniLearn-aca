import React from 'react'
import MyApplication from './client'

export const dynamic = 'force-dynamic'

async function Page(props: { params: Promise<{ orgslug: string; applicationuuid: string }> }) {
  const { orgslug, applicationuuid } = await props.params
  return <MyApplication orgslug={orgslug} applicationuuid={applicationuuid} />
}

export default Page
