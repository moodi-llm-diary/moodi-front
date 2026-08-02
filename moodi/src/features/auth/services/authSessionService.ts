import { requestApi, setApiCsrfToken } from '../../../shared/api/httpClient'
import { ApiRequestError } from '../../../shared/api/apiError'
import type { AuthUser } from '../types/auth'

type ApiUserDto = {
  id: string
  email: string
  displayName: string
  joinedAt: string
  lastLoginAt: string
}

type ApiSessionDto = {
  user: ApiUserDto
  authenticatedAt: string
  expiresAt: string
  absoluteExpiresAt: string
  csrfToken: string
}

/** 현재 cookie session을 메모리의 표시용 AuthUser와 CSRF token으로 변환한다. */
export async function loadCurrentSession(): Promise<AuthUser | null> {
  try {
    const response = await requestApi<ApiSessionDto>('/api/v1/auth/session')
    setApiCsrfToken(response.body.csrfToken)

    return response.body.user
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      setApiCsrfToken(null)
      return null
    }

    throw error
  }
}

/** session cookie를 server에서 revoke하고 메모리 CSRF token을 폐기한다. */
export async function logoutCurrentSession(): Promise<void> {
  await requestApi<void>('/api/v1/auth/session', {
    method: 'DELETE',
    includeCsrfToken: true,
  })
  setApiCsrfToken(null)
}
