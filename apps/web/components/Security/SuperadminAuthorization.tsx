'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useRouter } from 'next/navigation'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { getDeploymentMode } from '@services/config/config'
import Link from 'next/link'
import { ShieldWarning, SquaresFour } from '@phosphor-icons/react'
import AdminTopMenu from '@components/Admin/AdminLeftMenu'

type SuperadminAuthorizationProps = {
  children: React.ReactNode
}

const SuperadminAuthorization: React.FC<SuperadminAuthorizationProps> = ({
  children,
}) => {
  const session = useLHSession() as any
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const isUserAuthenticated = useMemo(
    () => session.status === 'authenticated',
    [session.status]
  )

  const checkAuth = useCallback(() => {
    if (session.status === 'loading') return

    if (!isUserAuthenticated) {
      router.push('/admin/login')
      return
    }

    const isSuperadmin = session?.data?.user?.is_superadmin === true
    if (isSuperadmin) {
      setIsAuthorized(true)
    } else {
      setIsAuthorized(false)
    }
    setIsChecking(false)
  }, [session.status, isUserAuthenticated, session?.data?.user?.is_superadmin, router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (session.status === 'loading' || isChecking) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    )
  }

  if (getDeploymentMode() === 'oss' || !isAuthorized) {
    const oss = getDeploymentMode() === 'oss'
    return (
      <div className="min-h-screen bg-[#0f0f10]">
        <AdminTopMenu minimal />
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
              <ShieldWarning size={24} weight="duotone" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-white">
              {oss ? 'Superadmin console is not available' : 'Access denied'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {oss
                ? 'This deployment runs the open-source edition, which does not include the multi-academy superadmin console. You can manage your academy from the academy dashboard.'
                : 'You need superadmin privileges to open this console.'}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/dash"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(135deg,hsl(43_90%_60%),hsl(39_82%_47%))] px-5 py-2.5 text-sm font-bold text-[hsl(220_10%_8%)]"
              >
                <SquaresFour size={16} weight="bold" />
                Go to the academy dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.06]"
              >
                Open the learning site
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default SuperadminAuthorization
