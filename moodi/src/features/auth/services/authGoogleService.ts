import { API_BASE_URL, requestJson } from '../../../shared/api/httpClient'
import { loadCurrentSession } from './authSessionService'
import type { AuthUser, GoogleAuthenticationRequest } from '../types/auth'

export type GoogleAuthServiceErrorCode =
  | 'google-auth-not-configured'
  | 'google-auth-cancelled'
  | 'google-auth-failed'

/**
 * Google 인증 연동이 준비되지 않은 상태를 호출 계층에 전달한다.
 */
export class GoogleAuthServiceError extends Error {
  readonly code: GoogleAuthServiceErrorCode

  constructor(code: GoogleAuthServiceErrorCode, message: string) {
    super(message)
    this.name = 'GoogleAuthServiceError'
    this.code = code
  }
}

/**
 * Google 계정 인증을 시작하는 application service 경계다.
 *
 * Google credential은 browser에 저장하지 않고 backend의 form callback으로 즉시 넘긴다.
 * 성공 여부는 credential 응답이 아니라 새 HttpOnly session을 조회해 판단한다.
 */
export async function authenticateWithGoogle(
  request: GoogleAuthenticationRequest,
): Promise<AuthUser> {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  if (!googleClientId) {
    throw new GoogleAuthServiceError(
      'google-auth-not-configured',
      'Google Client ID가 설정되지 않았어요. .env.local을 확인해 주세요.',
    )
  }

  const attempt = await requestJson<GoogleLoginAttemptDto>(
    '/api/v1/auth/login-attempts',
    {
      purpose: request.intent === 'login' ? 'login' : 'login',
      returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    },
    { method: 'POST' },
  )
  const credential = await requestGoogleCredential(googleClientId, attempt.body.nonce)
  const csrfToken = createGoogleCsrfToken()

  const secureCookieAttribute = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `g_csrf_token=${encodeURIComponent(csrfToken)}; Path=/; SameSite=Lax${secureCookieAttribute}`

  const form = new URLSearchParams({
    credential,
    g_csrf_token: csrfToken,
    state: attempt.body.attemptId,
  })
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/google-credentials`, {
    body: form,
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    redirect: 'manual',
  })

  if (response.type !== 'opaqueredirect' && response.status !== 303 && !response.ok) {
    throw new GoogleAuthServiceError(
      'google-auth-failed',
      'Google 인증을 완료하지 못했습니다. 다시 시도해 주세요.',
    )
  }

  const user = await loadCurrentSession()

  if (!user) {
    throw new GoogleAuthServiceError(
      'google-auth-failed',
      'Google 인증 후 세션을 확인하지 못했습니다. 다시 시도해 주세요.',
    )
  }

  return user
}

type GoogleLoginAttemptDto = {
  attemptId: string
  nonce: string
  expiresAt: string
}

type GoogleCredentialResponse = { credential: string }

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string
        nonce: string
        callback: (response: GoogleCredentialResponse) => void
      }) => void
      prompt: (callback?: (notification: {
        isNotDisplayed: () => boolean
        isSkippedMoment: () => boolean
      }) => void) => void
    }
  }
}

async function requestGoogleCredential(clientId: string, nonce: string): Promise<string> {
  const google = await loadGoogleIdentityApi()

  return new Promise((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      callback: (response) => {
        if (response.credential) {
          resolve(response.credential)
          return
        }
        reject(new GoogleAuthServiceError('google-auth-failed', 'Google credential을 받지 못했습니다.'))
      },
    })
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new GoogleAuthServiceError('google-auth-cancelled', 'Google 로그인을 취소했어요.'))
      }
    })
  })
}

function loadGoogleIdentityApi(): Promise<GoogleIdentityApi> {
  const existingGoogle = (window as Window & { google?: GoogleIdentityApi }).google
  if (existingGoogle) return Promise.resolve(existingGoogle)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      const google = (window as Window & { google?: GoogleIdentityApi }).google
      if (google) resolve(google)
      else reject(new GoogleAuthServiceError('google-auth-failed', 'Google 인증 화면을 불러오지 못했습니다.'))
    }
    script.onerror = () => reject(
      new GoogleAuthServiceError('google-auth-failed', 'Google 인증 화면을 불러오지 못했습니다.'),
    )
    document.head.append(script)
  })
}

function createGoogleCsrfToken(): string {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
