import { ArrowLeft, LogIn, LogOut, UserRound } from 'lucide-react'
import { ThemeSelector } from '../../theme/components/ThemeSelector'
import type { ThemeName, ThemeOption } from '../../theme/types/theme'
import { useMyPage } from '../hooks/useMyPage'
import './AuthPages.css'

type MyPageProps = {
  activeTheme: ThemeName
  onBack: () => void
  onLogin: () => void
  onLoggedOut: () => void
  onSelectTheme: (themeName: ThemeName) => void
  themeOptions: ThemeOption[]
}

/**
 * 마이페이지는 로그인 사용자 view model과 logout event만 표시한다.
 */
export function MyPage({
  activeTheme,
  onBack,
  onLogin,
  onLoggedOut,
  onSelectTheme,
  themeOptions,
}: MyPageProps) {
  const myPage = useMyPage()

  if (!myPage.myPageViewModel) {
    return (
      <main className="auth-app" tabIndex={-1}>
        <section className="auth-shell auth-surface">
          <button className="auth-back-button" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" size={18} />
            돌아가기
          </button>
          <div className="auth-heading">
            <span className="auth-eyebrow">나의 기록 공간</span>
            <h1>마이페이지</h1>
            <p>로그인 후 계정 정보를 확인할 수 있어요.</p>
          </div>
          <ThemeSelector
            activeTheme={activeTheme}
            onSelectTheme={onSelectTheme}
            options={themeOptions}
          />
          <button className="auth-primary-button" onClick={onLogin} type="button">
            <LogIn aria-hidden="true" size={18} />
            로그인하기
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-app" tabIndex={-1}>
      <section className="auth-shell auth-surface">
        <button className="auth-back-button" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={18} />
          돌아가기
        </button>

        <div className="profile-card">
          <div className="profile-avatar">
            <UserRound aria-hidden="true" size={30} />
          </div>
          <div>
            <span className="auth-eyebrow">나의 기록 공간</span>
            <h1>{myPage.myPageViewModel.displayName}</h1>
            <p>{myPage.myPageViewModel.email}</p>
          </div>
        </div>

        <dl className="profile-list">
          <div>
            <dt>가입일</dt>
            <dd>{myPage.myPageViewModel.joinedDateLabel}</dd>
          </div>
          <div>
            <dt>최근 로그인</dt>
            <dd>{myPage.myPageViewModel.lastLoginDateLabel}</dd>
          </div>
        </dl>

        <ThemeSelector
          activeTheme={activeTheme}
          onSelectTheme={onSelectTheme}
          options={themeOptions}
        />

        <div className="auth-actions">
          <button className="auth-secondary-button" onClick={onBack} type="button">
            일기장으로 돌아가기
          </button>
          <button
            className="auth-ghost-button"
            onClick={() => {
              myPage.logout()
              onLoggedOut()
            }}
            type="button"
          >
            <LogOut aria-hidden="true" size={18} />
            로그아웃
          </button>
        </div>
      </section>
    </main>
  )
}
