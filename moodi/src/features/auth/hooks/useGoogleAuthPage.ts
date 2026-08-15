import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAuthStore } from '../stores/authStore'
import {
  authenticateWithGoogleCredential,
  mountGooglePopupButton,
  prepareGooglePopupLogin,
  type GooglePopupLoginConfiguration,
} from '../services/authGoogleService'
import type { AuthIntent } from '../types/auth'

/**
 * Google 로그인·회원가입 화면의 popup button과 인증 상태 전이를 조합한다.
 */
export function useGoogleAuthPage(
  intent: AuthIntent,
  googleButtonRef: RefObject<HTMLDivElement | null>,
) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser)

  useEffect(() => {
    let isMounted = true
    let cleanupButton: (() => void) | undefined

    const handleCredential = async (
      configuration: GooglePopupLoginConfiguration,
      credential: string,
    ) => {
      if (!isMounted || isSubmittingRef.current) return

      isSubmittingRef.current = true
      setIsSubmitting(true)
      setErrorMessage(null)

      try {
        const authenticatedUser = await authenticateWithGoogleCredential(configuration, credential)

        if (isMounted) setAuthenticatedUser(authenticatedUser)
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Google 인증을 완료하지 못했어요.',
          )
        }
      } finally {
        isSubmittingRef.current = false
        if (isMounted) setIsSubmitting(false)
      }
    }

    void prepareGooglePopupLogin()
      .then(async (configuration: GooglePopupLoginConfiguration) => {
        if (!isMounted || !googleButtonRef.current) return

        const mountedButtonCleanup = await mountGooglePopupButton(
          googleButtonRef.current,
          configuration,
          intent,
          (credential) => handleCredential(configuration, credential),
        )

        if (isMounted) {
          cleanupButton = mountedButtonCleanup
          setIsPreparing(false)
        } else {
          mountedButtonCleanup()
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) return

        setErrorMessage(
          error instanceof Error ? error.message : 'Google 인증을 시작하지 못했어요.',
        )
        setIsPreparing(false)
      })

    return () => {
      isMounted = false
      cleanupButton?.()
    }
  }, [googleButtonRef, intent, setAuthenticatedUser])

  return {
    errorMessage,
    googleButtonRef,
    isPreparing,
    isSubmitting,
  }
}
