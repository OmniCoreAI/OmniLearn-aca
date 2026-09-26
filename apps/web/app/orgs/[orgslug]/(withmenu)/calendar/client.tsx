'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'

const EventsCalendar = dynamic(() => import('@components/Calendar/EventsCalendar'), {
  ssr: false,
  loading: () => <div className="dash-shimmer h-[680px] rounded-[var(--dash-radius)]" />,
})

export default function MyCalendar({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const signedIn = !!session?.data?.tokens?.access_token

  return (
    <GeneralWrapperStyled>
      {signedIn ? (
        <div className="rounded-[var(--dash-radius)] bg-[hsl(var(--dash-canvas))] p-4 sm:p-6">
          <EventsCalendar context="portal" orgslug={orgslug} className="min-h-[760px]" />
        </div>
      ) : (
        <>
          <PortalHeader title={t('calendar.my_calendar', 'My calendar')} />
          <SignInPrompt orgslug={orgslug} />
        </>
      )}
    </GeneralWrapperStyled>
  )
}
