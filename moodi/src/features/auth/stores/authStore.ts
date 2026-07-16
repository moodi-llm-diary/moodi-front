import { create } from 'zustand'
import {
  authenticateMockUser,
  clearMockAuthUser,
  loadMockAuthUser,
  persistMockAuthUser,
} from '../services/authMockService'
import type { AuthUser, LoginFormState } from '../types/auth'

type AuthStoreState = {
  currentUser: AuthUser | null
  login: (input: LoginFormState) => AuthUser
  logout: () => boolean
}

/**
 * MVP 단계의 인증 상태를 소유한다.
 * TODO: 백엔드 인증 계약 확정 후 token/session persistence는 전용 auth adapter로 분리한다.
 */
export const useAuthStore = create<AuthStoreState>((set) => ({
  currentUser: loadMockAuthUser(),
  login: (input) => {
    const authenticatedUser = authenticateMockUser(input)

    persistMockAuthUser(authenticatedUser)
    set({ currentUser: authenticatedUser })

    return authenticatedUser
  },
  logout: () => {
    let didClear = true

    try {
      clearMockAuthUser()
    } catch {
      didClear = false
    }

    set({ currentUser: null })
    return didClear
  },
}))
