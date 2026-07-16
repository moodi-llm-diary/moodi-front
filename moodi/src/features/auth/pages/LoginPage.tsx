import { ArrowLeft, LogIn } from 'lucide-react'
import { ThemeSelector } from '../../theme/components/ThemeSelector'
import type { ThemeName, ThemeOption } from '../../theme/types/theme'
import { useLoginPage } from '../hooks/useLoginPage'
import './AuthPages.css'

type LoginPageProps = {
  activeTheme: ThemeName
  onBack: () => void
  onLoginSuccess: () => void
  onSelectTheme: (themeName: ThemeName) => void
  themeOptions: ThemeOption[]
}

/**
 * 로그인 화면은 입력 UI와 submit event 전달만 담당한다.
 */
export function LoginPage({
  activeTheme,
  onBack,
  onLoginSuccess,
  onSelectTheme,
  themeOptions,
}: LoginPageProps) {
  const loginPage = useLoginPage(onLoginSuccess)

  return (
    <main className="auth-app" tabIndex={-1}>
      <section className="auth-shell auth-surface">
        <button className="auth-back-button" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={18} />
          돌아가기
        </button>

        <div className="auth-heading">
          <span className="auth-eyebrow">나의 기록 공간</span>
          <h1>로그인</h1>
          <p>이메일과 비밀번호를 입력하면 내 기록 화면으로 이동할 수 있어요.</p>
        </div>

        <ThemeSelector
          activeTheme={activeTheme}
          onSelectTheme={onSelectTheme}
          options={themeOptions}
        />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            loginPage.submitLogin()
          }}
        >
          <label>
            <span>이메일</span>
            <input
              aria-describedby={loginPage.errorMessage ? 'auth-login-error' : undefined}
              aria-invalid={Boolean(loginPage.errorMessage)}
              autoComplete="email"
              className="input"
              onChange={(event) => loginPage.updateForm('email', event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={loginPage.form.email}
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              aria-describedby={loginPage.errorMessage ? 'auth-login-error' : undefined}
              aria-invalid={Boolean(loginPage.errorMessage)}
              autoComplete="current-password"
              className="input"
              onChange={(event) => loginPage.updateForm('password', event.target.value)}
              placeholder="4자 이상"
              type="password"
              value={loginPage.form.password}
            />
          </label>

          {loginPage.errorMessage && (
            <p className="auth-error" id="auth-login-error" role="alert">
              {loginPage.errorMessage}
            </p>
          )}

          <button className="auth-primary-button" type="submit">
            <LogIn aria-hidden="true" size={18} />
            로그인
          </button>
        </form>
      </section>
    </main>
  )
}
