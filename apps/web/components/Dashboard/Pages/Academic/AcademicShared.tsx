'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { MoreVertical, Trash2, Pencil } from 'lucide-react'

// Small, shared presentational pieces for the Academic Management pages so the
// individual list/detail clients stay thin and consistent. These do NOT contain
// any course logic — courses are always handled by the existing course module.

export function AcademicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full bg-[#f8f8f8] pl-4 pr-4 sm:pl-10 sm:pr-10">
      <div className="mb-6 pt-6">{children}</div>
    </div>
  )
}

export function AcademicHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="mt-4 sm:mt-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}

export function AcademicGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {children}
    </div>
  )
}

export function AcademicEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="col-span-full flex justify-center items-center py-16">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-600 mb-2">{title}</h2>
        {description && <p className="text-lg text-gray-400 mb-6">{description}</p>}
        {action}
      </div>
    </div>
  )
}

type Badge = { label: string; className?: string }

export function AcademicCard({
  orgslug,
  href,
  title,
  subtitle,
  badges,
  onEdit,
  onDelete,
}: {
  orgslug: string
  href: string
  title: string
  subtitle?: string
  badges?: Badge[]
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const hasMenu = !!onEdit || !!onDelete

  return (
    <div className="relative bg-white rounded-xl overflow-hidden nice-shadow border border-gray-100 hover:border-gray-200 transition-colors">
      <Link href={getUriWithOrg(orgslug, href)} className="block p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {badges?.map((b, i) => (
            <span
              key={i}
              className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full ${
                b.className || 'bg-gray-100 text-gray-600'
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{subtitle}</p>}
      </Link>

      {hasMenu && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              setMenuOpen((v) => !v)
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 z-20 w-36 bg-white rounded-lg nice-shadow border border-gray-100 py-1">
                {onEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
