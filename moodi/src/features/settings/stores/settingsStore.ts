import { create } from 'zustand'
import {
  getSettingsPreferencesFromApi,
  resetSettingsPreferencesInApi,
  updateSettingsPreferencesInApi,
} from '../services/settingsApiService'
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
  status: 'idle' | 'loading' | 'ready' | 'error'
  initialize: () => Promise<void>
  setFontSize: (fontSize: FontSizePreference) => Promise<boolean>
  setEntryLockEnabledByDefault: (isEnabled: boolean) => Promise<boolean>
  setAiAnalysisEnabled: (isEnabled: boolean) => Promise<boolean>
  setAiTone: (aiTone: AiTonePreference) => Promise<boolean>
  setAiResponseLength: (responseLength: AiResponseLengthPreference) => Promise<boolean>
  setPersonalizedQuestionsEnabled: (isEnabled: boolean) => Promise<boolean>
  resetPreferences: () => Promise<boolean>
  clearPersistenceError: () => void
}

/**
 * 설정 preference의 source of truth와 localStorage 저장 action을 제공한다.
 */
export const useSettingsStore = create<SettingsStoreState>((set) => {
  const updatePreferences = async (patch: Partial<SettingsPreferences>): Promise<boolean> => {
    try {
      const preferences = await updateSettingsPreferencesInApi(patch)
      set({ preferences, persistenceError: null, status: 'ready' })

      return true
    } catch {
      set({ persistenceError: '서버에 설정을 저장하지 못했어요.' })

      return false
    }
  }

  return {
    preferences: { ...DEFAULT_SETTINGS_PREFERENCES },
    persistenceError: null,
    status: 'idle',
    initialize: async () => {
      set({ status: 'loading', persistenceError: null })

      try {
        const preferences = await getSettingsPreferencesFromApi()
        set({ preferences, status: 'ready', persistenceError: null })
      } catch {
        set({
          status: 'error',
          persistenceError: '서버에서 설정을 불러오지 못했어요.',
        })
      }
    },
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
    resetPreferences: async () => {
      try {
        await resetSettingsPreferencesInApi()
        set({
          preferences: { ...DEFAULT_SETTINGS_PREFERENCES },
          persistenceError: null,
          status: 'ready',
        })
        return true
      } catch {
        set({ persistenceError: '서버에서 저장된 설정을 초기화하지 못했어요.' })
        return false
      }
    },
    clearPersistenceError: () => set({ persistenceError: null }),
  }
})
