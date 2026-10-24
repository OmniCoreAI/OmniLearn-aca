'use client'
import React from 'react'
import LanguageSwitcher from '@components/Utils/LanguageSwitcher'
import AuthBrandingPanel from '@components/Auth/AuthBrandingPanel'
import AuthMobileHeader from '@components/Auth/AuthMobileHeader'

interface AuthLayoutProps {
  org: any
  welcomeText?: string
  children: React.ReactNode
}

export default function AuthLayout({ org, welcomeText, children }: AuthLayoutProps) {
  return (
    <div className="auth-shell flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,520px)] lg:h-screen lg:overflow-hidden">
      <div className="absolute end-4 top-4 z-dropdown">
        <LanguageSwitcher />
      </div>

      <div className="lg:hidden">
        <AuthMobileHeader org={org} />
      </div>

      <div className="hidden h-full min-h-0 lg:block">
        <AuthBrandingPanel org={org} welcomeText={welcomeText} />
      </div>

      <div className="relative flex flex-1 flex-col overflow-auto bg-[hsl(var(--auth-canvas))] lg:h-full lg:border-s lg:border-[hsl(var(--auth-border))]">
        {/* subtle paper grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(hsl(215 30% 40% / 0.05) 0.6px, transparent 0.6px)',
            backgroundSize: '14px 14px',
          }}
        />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
