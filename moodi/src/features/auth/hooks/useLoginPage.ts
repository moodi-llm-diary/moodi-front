import { useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { LoginFormState } from '../types/auth'

const initialLoginForm: LoginFormState = {
  email: '',
  password: '',
}

/**
 * 로그인 화면의 form state와 mock auth store 호출을 캡슐화한다.
 */
export function useLoginPage(onLoginSuccess: () => void) {
  const login = useAuthStore((state) => state.login)
  const [form, setForm] = useState<LoginFormState>(initialLoginForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const updateForm = useCallback((field: keyof LoginFormState, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrorMessage(null)
  }, [])

  const submitLogin = useCallback(() => {
    try {
      login(form)
      setErrorMessage(null)
      onLoginSuccess()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했어요.')
    }
  }, [form, login, onLoginSuccess])

  return {
    errorMessage,
    form,
    submitLogin,
    updateForm,
  }
}
