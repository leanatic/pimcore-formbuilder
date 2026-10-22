import { appConfig } from '@pimcore/studio-ui-bundle/app'

const DEFAULT_PREFIX = '/pimcore-studio/api'

export class ApiError extends Error {
  status: number
  data: any

  constructor (message: string, status: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }

  get isAuthError (): boolean {
    return this.status === 401 || this.status === 403
  }
}

export const getApiPrefix = (): string => {
  let prefix: string | undefined

  try {
    prefix = appConfig?.apiPrefix
  } catch {
    prefix = undefined
  }

  return (prefix ?? DEFAULT_PREFIX).replace(/\/$/, '')
}

export const buildUrl = (path: string, query?: Record<string, any>): string => {
  const url = `${window.location.origin}${getApiPrefix()}/formbuilder${path.startsWith('/') ? path : `/${path}`}`

  if (query === undefined) {
    return url
  }

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    params.append(key, String(value))
  })

  const qs = params.toString()

  return qs === '' ? url : `${url}?${qs}`
}

const extractMessage = (data: any, status: number, statusText: string): string => {
  if (status === 401) {
    return 'You are not authenticated. Please reload Pimcore Studio and log in again.'
  }

  if (status === 403) {
    return 'You are not allowed to perform this action (missing "formbuilder_permission_settings" permission).'
  }

  if (data !== null && typeof data === 'object') {
    if (typeof data.message === 'string') {
      return data.message
    }
    if (typeof data.detail === 'string') {
      return data.detail
    }
    if (typeof data.title === 'string') {
      return data.title
    }
  }

  return `${status} ${statusText}`.trim()
}

export interface RequestOptions {
  query?: Record<string, any>
  body?: any
  formData?: FormData
  signal?: AbortSignal
}

const parseResponse = async (response: Response): Promise<any> => {
  const text = await response.text()

  if (text === '') {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const request = async <T = any>(method: string, path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined

  if (options.formData !== undefined) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let response: Response

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal
    })
  } catch (e: any) {
    throw new ApiError(e?.message ?? 'Network error', 0)
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    throw new ApiError(extractMessage(data, response.status, response.statusText), response.status, data)
  }

  return data as T
}

export const get = async <T = any>(path: string, query?: Record<string, any>): Promise<T> => await request<T>('GET', path, { query })
export const post = async <T = any>(path: string, body?: any): Promise<T> => await request<T>('POST', path, { body: body ?? {} })
export const put = async <T = any>(path: string, body?: any): Promise<T> => await request<T>('PUT', path, { body: body ?? {} })
export const del = async <T = any>(path: string): Promise<T> => await request<T>('DELETE', path)

/**
 * Downloads a file endpoint (export) through fetch (cookie auth) and hands it to the browser.
 */
export const download = async (path: string, query?: Record<string, any>, fallbackFilename = 'download'): Promise<void> => {
  let response: Response

  try {
    response = await fetch(buildUrl(path, query), { credentials: 'include' })
  } catch (e: any) {
    throw new ApiError(e?.message ?? 'Network error', 0)
  }

  if (!response.ok) {
    const data = await parseResponse(response)
    throw new ApiError(extractMessage(data, response.status, response.statusText), response.status, data)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const filename = match !== null ? decodeURIComponent(match[1]) : fallbackFilename

  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => { window.URL.revokeObjectURL(objectUrl) }, 1000)
}
