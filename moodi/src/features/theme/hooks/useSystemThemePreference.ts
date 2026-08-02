import { useEffect, useState } from 'react'
import {
  getSystemThemePreference,
  SYSTEM_DARK_COLOR_SCHEME_QUERY,
} from '../services/themePreferenceService'
import type { ThemeName } from '../types/theme'

/**
 * 브라우저/운영체제의 색상 모드 변경을 구독해 화면 표시용 theme을 제공한다.
 */
export function useSystemThemePreference(): ThemeName {
  const [systemTheme, setSystemTheme] = useState(getSystemThemePreference)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(SYSTEM_DARK_COLOR_SCHEME_QUERY)
    const syncSystemTheme = () => setSystemTheme(getSystemThemePreference())

    mediaQuery.addEventListener('change', syncSystemTheme)

    return () => mediaQuery.removeEventListener('change', syncSystemTheme)
  }, [])

  return systemTheme
}
