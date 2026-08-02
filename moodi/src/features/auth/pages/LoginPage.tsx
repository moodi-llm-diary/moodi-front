import { GoogleAuthPage } from './GoogleAuthPage'

type LoginPageProps = {
  onLoginSuccess: () => void
  onOpenSignup: () => void
}

/**
 * 로그인 화면은 입력 UI와 submit event 전달만 담당한다.
 */
export function LoginPage({
  onLoginSuccess,
  onOpenSignup,
}: LoginPageProps) {
  return (
    <GoogleAuthPage
      intent="login"
      onAuthSuccess={onLoginSuccess}
      onOpenLogin={() => undefined}
      onOpenSignup={onOpenSignup}
    />
  )
}
