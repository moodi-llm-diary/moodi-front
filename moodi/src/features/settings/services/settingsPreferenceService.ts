import {
  AI_RESPONSE_LENGTH_OPTIONS,
  AI_TONE_OPTIONS,
  DEFAULT_SETTINGS_PREFERENCES,
  FONT_SIZE_OPTIONS,
} from '../types/settings'
import type { SettingsPreferences } from '../types/settings'

export const SETTINGS_PREFERENCES_STORAGE_KEY = 'moodi.settings.preferences.v1'

type StoredSettingsPreferences = {
  version: 1
  preferences: SettingsPreferences
}

/**
 * 브라우저에 저장된 사용자 설정을 읽고 유효하지 않은 값은 기본값으로 복구한다.
 */
export function loadSettingsPreferences(): SettingsPreferences {
  try {
    const storage = getBrowserStorage()
    const storedValue = storage?.getItem(SETTINGS_PREFERENCES_STORAGE_KEY)

    if (!storedValue) {
      return { ...DEFAULT_SETTINGS_PREFERENCES }
    }

    const parsedValue: unknown = JSON.parse(storedValue)

    if (!isStoredSettingsPreferences(parsedValue)) {
      return { ...DEFAULT_SETTINGS_PREFERENCES }
    }

    return normalizeSettingsPreferences(parsedValue.preferences)
  } catch {
    return { ...DEFAULT_SETTINGS_PREFERENCES }
  }
}

/**
 * 사용자 설정을 버전이 명시된 localStorage 계약으로 저장한다.
 */
export function persistSettingsPreferences(preferences: SettingsPreferences): void {
  const storage = getBrowserStorage()

  if (!storage) {
    return
  }

  const storedSettings: StoredSettingsPreferences = {
    version: 1,
    preferences,
  }

  storage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(storedSettings))
}

/** 전체 데이터 삭제 시 저장된 preference envelope을 제거한다. */
export function clearSettingsPreferences(): void {
  getBrowserStorage()?.removeItem(SETTINGS_PREFERENCES_STORAGE_KEY)
}

function normalizeSettingsPreferences(
  preferences: SettingsPreferences,
): SettingsPreferences {
  return {
    fontSize: FONT_SIZE_OPTIONS.some((option) => option.value === preferences.fontSize)
      ? preferences.fontSize
      : DEFAULT_SETTINGS_PREFERENCES.fontSize,
    isEntryLockEnabledByDefault:
      typeof preferences.isEntryLockEnabledByDefault === 'boolean'
        ? preferences.isEntryLockEnabledByDefault
        : DEFAULT_SETTINGS_PREFERENCES.isEntryLockEnabledByDefault,
    isAiAnalysisEnabled:
      typeof preferences.isAiAnalysisEnabled === 'boolean'
        ? preferences.isAiAnalysisEnabled
        : DEFAULT_SETTINGS_PREFERENCES.isAiAnalysisEnabled,
    aiTone: AI_TONE_OPTIONS.some((option) => option.value === preferences.aiTone)
      ? preferences.aiTone
      : DEFAULT_SETTINGS_PREFERENCES.aiTone,
    aiResponseLength: AI_RESPONSE_LENGTH_OPTIONS.some(
      (option) => option.value === preferences.aiResponseLength,
    )
      ? preferences.aiResponseLength
      : DEFAULT_SETTINGS_PREFERENCES.aiResponseLength,
    isPersonalizedQuestionsEnabled:
      typeof preferences.isPersonalizedQuestionsEnabled === 'boolean'
        ? preferences.isPersonalizedQuestionsEnabled
        : DEFAULT_SETTINGS_PREFERENCES.isPersonalizedQuestionsEnabled,
  }
}

function isStoredSettingsPreferences(value: unknown): value is StoredSettingsPreferences {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.preferences)) {
    return false
  }

  const preferences = value.preferences

  return (
    typeof preferences.fontSize === 'string' &&
    typeof preferences.isEntryLockEnabledByDefault === 'boolean' &&
    typeof preferences.isAiAnalysisEnabled === 'boolean' &&
    typeof preferences.aiTone === 'string' &&
    typeof preferences.aiResponseLength === 'string' &&
    typeof preferences.isPersonalizedQuestionsEnabled === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}
