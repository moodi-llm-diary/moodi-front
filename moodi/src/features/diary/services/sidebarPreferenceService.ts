const SIDEBAR_COLLAPSED_STORAGE_KEY = 'moodi.ui.sidebar-collapsed.v1'
export const SIDEBAR_PREFERENCE_RESET_EVENT = 'moodi:sidebar-preference-reset'

/** 데스크톱 사이드바 접기 상태를 브라우저 preference로 읽는다. */
export function loadSidebarCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** 데스크톱 사이드바 접기 상태를 저장한다. */
export function persistSidebarCollapsedPreference(isCollapsed: boolean): void {
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isCollapsed),
    )
  } catch {
    // UI preference 저장 실패는 일기 작성과 탐색을 막지 않는다.
  }
}

/** 전체 Moodi preference 삭제 시 사이드바 상태도 기본값으로 되돌린다. */
export function clearSidebarCollapsedPreference(): boolean {
  let didClear = true

  try {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  } catch {
    didClear = false
  }

  window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_RESET_EVENT))
  return didClear
}
