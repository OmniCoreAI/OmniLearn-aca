import React from 'react'
import type { Metadata } from 'next'
import PortalAccessManager from '@components/Admin/PortalAccessManager'

export const metadata: Metadata = {
  title: 'Portal Access',
}

export default function AdminPortalAccessPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Portal Access</h1>
        <p className="text-white/40 mt-1">
          Choose which dashboard sidebar sections each system role (Academy
          Admin, Organization Coordinator, Instructor, Trainee) can see,
          across every organization.
        </p>
      </div>
      <PortalAccessManager />
    </div>
  )
}
