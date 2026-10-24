import React from 'react'
import NotificationSettingsPage from './client'

async function Page(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <NotificationSettingsPage orgslug={orgslug} />
}

export default Page
