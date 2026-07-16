import { create } from 'zustand'
import {
  clearThemePreference,
  DEFAULT_THEME_NAME,
  loadThemePreference,
  persistThemePreference,
} from '../services/themePreferenceService'
import type { ThemeName } from '../types/theme'

type ThemeStoreState = {
  activeTheme: ThemeName
  setActiveTheme: (themeName: ThemeName) => boolean
  resetActiveTheme: () => boolean
}

/**
 * 앱 전역 theme preference를 소유한다.
 */
export const useThemeStore = create<ThemeStoreState>((set) => ({
  activeTheme: loadThemePreference(),
  setActiveTheme: (themeName) => {
    try {
      persistThemePreference(themeName)
      set({ activeTheme: themeName })
      return true
    } catch {
      return false
    }
  },
  resetActiveTheme: () => {
    let didClear = true

    try {
      clearThemePreference()
    } catch {
      didClear = false
    }

    set({ activeTheme: DEFAULT_THEME_NAME })
    return didClear
  },
}))
