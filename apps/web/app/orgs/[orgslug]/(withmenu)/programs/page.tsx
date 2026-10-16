import React from 'react'
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import MyPrograms from './client'
import ModuleGate from '@components/Security/ModuleGate'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ orgslug: string }> }): Promise<Metadata> {
  const { orgslug } = await props.params
  const org = await getOrganizationContextInfo(orgslug, { revalidate: 120, tags: ['organizations'] })
  return { title: 'Training programs — ' + org.name }
}

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return (
    <ModuleGate module="training_programs">
      <MyPrograms orgslug={orgslug} />
    </ModuleGate>
  )
}

export default Page
