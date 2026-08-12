import { requestJson } from '../../../shared/api/httpClient'
import type { GoogleAuthenticationRequest } from '../types/auth'

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

export type GoogleRedirectLoginConfiguration = {
  loginUri: string
  nonce: string
  state: string
}

/**
 * Google redirect 인증에 필요한 일회성 login attempt를 준비한다.
 * credential은 Google이 same-origin login URI로 직접 POST하며 브라우저에 저장하지 않는다.
 */
export async function prepareGoogleRedirectLogin(
): Promise<GoogleRedirectLoginConfiguration> {
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
    // GIS redirect POST must return to the browser-facing origin so the
    // double-submit cookie and the host-only session cookie share one host.
    loginUri: new URL('/api/v1/auth/google-credentials', window.location.origin).toString(),
    nonce: attempt.body.nonce,
    state: attempt.body.attemptId,
  }
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
        login_uri: string
        nonce: string
        ux_mode: 'redirect'
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
 * 준비된 attempt를 GIS redirect button에 연결한다.
 * Google이 관리하는 button만 credential을 redirect POST하므로 모바일에서도
 * popup opener나 window reference에 의존하지 않는다.
 */
export async function mountGoogleRedirectButton(
  container: HTMLElement,
  configuration: GoogleRedirectLoginConfiguration,
  intent: GoogleAuthenticationRequest['intent'],
): Promise<() => void> {
  const google = await loadGoogleIdentityApi()

  google.accounts.id.initialize({
    client_id: requireGoogleClientId(),
    login_uri: configuration.loginUri,
    nonce: configuration.nonce,
    ux_mode: 'redirect',
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
