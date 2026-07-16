import { useEffect, useState, type ReactNode } from 'react'
import { useSidebarPreference } from '../../hooks/useSidebarPreference'
import { MobileNavigation } from './MobileNavigation'
import { SidebarNavigation } from './SidebarNavigation'
import type {
  MoodiNavigationProfile,
  MoodiRouteKey,
  MoodiSidebarEntry,
} from './navigation'
import './common.css'

export type AppShellProps = {
  activeRoute: MoodiRouteKey
  children: ReactNode
  onNavigate: (route: MoodiRouteKey) => void
  profile?: MoodiNavigationProfile
  onOpenProfile?: () => void
  onOpenRecentEntry?: (entryId: string) => void
  onResumeDraft?: () => void
  recentEntries?: MoodiSidebarEntry[]
  favoriteEntries?: MoodiSidebarEntry[]
  draftTitle?: string
  mobileTitle?: string
  onStartNewJournal?: () => void
  onCreateAIConversation?: () => void
  onMoveCalendarToToday?: () => void
  mainId?: string
}

/**
 * 좌측 Sidebar와 그 오른쪽 전체 Main area, mobile navigation을 조립한다.
 */
export function AppShell({
  activeRoute,
  children,
  onNavigate,
  profile,
  onOpenProfile,
  onOpenRecentEntry,
  onResumeDraft,
  recentEntries = [],
  favoriteEntries = [],
  draftTitle,
  mobileTitle,
  onStartNewJournal,
  onCreateAIConversation,
  onMoveCalendarToToday,
  mainId = 'moodi-main-content',
}: AppShellProps) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebarPreference()
  const isKeyboardOpen = useMobileVisualViewport()

  return (
    <div className={[
      'moodi-app-shell',
      isSidebarCollapsed ? 'is-sidebar-collapsed' : '',
      activeRoute === 'write' ? 'is-writing' : '',
      activeRoute === 'ai' ? 'is-ai-chat' : '',
      isKeyboardOpen ? 'is-keyboard-open' : '',
    ].filter(Boolean).join(' ')}>
      <a className="moodi-common-skip-link" href={`#${mainId}`}>
        본문으로 건너뛰기
      </a>

      <SidebarNavigation
        activeRoute={activeRoute}
        isCollapsed={isSidebarCollapsed}
        onNavigate={onNavigate}
        onOpenRecentEntry={onOpenRecentEntry}
        onOpenProfile={onOpenProfile}
        onResumeDraft={onResumeDraft}
        onToggleCollapsed={toggleSidebar}
        profile={profile}
        recentEntries={recentEntries}
        draftTitle={draftTitle}
      />

      {activeRoute !== 'write' && (
        <MobileNavigation
          activeRoute={activeRoute}
          draftTitle={draftTitle}
          favoriteEntries={favoriteEntries}
          onCreateAIConversation={onCreateAIConversation}
          onMoveCalendarToToday={onMoveCalendarToToday}
          onNavigate={onNavigate}
          onOpenProfile={onOpenProfile}
          onOpenRecentEntry={onOpenRecentEntry}
          onResumeDraft={onResumeDraft}
          onStartNewJournal={onStartNewJournal}
          profile={profile}
          recentEntries={recentEntries}
          title={mobileTitle}
        />
      )}

      <main
        aria-label="메인 영역"
        className={`moodi-main-area moodi-common-main ${activeRoute === 'write' ? 'is-writing' : ''}`}
        id={mainId}
        tabIndex={-1}
      >
        {children}
      </main>

    </div>
  )
}

function useMobileVisualViewport(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    const visualViewport = window.visualViewport
    const updateViewport = () => {
      const viewportHeight = visualViewport?.height ?? window.innerHeight
      const keyboardInset = window.innerHeight - viewportHeight - (visualViewport?.offsetTop ?? 0)

      document.documentElement.style.setProperty(
        '--moodi-visual-viewport-height',
        `${Math.round(viewportHeight)}px`,
      )
      document.documentElement.style.setProperty(
        '--moodi-keyboard-inset',
        `${Math.max(0, Math.round(keyboardInset))}px`,
      )
      setIsKeyboardOpen(window.innerWidth <= 900 && keyboardInset > 120)
    }

    updateViewport()
    visualViewport?.addEventListener('resize', updateViewport)
    visualViewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      visualViewport?.removeEventListener('resize', updateViewport)
      visualViewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
      document.documentElement.style.removeProperty('--moodi-visual-viewport-height')
      document.documentElement.style.removeProperty('--moodi-keyboard-inset')
    }
  }, [])

  return isKeyboardOpen
}
