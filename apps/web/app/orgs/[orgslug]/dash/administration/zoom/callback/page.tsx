import React, { Suspense } from 'react'
import ZoomOAuthCallback from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return (
    <Suspense>
      <ZoomOAuthCallback orgslug={orgslug} />
    </Suspense>
  )
}

export default Page
