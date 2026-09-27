'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicPrimaryButton,
  AcademicEmptyState,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { IconButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { SAMPLE_CERTIFICATE_VARIABLES, TemplateCertificate } from '@components/Certificates/TemplateCertificate'
import {
  createCertificateTemplate,
  deleteCertificateTemplate,
  duplicateCertificateTemplate,
  getCertificateTemplates,
  updateCertificateTemplate,
} from '@services/administration/administration'

function CertificateTemplatesPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { org, orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['administration', 'certificate-templates', orgId],
    queryFn: () => getCertificateTemplates(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'certificate-templates', orgId] })
  const act = async (fn: () => Promise<any>, ok: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const create = async () => {
    try {
      const created = await createCertificateTemplate(
        orgId,
        { name: String(t('certificates.new_name', 'New certificate')), is_default: (templates as any[]).length === 0 },
        access_token
      )
      router.push(getUriWithOrg(orgslug, `/dash/administration/certificates/${created.template_uuid}`))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.certificates', 'Certificates') }]} />
      <AcademicHeader
        title={t('administration.nav.certificates', 'Certificates')}
        subtitle={t('certificates.subtitle', 'Certificate designs with your logos, signatures, QR code and serial numbers. Courses and programs pick one; the default applies otherwise.')}
        action={
          <AcademicPrimaryButton onClick={create}>
            <Plus className="h-4 w-4" /> {t('certificates.new', 'New template')}
          </AcademicPrimaryButton>
        }
      />
      {isLoading && <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />}
      {!isLoading && (templates as any[]).length === 0 && (
        <AcademicEmptyState
          title={t('certificates.none', 'No certificate templates yet')}
          description={t('certificates.none_desc', 'Until you create one, certificates use the built-in patterns chosen on each course.')}
        />
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(templates as any[]).map((tpl) => (
          <div key={tpl.template_uuid} className="overflow-hidden rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))]">
            <Link href={getUriWithOrg(orgslug, `/dash/administration/certificates/${tpl.template_uuid}`)} className="block bg-[hsl(var(--dash-canvas))] p-3">
              <div className="mx-auto w-fit shadow-sm">
                <TemplateCertificate
                  template={tpl}
                  variables={{ ...SAMPLE_CERTIFICATE_VARIABLES, org_name: org?.name || SAMPLE_CERTIFICATE_VARIABLES.org_name }}
                  orgUuid={org?.org_uuid}
                  orgLogo={org?.logo_image}
                  scale={tpl.orientation === 'portrait' ? 0.2 : 0.28}
                />
              </div>
            </Link>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate text-sm font-semibold">
                  {tpl.is_default && <Star className="h-3.5 w-3.5 text-amber-500" />}
                  {tpl.name}
                </div>
                <div className="text-xs text-[hsl(var(--dash-muted))]">
                  {String(t(`certificates.layout_${tpl.layout}`, tpl.layout))} ·{' '}
                  {tpl.status === 'active' ? `${tpl.usage_count} ${t('certificates.uses', 'use(s)')}` : String(t('administration.common.status_inactive', 'inactive'))}
                </div>
              </div>
              <div className="flex shrink-0">
                {!tpl.is_default && (
                  <IconButton
                    title={String(t('certificates.make_default', 'Make default'))}
                    onClick={() => act(() => updateCertificateTemplate(tpl.template_uuid, { is_default: true, status: 'active' }, access_token), t('administration.common.updated', 'Saved'))}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </IconButton>
                )}
                <IconButton title={String(t('administration.common.edit', 'Edit'))} onClick={() => router.push(getUriWithOrg(orgslug, `/dash/administration/certificates/${tpl.template_uuid}`))}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton title={String(t('communication.duplicate', 'Duplicate'))} onClick={() => act(() => duplicateCertificateTemplate(tpl.template_uuid, access_token), t('administration.common.created', 'Created'))}>
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  tone="danger"
                  title={String(t('administration.common.delete', 'Delete'))}
                  onClick={() =>
                    act(
                      () => deleteCertificateTemplate(tpl.template_uuid, access_token),
                      t('administration.common.deleted', 'Deleted'),
                      t('certificates.confirm_delete', 'Delete this template? Courses using it switch to the default template; issued certificates keep their number.')
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AcademicPageShell>
  )
}

export default CertificateTemplatesPage
