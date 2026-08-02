import { create } from 'zustand'
import { authenticateWithGoogle } from '../services/authGoogleService'
import { loadCurrentSession, logoutCurrentSession } from '../services/authSessionService'
import type { AuthUser, GoogleAuthenticationRequest } from '../types/auth'

type AuthStoreState = {
  currentUser: AuthUser | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null
  initialize: () => Promise<void>
  loginWithGoogle: (request: GoogleAuthenticationRequest) => Promise<AuthUser>
  logout: () => Promise<boolean>
}

/**
 * 인증 상태와 사용자 profile 표시용 state를 소유한다.
 * 실제 Google credential과 서버 session은 auth service의 외부 계약으로 격리한다.
 */
export const useAuthStore = create<AuthStoreState>((set) => ({
  currentUser: null,
  status: 'idle',
  errorMessage: null,
  initialize: async () => {
    set({ status: 'loading', errorMessage: null })

    try {
      const currentUser = await loadCurrentSession()
      set({ currentUser, status: 'ready', errorMessage: null })
    } catch (error) {
      set({
        currentUser: null,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '세션을 확인하지 못했습니다.',
      })
    }
  },
  loginWithGoogle: async (request) => {
    const authenticatedUser = await authenticateWithGoogle(request)

    set({ currentUser: authenticatedUser, status: 'ready', errorMessage: null })

    return authenticatedUser
  },
  logout: async () => {
    try {
      await logoutCurrentSession()
      set({ currentUser: null, status: 'ready', errorMessage: null })
      return true
    } catch {
      set({ currentUser: null, status: 'ready', errorMessage: '로그아웃을 완료하지 못했습니다.' })
      return false
    }
  },
}))
