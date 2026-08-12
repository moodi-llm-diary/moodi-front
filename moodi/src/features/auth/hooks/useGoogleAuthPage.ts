import { useEffect, useState, type RefObject } from 'react'
import {
  mountGoogleRedirectButton,
  prepareGoogleRedirectLogin,
  type GoogleRedirectLoginConfiguration,
} from '../services/authGoogleService'
import type { AuthIntent } from '../types/auth'

/**
 * Google 로그인·회원가입 화면의 redirect button 준비 상태와 auth service를 조합한다.
 */
export function useGoogleAuthPage(
  intent: AuthIntent,
  googleButtonRef: RefObject<HTMLDivElement | null>,
) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(true)

  useEffect(() => {
    let isMounted = true
    let cleanupButton: (() => void) | undefined

    void prepareGoogleRedirectLogin()
      .then(async (configuration: GoogleRedirectLoginConfiguration) => {
        if (!isMounted || !googleButtonRef.current) return

        const mountedButtonCleanup = await mountGoogleRedirectButton(
          googleButtonRef.current,
          configuration,
          intent,
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
  }, [googleButtonRef, intent])

  return {
    errorMessage,
    googleButtonRef,
    isPreparing,
  }
}
