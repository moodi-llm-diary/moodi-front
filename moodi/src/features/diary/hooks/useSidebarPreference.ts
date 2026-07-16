import { useEffect, useState } from 'react'
import {
  loadSidebarCollapsedPreference,
  persistSidebarCollapsedPreference,
  SIDEBAR_PREFERENCE_RESET_EVENT,
} from '../services/sidebarPreferenceService'

/** AppShell이 사용하는 사이드바 접기 preference를 캡슐화한다. */
export function useSidebarPreference() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    loadSidebarCollapsedPreference,
  )

  useEffect(() => {
    const resetSidebar = () => setIsSidebarCollapsed(false)

    window.addEventListener(SIDEBAR_PREFERENCE_RESET_EVENT, resetSidebar)
    return () => window.removeEventListener(SIDEBAR_PREFERENCE_RESET_EVENT, resetSidebar)
  }, [])

  const toggleSidebar = () => {
    setIsSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue

      persistSidebarCollapsedPreference(nextValue)
      return nextValue
    })
  }

  return { isSidebarCollapsed, toggleSidebar }
}
