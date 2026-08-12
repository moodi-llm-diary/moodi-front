import { create } from 'zustand'
import { loadCurrentSession, logoutCurrentSession } from '../services/authSessionService'
import type { AuthUser } from '../types/auth'

type AuthStoreState = {
  currentUser: AuthUser | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null
  initialize: () => Promise<void>
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
