import { useSettingsStore } from '../stores/settingsStore'
import {
  AI_RESPONSE_LENGTH_OPTIONS,
  AI_TONE_OPTIONS,
  EXTERNAL_DATA_CONNECTION_OPTIONS,
  FONT_SIZE_OPTIONS,
} from '../types/settings'

/**
 * 설정 화면에 preference 상태, 선택지, 변경 action을 제공한다.
 */
export function useSettingsPreferences() {
  const preferences = useSettingsStore((state) => state.preferences)
  const persistenceError = useSettingsStore((state) => state.persistenceError)
  const setFontSize = useSettingsStore((state) => state.setFontSize)
  const setEntryLockEnabledByDefault = useSettingsStore(
    (state) => state.setEntryLockEnabledByDefault,
  )
  const setAiAnalysisEnabled = useSettingsStore(
    (state) => state.setAiAnalysisEnabled,
  )
  const setAiTone = useSettingsStore((state) => state.setAiTone)
  const setAiResponseLength = useSettingsStore(
    (state) => state.setAiResponseLength,
  )
  const setPersonalizedQuestionsEnabled = useSettingsStore(
    (state) => state.setPersonalizedQuestionsEnabled,
  )
  const clearPersistenceError = useSettingsStore(
    (state) => state.clearPersistenceError,
  )

  return {
    preferences,
    persistenceError,
    fontSizeOptions: FONT_SIZE_OPTIONS,
    aiToneOptions: AI_TONE_OPTIONS,
    aiResponseLengthOptions: AI_RESPONSE_LENGTH_OPTIONS,
    externalDataConnectionOptions: EXTERNAL_DATA_CONNECTION_OPTIONS,
    setFontSize,
    setEntryLockEnabledByDefault,
    setAiAnalysisEnabled,
    setAiTone,
    setAiResponseLength,
    setPersonalizedQuestionsEnabled,
    clearPersistenceError,
  }
}
