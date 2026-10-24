'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy, Eye, LayoutGrid, List, Pencil, Plus, Power, Star, Trash2 } from 'lucide-react'
import { Certificate, CheckCircle, Medal, SealCheck } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { DashRowAction, RowActionsMenu, ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AdminBreadcrumbs, formatAdminDate, useAdminContext, useConfirm, useStoredView } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CertificatePreviewDialog, FitCertificate } from '@components/Dashboard/Pages/Certificates/CertificateUI'
import { CERTIFICATE_LAYOUTS } from '@components/Certificates/TemplateCertificate'
import {
  createCertificateTemplate,
  deleteCertificateTemplate,
  duplicateCertificateTemplate,
  getCertificateTemplates,
  updateCertificateTemplate,
} from '@services/administration/administration'
import { cn } from '@/lib/utils'

const VIEW_KEY = 'admin-certificates-view'

function CertificateTemplatesPage({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [view, changeView] = useStoredView<'gallery' | 'table'>(VIEW_KEY, 'gallery')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [layout, setLayout] = useState('all')
  const [previewing, setPreviewing] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['administration', 'certificate-templates', orgId],
    queryFn: () => getCertificateTemplates(orgId, access_token),
    enabled: ready,
  })
  const all = templates as any[]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administration', 'certificate-templates', orgId] })
  const editHref = (tpl: any) => getUriWithOrg(orgslug, `/dash/administration/certificates/${tpl.template_uuid}`)
  const layoutLabel = (l: string) => String(t(`certificates.layout_${l}`, l))

  const run = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const create = async () => {
    setCreating(true)
    try {
      const created = await createCertificateTemplate(orgId, { name: String(t('certificates.new_name', 'New certificate')), is_default: all.length === 0 }, access_token)
      router.push(editHref(created))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
      setCreating(false)
    }
  }
  const remove = async (tpl: any) => {
    const ok = await confirm({
      title: t('certificates.delete_title', 'Delete {{name}}?', { name: tpl.name }),
      message:
        tpl.usage_count > 0
          ? t('certificates.confirm_delete_used', '{{count}} certificate(s) were issued with this design. Deactivating keeps it for them; deleting switches its courses to the default template. Issued certificates keep their number.', { count: tpl.usage_count })
          : t('certificates.confirm_delete', 'Delete this template? Courses using it switch to the default template; issued certificates keep their number.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (ok) run(() => deleteCertificateTemplate(tpl.template_uuid, access_token), t('administration.common.deleted', 'Deleted'))
  }
  const actionsFor = (tpl: any): DashRowAction[] => [
    { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, href: editHref(tpl) },
    { label: t('certificates.preview', 'Preview'), icon: <Eye className="h-3.5 w-3.5" />, onSelect: () => setPreviewing(tpl) },
    ...(!tpl.is_default
      ? [
          {
            label: t('certificates.make_default', 'Make default'),
            icon: <Star className="h-3.5 w-3.5" />,
            onSelect: () => run(() => updateCertificateTemplate(tpl.template_uuid, { is_default: true, status: 'active' }, access_token), t('administration.common.updated', 'Saved')),
          },
        ]
      : []),
    {
      label: tpl.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
      icon: <Power className="h-3.5 w-3.5" />,
      disabled: tpl.is_default && tpl.status === 'active',
      onSelect: () =>
        run(() => updateCertificateTemplate(tpl.template_uuid, { status: tpl.status === 'active' ? 'inactive' : 'active' }, access_token), t('administration.common.updated', 'Saved')),
    },
    {
      label: t('communication.duplicate', 'Duplicate'),
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: () => run(() => duplicateCertificateTemplate(tpl.template_uuid, access_token), t('administration.common.created', 'Created')),
    },
    { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger', onSelect: () => remove(tpl) },
  ]

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((tpl) => (status === 'all' || tpl.status === status) && (layout === 'all' || tpl.layout === layout) && (!q || String(tpl.name).toLowerCase().includes(q)))
  }, [all, query, status, layout])
  const filtering = !!query || status !== 'all' || layout !== 'all'
  const defaultTpl = all.find((tpl) => tpl.is_default)
  const issued = all.reduce((sum, tpl) => sum + (tpl.usage_count || 0), 0)
  const activeCount = all.filter((tpl) => tpl.status === 'active').length

  const createButton = (
    <AcademicPrimaryButton onClick={create} disabled={creating}>
      <Plus className="h-4 w-4" /> {t('certificates.new', 'New template')}
    </AcademicPrimaryButton>
  )
  const empty = (
    <AcademicEmptyState
      compact
      icon={<Certificate size={24} />}
      title={filtering ? t('administration.common.no_matches', 'No matches') : t('certificates.none', 'No certificate templates yet')}
      description={
        filtering
          ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
          : t('certificates.none_desc', 'Until you create one, certificates use the built-in patterns chosen on each course.')
      }
      action={filtering ? undefined : createButton}
    />
  )
  const toolbar = (
    <>
      <ToolbarSearch value={query} onChange={setQuery} placeholder={t('certificates.search', 'Search templates')} />
      <ToolbarSelect
        label={t('certificates.layout', 'Layout')}
        value={layout}
        onChange={setLayout}
        options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...CERTIFICATE_LAYOUTS.map((l) => ({ value: l, label: layoutLabel(l) }))]}
      />
      <ToolbarSelect
        label={t('administration.common.status', 'Status')}
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: t('administration.common.all', 'All') },
          { value: 'active', label: t('academic.state_active', 'Active') },
          { value: 'inactive', label: t('administration.common.status_inactive', 'Inactive') },
        ]}
      />
    </>
  )
  const viewToggle = (
    <div className={cn(TAB_TRACK, 'p-0.5 shadow-none')} role="tablist" aria-label={t('administration.common.view', 'View')}>
      <button type="button" role="tab" aria-selected={view === 'gallery'} aria-label={t('administration.common.view_cards', 'Cards')} onClick={() => changeView('gallery')} className={tabItemClass(view === 'gallery', 'px-2.5 py-1')}>
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button type="button" role="tab" aria-selected={view === 'table'} aria-label={t('administration.common.view_table', 'Table')} onClick={() => changeView('table')} className={tabItemClass(view === 'table', 'px-2.5 py-1')}>
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  )
  const meta = (tpl: any) =>
    [layoutLabel(tpl.layout), tpl.orientation === 'portrait' ? t('certificates.portrait', 'Portrait') : t('certificates.landscape', 'Landscape')].join(' · ')

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.certificates', 'Certificates') }]} />
      <AcademicHeader
        title={t('administration.nav.certificates', 'Certificates')}
        subtitle={t('certificates.subtitle', 'Certificate designs with your logos, signatures, QR code and serial numbers. Courses and programs pick one; the default applies otherwise.')}
        action={createButton}
      />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'templates', label: t('certificates.stats.templates', 'Templates'), value: all.length, icon: Certificate, tone: 'gold' },
          {
            key: 'active',
            label: t('certificates.stats.active', 'Active'),
            value: activeCount,
            icon: CheckCircle,
            tone: 'stone',
            progress: all.length ? activeCount / all.length : undefined,
          },
          { key: 'issued', label: t('certificates.stats.issued', 'Certificates issued'), value: issued, icon: SealCheck, tone: 'rose' },
          {
            key: 'inactive',
            label: t('certificates.stats.inactive', 'Inactive'),
            value: all.length - activeCount,
            icon: Medal,
            tone: 'sand',
            hint: defaultTpl
              ? t('certificates.default_is', 'Default: {{name}}', { name: defaultTpl.name })
              : t('certificates.no_default_hint', 'No default — courses use built-in patterns'),
          },
        ]}
      />

      {view === 'table' ? (
        <DashDataTable
          rows={visible}
          rowKey={(tpl: any) => tpl.template_uuid}
          loading={isLoading}
          rowHref={editHref}
          initialSort={{ key: 'name', dir: 'asc' }}
          itemLabel={(n) => t('certificates.count', '{{count}} templates', { count: n })}
          toolbar={toolbar}
          toolbarEnd={viewToggle}
          empty={empty}
          actions={actionsFor}
          columns={[
            {
              key: 'name',
              header: t('certificates.template', 'Template'),
              primary: true,
              sortValue: (tpl: any) => tpl.name,
              cell: (tpl: any) => (
                <div className="flex min-w-0 items-center gap-3">
                  <FitCertificate template={tpl} className="w-16 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{tpl.name}</span>
                      {tpl.is_default ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" /> : null}
                    </div>
                    <div className="truncate font-mono text-[11px] text-[hsl(var(--dash-muted))]">{tpl.serial_format}</div>
                  </div>
                </div>
              ),
            },
            { key: 'layout', header: t('certificates.layout', 'Layout'), sortValue: (tpl: any) => tpl.layout, cell: (tpl: any) => <span className="whitespace-nowrap text-[13px]">{layoutLabel(tpl.layout)}</span> },
            {
              key: 'orientation',
              header: t('certificates.orientation', 'Orientation'),
              hideBelow: 'lg',
              hideOnMobile: true,
              cell: (tpl: any) => <span className="text-[13px]">{tpl.orientation === 'portrait' ? t('certificates.portrait', 'Portrait') : t('certificates.landscape', 'Landscape')}</span>,
            },
            { key: 'issued', header: t('certificates.issued', 'Issued'), align: 'end', sortValue: (tpl: any) => tpl.usage_count, cell: (tpl: any) => <span className="tabular-nums">{tpl.usage_count}</span> },
            { key: 'status', header: t('administration.common.status', 'Status'), sortValue: (tpl: any) => tpl.status, cell: (tpl: any) => <StatusPill status={tpl.status} /> },
            {
              key: 'updated',
              header: t('communication.last_updated', 'Last updated'),
              hideBelow: 'xl',
              hideOnMobile: true,
              sortValue: (tpl: any) => tpl.update_date,
              cell: (tpl: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{formatAdminDate(tpl.update_date, i18n.language)}</span>,
            },
          ]}
        />
      ) : (
        <>
          <div className="dash-card mb-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
            <span className="text-[12px] text-[hsl(var(--dash-muted))]">{t('certificates.count', '{{count}} templates', { count: visible.length })}</span>
            {viewToggle}
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="dash-shimmer h-72 rounded-[1.25rem]" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="dash-card rounded-[1.25rem] px-6 py-14">{empty}</div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((tpl) => (
                <div key={tpl.template_uuid} className="dash-card group overflow-hidden rounded-[1.25rem]">
                  <Link href={editHref(tpl)} className="relative block bg-[hsl(var(--dash-canvas))] px-6 py-5" aria-label={tpl.name}>
                    <FitCertificate template={tpl} className={cn('transition-transform duration-300 group-hover:scale-[1.02]', tpl.orientation === 'portrait' && 'mx-auto w-1/2')} />
                    {tpl.is_default ? (
                      <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-ink))] shadow-sm">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {t('certificates.default_badge', 'Default')}
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{tpl.name}</div>
                      <div className="truncate text-xs text-[hsl(var(--dash-muted))]">
                        {meta(tpl)} · {t('certificates.issued_count', '{{count}} issued', { count: tpl.usage_count })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusPill status={tpl.status} />
                      <RowActionsMenu actions={actionsFor(tpl)} label={t('administration.common.actions', 'Actions')} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <CertificatePreviewDialog template={previewing} onClose={() => setPreviewing(null)} />
      {dialog}
    </AcademicPageShell>
  )
}

export default CertificateTemplatesPage
