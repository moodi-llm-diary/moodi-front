import { useRef } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { useGoogleAuthPage } from '../hooks/useGoogleAuthPage'
import type { AuthIntent } from '../types/auth'
import './AuthPages.css'

type GoogleAuthPageProps = {
  intent: AuthIntent
  onOpenLogin: () => void
  onOpenSignup: () => void
}

/**
 * 로그인과 회원가입에서 공유하는 Google 기반 인증 화면이다.
 * 실제 provider 호출은 hook과 auth service 경계 뒤에 있으며 화면은 user intent만 전달한다.
 */
export function GoogleAuthPage({
  intent,
  onOpenLogin,
  onOpenSignup,
}: GoogleAuthPageProps) {
  const isLogin = intent === 'login'
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const authPage = useGoogleAuthPage(intent, googleButtonRef)

  return (
    <main className="auth-app" tabIndex={-1}>
      <div className="auth-layout">
        <section className="auth-intro" aria-label="Moodi 소개">
          <div className="auth-brand-mark" aria-hidden="true">
            M
          </div>
          <span className="auth-eyebrow">나의 기록 공간</span>
          <h1>
            기억을 안전하게
            <br />
            이어가는 Moodi
          </h1>
          <p>
            Google 계정 하나로 로그인하고, 나만의 기록과 회고를 한곳에서 이어가세요.
          </p>
          <ul className="auth-feature-list">
            <li>
              <Check aria-hidden="true" size={16} />
              기록은 나의 계정에만 연결돼요.
            </li>
            <li>
              <Check aria-hidden="true" size={16} />
              Google 비밀번호를 Moodi가 보관하지 않아요.
            </li>
          </ul>
        </section>

        <section className="auth-shell auth-surface">
          <div className="auth-heading">
            <span className="auth-eyebrow">Moodi account</span>
            <h2>{isLogin ? '로그인' : 'Moodi 시작하기'}</h2>
            <p>
              {isLogin
                ? 'Google 계정으로 내 기록 공간에 들어가세요.'
                : 'Google 계정으로 나만의 Moodi 계정을 만들어요.'}
            </p>
          </div>

          <div className="auth-mode-switch" aria-label="인증 화면 선택" role="tablist">
            <button
              aria-selected={isLogin}
              className={isLogin ? 'active' : ''}
              onClick={onOpenLogin}
              role="tab"
              type="button"
            >
              로그인
            </button>
            <button
              aria-selected={!isLogin}
              className={!isLogin ? 'active' : ''}
              onClick={onOpenSignup}
              role="tab"
              type="button"
            >
              회원가입
            </button>
          </div>

          <div className="auth-provider-block">
            <div
              aria-busy={authPage.isPreparing}
              aria-describedby={authPage.errorMessage ? 'auth-google-error' : 'auth-google-help'}
              className="auth-google-button-host"
              ref={googleButtonRef}
            />
            {authPage.isPreparing && (
              <p className="auth-provider-status" role="status">
                Google 로그인 버튼을 준비하고 있어요…
              </p>
            )}
            <p className="auth-provider-help" id="auth-google-help">
              Google 계정 선택 화면으로 이동한 뒤 안전하게 돌아옵니다.
            </p>
          </div>

          {authPage.errorMessage && (
            <p className="auth-error" id="auth-google-error" role="alert">
              {authPage.errorMessage}
            </p>
          )}

          <p className="auth-legal-copy">
            <LockKeyhole aria-hidden="true" size={15} />
            계속하면 Moodi의 서비스 이용과 기록 보관 방식에 동의하는 것으로 안내돼요.
          </p>
        </section>
      </div>
    </main>
  )
}
