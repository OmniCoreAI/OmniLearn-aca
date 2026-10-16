'use client';
import DashLeftMenu from '@components/Dashboard/Menus/DashLeftMenu';
import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import DashTopBar, { DASH_TOPBAR_HEIGHT } from '@components/Dashboard/Menus/DashTopBar';
import FreePlanUpgradeBanner from '@components/Dashboard/Shared/PlanRestricted/FreePlanUpgradeBanner';
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { SessionGate } from '@components/Contexts/LHSessionContext'
import { CommandPaletteProvider } from '@components/Dashboard/CommandPalette/CommandPaletteContext'
import CommandPalette from '@components/Dashboard/CommandPalette/CommandPalette'
import React from 'react'
import { useMediaQuery } from 'usehooks-ts';

function ClientAdminLayout({
    children,
    params: _params,
}: {
    children: React.ReactNode
    params: any
}) {
    const isMobile = useMediaQuery('(max-width: 1024px)')

    return (
        <SessionGate>
            <AdminAuthorization authorizationMode="page">
                <CommandPaletteProvider>
                    {isMobile && <DashMobileMenu />}
                    <div
                        className="dash-soft flex min-h-screen flex-col bg-[hsl(var(--dash-canvas))] lg:flex-row"
                        // Screens that fill the viewport subtract the top bar's height.
                        style={{ '--dash-topbar-h': isMobile ? '0px' : `${DASH_TOPBAR_HEIGHT}px` } as React.CSSProperties}
                    >
                        {!isMobile && <DashLeftMenu />}
                        {/* overflow-x-clip (not hidden) so the sticky top bar keeps sticking. */}
                        <div className="relative isolate flex min-w-0 w-full flex-1 flex-col overflow-x-clip pb-24 lg:pb-0">
                            {!isMobile && <DashTopBar />}
                            <FreePlanUpgradeBanner />
                            {children}
                        </div>
                        <CommandPalette />
                    </div>
                </CommandPaletteProvider>
            </AdminAuthorization>
        </SessionGate>
    )
}

export default ClientAdminLayout
