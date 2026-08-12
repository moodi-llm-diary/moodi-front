import { GoogleAuthPage } from './GoogleAuthPage'

type SignupPageProps = {
  onOpenLogin: () => void
}

/**
 * Google 기반 Moodi 자체 계정 가입 화면을 조립한다.
 */
export function SignupPage({
  onOpenLogin,
}: SignupPageProps) {
  return (
    <GoogleAuthPage
      intent="signup"
      onOpenLogin={onOpenLogin}
      onOpenSignup={() => undefined}
    />
  )
}
