import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Heart,
  PenLine,
  Settings,
  UserRound,
} from 'lucide-react'
import {
  DESKTOP_NAVIGATION_ITEMS,
  type MoodiNavigationProfile,
  type MoodiRouteKey,
  type MoodiSidebarEntry,
} from './navigation'
import './common.css'

export type SidebarNavigationProps = {
  activeRoute: MoodiRouteKey
  isCollapsed: boolean
  onNavigate: (route: MoodiRouteKey) => void
  onToggleCollapsed: () => void
  profile?: MoodiNavigationProfile
  onOpenProfile?: () => void
  onOpenRecentEntry?: (entryId: string) => void
  onResumeDraft?: () => void
  recentEntries?: MoodiSidebarEntry[]
  draftTitle?: string
}

/** 문서 중심 탐색과 최근 기록 접근을 제공하는 데스크톱 사이드바다. */
export function SidebarNavigation({
  activeRoute,
  isCollapsed,
  onNavigate,
  onToggleCollapsed,
  profile,
  onOpenProfile,
  onOpenRecentEntry,
  onResumeDraft,
  recentEntries = [],
  draftTitle,
}: SidebarNavigationProps) {
  const navigate = (route: MoodiRouteKey) => {
    if (route !== 'write' || activeRoute !== 'write') onNavigate(route)
  }

  return (
    <aside className="moodi-sidebar" aria-label="Moodi 문서 탐색">
      <div className="moodi-sidebar-topline">
        <button
          aria-label="Moodi 오늘 화면으로 이동"
          className="moodi-sidebar-brand"
          onClick={() => navigate('home')}
          type="button"
        >
          <span><Heart aria-hidden="true" size={17} /></span>
          {!isCollapsed && <strong>moodi</strong>}
        </button>
        <button
          aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="moodi-sidebar-collapse"
          onClick={onToggleCollapsed}
          type="button"
        >
          {isCollapsed ? <ChevronRight aria-hidden="true" size={17} /> : <ChevronLeft aria-hidden="true" size={17} />}
        </button>
      </div>

      <button className="moodi-sidebar-compose" onClick={() => navigate('write')} type="button">
        <PenLine aria-hidden="true" size={17} />
        {!isCollapsed && <span>새 기록</span>}
      </button>

      <nav className="moodi-sidebar-navigation" aria-label="주요 메뉴">
        {!isCollapsed && <span className="moodi-sidebar-section-label">나의 공간</span>}
        {DESKTOP_NAVIGATION_ITEMS.map((item) => (
          <button
            aria-current={activeRoute === item.route ? 'page' : undefined}
            aria-label={isCollapsed ? item.label : undefined}
            className={activeRoute === item.route ? 'is-active' : undefined}
            key={item.route}
            onClick={() => navigate(item.route)}
            title={isCollapsed ? item.label : undefined}
            type="button"
          >
            <item.Icon aria-hidden="true" size={18} />
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {!isCollapsed && (
        <div className="moodi-sidebar-library">
          {draftTitle && onResumeDraft && (
            <section aria-labelledby="moodi-sidebar-draft-label">
              <span className="moodi-sidebar-section-label" id="moodi-sidebar-draft-label">
                작성 중
              </span>
              <button className="moodi-sidebar-document" onClick={onResumeDraft} type="button">
                <Clock3 aria-hidden="true" size={16} />
                <span>
                  <strong>{draftTitle}</strong>
                  <small>임시저장 이어쓰기</small>
                </span>
              </button>
            </section>
          )}

          {recentEntries.length > 0 && onOpenRecentEntry && (
            <section aria-labelledby="moodi-sidebar-recent-label">
              <span className="moodi-sidebar-section-label" id="moodi-sidebar-recent-label">
                최근 기록
              </span>
              <div className="moodi-sidebar-recent-list">
                {recentEntries.slice(0, 5).map((entry) => (
                  <button
                    className="moodi-sidebar-document"
                    key={entry.id}
                    onClick={() => onOpenRecentEntry(entry.id)}
                    type="button"
                  >
                    <FileText aria-hidden="true" size={16} />
                    <span>
                      <strong>{entry.title}</strong>
                      <small>{entry.meta}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="moodi-sidebar-footer">
        {onOpenProfile && (
          <button
            aria-label={isCollapsed ? `${profile?.displayName ?? '사용자'} 프로필` : undefined}
            onClick={onOpenProfile}
            title={isCollapsed ? '프로필' : undefined}
            type="button"
          >
            <UserRound aria-hidden="true" size={18} />
            {!isCollapsed && (
              <span>
                <strong>{profile?.displayName ?? '게스트 기록자'}</strong>
                <small>{profile?.secondaryText ?? '나의 기록 공간'}</small>
              </span>
            )}
          </button>
        )}
        <button
          aria-label={isCollapsed ? '설정' : undefined}
          className={activeRoute === 'settings' ? 'is-active' : undefined}
          onClick={() => navigate('settings')}
          title={isCollapsed ? '설정' : undefined}
          type="button"
        >
          <Settings aria-hidden="true" size={18} />
          {!isCollapsed && <span>설정</span>}
        </button>
      </div>
    </aside>
  )
}
