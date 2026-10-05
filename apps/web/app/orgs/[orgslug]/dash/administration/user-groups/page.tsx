import React from 'react'
import { Metadata } from 'next'
import UserGroupsHome from './client'

export const metadata: Metadata = {
  title: 'User groups',
}

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <UserGroupsHome orgslug={orgslug} />
}

export default Page
