import { isThemeName, type ThemeName } from '../types/theme'

export const THEME_STORAGE_KEY = 'moodi.mvp.theme.v1'
export const DEFAULT_THEME_NAME: ThemeName = 'paper'
export const SYSTEM_DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

const LEGACY_LIGHT_THEME_NAMES = new Set(['forest', 'rose', 'ocean'])

/**
 * MVP 단계의 테마 preference를 브라우저 저장소에서 로드한다.
 */
export function loadThemePreference(): ThemeName {
  try {
    const storedThemeName = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (storedThemeName && isThemeName(storedThemeName)) return storedThemeName

    // 이전의 다색 테마는 사용자 데이터를 지우지 않고 새 중립 라이트 테마로 수렴시킨다.
    return storedThemeName && LEGACY_LIGHT_THEME_NAMES.has(storedThemeName)
      ? 'paper'
      : DEFAULT_THEME_NAME
  } catch {
    return DEFAULT_THEME_NAME
  }
}

/**
 * 브라우저 또는 운영체제의 현재 색상 모드를 Moodi canonical theme으로 변환한다.
 * 이 값은 화면 표시용이며 사용자의 저장된 theme preference를 바꾸지 않는다.
 */
export function getSystemThemePreference(): ThemeName {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_THEME_NAME
  }

  return window.matchMedia(SYSTEM_DARK_COLOR_SCHEME_QUERY).matches ? 'midnight' : 'paper'
}

/**
 * MVP 단계의 테마 preference를 브라우저 저장소에 저장한다.
 */
export function persistThemePreference(themeName: ThemeName): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, themeName)
}

/** 저장된 테마 preference를 제거해 기본 테마로 돌아갈 준비를 한다. */
export function clearThemePreference(): void {
  window.localStorage.removeItem(THEME_STORAGE_KEY)
}
