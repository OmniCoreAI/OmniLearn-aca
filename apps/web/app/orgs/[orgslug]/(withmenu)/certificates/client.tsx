'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'
import UserCertificates from '@components/Pages/Trail/UserCertificates'

/** The learner's earned certificates (each links to its public verification page). */
export default function MyCertificates({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const signedIn = !!session?.data?.tokens?.access_token

  return (
    <GeneralWrapperStyled>
      {signedIn ? (
        <UserCertificates orgslug={orgslug} />
      ) : (
        <>
          <PortalHeader title={t('certificate.my_certificates', 'My certificates')} />
          <SignInPrompt orgslug={orgslug} />
        </>
      )}
    </GeneralWrapperStyled>
  )
}
