import React, { Suspense } from 'react'
import FloorPlansWorkspace from '@components/Dashboard/Pages/Administration/FloorPlan/FloorPlansWorkspace'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return (
    <Suspense>
      <FloorPlansWorkspace orgslug={orgslug} />
    </Suspense>
  )
}

export default Page
