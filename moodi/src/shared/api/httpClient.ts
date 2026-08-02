import { API_BASE_URL, toApiUrl } from './apiConfig'
import { ApiRequestError, type ApiProblemDetails } from './apiError'

const DEFAULT_TIMEOUT_MS = 15_000

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export type ApiResponse<T> = {
  body: T
  headers: Headers
  status: number
}

export type ApiRequestOptions = {
  method?: HttpMethod
  body?: BodyInit | null
  headers?: HeadersInit
  signal?: AbortSignal
  includeCsrfToken?: boolean
  idempotencyKey?: string
  contentType?: string
}

let csrfToken: string | null = null

/** session 응답에서 받은 CSRF token은 메모리에만 보관한다. */
export function setApiCsrfToken(nextCsrfToken: string | null): void {
  csrfToken = nextCsrfToken
}

/** feature adapter가 직접 fetch를 호출하지 않도록 제공하는 공통 HTTP 경계다. */
export async function requestApi<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const method = options.method ?? 'GET'
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const signal = mergeAbortSignals(options.signal, controller.signal)
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json, application/problem+json')

  if (options.contentType) headers.set('Content-Type', options.contentType)
  if (options.includeCsrfToken && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)

  try {
    const response = await fetch(toApiUrl(path), {
      body: options.body,
      credentials: 'include',
      headers,
      method,
      redirect: 'manual',
      signal,
    })

    if (!response.ok) {
      throw await toApiRequestError(response)
    }

    return {
      body: (await readResponseBody<T>(response)) as T,
      headers: response.headers,
      status: response.status,
    }
  } catch (error) {
    if (error instanceof ApiRequestError || error instanceof DOMException) throw error

    throw new ApiRequestError(
      '서버와 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.',
      0,
      'NETWORK_ERROR',
    )
  } finally {
    window.clearTimeout(timeoutId)
  }
}

/** JSON endpoint에 맞는 body와 content type을 갖춘 request helper다. */
export function requestJson<T>(
  path: string,
  body: unknown,
  options: Omit<ApiRequestOptions, 'body' | 'contentType'> = {},
): Promise<ApiResponse<T>> {
  return requestApi<T>(path, {
    ...options,
    body: JSON.stringify(body),
    contentType: 'application/json',
  })
}

/** 현재 API base origin을 SSE나 image URL 구성에 제공한다. */
export { API_BASE_URL, toApiUrl }

export function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function toApiRequestError(response: Response): Promise<ApiRequestError> {
  const problem = await readResponseBody<ApiProblemDetails>(response)
  const message = problem?.detail || problem?.title || `요청을 처리하지 못했습니다. (${response.status})`

  return new ApiRequestError(
    message,
    response.status,
    problem?.code ?? null,
    problem?.requestId ?? response.headers.get('X-Request-Id'),
  )
}

async function readResponseBody<T>(response: Response): Promise<T | null> {
  if (response.status === 204 || response.headers.get('Content-Length') === '0') return null

  const contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('json')) return response.json() as Promise<T>

  const text = await response.text()
  return text ? (text as T) : null
}

function mergeAbortSignals(
  first: AbortSignal | undefined,
  second: AbortSignal,
): AbortSignal {
  if (!first) return second
  if (first.aborted) return first

  const controller = new AbortController()
  const abort = () => controller.abort()

  first.addEventListener('abort', abort, { once: true })
  second.addEventListener('abort', abort, { once: true })

  return controller.signal
}
