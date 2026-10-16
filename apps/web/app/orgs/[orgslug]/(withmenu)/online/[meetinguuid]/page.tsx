import React from 'react'
import { Metadata } from 'next'
import MeetingRoom from '@components/Objects/OnlineMeetings/MeetingRoom'
import ModuleGate from '@components/Security/ModuleGate'

type Props = {
  params: Promise<{ orgslug: string; meetinguuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const metadata: Metadata = {
  title: 'Online class',
  robots: { index: false, follow: false },
}

export default async function OnlineMeetingPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams
  return (
    <ModuleGate module="online_classes">
      <MeetingRoom
        orgslug={params.orgslug}
        meetingUuid={`onlinemeeting_${params.meetinguuid}`}
        asHost={searchParams.host === '1'}
      />
    </ModuleGate>
  )
}
