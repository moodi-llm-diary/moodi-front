import { useCallback } from 'react'
import { useAuthStore } from '../../auth/stores/authStore'
import { useThemeStore } from '../../theme/stores/themeStore'
import { clearSidebarCollapsedPreference } from '../../diary/services/sidebarPreferenceService'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * 일기 저장소 밖의 Moodi profile과 preference 초기화를 하나의 application action으로 묶는다.
 */
export function useMoodiDataReset() {
  const logout = useAuthStore((state) => state.logout)
  const resetActiveTheme = useThemeStore((state) => state.resetActiveTheme)
  const resetPreferences = useSettingsStore((state) => state.resetPreferences)

  return useCallback(() => {
    const results = [
      logout(),
      resetActiveTheme(),
      resetPreferences(),
      clearSidebarCollapsedPreference(),
    ]

    return results.every(Boolean)
  }, [logout, resetActiveTheme, resetPreferences])
}
