'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updatePassword } from '@services/settings/password'
import { Formik, Form } from 'formik'
import React, { useState } from 'react'
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { signOut } from '@components/Contexts/AuthContext'
import { getUriWithoutOrg } from '@services/config/config'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { SettingsCard } from '@components/Objects/Account/AccountUI'
import { cn } from '@/lib/utils'

const validationSchema = Yup.object().shape({
  old_password: Yup.string().required('validation.required'),
  new_password: Yup.string()
    .required('validation.required')
    .min(8, 'validation.password_min_length'),
})

/** Password input with a show/hide toggle. */
function PasswordInput({
  name,
  autoComplete,
  value,
  onChange,
  invalid,
}: {
  name: string
  autoComplete: string
  value: string
  onChange: (_e: React.ChangeEvent<HTMLInputElement>) => void
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={invalid}
        className={cn(inputCls, 'h-10 rounded-xl pe-10')}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('user.settings.password.hide', 'Hide password') : t('user.settings.password.show', 'Show password')}
        className="absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function AccountSecurity() {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token;
  const { t } = useTranslation();

  const updatePasswordUI = async (values: any) => {
    const loadingToast = toast.loading(t('user.settings.password.updating'))
    try {
      const user_id = session.data.user.id
      const response = await updatePassword(user_id, values, access_token)

      if (response.success) {
        toast.dismiss(loadingToast)

        toast.success(t('user.settings.password.password_updated'), { duration: 4000 })
        toast(() => (
          <div className="flex items-center gap-2">
            <span>{t('user.settings.password.relogin_message')}</span>
          </div>
        ), {
          duration: 4000,
          icon: '🔑'
        })

        await new Promise(resolve => setTimeout(resolve, 4000))
        signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })
      } else {
        toast.error(response.data.detail || t('user.settings.password.update_failed', 'Could not update your password'), { id: loadingToast })
      }
    } catch (error: any) {
      const errorMessage = error.data?.detail || t('user.settings.password.update_failed', 'Could not update your password')
      toast.error(errorMessage, { id: loadingToast })
    }
  }

  return (
    <Formik
      initialValues={{ old_password: '', new_password: '' }}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting }) => {
        setTimeout(() => {
          setSubmitting(false)
          updatePasswordUI(values)
        }, 400)
      }}
    >
      {({ isSubmitting, handleChange, values, errors, touched }) => {
        const pwd = values.new_password
        const rules = [
          { ok: pwd.length >= 8, label: t('user.settings.password.rule_length', 'At least 8 characters') },
          { ok: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd), label: t('user.settings.password.rule_case', 'Upper and lower case letters') },
          { ok: /\d/.test(pwd), label: t('user.settings.password.rule_number', 'A number') },
          { ok: /[^A-Za-z0-9]/.test(pwd), label: t('user.settings.password.rule_symbol', 'A symbol') },
        ]
        const score = rules.filter((r) => r.ok).length
        const strength =
          score <= 1
            ? { label: t('user.settings.password.weak', 'Weak'), color: 'bg-[hsl(var(--dash-warn))]', text: 'text-[hsl(var(--dash-warn))]' }
            : score <= 3
              ? { label: t('user.settings.password.fair', 'Fair'), color: 'bg-amber-500', text: 'text-amber-700' }
              : { label: t('user.settings.password.strong', 'Strong'), color: 'bg-emerald-500', text: 'text-emerald-700' }
        const errorOf = (field: 'old_password' | 'new_password') =>
          touched[field] && errors[field] ? String(t(errors[field] as string)) : undefined

        return (
          <Form className="space-y-5">
            <SettingsCard
              icon={<KeyRound className="h-[18px] w-[18px]" />}
              title={t('user.settings.password.title')}
              description={t('user.settings.password.subtitle')}
            >
              <div className="grid max-w-2xl grid-cols-1 gap-4">
                <Field label={t('user.settings.password.current_password')} required error={errorOf('old_password')}>
                  <PasswordInput
                    name="old_password"
                    autoComplete="current-password"
                    value={values.old_password}
                    onChange={handleChange}
                    invalid={!!errorOf('old_password')}
                  />
                </Field>
                <Field label={t('user.settings.password.new_password')} required error={errorOf('new_password')}>
                  <PasswordInput
                    name="new_password"
                    autoComplete="new-password"
                    value={values.new_password}
                    onChange={handleChange}
                    invalid={!!errorOf('new_password')}
                  />
                </Field>

                {pwd ? (
                  <div className="space-y-2.5 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-1 gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < score ? strength.color : 'bg-[hsl(var(--dash-border))]')}
                          />
                        ))}
                      </div>
                      <span className={cn('text-xs font-semibold', strength.text)}>{strength.label}</span>
                    </div>
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {rules.map((rule) => (
                        <li
                          key={rule.label}
                          className={cn('flex items-center gap-1.5 text-xs transition-colors', rule.ok ? 'text-emerald-700' : 'text-[hsl(var(--dash-muted))]')}
                        >
                          <span
                            className={cn(
                              'inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                              rule.ok ? 'bg-emerald-500 text-white' : 'bg-[hsl(var(--dash-border))]'
                            )}
                          >
                            {rule.ok ? <Check className="h-2.5 w-2.5" /> : null}
                          </span>
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('user.settings.password.logout_warning')}</span>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isSubmitting ? t('user.settings.password.updating') : t('user.settings.password.update_password')}
                  </button>
                </div>
              </div>
            </SettingsCard>
          </Form>
        )
      }}
    </Formik>
  )
}

export default AccountSecurity
