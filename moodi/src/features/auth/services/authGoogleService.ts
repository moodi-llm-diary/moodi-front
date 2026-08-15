import { requestApi, requestJson } from '../../../shared/api/httpClient'
import { loadCurrentSession } from './authSessionService'
import type { AuthUser, GoogleAuthenticationRequest } from '../types/auth'

export type GoogleAuthServiceErrorCode =
  | 'google-auth-not-configured'
  | 'google-auth-cancelled'
  | 'google-auth-failed'

/**
 * Google 인증 연동 오류를 호출 계층에 전달한다.
 */
export class GoogleAuthServiceError extends Error {
  readonly code: GoogleAuthServiceErrorCode

  constructor(code: GoogleAuthServiceErrorCode, message: string) {
    super(message)
    this.name = 'GoogleAuthServiceError'
    this.code = code
  }
}

export type GooglePopupLoginConfiguration = {
  nonce: string
  state: string
}

/**
 * Google popup 인증에 필요한 일회성 login attempt를 준비한다.
 * credential은 popup callback 이후 앱의 same-origin service가 즉시 전송한다.
 */
export async function prepareGooglePopupLogin(): Promise<GooglePopupLoginConfiguration> {
  requireGoogleClientId()

  const attempt = await requestJson<GoogleLoginAttemptDto>(
    '/api/v1/auth/login-attempts',
    {
      purpose: 'login',
      returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    },
    { method: 'POST' },
  )

  return {
    nonce: attempt.body.nonce,
    state: attempt.body.attemptId,
  }
}

/**
 * GIS popup callback의 credential을 backend session으로 교환한다.
 * 브라우저-facing same-origin API를 사용해 Google origin CORS 차단을 피한다.
 */
export async function authenticateWithGoogleCredential(
  configuration: GooglePopupLoginConfiguration,
  credential: string,
): Promise<AuthUser> {
  const csrfToken = createGoogleCsrfToken()
  const form = new URLSearchParams({
    credential,
    g_csrf_token: csrfToken,
    state: configuration.state,
  })

  setGoogleCsrfCookie(csrfToken)

  await requestApi<void>('/api/v1/auth/google-credentials', {
    acceptedStatuses: [303],
    body: form,
    contentType: 'application/x-www-form-urlencoded',
    method: 'POST',
  })

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

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string
        nonce: string
        callback: (response: GoogleCredentialResponse) => void
        ux_mode: 'popup'
      }) => void
      renderButton: (parent: HTMLElement, options: {
        size: 'large'
        state: string
        text: 'signin_with' | 'signup_with'
        theme: 'outline'
        type: 'standard'
        width: string
      }) => void
      cancel: () => void
    }
  }
}

/**
 * 준비된 attempt를 GIS popup button에 연결한다.
 * credential은 callback으로 받아 application service에 전달한다.
 */
export async function mountGooglePopupButton(
  container: HTMLElement,
  configuration: GooglePopupLoginConfiguration,
  intent: GoogleAuthenticationRequest['intent'],
  onCredential: (credential: string) => void | Promise<void>,
): Promise<() => void> {
  const google = await loadGoogleIdentityApi()

  google.accounts.id.initialize({
    callback: (response) => {
      if (response.credential) void onCredential(response.credential)
    },
    client_id: requireGoogleClientId(),
    nonce: configuration.nonce,
    ux_mode: 'popup',
  })
  google.accounts.id.renderButton(container, {
    size: 'large',
    state: configuration.state,
    text: intent === 'login' ? 'signin_with' : 'signup_with',
    theme: 'outline',
    type: 'standard',
    width: String(Math.min(400, Math.max(200, container.clientWidth))),
  })

  return () => {
    google.accounts.id.cancel()
    container.replaceChildren()
  }
}

function requireGoogleClientId(): string {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  if (!googleClientId) {
    throw new GoogleAuthServiceError(
      'google-auth-not-configured',
      'Google Client ID가 설정되지 않았어요. .env.local을 확인해 주세요.',
    )
  }

  return googleClientId
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

type GoogleCredentialResponse = {
  credential?: string
}

function setGoogleCsrfCookie(token: string): void {
  const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `g_csrf_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secureAttribute}`
}

function createGoogleCsrfToken(): string {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
