import { useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { MyPageViewModel } from '../types/auth'

/**
 * 마이페이지에 필요한 auth user view model과 logout action을 제공한다.
 */
export function useMyPage() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const logout = useAuthStore((state) => state.logout)

  const myPageViewModel = useMemo<MyPageViewModel | null>(() => {
    if (!currentUser) {
      return null
    }

    return {
      displayName: currentUser.displayName,
      email: currentUser.email,
      joinedDateLabel: formatDateTimeLabel(currentUser.joinedAt),
      lastLoginDateLabel: formatDateTimeLabel(currentUser.lastLoginAt),
    }
  }, [currentUser])

  return {
    currentUser,
    logout,
    myPageViewModel,
  }
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('ko-KR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
