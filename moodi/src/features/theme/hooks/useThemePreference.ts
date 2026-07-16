import { useThemeStore } from '../stores/themeStore'
import { THEME_OPTIONS } from '../types/theme'

/**
 * 전역 theme preference와 선택 action을 제공한다.
 */
export function useThemePreference() {
  const activeTheme = useThemeStore((state) => state.activeTheme)
  const setActiveTheme = useThemeStore((state) => state.setActiveTheme)

  return {
    activeTheme,
    setActiveTheme,
    themeOptions: THEME_OPTIONS,
  }
}
