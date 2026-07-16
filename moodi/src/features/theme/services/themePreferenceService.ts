import { isThemeName, type ThemeName } from '../types/theme'

export const THEME_STORAGE_KEY = 'moodi.mvp.theme.v1'
export const DEFAULT_THEME_NAME: ThemeName = 'paper'

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
 * MVP 단계의 테마 preference를 브라우저 저장소에 저장한다.
 */
export function persistThemePreference(themeName: ThemeName): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, themeName)
}

/** 저장된 테마 preference를 제거해 기본 테마로 돌아갈 준비를 한다. */
export function clearThemePreference(): void {
  window.localStorage.removeItem(THEME_STORAGE_KEY)
}
