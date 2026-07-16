import { create } from 'zustand'
import {
  clearSettingsPreferences,
  loadSettingsPreferences,
  persistSettingsPreferences,
} from '../services/settingsPreferenceService'
import {
  DEFAULT_SETTINGS_PREFERENCES,
  type AiResponseLengthPreference,
  type AiTonePreference,
  type FontSizePreference,
  type SettingsPreferences,
} from '../types/settings'

export type SettingsStoreState = {
  preferences: SettingsPreferences
  persistenceError: string | null
  setFontSize: (fontSize: FontSizePreference) => boolean
  setEntryLockEnabledByDefault: (isEnabled: boolean) => boolean
  setAiAnalysisEnabled: (isEnabled: boolean) => boolean
  setAiTone: (aiTone: AiTonePreference) => boolean
  setAiResponseLength: (responseLength: AiResponseLengthPreference) => boolean
  setPersonalizedQuestionsEnabled: (isEnabled: boolean) => boolean
  resetPreferences: () => boolean
  clearPersistenceError: () => void
}

/**
 * 설정 preference의 source of truth와 localStorage 저장 action을 제공한다.
 */
export const useSettingsStore = create<SettingsStoreState>((set, get) => {
  const updatePreferences = (patch: Partial<SettingsPreferences>): boolean => {
    const nextPreferences: SettingsPreferences = {
      ...get().preferences,
      ...patch,
    }

    try {
      persistSettingsPreferences(nextPreferences)
      set({ preferences: nextPreferences, persistenceError: null })

      return true
    } catch {
      set({ persistenceError: '브라우저에 설정을 저장하지 못했어요.' })

      return false
    }
  }

  return {
    preferences: loadSettingsPreferences(),
    persistenceError: null,
    setFontSize: (fontSize) => updatePreferences({ fontSize }),
    setEntryLockEnabledByDefault: (isEntryLockEnabledByDefault) =>
      updatePreferences({ isEntryLockEnabledByDefault }),
    setAiAnalysisEnabled: (isAiAnalysisEnabled) =>
      updatePreferences({ isAiAnalysisEnabled }),
    setAiTone: (aiTone) => updatePreferences({ aiTone }),
    setAiResponseLength: (aiResponseLength) =>
      updatePreferences({ aiResponseLength }),
    setPersonalizedQuestionsEnabled: (isPersonalizedQuestionsEnabled) =>
      updatePreferences({ isPersonalizedQuestionsEnabled }),
    resetPreferences: () => {
      let didClear = true

      try {
        clearSettingsPreferences()
      } catch {
        didClear = false
      }

      set({
        preferences: { ...DEFAULT_SETTINGS_PREFERENCES },
        persistenceError: didClear ? null : '브라우저에서 저장된 설정을 삭제하지 못했어요.',
      })

      return didClear
    },
    clearPersistenceError: () => set({ persistenceError: null }),
  }
})
