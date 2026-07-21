import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  RequestBodyFormWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

export type CMSNewsImage = {
  id: number
  imageName: string
  imageURL: string
  dateCreatedString: string
}

export type CMSNewsVideo = {
  id: number
  videoName: string
  videoURL: string
  dateCreatedString: string
}

export type CMSNewsListItem = {
  id: number
  org_id: number
  org_uuid?: string
  news_uuid: string
  title: string
  slug: string
  excerpt: string
  cover_image: string
  images: CMSNewsImage[]
  videos: CMSNewsVideo[]
  published: boolean
  published_at: string | null
  creation_date: string
  update_date: string
}

export type CMSNews = CMSNewsListItem & {
  body: string
  created_by?: number | null
}

export type CMSNewsListResponse = {
  items: CMSNewsListItem[]
  total: number
  page: number
  limit: number
}

export type CMSNewsPayload = {
  title: string
  slug?: string | null
  excerpt?: string
  body?: string
  cover_image?: string
  published?: boolean
  published_at?: string | null
}

export async function listAdminNews(
  org_id: number,
  access_token: string,
  page = 1,
  limit = 20
): Promise<CMSNewsListResponse> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news?page=${page}&limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getAdminNews(
  org_id: number,
  news_uuid: string,
  access_token: string
): Promise<CMSNews> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createNews(
  org_id: number,
  data: CMSNewsPayload,
  access_token: string
): Promise<CMSNews> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateNews(
  org_id: number,
  news_uuid: string,
  data: Partial<CMSNewsPayload>,
  access_token: string
): Promise<CMSNews> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteNews(
  org_id: number,
  news_uuid: string,
  access_token: string
): Promise<{ detail: string }> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function uploadNewsCover(
  org_id: number,
  news_uuid: string,
  file: File,
  access_token: string
): Promise<CMSNews> {
  const formData = new FormData()
  formData.append('cover_file', file)
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}/cover`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  )
  return errorHandling(result)
}

export async function uploadNewsImage(
  org_id: number,
  news_uuid: string,
  file: File,
  access_token: string
): Promise<CMSNews> {
  const formData = new FormData()
  formData.append('image_file', file)
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}/images`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  )
  return errorHandling(result)
}

export async function uploadNewsVideo(
  org_id: number,
  news_uuid: string,
  file: File,
  access_token: string
): Promise<CMSNews> {
  const formData = new FormData()
  formData.append('video_file', file)
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}/videos`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteNewsImage(
  org_id: number,
  news_uuid: string,
  media_id: number,
  access_token: string
): Promise<CMSNews> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}/images/${media_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteNewsVideo(
  org_id: number,
  news_uuid: string,
  media_id: number,
  access_token: string
): Promise<CMSNews> {
  const result = await fetch(
    `${getAPIUrl()}cms/admin/${org_id}/news/${news_uuid}/videos/${media_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
