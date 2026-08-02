import type { AuthUser } from '../types/auth'

const AUTH_PROFILE_STORAGE_KEY = 'moodi.mvp.auth.user.v1'

/**
 * 서버 인증 결과에서 받은 표시용 사용자 profile만 복구한다.
 * Google credential과 Moodi session 원문은 브라우저 저장소에 보관하지 않는다.
 */
export function loadStoredAuthUser(): AuthUser | null {
  try {
    const storedValue = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)

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
 * 인증 결과로 받은 안전한 사용자 profile을 저장한다.
 */
export function persistStoredAuthUser(user: AuthUser): void {
  window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(user))
}

/**
 * 현재 브라우저에 남아 있는 표시용 사용자 profile을 제거한다.
 */
export function clearStoredAuthUser(): void {
  window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
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
