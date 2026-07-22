'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useFormik } from 'formik'
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Mail, Shield, X, Clock } from 'lucide-react'
import { checkSSOEnabled, redirectToSSOLogin } from '@services/auth/sso'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@components/Contexts/AuthContext'
import { getOMNILEARN_TOP_DOMAIN_VAL, getDeploymentMode } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'
import { resendVerificationEmail } from '@services/auth/auth'
import AuthLayout from '@components/Auth/AuthLayout'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

interface LoginClientProps {
  org: any
}

const LoginClient = (props: LoginClientProps) => {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const { track } = useOmniLearnAnalytics('public')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const _router = useRouter();
  const _session = useLHSession() as any;

  // Error state with type information
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationResent, setVerificationResent] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const handleGoogleSignIn = () => {
    track(AnalyticsEvent.LoginGoogleClicked)
    // Store org context in cookies before OAuth redirect
    if (props.org?.slug) {
      const topDomain = getOMNILEARN_TOP_DOMAIN_VAL();
      const isSecure = window.location.protocol === 'https:';
      const secureAttr = isSecure ? '; secure' : '';
      const baseAttributes = `; path=/; SameSite=Lax${secureAttr}`;
      const domainAttr = topDomain === 'localhost' ? '' : `; domain=.${topDomain}`;
      document.cookie = `OL_oauth_orgslug=${props.org.slug}${baseAttributes}${domainAttr}`;
      document.cookie = `OL_oauth_org_id=${props.org.id}${baseAttributes}${domainAttr}`;
    }
    // Use absolute URL with current origin for custom domain support
    signIn('google', { callbackUrl: `${window.location.origin}/redirect_from_auth` });
  };

  // Check if SSO is enabled for this organization (requires enterprise plan)
  useEffect(() => {
    const checkSSO = async () => {
      // SSO is only available for enterprise plan (requires EE or SaaS/enterprise)
      const orgConfig = props.org?.config?.config
      const plan = orgConfig?.plan ?? orgConfig?.cloud?.plan
      const mode = getDeploymentMode()
      if (mode === 'oss' || (mode === 'saas' && plan !== 'enterprise')) {
        setSsoEnabled(false)
        return
      }

      if (props.org?.slug) {
        try {
          const result = await checkSSOEnabled(props.org.slug)
          setSsoEnabled(result.sso_enabled)
        } catch (error) {
          // SSO not available, silently ignore
          console.debug('SSO check failed:', error)
        }
      }
    }
    checkSSO()
  }, [props.org?.slug, props.org?.config?.config?.plan, props.org?.config?.config?.cloud?.plan]) // eslint-disable-line

  const handleSSOLogin = async () => {
    track(AnalyticsEvent.LoginSsoClicked)
    setSsoLoading(true)
    try {
      await redirectToSSOLogin(props.org.slug)
    } catch (error: any) {
      setError(error.message || t('auth.sso_error'))
      setSsoLoading(false)
    }
  }

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
      errors.email = t('validation.required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = t('validation.invalid_email')
    }

    if (!values.password) {
      errors.password = t('validation.required')
    } else if (values.password.length < 8) {
      errors.password = t('validation.password_min_length')
    }

    return errors
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail || !props.org?.id) return

    setIsResendingVerification(true)
    try {
      const res = await resendVerificationEmail(unverifiedEmail, props.org.id)
      if (res.success) {
        setVerificationResent(true)
      } else {
        setError(res.error || t('auth.resend_verification_failed'))
      }
    } catch (_err) {
      setError(t('auth.resend_verification_failed'))
    } finally {
      setIsResendingVerification(false)
    }
  }

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values, {validateForm, setErrors, setSubmitting}) => {
      setIsSubmitting(true)
      setError('')
      setErrorType(null)
      setUnverifiedEmail(null)
      setVerificationResent(false)
      setShowErrorModal(false)
      setRetryAfter(null)

      const errors = await validateForm(values);
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        setSubmitting(false);
        setIsSubmitting(false);
        return;
      }

      track(AnalyticsEvent.LoginSubmitted, { has_sso_enabled: ssoEnabled })

      // Use absolute URL with current origin for custom domain support
      const callbackUrl = `${window.location.origin}/redirect_from_auth`;

      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl
      });

      if (res && res.error) {
        let loginErrorType: string | null = null
        // Try to parse the error message for error codes
        try {
          // The error from next-auth might contain our structured error
          const errorData = JSON.parse(res.error);
          if (errorData.code) {
            loginErrorType = errorData.code;
            setErrorType(errorData.code);
            setError(errorData.message || t('auth.wrong_email_password'));
            if (errorData.code === 'EMAIL_NOT_VERIFIED') {
              setUnverifiedEmail(errorData.email || values.email);
            }
            if (errorData.retry_after) {
              setRetryAfter(errorData.retry_after);
            }
          } else {
            setError(t('auth.wrong_email_password'));
          }
        } catch {
          // If parsing fails, check for specific error strings
          if (res.error.includes('EMAIL_NOT_VERIFIED')) {
            loginErrorType = 'EMAIL_NOT_VERIFIED';
            setErrorType('EMAIL_NOT_VERIFIED');
            setError(t('auth.email_not_verified_message'));
            setUnverifiedEmail(values.email);
          } else if (res.error.includes('ACCOUNT_LOCKED')) {
            loginErrorType = 'ACCOUNT_LOCKED';
            setErrorType('ACCOUNT_LOCKED');
            setError(t('auth.account_locked_message'));
          } else if (res.error.includes('RATE_LIMITED')) {
            loginErrorType = 'RATE_LIMITED';
            setErrorType('RATE_LIMITED');
            setError(t('auth.rate_limited_message'));
          } else {
            setError(t('auth.wrong_email_password'));
          }
        }
        track(AnalyticsEvent.LoginFailed, { method: 'credentials', error_type: loginErrorType })
        setShowErrorModal(true);
        setIsSubmitting(false);
      } else {
        track(AnalyticsEvent.LoginSucceeded, { method: 'credentials' })
        // First signIn already authenticated and set cookies — just redirect
        window.location.href = callbackUrl;
      }
    },
  })

  return (
    <AuthLayout org={props.org} welcomeText={t('auth.login_to')}>
        {/* Error Top Bar */}
        {showErrorModal && (
          <div className={`
            w-full px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200
            ${errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent ? 'bg-amber-600 text-white' : ''}
            ${verificationResent ? 'bg-emerald-600 text-white' : ''}
            ${errorType === 'ACCOUNT_LOCKED' ? 'bg-red-600 text-white' : ''}
            ${errorType === 'RATE_LIMITED' ? 'bg-orange-600 text-white' : ''}
            ${error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' ? 'bg-red-600 text-white' : ''}
          `}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && <Mail size={18} className="shrink-0" />}
              {verificationResent && <Mail size={18} className="shrink-0" />}
              {errorType === 'ACCOUNT_LOCKED' && <Lock size={18} className="shrink-0" />}
              {errorType === 'RATE_LIMITED' && <Clock size={18} className="shrink-0" />}
              {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && <AlertTriangle size={18} className="shrink-0" />}

              <div className="flex-1 min-w-0">
                {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{t('auth.email_not_verified_message')}</span>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification}
                      className="text-sm underline hover:no-underline disabled:opacity-50"
                    >
                      {isResendingVerification ? t('common.loading') : t('auth.resend_verification_email')}
                    </button>
                  </div>
                )}
                {verificationResent && (
                  <span className="text-sm font-medium">{t('auth.verification_email_resent')} - {t('auth.check_inbox_message')}</span>
                )}
                {errorType === 'ACCOUNT_LOCKED' && (
                  <span className="text-sm font-medium">
                    {t('auth.account_locked')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {errorType === 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">
                    {t('auth.rate_limited')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">{error}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setShowErrorModal(false)
                if (verificationResent) setVerificationResent(false)
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-[400px] animate-fade-in">
            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--auth-gold-soft))] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--auth-ink))]">
                <Shield size={12} strokeWidth={2.25} />
                {t('auth.secure_sign_in', 'Secure sign-in')}
              </div>
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-[hsl(var(--auth-ink))]">
                {t('auth.welcome_back')}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[hsl(var(--auth-muted))]">
                {t('auth.enter_credentials')}
              </p>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--auth-border))] bg-[hsl(var(--auth-surface))] p-6 sm:p-7 shadow-[0_1px_0_hsl(215_30%_20%/0.03),0_18px_40px_hsl(215_40%_12%/0.06)]">
              <FormLayout onSubmit={formik.handleSubmit} className="space-y-1">
                <FormField name="email">
                  <FormLabelAndMessage
                    label={t('auth.email')}
                    message={formik.touched.email ? formik.errors.email : undefined}
                  />
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--auth-muted))]" />
                    <Form.Control asChild>
                      <Input
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.email}
                        type="email"
                        autoComplete="email"
                        placeholder="name@institution.gov"
                        className="auth-input !h-11 !rounded-[0.625rem] !bg-white !px-10 !text-[hsl(var(--auth-ink))] !shadow-none placeholder:!text-[hsl(var(--auth-muted)/0.55)]"
                      />
                    </Form.Control>
                  </div>
                </FormField>

                <FormField name="password">
                  <FormLabelAndMessage
                    label={t('auth.password')}
                    message={formik.touched.password ? formik.errors.password : undefined}
                  />
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--auth-muted))]" />
                    <Form.Control asChild>
                      <Input
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.password}
                        type="password"
                        autoComplete="current-password"
                        className="auth-input !h-11 !rounded-[0.625rem] !bg-white !px-10 !text-[hsl(var(--auth-ink))] !shadow-none placeholder:!text-[hsl(var(--auth-muted)/0.55)]"
                      />
                    </Form.Control>
                  </div>
                </FormField>

                <div className="flex justify-end pb-1 pt-0.5">
                  <Link
                    href="/forgot"
                    className="text-xs font-medium text-[hsl(var(--auth-focus))] hover:underline"
                  >
                    {t('auth.forgot_password')}
                  </Link>
                </div>

                <div className="pt-2">
                  <Form.Submit asChild>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="auth-btn-primary w-full rounded-xl py-3 text-center text-sm font-semibold disabled:opacity-60"
                    >
                      {isSubmitting ? t('common.loading') : t('auth.login')}
                    </button>
                  </Form.Submit>
                </div>
              </FormLayout>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[hsl(var(--auth-border))]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[hsl(var(--auth-surface))] px-3 font-medium uppercase tracking-[0.14em] text-[hsl(var(--auth-muted))]">
                    {t('common.or')}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[hsl(var(--auth-border))] bg-white py-2.5 text-sm font-medium text-[hsl(var(--auth-ink))] transition-colors hover:bg-[hsl(var(--auth-canvas))]"
                >
                  <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="" className="h-4 w-4" />
                  <span>{t('auth.sign_in_with_google')}</span>
                </button>

                {ssoEnabled && (
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    disabled={ssoLoading}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[hsl(var(--auth-navy))] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Shield size={16} />
                    <span>{ssoLoading ? t('common.loading') : t('auth.sign_in_with_sso')}</span>
                  </button>
                )}
              </div>
            </div>

            <p className="mt-7 text-center text-sm text-[hsl(var(--auth-muted))]">
              {t('auth.no_account')}{' '}
              <Link href="/signup" className="font-semibold text-[hsl(var(--auth-ink))] underline-offset-2 hover:underline">
                {t('auth.sign_up')}
              </Link>
            </p>
          </div>
        </div>
    </AuthLayout>
  )
}

export default LoginClient
