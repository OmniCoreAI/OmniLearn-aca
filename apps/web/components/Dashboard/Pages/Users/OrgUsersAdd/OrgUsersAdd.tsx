'use client'

import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import { getAPIUrl } from '@services/config/config'
import { adminCreateUser } from '@services/organizations/invites'
import { apiFetch } from '@services/utils/ts/requests'
import { Copy, Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

function OrgUsersAdd() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [gender, setGender] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [roleUuid, setRoleUuid] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [created, setCreated] = useState<{ email: string; username: string; password: string } | null>(null)

  const { data: roles } = useQuery({
    queryKey: ['org', org?.id, 'roles'],
    queryFn: () => apiFetch(`${getAPIUrl()}roles/org/${org?.id}`, access_token),
    enabled: !!org?.id && !!access_token,
    staleTime: 60_000,
  })

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setUsername('')
    setEmail('')
    setPhone('')
    setNationalId('')
    setGender('')
    setBirthDate('')
    setRoleUuid('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !email.trim()) return
    setSubmitting(true)
    setShowPassword(false)
    const toastId = toast.loading(t('dashboard.users.create_account.creating', 'Creating account...'))
    try {
      const res = await adminCreateUser(
        org.id,
        {
          username: username.trim(),
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role_uuid: roleUuid || null,
          phone: phone.trim() || null,
          national_id: nationalId.trim() || null,
          gender: (gender as 'male' | 'female' | 'other' | '') || null,
          birth_date: birthDate.trim() || null,
        },
        access_token
      )
      if (res.status === 200) {
        setCreated({
          email: res.data.user.email,
          username: res.data.user.username,
          password: res.data.temporary_password,
        })
        resetForm()
        toast.success(t('dashboard.users.create_account.success', 'Account created'), { id: toastId })
      } else {
        const detail =
          typeof res.data?.detail === 'string'
            ? res.data.detail
            : t('dashboard.users.create_account.error', 'Could not create account')
        toast.error(detail, { id: toastId })
      }
    } catch (err: any) {
      toast.error(err?.message || t('dashboard.users.create_account.error', 'Could not create account'), {
        id: toastId,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copyPassword = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.password)
      toast.success(t('dashboard.users.create_account.copied', 'Password copied'))
    } catch {
      toast.error(t('dashboard.users.create_account.copy_failed', 'Copy failed'))
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'

  return (
    <>
      <Toast />
      <div className="h-6" />
      <div className="mx-4 sm:mx-10 bg-white rounded-xl nice-shadow">
        <div className="flex flex-wrap gap-3 items-start justify-between px-4 sm:px-6 py-5 border-b border-gray-100">
          <div className="flex-1">
            <h1 className="font-bold text-xl text-gray-800">
              {t('dashboard.users.create_account.title', 'Create an account')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t(
                'dashboard.users.create_account.subtitle',
                'Create a user with a temporary password. They must change it on first login.'
              )}
            </p>
          </div>
        </div>

        {created ? (
          <div className="px-6 py-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <KeyRound className="w-4 h-4" />
                {t('dashboard.users.create_account.password_title', 'Temporary password (shown once)')}
              </div>
              <p className="text-xs text-emerald-700/80 mt-1">
                {t(
                  'dashboard.users.create_account.password_hint',
                  'Copy and share this securely. It will not be shown again. The user will be asked to set a new password on first login.'
                )}
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2">
                  <span className="text-gray-400 text-xs uppercase font-bold">
                    {t('dashboard.users.create_account.username', 'Username')}
                  </span>
                  <div className="text-gray-800 truncate">{created.username}</div>
                </div>
                <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2">
                  <span className="text-gray-400 text-xs uppercase font-bold">
                    {t('dashboard.users.create_account.email', 'Email')}
                  </span>
                  <div className="text-gray-800 truncate">{created.email}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-white rounded-lg border border-emerald-100 px-3 py-2 font-mono text-sm text-gray-900 tracking-wide">
                  {showPassword ? created.password : '•'.repeat(created.password.length)}
                </code>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="p-2 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-700"
                  aria-label={t('dashboard.users.create_account.toggle', 'Show/hide')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
                >
                  <Copy className="w-4 h-4" />
                  {t('dashboard.users.create_account.copy', 'Copy')}
                </button>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setCreated(null)
                  setShowPassword(false)
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('dashboard.users.create_account.create_another', 'Create another')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.first_name', 'First name')}
                </label>
                <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.last_name', 'Last name')}
                </label>
                <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.username', 'Username')} *
                </label>
                <input
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.email', 'Email')} *
                </label>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.phone', 'Phone')}
                </label>
                <input
                  type="tel"
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('dashboard.users.create_account.phone_placeholder', 'e.g. 01012345678')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.national_id', 'National ID')}
                </label>
                <input
                  className={inputCls}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder={t('dashboard.users.create_account.national_id_placeholder', '14-digit national ID')}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.gender', 'Gender')}
                </label>
                <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">{t('dashboard.users.create_account.gender_unspecified', 'Not specified')}</option>
                  <option value="male">{t('dashboard.users.create_account.gender_male', 'Male')}</option>
                  <option value="female">{t('dashboard.users.create_account.gender_female', 'Female')}</option>
                  <option value="other">{t('dashboard.users.create_account.gender_other', 'Other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dashboard.users.create_account.birth_date', 'Birth date')}
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            </div>
            <div className="sm:max-w-[50%]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('dashboard.users.create_account.role', 'Role')}
              </label>
              <select className={inputCls} value={roleUuid} onChange={(e) => setRoleUuid(e.target.value)}>
                <option value="">{t('dashboard.users.create_account.default_role', 'Default (Trainee)')}</option>
                {(roles || []).map((role: any) => (
                  <option key={role.role_uuid} value={role.role_uuid}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !username.trim() || !email.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-sm text-white transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {submitting
                    ? t('dashboard.users.create_account.creating', 'Creating account...')
                    : t('dashboard.users.create_account.create_button', 'Create account')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

export default OrgUsersAdd
