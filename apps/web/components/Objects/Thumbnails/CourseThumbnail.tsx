'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ManageAccessPopover from '@components/Dashboard/Library/ManageAccessPopover'
import { getUriWithOrg } from '@services/config/config'
import { deleteCourseFromBackend, cloneCourse } from '@services/courses/courses'
import { exportCourse, downloadBlob, ExportStatus } from '@services/courses/transfer'
import { exportToast } from '@components/Objects/StyledElements/Toast/ExportToast'
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getCourseMetadata } from '@services/courses/courses'
import { BookMinus, FilePenLine, Settings2, MoreVertical, Copy, Download, CheckSquare, Square, Lock, ArrowRight } from 'lucide-react'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import React from 'react'
import toast from 'react-hot-toast'
import UserAvatar from '@components/Objects/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { useTranslation } from 'react-i18next'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

type Course = {
  course_uuid: string
  name: string
  description: string
  thumbnail_image: string
  org_id: string | number
  update_date: string
  public?: boolean
  published?: boolean
  authors?: Array<{
    user: {
      id: string
      user_uuid: string
      avatar_image: string
      first_name: string
      last_name: string
      username: string
    }
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  }>
}

type PropsType = {
  course: Course
  orgslug: string
  customLink?: string
  isDashboard?: boolean
  isSelected?: boolean
  onToggleSelect?: (_courseUuid: string) => void
  isPriority?: boolean
}

export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '')

function CourseThumbnail({ course, orgslug, customLink, isDashboard = false, isSelected = false, onToggleSelect, isPriority = false }: PropsType) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const queryClient = useQueryClient()
  const { track } = useOmniLearnAnalytics('learner')

  const cleanUuid = removeCoursePrefix(course.course_uuid)

  const handleCardOpen = () => {
    track(AnalyticsEvent.CourseCardOpened, {
      course_uuid: cleanUuid,
      source: isDashboard ? 'dashboard' : 'catalog',
    })
  }

  // Prefetch course meta on hover so the course page feels instant
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.courses.meta(cleanUuid),
      queryFn: () => getCourseMetadata(cleanUuid, {}, session?.data?.tokens?.access_token, { slim: true }),
      staleTime: 60_000,
    })
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(course.course_uuid)
  }

  const activeAuthors = course.authors?.filter(author => author.authorship_status === 'ACTIVE') || []
  const displayedAuthors = activeAuthors.slice(0, 3)
  const hasMoreAuthors = activeAuthors.length > 3
  const remainingAuthorsCount = activeAuthors.length - 3

  const deleteCourse = async () => {
    const toastId = toast.loading(t('courses.deleting_course'))
    try {
      await deleteCourseFromBackend(course.course_uuid, session.data?.tokens?.access_token)
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(t('courses.course_deleted_success'))
    } catch (_error) {
      toast.error(t('courses.course_deleted_error'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleCloneCourse = async () => {
    const toastId = toast.loading(t('courses.cloning_course'))
    try {
      const result = await cloneCourse(course.course_uuid, session.data?.tokens?.access_token)
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['courses'] })
        toast.success(t('courses.course_cloned_success'))
      } else {
        toast.error(result.HTTPmessage || t('courses.course_cloned_error'))
      }
    } catch (_error) {
      toast.error(t('courses.course_cloned_error'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleExportCourse = async () => {
    const toastId = exportToast.start('single', course.name)

    try {
      const blob = await exportCourse(
        course.course_uuid,
        session.data?.tokens?.access_token,
        (progress, status) => {
          exportToast.update(toastId, status as ExportStatus, progress, course.name, undefined, 'single')
        }
      )
      const timestamp = new Date().toISOString().split('T')[0]
      downloadBlob(blob, `${course.name.replace(/[^a-z0-9]/gi, '_')}-${timestamp}.zip`)
      exportToast.complete(toastId, course.name, undefined, 'single')
    } catch (error: any) {
      exportToast.error(toastId, error.message || t('courses.course_exported_error'), course.name, undefined, 'single')
    }
  }

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : null

  const courseLink = customLink ? customLink : getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)

  return (
    <div onMouseEnter={handleMouseEnter} className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white shadow-[0_1px_2px_hsl(0_0%_8%/0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_hsl(0_0%_8%/0.18)] ${isSelected ? 'ring-2 ring-[hsl(var(--dash-accent))] ring-offset-2' : ''}`}>
      {/* Selection checkbox - visible on hover or when selected (dashboard only) */}
      {isDashboard && onToggleSelect && (
        <button
          onClick={handleSelectClick}
          aria-label={isSelected ? 'Deselect course' : 'Select course'}
          className={`absolute top-2 left-2 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-md ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-black" />
          ) : (
            <Square className="w-4 h-4 text-gray-500" />
          )}
        </button>
      )}

      {/* Options menu - visible on hover or when dropdown is open */}
      <AdminEditOptions
        course={course}
        orgSlug={orgslug}
        deleteCourse={deleteCourse}
        cloneCourse={handleCloneCourse}
        exportCourse={handleExportCourse}
        isDashboard={isDashboard}
      />

      <Link prefetch={false} href={courseLink} onClick={handleCardOpen} className="relative block aspect-video overflow-hidden bg-[hsl(var(--dash-canvas))]">
        {/* Hidden img gives the browser a real resource hint so it can fetch the cover early as an LCP candidate */}
        {thumbnailImage && isPriority && (
          <img
            src={thumbnailImage}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
        )}
        {/* The generated cover shows when there's no thumbnail or it fails to load. */}
        <CourseCover
          name={course.name}
          seed={course.course_uuid}
          src={thumbnailImage || null}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
        {isDashboard && (
          <div className="absolute bottom-2.5 end-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--dash-ink))] shadow-sm backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${course.published ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {course.published ? t('courses.published') : t('courses.unpublished')}
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link
          prefetch={false}
          href={courseLink}
          onClick={handleCardOpen}
          title={course.name}
          className="line-clamp-2 text-[15px] font-semibold leading-snug text-[hsl(var(--dash-ink))] transition-colors hover:text-[hsl(var(--dash-accent))]"
        >
          {course.name}
        </Link>

        <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-[hsl(var(--dash-muted))]">
          {course.description || '\u00a0'}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-[hsl(var(--dash-border))]/60 pt-3">
          <div className="flex items-center gap-2">
            {displayedAuthors.length > 0 && (
              <div className="flex -space-x-2 items-center">
                {displayedAuthors.map((author, index) => (
                  <div 
                    key={author.user.user_uuid} 
                    className="relative"
                    style={{ zIndex: displayedAuthors.length - index }}
                  >
                    <UserAvatar
                      border="border-2"
                      rounded="rounded-full"
                      avatar_url={author.user.avatar_image ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image) : ''}
                      predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
                      width={20}
                      showProfilePopup={true}
                      userId={author.user.id}
                    />
                  </div>
                ))}
                {hasMoreAuthors && (
                  <div className="relative z-0">
                    <div className="flex items-center justify-center w-[20px] h-[20px] text-[8px] font-bold text-gray-600 bg-gray-100 border-2 border-white rounded-full">
                      +{remainingAuthorsCount}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {course.update_date && (
              <span className="text-[11px] text-[hsl(var(--dash-muted))]">
                {new Date(course.update_date).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          <Link
            prefetch={false}
            href={courseLink}
            onClick={handleCardOpen}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
          >
            {t('courses.start_learning')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  )
}

const AdminEditOptions = ({ course, orgSlug, deleteCourse, cloneCourse, exportCourse, isDashboard = false }: {
  course: Course
  orgSlug: string
  deleteCourse: () => Promise<void>
  cloneCourse: () => Promise<void>
  exportCourse: () => Promise<void>
  isDashboard?: boolean
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const [accessOpen, setAccessOpen] = React.useState(false)

  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className={`absolute top-2 right-2 z-20 transition-opacity ${
        isDashboard && !isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
      }`}>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button aria-label="Course actions" className="rounded-full bg-white/95 p-1.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white">
              <MoreVertical size={18} className="text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`)} className="flex items-center cursor-pointer">
                <FilePenLine className="mr-2 h-4 w-4" /> {t('courses.edit_content')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`)} className="flex items-center cursor-pointer">
                <Settings2 className="mr-2 h-4 w-4" /> {t('common.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('courses.clone_course')}
                confirmationMessage={t('courses.clone_course_confirm')}
                dialogTitle={t('courses.clone_course_title', { name: course.name })}
                dialogTrigger={
                  <button className="w-full text-left flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                    <Copy className="mr-2 h-4 w-4" /> {t('courses.clone_course')}
                  </button>
                }
                functionToExecute={cloneCourse}
                status="info"
              />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                onClick={exportCourse}
                className="w-full text-left flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Download className="mr-2 h-4 w-4" /> {t('courses.export_course')}
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                onClick={() => setAccessOpen(true)}
                className="w-full text-left flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Lock className="mr-2 h-4 w-4" /> {t('library.manage_access')}
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('courses.delete_course')}
                confirmationMessage={t('courses.delete_course_confirm')}
                dialogTitle={t('courses.delete_course_title', { name: course.name })}
                dialogTrigger={
                  <button className="w-full text-left flex items-center px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <BookMinus className="mr-2 h-4 w-4" /> {t('courses.delete_course')}
                  </button>
                }
                functionToExecute={deleteCourse}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Modal
          isDialogOpen={accessOpen}
          onOpenChange={setAccessOpen}
          minHeight="no-min"
          minWidth="md"
          dialogTitle={t('library.manage_access')}
          dialogContent={
            <ManageAccessPopover
              resource_uuid={course.course_uuid}
              resourceType="courses"
              orgslug={orgSlug}
            />
          }
        />
      </div>
    </AuthenticatedClientElement>
  )
}

export default CourseThumbnail
