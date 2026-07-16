import {
  CalendarCheck,
  Clock3,
  FileText,
  Heart,
  Menu,
  MessageCirclePlus,
  PenLine,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  DESKTOP_NAVIGATION_ITEMS,
  MOBILE_NAVIGATION_ITEMS,
  type MoodiNavigationProfile,
  type MoodiRouteKey,
  type MoodiSidebarEntry,
} from './navigation'
import './common.css'

export type MobileNavigationProps = {
  activeRoute: MoodiRouteKey
  title?: string
  onNavigate: (route: MoodiRouteKey) => void
  profile?: MoodiNavigationProfile
  onOpenProfile?: () => void
  onOpenRecentEntry?: (entryId: string) => void
  onResumeDraft?: () => void
  onStartNewJournal?: () => void
  onCreateAIConversation?: () => void
  onMoveCalendarToToday?: () => void
  recentEntries?: MoodiSidebarEntry[]
  favoriteEntries?: MoodiSidebarEntry[]
  draftTitle?: string
}

/** 공통 App Bar, focus-trapped drawer와 다섯 개 핵심 모바일 탭을 조립한다. */
export function MobileNavigation({
  activeRoute,
  title,
  onNavigate,
  profile,
  onOpenProfile,
  onOpenRecentEntry,
  onResumeDraft,
  onStartNewJournal,
  onCreateAIConversation,
  onMoveCalendarToToday,
  recentEntries = [],
  favoriteEntries = [],
  draftTitle,
}: MobileNavigationProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const drawerTitleId = useId()

  useEffect(() => {
    if (!isDrawerOpen) return

    const previousOverflow = document.body.style.overflow
    const focusableSelector =
      'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsDrawerOpen(false)
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (!firstElement || !lastElement) return
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() =>
      drawerRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus(),
    )

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  const closeDrawer = (restoreFocus = false) => {
    setIsDrawerOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  const navigate = (route: MoodiRouteKey) => {
    closeDrawer()
    onNavigate(route)
  }

  const startJournal = () => {
    closeDrawer()
    onStartNewJournal?.()
  }

  const openProfile = () => {
    closeDrawer()
    onOpenProfile?.()
  }

  const appBarAction = getAppBarAction({
    activeRoute,
    onCreateAIConversation,
    onMoveCalendarToToday,
    onStartNewJournal,
  })

  return (
    <div className="moodi-common-mobile-navigation">
      <header className="moodi-common-mobile-header">
        <button
          aria-expanded={isDrawerOpen}
          aria-haspopup="dialog"
          aria-label="메뉴 열기"
          className="moodi-common-mobile-menu-button"
          onClick={() => setIsDrawerOpen(true)}
          ref={menuButtonRef}
          type="button"
        >
          <Menu aria-hidden="true" size={22} />
        </button>
        <strong className="moodi-common-mobile-title">
          {title ?? getMobileRouteLabel(activeRoute)}
        </strong>
        {appBarAction ? (
          <button
            aria-label={appBarAction.label}
            className="moodi-common-mobile-action"
            onClick={appBarAction.onClick}
            type="button"
          >
            <appBarAction.Icon aria-hidden="true" size={20} />
          </button>
        ) : <span aria-hidden="true" className="moodi-common-mobile-action-spacer" />}
      </header>

      <nav className="moodi-common-bottom-navigation" aria-label="모바일 주요 메뉴">
        {MOBILE_NAVIGATION_ITEMS.map((item) => (
          <button
            aria-current={activeRoute === item.route ? 'page' : undefined}
            className={activeRoute === item.route ? 'is-active' : undefined}
            key={item.route}
            onClick={() => navigate(item.route)}
            type="button"
          >
            <span className="moodi-common-bottom-icon">
              <item.Icon aria-hidden="true" size={21} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          aria-current={isProfileRoute(activeRoute) ? 'page' : undefined}
          aria-label={`${profile?.displayName ?? '사용자'} 메뉴 열기`}
          className={isProfileRoute(activeRoute) ? 'is-active' : undefined}
          onClick={() => setIsDrawerOpen(true)}
          type="button"
        >
          <span className="moodi-common-bottom-icon">
            <UserRound aria-hidden="true" size={21} />
          </span>
          <span>나</span>
        </button>
      </nav>

      {isDrawerOpen && (
        <div
          className="moodi-mobile-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer(true)
          }}
          role="presentation"
        >
          <aside
            aria-labelledby={drawerTitleId}
            aria-modal="true"
            className="moodi-mobile-drawer"
            ref={drawerRef}
            role="dialog"
          >
            <header className="moodi-mobile-drawer-header">
              <button
                aria-label="Moodi 오늘 화면으로 이동"
                className="moodi-mobile-drawer-brand"
                onClick={() => navigate('home')}
                type="button"
              >
                <span><Heart aria-hidden="true" size={17} /></span>
                <strong id={drawerTitleId}>moodi</strong>
              </button>
              <button aria-label="메뉴 닫기" onClick={() => closeDrawer(true)} type="button">
                <X aria-hidden="true" size={21} />
              </button>
            </header>

            <button className="moodi-mobile-drawer-profile" onClick={openProfile} type="button">
              <span><UserRound aria-hidden="true" size={19} /></span>
              <span>
                <strong>{profile?.displayName ?? '게스트 기록자'}</strong>
                <small>{profile?.secondaryText ?? '나의 기록 공간'}</small>
              </span>
            </button>

            <button className="moodi-mobile-drawer-compose" onClick={startJournal} type="button">
              <PenLine aria-hidden="true" size={18} /> 새 기록
            </button>

            <nav className="moodi-mobile-drawer-navigation" aria-label="모바일 전체 메뉴">
              <span>나의 공간</span>
              {DESKTOP_NAVIGATION_ITEMS.map((item) => (
                <button
                  aria-current={activeRoute === item.route ? 'page' : undefined}
                  className={activeRoute === item.route ? 'is-active' : undefined}
                  key={item.route}
                  onClick={() => navigate(item.route)}
                  type="button"
                >
                  <item.Icon aria-hidden="true" size={19} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="moodi-mobile-drawer-library">
              {draftTitle && onResumeDraft && (
                <section aria-labelledby="mobile-drawer-draft-title">
                  <span id="mobile-drawer-draft-title">작성 중</span>
                  <button
                    onClick={() => {
                      closeDrawer()
                      onResumeDraft()
                    }}
                    type="button"
                  >
                    <Clock3 aria-hidden="true" size={17} />
                    <span><strong>{draftTitle}</strong><small>임시저장 이어쓰기</small></span>
                  </button>
                </section>
              )}

              {recentEntries.length > 0 && onOpenRecentEntry && (
                <section aria-labelledby="mobile-drawer-recent-title">
                  <span id="mobile-drawer-recent-title">최근 기록</span>
                  {recentEntries.slice(0, 4).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        closeDrawer()
                        onOpenRecentEntry(entry.id)
                      }}
                      type="button"
                    >
                      <FileText aria-hidden="true" size={17} />
                      <span><strong>{entry.title}</strong><small>{entry.meta}</small></span>
                    </button>
                  ))}
                </section>
              )}

              {favoriteEntries.length > 0 && onOpenRecentEntry && (
                <section aria-labelledby="mobile-drawer-favorite-title">
                  <span id="mobile-drawer-favorite-title">즐겨찾기</span>
                  {favoriteEntries.slice(0, 3).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        closeDrawer()
                        onOpenRecentEntry(entry.id)
                      }}
                      type="button"
                    >
                      <Heart aria-hidden="true" size={17} />
                      <span><strong>{entry.title}</strong><small>{entry.meta}</small></span>
                    </button>
                  ))}
                </section>
              )}
            </div>

            <footer className="moodi-mobile-drawer-footer">
              <button onClick={() => navigate('settings')} type="button">
                <Settings aria-hidden="true" size={18} /> 설정
              </button>
              <button onClick={() => navigate('settings')} type="button">
                <ShieldCheck aria-hidden="true" size={18} /> 데이터와 개인정보
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}

function getMobileRouteLabel(route: MoodiRouteKey): string {
  const labels: Record<MoodiRouteKey, string> = {
    home: 'Moodi',
    write: '새 기록',
    ai: 'Moodi AI',
    entries: '기록',
    calendar: '캘린더',
    insights: '회고',
    tags: '태그와 주제',
    settings: '설정',
  }

  return labels[route]
}

function isProfileRoute(route: MoodiRouteKey): boolean {
  return route === 'insights' || route === 'tags' || route === 'settings'
}

function getAppBarAction({
  activeRoute,
  onCreateAIConversation,
  onMoveCalendarToToday,
  onStartNewJournal,
}: {
  activeRoute: MoodiRouteKey
  onCreateAIConversation?: () => void
  onMoveCalendarToToday?: () => void
  onStartNewJournal?: () => void
}) {
  if (activeRoute === 'ai' && onCreateAIConversation) {
    return { label: '새 AI 대화', Icon: MessageCirclePlus, onClick: onCreateAIConversation }
  }
  if (activeRoute === 'calendar' && onMoveCalendarToToday) {
    return { label: '오늘 날짜로 이동', Icon: CalendarCheck, onClick: onMoveCalendarToToday }
  }
  if (
    onStartNewJournal &&
    (activeRoute === 'home' || activeRoute === 'entries' || activeRoute === 'insights')
  ) {
    return { label: '새 기록', Icon: PenLine, onClick: onStartNewJournal }
  }

  return null
}
