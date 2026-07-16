import type { AuthUser, AuthValidationResult, LoginFormState } from '../types/auth'

const AUTH_STORAGE_KEY = 'moodi.mvp.auth.user.v1'

/**
 * MVP 단계의 로그인 사용자를 브라우저 저장소에서 로드한다.
 * TODO: 백엔드 auth contract, session/token format, refresh, expiry, 401/403 mapping이 확정되면 API adapter로 교체한다.
 */
export function loadMockAuthUser(): AuthUser | null {
  try {
    const storedValue = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    const parsedUser = JSON.parse(storedValue) as AuthUser

    return isStoredAuthUser(parsedUser) ? parsedUser : null
  } catch {
    return null
  }
}

/**
 * MVP 단계의 로그인 사용자 프로필만 저장한다.
 * 비밀번호, token, secret은 저장하지 않는다.
 */
export function persistMockAuthUser(user: AuthUser): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

/**
 * MVP 단계의 로그인 사용자 정보를 제거한다.
 */
export function clearMockAuthUser(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

/**
 * 입력값을 검증하고 MVP용 사용자 프로필을 만든다.
 * TODO: 실제 auth endpoint, request/response field, timeout, retry, 401/403 mapping 확정 필요.
 */
export function authenticateMockUser(input: LoginFormState): AuthUser {
  const validationResult = validateLoginForm(input)

  if (!validationResult.isValid) {
    throw new Error(validationResult.message)
  }

  const normalizedEmail = input.email.trim().toLowerCase()
  const existingUser = loadMockAuthUser()
  const now = new Date().toISOString()

  return {
    id: existingUser?.email === normalizedEmail ? existingUser.id : createAuthUserId(),
    email: normalizedEmail,
    displayName:
      existingUser?.email === normalizedEmail
        ? existingUser.displayName
        : createDefaultDisplayName(normalizedEmail),
    joinedAt: existingUser?.email === normalizedEmail ? existingUser.joinedAt : now,
    lastLoginAt: now,
  }
}

/**
 * 로그인 폼 입력 계약을 검증한다.
 */
export function validateLoginForm(input: LoginFormState): AuthValidationResult {
  const normalizedEmail = input.email.trim()
  const password = input.password.trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      isValid: false,
      message: '이메일 형식으로 입력해 주세요.',
    }
  }

  if (password.length < 4) {
    return {
      isValid: false,
      message: '비밀번호는 4자 이상 입력해 주세요.',
    }
  }

  return { isValid: true }
}

function isStoredAuthUser(value: AuthUser): value is AuthUser {
  return (
    typeof value?.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.joinedAt === 'string' &&
    typeof value.lastLoginAt === 'string'
  )
}

function createDefaultDisplayName(email: string): string {
  const localPart = email.split('@')[0]?.trim()

  return localPart ? `${localPart} 님` : 'moodi 사용자'
}

function createAuthUserId(): string {
  if (window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
