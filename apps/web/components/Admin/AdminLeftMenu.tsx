'use client'
import {
  Buildings,
  CaretDown,
  ChartBar,
  House,
  Key,
  Shield,
  SignOut,
  SquaresFour,
  User,
  Users,
} from '@phosphor-icons/react'
import { signOut } from '@components/Contexts/AuthContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import React from 'react'

/** `minimal`: logo + account menu only (for screens where the console itself is unavailable). */
function AdminTopMenu({ minimal = false }: { minimal?: boolean }) {
  const session = useLHSession() as any

  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: '/admin/login' })
  }

  if (!session) return null

  const user = session?.data?.user
  const avatarUrl = user?.avatar_image
    ? user.avatar_image.startsWith('http')
      ? user.avatar_image
      : getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
    : null

  return (
    <>
      {/* Spacer to push content below the fixed menu */}
      <div className="h-14" />
      {/* Fixed menu bar */}
      <div
        className="fixed top-0 left-0 right-0 h-14 bg-black border-b border-white/[0.08] flex items-center text-white px-4 gap-6"
        style={{ zIndex: 'var(--z-overlay)' }}
      >
        {/* Logo */}
        <Link className="flex items-center gap-2 transition-opacity hover:opacity-70 shrink-0" href="/admin">
          <img src="/lrn-dash.svg" alt="OmniLearn logo" className="h-7 w-7" />
          <span className="font-semibold text-sm text-white">Admin</span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            Superadmin
          </span>
        </Link>

        {/* Navigation */}
        <nav className={minimal ? 'hidden' : 'flex items-center gap-1'}>
          <NavLink
            href="/admin/organizations"
            icon={<Buildings size={16} weight="fill" />}
            label="Organizations"
          />
          <NavLink
            href="/admin/users"
            icon={<Users size={16} weight="fill" />}
            label="Users"
          />
          <NavLink
            href="/admin/analytics"
            icon={<ChartBar size={16} weight="fill" />}
            label="Analytics"
          />
          <NavLink
            href="/admin/developers"
            icon={<Key size={16} weight="fill" />}
            label="Developers"
          />
          <NavLink
            href="/admin/portal-access"
            icon={<Shield size={16} weight="fill" />}
            label="Portal Access"
          />
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Account */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="group flex items-center gap-2 rounded-full py-1 pe-2.5 ps-1 text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full bg-gray-700 object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <User size={14} weight="fill" className="text-white/50" />
                </span>
              )}
              <span className="hidden text-sm sm:inline">{user?.username}</span>
              <CaretDown size={12} weight="bold" className="transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-56">
            <div className="px-2.5 py-2">
              <p className="truncate text-[13px] font-bold text-[hsl(var(--dash-ink))]">{user?.username}</p>
              {user?.email ? <p className="truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{user.email}</p> : null}
              <span className="mt-1.5 inline-flex rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700">Superadmin</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild icon={SquaresFour}>
              <Link href="/dash">Academy dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild icon={House}>
              <Link href="/">Open the learning site</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={SignOut} variant="destructive" onSelect={() => logOutUI()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

const NavLink = ({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) => {
  return (
    <Link aria-label={label} href={href}>
      <div className="flex items-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all px-3 py-1.5 gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </Link>
  )
}

export default AdminTopMenu
