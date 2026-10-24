'use client'
import React from 'react'
import dynamic from 'next/dynamic'

const EventsCalendar = dynamic(() => import('@components/Calendar/EventsCalendar'), {
  ssr: false,
  loading: () => <div className="dash-shimmer h-full min-h-[600px] rounded-[var(--dash-radius)]" />,
})

export default function DashCalendarClient({ orgslug }: { orgslug: string }) {
  return (
    <div className="flex min-h-full w-full flex-col bg-[hsl(var(--dash-canvas))] px-4 py-6 sm:px-8 fit:h-dvh fit:min-h-0 fit:overflow-hidden fit:py-5">
      <EventsCalendar context="dash" orgslug={orgslug} className="flex-1" />
    </div>
  )
}
