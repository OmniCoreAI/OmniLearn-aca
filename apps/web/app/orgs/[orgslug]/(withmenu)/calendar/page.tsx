import React from 'react'
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import MyCalendar from './client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ orgslug: string }> }): Promise<Metadata> {
  const { orgslug } = await props.params
  const org = await getOrganizationContextInfo(orgslug, { revalidate: 120, tags: ['organizations'] })
  return { title: 'My calendar — ' + org.name }
}

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <MyCalendar orgslug={orgslug} />
}

export default Page
