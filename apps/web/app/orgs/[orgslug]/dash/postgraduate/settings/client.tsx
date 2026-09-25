'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  DataTable,
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { createGradeScale, deleteGradeScale, getGradeScales, updateGradeScale } from '@services/academic/core'

function AcademicSettings({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<null | { scale?: any }>(null)

  const { data: scales = [] } = useQuery({
    queryKey: ['academic', 'grade-scales', orgId],
    queryFn: () => getGradeScales(orgId, access_token),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'grade-scales', orgId] })

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_settings', 'Settings') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_settings', 'Settings')}
        subtitle={t('academic.settings_desc', 'Institution-wide academic rules.')}
      />
      <PostgradTabs orgslug={orgslug} />

      <Section
        title={t('academic.grade_scales', 'Grade scales')}
        description={t(
          'academic.grade_scales_desc',
          'Map weighted course totals (0–100) to letter grades and grade points. Programs use the default scale unless they select another one.'
        )}
        action={
          <GhostButton onClick={() => setModal({})}>
            <Plus className="h-3.5 w-3.5" /> {t('academic.new_grade_scale', 'New grade scale')}
          </GhostButton>
        }
      >
        <div className="space-y-4">
          {scales.map((scale: any) => (
            <div key={scale.grade_scale_uuid} className="rounded-xl border border-[hsl(var(--dash-border))] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {scale.name}
                    {scale.is_default && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        {t('academic.default', 'Default')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">
                    {scale.description} · {t('academic.pass_mark', 'pass mark')} {scale.pass_mark ?? '—'} ·{' '}
                    {t('academic.used_by_programs', { count: scale.program_count, defaultValue: `${scale.program_count} programs` })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!scale.is_default && (
                    <GhostButton
                      onClick={() =>
                        act(() => updateGradeScale(scale.grade_scale_uuid, { is_default: true }, access_token), t('academic.updated'))
                      }
                    >
                      <Star className="h-3.5 w-3.5" /> {t('academic.make_default', 'Make default')}
                    </GhostButton>
                  )}
                  <IconButton onClick={() => setModal({ scale })} aria-label={t('academic.edit', 'Edit')}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    tone="danger"
                    onClick={() =>
                      window.confirm(t('academic.confirm_delete')) &&
                      act(() => deleteGradeScale(scale.grade_scale_uuid, access_token), t('academic.deleted'))
                    }
                    aria-label={t('academic.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scale.bands.map((b: any) => (
                  <span
                    key={b.letter}
                    className={`rounded-lg px-2 py-1 text-xs ${b.passing ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
                  >
                    <b>{b.letter}</b> ≥{b.min_score} · {b.points}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Modal
        isDialogOpen={!!modal}
        onOpenChange={(o: boolean) => !o && setModal(null)}
        minWidth="md"
        dialogTitle={modal?.scale ? modal.scale.name : t('academic.new_grade_scale', 'New grade scale')}
        dialogContent={
          modal && (
            <ScaleForm
              scale={modal.scale}
              onDone={() => {
                setModal(null)
                refresh()
              }}
            />
          )
        }
      />
    </AcademicPageShell>
  )
}

type Band = { letter: string; min_score: number; points: number; passing: boolean }

function ScaleForm({ scale, onDone }: { scale?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [name, setName] = useState(scale?.name || '')
  const [description, setDescription] = useState(scale?.description || '')
  const [isDefault, setIsDefault] = useState(scale?.is_default ?? false)
  const [bands, setBands] = useState<Band[]>(
    scale?.bands || [
      { letter: 'A', min_score: 90, points: 4, passing: true },
      { letter: 'B', min_score: 75, points: 3, passing: true },
      { letter: 'C', min_score: 60, points: 2, passing: true },
      { letter: 'F', min_score: 0, points: 0, passing: false },
    ]
  )
  const [saving, setSaving] = useState(false)
  const setBand = (i: number, patch: Partial<Band>) => setBands((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name, description: description || null, is_default: isDefault, bands }
      if (scale) await updateGradeScale(scale.grade_scale_uuid, payload, access_token)
      else await createGradeScale(orgId, payload, access_token)
      toast.success(scale ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('academic.description')}>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <DataTable
        headers={[
          t('academic.grade', 'Grade'),
          t('academic.min_score', 'Min score'),
          t('academic.grade_points', 'Points'),
          t('academic.passing', 'Passing'),
          '',
        ]}
      >
        {bands.map((b, i) => (
          <tr key={i}>
            <td className={tdCls}>
              <input className={`${inputCls} w-20`} value={b.letter} onChange={(e) => setBand(i, { letter: e.target.value })} required />
            </td>
            <td className={tdCls}>
              <input type="number" min={0} max={100} step="0.5" className={`${inputCls} w-24`} value={b.min_score} onChange={(e) => setBand(i, { min_score: Number(e.target.value) })} />
            </td>
            <td className={tdCls}>
              <input type="number" min={0} step="0.1" className={`${inputCls} w-24`} value={b.points} onChange={(e) => setBand(i, { points: Number(e.target.value) })} />
            </td>
            <td className={tdCls}>
              <input type="checkbox" checked={b.passing} onChange={(e) => setBand(i, { passing: e.target.checked })} />
            </td>
            <td className={`${tdCls} text-right`}>
              <IconButton tone="danger" type="button" onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="flex items-center justify-between">
        <GhostButton type="button" onClick={() => setBands((prev) => [...prev, { letter: '', min_score: 0, points: 0, passing: false }])}>
          <Plus className="h-3.5 w-3.5" /> {t('academic.add_band', 'Add band')}
        </GhostButton>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          {t('academic.default_scale', 'Default scale for the organization')}
        </label>
      </div>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('academic.bands_hint', 'Each band starts at its minimum score; the lowest band must start at 0.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default AcademicSettings
