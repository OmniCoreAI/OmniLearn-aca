'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Newspaper, Trash2, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, inputCls, SubmitRow } from '../../postgraduate/client'
import HtmlRichTextEditor from '@components/Dashboard/CMS/HtmlRichTextEditor'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import {
  CMSNewsImage,
  CMSNewsVideo,
  createNews,
  deleteNewsImage,
  deleteNewsVideo,
  getAdminNews,
  updateNews,
  uploadNewsCover,
  uploadNewsImage,
  uploadNewsVideo,
} from '@services/cms/news'
import {
  getNewsCoverMediaDirectory,
  resolveNewsMediaUrl,
} from '@services/media/media'
import { Switch } from '@components/ui/switch'

type Props = {
  orgslug: string
  newsUuid?: string
}

type PendingMedia = {
  key: string
  file: File
  url: string
}

type RemoveTarget =
  | { kind: 'image'; id: number; name: string }
  | { kind: 'video'; id: number; name: string }
  | { kind: 'pending-image'; key: string; name: string }
  | { kind: 'pending-video'; key: string; name: string }
  | { kind: 'cover' }

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function nowDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date().toISOString())
}

function revokePending(list: PendingMedia[]) {
  list.forEach((item) => URL.revokeObjectURL(item.url))
}

export default function NewsEditorClient({ orgslug, newsUuid }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const orgUuid = org?.org_uuid as string | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const isEdit = !!newsUuid

  const { data: existing, isLoading } = useQuery({
    queryKey: ['cms-news-item', orgId, newsUuid],
    queryFn: () => getAdminNews(orgId!, newsUuid!, access_token),
    enabled: isEdit && !!orgId && !!access_token,
  })

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingMedia[]>([])
  const [pendingVideos, setPendingVideos] = useState<PendingMedia[]>([])
  const [images, setImages] = useState<CMSNewsImage[]>([])
  const [videos, setVideos] = useState<CMSNewsVideo[]>([])
  const [published, setPublished] = useState(false)
  const [publishedAtLocal, setPublishedAtLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [hydrated, setHydrated] = useState(!isEdit)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)

  useEffect(() => {
    if (!existing) return
    setTitle(existing.title || '')
    setBody(existing.body || '')
    setCoverImage(existing.cover_image || '')
    setImages(existing.images || [])
    setVideos(existing.videos || [])
    setPublished(!!existing.published)
    setPublishedAtLocal(toDatetimeLocalValue(existing.published_at))
    setPendingCoverFile(null)
    revokePending(pendingImages)
    revokePending(pendingVideos)
    setPendingImages([])
    setPendingVideos([])
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only hydrate from server item
  }, [existing])

  useEffect(() => {
    return () => {
      if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
      revokePending(pendingImages)
      revokePending(pendingVideos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resolvedCoverUrl =
    coverPreview ||
    (coverImage && orgUuid && (newsUuid || existing?.news_uuid)
      ? getNewsCoverMediaDirectory(
          orgUuid,
          newsUuid || existing!.news_uuid,
          coverImage
        )
      : coverImage.startsWith('http')
        ? coverImage
        : '')

  const refreshItem = async (updated?: {
    images?: CMSNewsImage[]
    videos?: CMSNewsVideo[]
    cover_image?: string
  }) => {
    if (updated) {
      if (updated.images) setImages(updated.images)
      if (updated.videos) setVideos(updated.videos)
      if (updated.cover_image !== undefined) setCoverImage(updated.cover_image)
    }
    await queryClient.invalidateQueries({
      queryKey: ['cms-news-item', orgId, newsUuid],
    })
    await queryClient.invalidateQueries({ queryKey: ['cms-news', orgId] })
  }

  const handleCoverSelect = async (file?: File) => {
    if (!file) return
    if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(file))

    if (isEdit && newsUuid && orgId && access_token) {
      setUploadingCover(true)
      try {
        const updated = await uploadNewsCover(orgId, newsUuid, file, access_token)
        setCoverImage(updated.cover_image || '')
        setPendingCoverFile(null)
        toast.success(t('cms.news.cover_uploaded', 'Cover image uploaded'))
        await refreshItem(updated)
      } catch {
        toast.error(t('cms.news.cover_upload_failed', 'Could not upload cover image'))
      } finally {
        setUploadingCover(false)
      }
      return
    }

    setPendingCoverFile(file)
  }

  const clearCover = () => {
    if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverPreview('')
    setPendingCoverFile(null)
    setCoverImage('')
  }

  const handleImageSelect = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files)
    if (isEdit && newsUuid && orgId && access_token) {
      setUploadingMedia(true)
      try {
        let latest = existing
        for (const file of list) {
          latest = await uploadNewsImage(orgId, newsUuid, file, access_token)
        }
        if (latest) {
          setImages(latest.images || [])
          toast.success(t('cms.news.images_uploaded', 'Images uploaded'))
          await refreshItem(latest)
        }
      } catch {
        toast.error(t('cms.news.media_upload_failed', 'Could not upload media'))
      } finally {
        setUploadingMedia(false)
      }
      return
    }
    setPendingImages((prev) => [
      ...prev,
      ...list.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  const handleVideoSelect = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files)
    if (isEdit && newsUuid && orgId && access_token) {
      setUploadingMedia(true)
      try {
        let latest = existing
        for (const file of list) {
          latest = await uploadNewsVideo(orgId, newsUuid, file, access_token)
        }
        if (latest) {
          setVideos(latest.videos || [])
          toast.success(t('cms.news.videos_uploaded', 'Videos uploaded'))
          await refreshItem(latest)
        }
      } catch {
        toast.error(t('cms.news.media_upload_failed', 'Could not upload media'))
      } finally {
        setUploadingMedia(false)
      }
      return
    }
    setPendingVideos((prev) => [
      ...prev,
      ...list.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      if (removeTarget.kind === 'cover') {
        clearCover()
      } else if (removeTarget.kind === 'pending-image') {
        setPendingImages((prev) => {
          const item = prev.find((p) => p.key === removeTarget.key)
          if (item) URL.revokeObjectURL(item.url)
          return prev.filter((p) => p.key !== removeTarget.key)
        })
      } else if (removeTarget.kind === 'pending-video') {
        setPendingVideos((prev) => {
          const item = prev.find((p) => p.key === removeTarget.key)
          if (item) URL.revokeObjectURL(item.url)
          return prev.filter((p) => p.key !== removeTarget.key)
        })
      } else if (removeTarget.kind === 'image' && newsUuid && orgId && access_token) {
        const updated = await deleteNewsImage(
          orgId,
          newsUuid,
          removeTarget.id,
          access_token
        )
        setImages(updated.images || [])
        await refreshItem(updated)
        toast.success(t('cms.news.media_removed', 'Removed'))
      } else if (removeTarget.kind === 'video' && newsUuid && orgId && access_token) {
        const updated = await deleteNewsVideo(
          orgId,
          newsUuid,
          removeTarget.id,
          access_token
        )
        setVideos(updated.videos || [])
        await refreshItem(updated)
        toast.success(t('cms.news.media_removed', 'Removed'))
      }
      setRemoveTarget(null)
    } catch {
      toast.error(t('cms.news.media_delete_failed', 'Could not remove media'))
    } finally {
      setRemoving(false)
    }
  }

  const handlePublishedChange = (next: boolean) => {
    setPublished(next)
    if (next && !publishedAtLocal) {
      setPublishedAtLocal(nowDatetimeLocalValue())
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !access_token) return
    if (!title.trim()) {
      toast.error(t('cms.news.title_required', 'Title is required'))
      return
    }
    setSaving(true)
    try {
      const published_at =
        fromDatetimeLocalValue(publishedAtLocal) ||
        (published ? new Date().toISOString() : null)

      const payload = {
        title: title.trim(),
        body,
        cover_image: coverImage,
        published,
        published_at,
      }
      if (isEdit && newsUuid) {
        await updateNews(orgId, newsUuid, payload, access_token)
        toast.success(t('cms.news.saved', 'Article saved'))
      } else {
        const created = await createNews(orgId, payload, access_token)
        try {
          if (pendingCoverFile) {
            await uploadNewsCover(
              orgId,
              created.news_uuid,
              pendingCoverFile,
              access_token
            )
          }
          for (const item of pendingImages) {
            await uploadNewsImage(orgId, created.news_uuid, item.file, access_token)
          }
          for (const item of pendingVideos) {
            await uploadNewsVideo(orgId, created.news_uuid, item.file, access_token)
          }
        } catch {
          toast.error(t('cms.news.media_upload_failed', 'Could not upload media'))
        }
        toast.success(t('cms.news.created', 'Article created'))
        await queryClient.invalidateQueries({ queryKey: ['cms-news', orgId] })
        router.push(getUriWithOrg(orgslug, `/dash/cms/news/${created.news_uuid}`))
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['cms-news', orgId] })
      await queryClient.invalidateQueries({
        queryKey: ['cms-news-item', orgId, newsUuid],
      })
    } catch {
      toast.error(t('cms.news.save_failed', 'Could not save article'))
    } finally {
      setSaving(false)
    }
  }

  const hasImages = images.length > 0 || pendingImages.length > 0
  const hasVideos = videos.length > 0 || pendingVideos.length > 0

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('cms.news.title', 'News'),
            href: getUriWithOrg(orgslug, '/dash/cms/news'),
            icon: <Newspaper size={14} />,
          },
          {
            label: isEdit
              ? t('cms.news.edit', 'Edit article')
              : t('cms.news.new', 'New article'),
          },
        ]}
      />
      <AcademicHeader
        title={
          isEdit
            ? t('cms.news.edit', 'Edit article')
            : t('cms.news.new', 'New article')
        }
        subtitle={t(
          'cms.news.editor_subtitle',
          'Title, cover, images, videos, rich content, publish date and time'
        )}
        action={
          <Link
            href={getUriWithOrg(orgslug, '/dash/cms/news')}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-4 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {t('cms.news.back', 'Back to list')}
          </Link>
        }
      />

      {isEdit && isLoading && !hydrated ? (
        <p className="text-sm text-[hsl(var(--dash-muted))]">
          {t('common.loading', 'Loading...')}
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="mx-auto max-w-3xl space-y-5 rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 sm:p-6"
        >
          <Field label={t('cms.news.field_title', 'Title')}>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field label={t('cms.news.field_cover', 'Cover image')}>
            <div className="space-y-3">
              {resolvedCoverUrl ? (
                <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-[hsl(var(--dash-border))]">
                  <img
                    src={resolvedCoverUrl}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setRemoveTarget({ kind: 'cover' })}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('cms.news.cover_remove', 'Remove')}
                  </button>
                </div>
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-400">
                <ImageIcon className="h-4 w-4" />
                <span>
                  {uploadingCover
                    ? t('cms.news.cover_uploading', 'Uploading…')
                    : t('cms.news.cover_choose', 'Choose image')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover || saving}
                  onChange={(e) => {
                    void handleCoverSelect(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </Field>

          <Field label={t('cms.news.field_images', 'Images')}>
            <div className="space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-400">
                <ImageIcon className="h-4 w-4" />
                <span>
                  {uploadingMedia
                    ? t('cms.news.media_uploading', 'Uploading…')
                    : t('cms.news.images_choose', 'Add images')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploadingMedia || saving}
                  onChange={(e) => {
                    void handleImageSelect(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>

              {hasImages ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((img) => {
                    const src = resolveNewsMediaUrl(img.imageURL)
                    return (
                      <div
                        key={`img-${img.id}`}
                        className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={src}
                          alt={img.imageName}
                          className="aspect-video w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
                          <span className="truncate text-[11px] font-medium text-white">
                            {img.imageName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRemoveTarget({
                                kind: 'image',
                                id: img.id,
                                name: img.imageName,
                              })
                            }
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            {t('cms.news.cover_remove', 'Remove')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {pendingImages.map((item) => (
                    <div
                      key={item.key}
                      className="group relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40"
                    >
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="aspect-video w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
                        <span className="truncate text-[11px] font-medium text-white">
                          {item.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveTarget({
                              kind: 'pending-image',
                              key: item.key,
                              name: item.file.name,
                            })
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('cms.news.cover_remove', 'Remove')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {t('cms.news.images_empty', 'No images yet')}
                </p>
              )}
            </div>
          </Field>

          <Field label={t('cms.news.field_videos', 'Videos')}>
            <div className="space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-400">
                <Video className="h-4 w-4" />
                <span>
                  {uploadingMedia
                    ? t('cms.news.media_uploading', 'Uploading…')
                    : t('cms.news.videos_choose', 'Add videos')}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  multiple
                  className="hidden"
                  disabled={uploadingMedia || saving}
                  onChange={(e) => {
                    void handleVideoSelect(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>

              {hasVideos ? (
                <div className="space-y-3">
                  {videos.map((vid) => {
                    const src = resolveNewsMediaUrl(vid.videoURL)
                    return (
                      <div
                        key={`vid-${vid.id}`}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <video
                          src={src}
                          controls
                          preload="metadata"
                          className="aspect-video w-full bg-black"
                        />
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {vid.videoName}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {vid.dateCreatedString}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRemoveTarget({
                                kind: 'video',
                                id: vid.id,
                                name: vid.videoName,
                              })
                            }
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('cms.news.cover_remove', 'Remove')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {pendingVideos.map((item) => (
                    <div
                      key={item.key}
                      className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40"
                    >
                      <video
                        src={item.url}
                        controls
                        preload="metadata"
                        className="aspect-video w-full bg-black"
                      />
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-amber-700">
                            {t('cms.news.pending_preview', 'Will upload on save')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveTarget({
                              kind: 'pending-video',
                              key: item.key,
                              name: item.file.name,
                            })
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('cms.news.cover_remove', 'Remove')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {t('cms.news.videos_empty', 'No videos yet')}
                </p>
              )}
            </div>
          </Field>

          <Field label={t('cms.news.field_body', 'Rich content')}>
            {hydrated && (
              <HtmlRichTextEditor
                value={body}
                onChange={setBody}
                placeholder={t('cms.news.body_placeholder', 'Write the article…')}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t('cms.news.field_published', 'Published')}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    'cms.news.published_hint',
                    'Only published articles appear on the public site'
                  )}
                </p>
              </div>
              <Switch checked={published} onCheckedChange={handlePublishedChange} />
            </div>

            <Field label={t('cms.news.field_datetime', 'Date and time')}>
              <input
                type="datetime-local"
                className={inputCls}
                value={publishedAtLocal}
                onChange={(e) => setPublishedAtLocal(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>

          <SubmitRow saving={saving || uploadingCover || uploadingMedia} />
        </form>
      )}

      <Modal
        isDialogOpen={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTarget(null)
        }}
        noPadding
        customWidth="sm:max-w-[480px] sm:min-w-[400px]"
        dialogTitle={t('cms.news.remove_media_title', 'Remove media')}
        dialogContent={
          <div className="space-y-4 p-5">
            <p className="text-sm text-gray-600">
              {t(
                'cms.news.remove_media_confirm',
                'Remove this item? You can upload it again later.'
              )}
            </p>
            {removeTarget && 'name' in removeTarget ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                {removeTarget.name}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemove()}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {removing ? '…' : t('cms.news.cover_remove', 'Remove')}
              </button>
            </div>
          </div>
        }
      />
    </AcademicPageShell>
  )
}
