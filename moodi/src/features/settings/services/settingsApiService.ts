import { requestApi, requestJson } from '../../../shared/api/httpClient'
import type { SettingsPreferences } from '../types/settings'

type ApiSettingsDto = SettingsPreferences & { updatedAt: string }

/** settings API DTO를 feature의 preference contract로 변환하는 HTTP adapter다. */
export async function getSettingsPreferencesFromApi(): Promise<SettingsPreferences> {
  const response = await requestApi<ApiSettingsDto>('/api/v1/users/me/settings')
  return toSettingsPreferences(response.body)
}

export async function updateSettingsPreferencesInApi(
  patch: Partial<SettingsPreferences>,
): Promise<SettingsPreferences> {
  const response = await requestJson<ApiSettingsDto>('/api/v1/users/me/settings', patch, {
    method: 'PATCH',
    includeCsrfToken: true,
  })

  return toSettingsPreferences(response.body)
}

export async function resetSettingsPreferencesInApi(): Promise<void> {
  await requestApi<void>('/api/v1/users/me/settings', {
    method: 'DELETE',
    includeCsrfToken: true,
  })
}

function toSettingsPreferences(dto: ApiSettingsDto): SettingsPreferences {
  return {
    fontSize: dto.fontSize,
    isEntryLockEnabledByDefault: dto.isEntryLockEnabledByDefault,
    isAiAnalysisEnabled: dto.isAiAnalysisEnabled,
    aiTone: dto.aiTone,
    aiResponseLength: dto.aiResponseLength,
    isPersonalizedQuestionsEnabled: dto.isPersonalizedQuestionsEnabled,
  }
}
