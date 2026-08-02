import { useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { AuthIntent } from '../types/auth'

/**
 * Google 로그인·회원가입 화면의 제출 상태와 auth application action을 조합한다.
 */
export function useGoogleAuthPage(
  intent: AuthIntent,
  onAuthSuccess: () => void,
) {
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitGoogleAuth = useCallback(async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await loginWithGoogle({ intent })
      onAuthSuccess()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Google 인증을 시작하지 못했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [intent, isSubmitting, loginWithGoogle, onAuthSuccess])

  return {
    errorMessage,
    isSubmitting,
    submitGoogleAuth,
  }
}
