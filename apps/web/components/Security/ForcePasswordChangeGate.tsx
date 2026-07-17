'use client'
import React, { useState } from 'react'
import { KeyRound, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'
import { updatePassword } from '@services/settings/password'
import { getUriWithoutOrg } from '@services/config/config'

/*
  Blocking overlay shown when the authenticated user has `must_change_password`
  set (admin-provisioned accounts with a temporary password). The user cannot
  proceed until they set a new password. On success they are signed out and
  must re-authenticate with the new password (the flag is cleared server-side).
*/
export default function ForcePasswordChangeGate() {
  const { t } = useTranslation()
  const session = useLHSession() as any

  const user = session?.data?.user
  const access_token = session?.data?.tokens?.access_token
  const mustChange = session?.status === 'authenticated' && user?.must_change_password === true

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!mustChange) return null

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error(t('force_password_change.mismatch', 'Passwords do not match'))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t('force_password_change.too_short', 'Password must be at least 8 characters'))
      return
    }
    setSubmitting(true)
    const toastId = toast.loading(t('force_password_change.updating', 'Updating password...'))
    try {
      const res = await updatePassword(
        user.id,
        { old_password: currentPassword, new_password: newPassword },
        access_token
      )
      if (res.success) {
        toast.success(t('force_password_change.success', 'Password updated. Please sign in again.'), {
          id: toastId,
        })
        setTimeout(() => {
          signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/auth/login') })
        }, 1500)
      } else {
        const detail =
          typeof res.data?.detail === 'string'
            ? res.data.detail
            : t('force_password_change.error', 'Could not update password')
        toast.error(detail, { id: toastId })
        setSubmitting(false)
      }
    } catch (err: any) {
      toast.error(err?.message || t('force_password_change.error', 'Could not update password'), { id: toastId })
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl nice-shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
            <KeyRound className="w-5 h-5" />
            {t('force_password_change.title', 'Set a new password')}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              'force_password_change.subtitle',
              'Your account was created with a temporary password. Choose a new password to continue.'
            )}
          </p>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('force_password_change.current', 'Temporary password')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('force_password_change.new', 'New password')}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('force_password_change.confirm', 'Confirm new password')}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {t(
                'force_password_change.requirements',
                'Use at least 8 characters with uppercase, lowercase, a number and a special character.'
              )}
            </span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-black/90 disabled:opacity-40 rounded-lg font-semibold text-sm text-white transition-all"
          >
            {submitting
              ? t('force_password_change.updating', 'Updating password...')
              : t('force_password_change.submit', 'Update password')}
          </button>
        </form>
      </div>
    </div>
  )
}
