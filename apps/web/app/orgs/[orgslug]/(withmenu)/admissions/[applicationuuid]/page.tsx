import React from 'react'
import MyApplication from './client'
import ModuleGate from '@components/Security/ModuleGate'

export const dynamic = 'force-dynamic'

async function Page(props: { params: Promise<{ orgslug: string; applicationuuid: string }> }) {
  const { orgslug, applicationuuid } = await props.params
  return (
    <ModuleGate module="postgraduate">
      <MyApplication orgslug={orgslug} applicationuuid={applicationuuid} />
    </ModuleGate>
  )
}

export default Page
