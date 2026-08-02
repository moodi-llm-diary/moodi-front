import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSystemThemePreference } from './themePreferenceService'

describe('getSystemThemePreference', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('브라우저가 다크 모드일 때 midnight theme을 반환한다', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    })

    expect(getSystemThemePreference()).toBe('midnight')
  })

  it('색상 모드 API가 없으면 안전하게 paper theme을 반환한다', () => {
    vi.stubGlobal('window', {})

    expect(getSystemThemePreference()).toBe('paper')
  })
})
