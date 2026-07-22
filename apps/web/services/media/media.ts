import { getBackendUrl, getConfig } from '@services/config/config'
import { isLocalhost } from '@services/utils/ts/hostUtils'

function getMediaUrl() {
  // Prefer same-origin /content in the browser so cookies + Next/nginx proxies work.
  // Absolute backend URL is still used on the server and when a dedicated media CDN is set.
  const mediaUrl = getConfig('NEXT_PUBLIC_OMNILEARN_MEDIA_URL')
  if (mediaUrl) return mediaUrl
  if (typeof window !== 'undefined' && isLocalhost(window.location.hostname)) {
    return '/'
  }
  return getBackendUrl()
}

function getApiUrl() {
  return getBackendUrl();
}

/**
 * Get the streaming URL for an activity video.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getActivityVideoStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/video/${orgUUID}/${courseUUID}/${activityUUID}/${filename}`
}

/**
 * Get the streaming URL for a video block.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getVideoBlockStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  blockUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/block/${orgUUID}/${courseUUID}/${activityUUID}/${blockUUID}/${filename}`
}

/**
 * Get the streaming URL for an audio block.
 * Uses the optimized streaming endpoint with proper Range request support.
 */
export function getAudioBlockStreamUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  blockUUID: string,
  filename: string
) {
  return `${getApiUrl()}api/v1/stream/block/audio/${orgUUID}/${courseUUID}/${activityUUID}/${blockUUID}/${filename}`
}

export function getCourseThumbnailMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  fileId: string
) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/thumbnails/${fileId}`
  return uri
}

export function getProgramThumbnailMediaDirectory(
  orgUUID: string,
  programUUID: string,
  fileId: string
) {
  return `${getMediaUrl()}content/orgs/${orgUUID}/programs/${programUUID}/thumbnails/${fileId}`
}

export function getTrainingProgramThumbnailMediaDirectory(
  orgUUID: string,
  trainingProgramUUID: string,
  fileId: string
) {
  return `${getMediaUrl()}content/orgs/${orgUUID}/trainingprograms/${trainingProgramUUID}/thumbnails/${fileId}`
}

export function getFolderThumbnailMediaDirectory(
  orgUUID: string,
  folderUUID: string,
  fileId: string
) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/folders/${folderUUID}/thumbnails/${fileId}`
  return uri
}

export function getBoardThumbnailMediaDirectory(
  orgUUID: string,
  boardUUID: string,
  fileId: string
) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/boards/${boardUUID}/thumbnails/${fileId}`
  return uri
}

export function getPlaygroundThumbnailMediaDirectory(
  orgUUID: string,
  playgroundUUID: string,
  fileId: string
) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/playgrounds/${playgroundUUID}/thumbnails/${fileId}`
  return uri
}

export function getOrgLandingMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/landing/${fileId}`
  return uri
}

export function getUserAvatarMediaDirectory(userUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/users/${userUUID}/avatars/${fileId}`
  return uri
}

export function getActivityBlockMediaDirectory(
  orgUUID: string,
  courseId: string,
  activityId: string,
  blockId: any,
  fileId: any,
  type: string
) {
  if (type == 'pdfBlock') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/pdfBlock/${blockId}/${fileId}`
    return uri
  }
  if (type == 'videoBlock') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/videoBlock/${blockId}/${fileId}`
    return uri
  }
  if (type == 'imageBlock') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/imageBlock/${blockId}/${fileId}`
    return uri
  }
  if (type == 'audioBlock') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/audioBlock/${blockId}/${fileId}`
    return uri
  }
}

export function getTaskRefFileDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileID: string

) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/${fileID}`
  return uri
}

export function getTaskFileSubmissionDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileSubID: string
) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/subs/${fileSubID}`
  return uri
}

export function getActivityMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  fileId: string,
  activityType: string
) {
  if (activityType == 'video') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/video/${fileId}`
    return uri
  }
  if (activityType == 'documentpdf') {
    let uri = `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/documentpdf/${fileId}`
    return uri
  }
}

export function getOrgLogoMediaDirectory(orgUUID: string, fileId: string) {
  if (!fileId) return ''
  // Allow absolute URLs (e.g. hosted org logos) — same pattern as news covers.
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId
  return `${getMediaUrl()}content/orgs/${orgUUID}/logos/${fileId}`
}

export function getNewsCoverMediaDirectory(
  orgUUID: string,
  newsUUID: string,
  fileId: string
) {
  if (!fileId) return ''
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId
  if (fileId.startsWith('content/')) return `${getMediaUrl()}${fileId}`
  return `${getMediaUrl()}content/orgs/${orgUUID}/cms/news/${newsUUID}/covers/${fileId}`
}

export function resolveNewsMediaUrl(pathOrUrl: string) {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  if (pathOrUrl.startsWith('content/')) return `${getMediaUrl()}${pathOrUrl}`
  if (pathOrUrl.startsWith('/')) return `${getMediaUrl()}${pathOrUrl.replace(/^\//, '')}`
  return `${getMediaUrl()}${pathOrUrl}`
}

export function getOrgThumbnailMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/thumbnails/${fileId}`
  return uri
}

export function getOrgPreviewMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/previews/${fileId}`
  return uri
}

export function getOrgOgImageMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/og_images/${fileId}`
  return uri
}

export function getOrgAuthBackgroundMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/auth_backgrounds/${fileId}`
  return uri
}

export function getOrgFaviconMediaDirectory(orgUUID: string, fileId: string) {
  let uri = `${getMediaUrl()}content/orgs/${orgUUID}/favicons/${fileId}`
  return uri
}

/**
 * Get the URL for SCORM content files
 * Routes through a local proxy to ensure same-origin for SCORM API injection
 */
export function getScormContentUrl(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  filePath: string
): string {
  // Use local proxy route to serve SCORM content from same origin
  // This is required for the SCORM API to work properly in iframes
  return `/api/scorm/${activityUUID}/content/${filePath}`
}
