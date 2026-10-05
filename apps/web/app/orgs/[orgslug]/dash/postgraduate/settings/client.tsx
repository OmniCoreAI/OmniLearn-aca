'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { GraduationCap, PencilSimple, Plus, SlidersHorizontal, Star, Trash } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, IconButton, PostgradTabs, Section, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Switch } from '@components/ui/switch'
import { createGradeScale, deleteGradeScale, getGradeScales, updateGradeScale } from '@services/academic/core'
import { cn } from '@/lib/utils'

type Band = { letter: string; min_score: number; points: number; passing: boolean }

/** The 0–100 range split into the scale's bands, passing ones in green. */
function BandBar({ bands }: { bands: Band[] }) {
  const sorted = [...bands].sort((a, b) => a.min_score - b.min_score)
  return (
    <div className="flex h-8 overflow-hidden rounded-xl ring-1 ring-[hsl(var(--dash-border))]/70" dir="ltr">
      {sorted.map((b, i) => {
        const next = sorted[i + 1]?.min_score ?? 100
        const width = Math.max(0, next - b.min_score)
        if (width <= 0) return null
        return (
          <div
            key={`${b.letter}-${i}`}
            title={`${b.letter} · ${b.min_score}–${next} · ${b.points}`}
            className={cn('flex min-w-0 items-center justify-center border-e border-white/70 text-[11px] font-bold last:border-e-0', b.passing ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')}
            style={{ width: `${width}%` }}
          >
            <span className="truncate px-0.5">{b.letter}</span>
          </div>
        )
      })}
    </div>
  )
}

function AcademicSettings({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const [drawer, setDrawer] = useState<null | { scale?: any }>(null)

  const { data: scales = [], isLoading } = useQuery({ queryKey: ['academic', 'grade-scales', orgId], queryFn: () => getGradeScales(orgId, access_token), enabled: ready })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'grade-scales', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }
  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }
  const remove = async (scale: any) => {
    const ok = await ask({
      title: t('academic.set.delete_title', 'Delete {{name}}?', { name: scale.name }),
      message: t('academic.set.delete_message', 'Scales used by a program or by approved results cannot be deleted.'),
      confirmText: t('academic.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok !== null) act(() => deleteGradeScale(scale.grade_scale_uuid, access_token), t('academic.deleted'))
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.nav.grading_settings', 'Grading & settings') },
        ]}
      />
      <AcademicHeader
        title={t('academic.nav.grading_settings', 'Grading & settings')}
        subtitle={t('academic.settings_desc', 'Institution-wide academic rules.')}
        action={
          <AcademicPrimaryButton onClick={() => setDrawer({})}>
            <Plus size={16} weight="bold" /> {t('academic.new_grade_scale', 'New grade scale')}
          </AcademicPrimaryButton>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <Section
        icon={<SlidersHorizontal size={18} weight="duotone" />}
        title={t('academic.grade_scales', 'Grade scales')}
        count={(scales as any[]).length}
        description={t('academic.grade_scales_desc', 'Map weighted course totals (0–100) to letter grades and grade points. Programs use the default scale unless they select another one.')}
      >
        {isLoading ? (
          <div className="dash-shimmer h-32 rounded-2xl" />
        ) : (scales as any[]).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-8 text-center text-sm text-[hsl(var(--dash-muted))]">
            {t('academic.set.empty', 'No grade scale yet. Create one so results can be graded.')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {(scales as any[]).map((scale) => (
              <div key={scale.grade_scale_uuid} className={cn('group rounded-2xl border bg-white p-4', scale.is_default ? 'border-[hsl(var(--dash-accent))]/40' : 'border-[hsl(var(--dash-border))]/70')}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold">{scale.name}</p>
                      {scale.is_default ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--dash-accent))]">
                          <Star size={11} weight="fill" /> {t('academic.default', 'Default')}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">
                      {[scale.description, `${t('academic.pass_mark', 'pass mark')} ${scale.pass_mark ?? '—'}`, t('academic.used_by_programs', { count: scale.program_count, defaultValue: `${scale.program_count} programs` })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {!scale.is_default ? (
                      <GhostButton onClick={() => act(() => updateGradeScale(scale.grade_scale_uuid, { is_default: true }, access_token), t('academic.updated'))}>
                        <Star size={14} /> {t('academic.make_default', 'Make default')}
                      </GhostButton>
                    ) : null}
                    <IconButton onClick={() => setDrawer({ scale })} aria-label={t('academic.edit', 'Edit')}>
                      <PencilSimple size={16} />
                    </IconButton>
                    <IconButton tone="danger" onClick={() => remove(scale)} aria-label={t('academic.delete', 'Delete')}>
                      <Trash size={16} />
                    </IconButton>
                  </div>
                </div>
                <BandBar bands={scale.bands} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...scale.bands]
                    .sort((a: Band, b: Band) => b.min_score - a.min_score)
                    .map((b: Band) => (
                      <span key={b.letter} className={cn('rounded-lg px-2 py-1 text-[11.5px]', b.passing ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
                        <b>{b.letter}</b> ≥{b.min_score} · {b.points}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PostgradDrawer
        isDialogOpen={!!drawer}
        onOpenChange={(o: boolean) => !o && setDrawer(null)}
        minWidth="md"
        icon={<SlidersHorizontal size={20} weight="duotone" />}
        dialogTitle={drawer?.scale ? `${t('academic.edit', 'Edit')} ${drawer.scale.name}` : t('academic.new_grade_scale', 'New grade scale')}
        dialogDescription={t('academic.bands_hint', 'Each band starts at its minimum score; the lowest band must start at 0.')}
        dialogContent={
          drawer ? (
            <ScaleForm
              scale={drawer.scale}
              onDone={() => {
                setDrawer(null)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

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
  const letters = bands.map((b) => b.letter.trim().toUpperCase())
  const problem = !bands.length
    ? t('academic.set.need_band', 'Add at least one band')
    : !bands.some((b) => Number(b.min_score) === 0)
      ? t('academic.set.need_zero', 'The lowest band must start at 0')
      : letters.some((l) => !l)
        ? t('academic.set.need_letter', 'Every band needs a letter')
        : new Set(letters).size !== letters.length
          ? t('academic.set.unique_letters', 'Letters must be unique')
          : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (problem || !name.trim()) return
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
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.name')} required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard 4.0" />
        </Field>
        <Field label={t('academic.description')}>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5 sm:col-span-2">
          <span>
            <span className="block text-sm font-medium">{t('academic.default_scale', 'Default scale for the organization')}</span>
            <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.set.default_hint', 'Used by programs that do not choose a scale')}</span>
          </span>
          <Switch className="data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]" checked={isDefault} onCheckedChange={setIsDefault} />
        </label>
      </FormSection>
      <FormSection title={t('academic.set.bands', 'Grade bands')} columns={1}>
        <BandBar bands={bands.map((b) => ({ ...b, min_score: Number(b.min_score) || 0 }))} />
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2 px-1 text-[11px] font-semibold text-[hsl(var(--dash-muted))]">
            <span>{t('academic.grade', 'Grade')}</span>
            <span>{t('academic.min_score', 'Min score')}</span>
            <span>{t('academic.grade_points', 'Points')}</span>
            <span>{t('academic.passing', 'Passing')}</span>
            <span className="w-8" />
          </div>
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2">
              <input className={cn(inputCls, 'font-semibold')} value={b.letter} onChange={(e) => setBand(i, { letter: e.target.value })} aria-label={t('academic.grade', 'Grade')} />
              <input type="number" min={0} max={100} step="0.5" className={inputCls} value={b.min_score} onChange={(e) => setBand(i, { min_score: Number(e.target.value) })} aria-label={t('academic.min_score', 'Min score')} />
              <input type="number" min={0} step="0.1" className={inputCls} value={b.points} onChange={(e) => setBand(i, { points: Number(e.target.value) })} aria-label={t('academic.grade_points', 'Points')} />
              <Switch className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-[hsl(var(--dash-border))]" checked={b.passing} onCheckedChange={(v) => setBand(i, { passing: v })} aria-label={t('academic.passing', 'Passing')} />
              <IconButton tone="danger" type="button" onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))} aria-label={t('academic.delete', 'Delete')}>
                <Trash size={15} />
              </IconButton>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <GhostButton type="button" onClick={() => setBands((prev) => [...prev, { letter: '', min_score: 0, points: 0, passing: false }])}>
            <Plus size={14} /> {t('academic.add_band', 'Add band')}
          </GhostButton>
          {problem ? <span className="text-xs font-medium text-[hsl(var(--dash-warn))]">{problem}</span> : null}
        </div>
      </FormSection>
      <SubmitRow saving={saving} disabled={!!problem || !name.trim()} />
    </form>
  )
}

export default AcademicSettings
