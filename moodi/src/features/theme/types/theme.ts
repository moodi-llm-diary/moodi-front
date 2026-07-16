export type ThemeName = 'paper' | 'midnight'

export type ThemeOption = {
  name: ThemeName
  label: string
  description: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    name: 'paper',
    label: '라이트',
    description: '차분한 중립색과 Moodi 포인트',
  },
  {
    name: 'midnight',
    label: '다크',
    description: '눈부심을 낮춘 중립색 기록 모드',
  },
]

export function isThemeName(value: string): value is ThemeName {
  return THEME_OPTIONS.some((themeOption) => themeOption.name === value)
}
