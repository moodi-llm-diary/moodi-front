/**
 * API origin을 한 곳에서 정규화한다. Vite 환경변수는 배포마다 바뀔 수 있으므로
 * feature 코드가 직접 import.meta.env를 읽지 않는다.
 */
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

/** `/`는 Vite 또는 Vercel same-origin proxy를 뜻한다. 브라우저 인증 배포도 이를 사용한다. */
export const API_BASE_URL = configuredApiBaseUrl && configuredApiBaseUrl !== '/'
  ? configuredApiBaseUrl.replace(/\/$/, '')
  : ''

/** API가 돌려준 same-origin path를 브라우저에서 실제로 사용할 절대 URL로 바꾼다. */
export function toApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

/** 저장 전 HTML 안의 API origin URL을 backend가 소유하는 relative path로 복원한다. */
export function toApiRelativeUrl(pathOrUrl: string): string {
  return API_BASE_URL && pathOrUrl.startsWith(API_BASE_URL)
    ? pathOrUrl.slice(API_BASE_URL.length) || '/'
    : pathOrUrl
}
