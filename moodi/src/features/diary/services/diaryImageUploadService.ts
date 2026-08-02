import {
  createIdempotencyKey,
  requestApi,
} from '../../../shared/api/httpClient'
import { toApiUrl } from '../../../shared/api/apiConfig'
import type { DiaryImage, DiaryImageRole } from '../types/diaryDomain'
import type { ApiDiaryImageDto } from '../types/diaryApi'

/**
 * 이미지의 File/FormData 전송은 editor가 아닌 service boundary에서 수행한다.
 * 응답의 content URL만 form state에 돌려줘 이후 draft와 entry request는 image ID를 쓴다.
 */
export async function uploadDiaryImage(
  file: File,
  role: DiaryImageRole,
  alt: string,
): Promise<DiaryImage> {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('role', role)
  formData.set('alt', alt)

  const response = await requestApi<ApiDiaryImageDto>('/api/v1/diary-images', {
    method: 'POST',
    body: formData,
    includeCsrfToken: true,
    idempotencyKey: createIdempotencyKey(),
  })

  return {
    id: response.body.id,
    url: toApiUrl(response.body.contentUrl),
    alt: response.body.alt ?? undefined,
    role: response.body.role,
  }
}
