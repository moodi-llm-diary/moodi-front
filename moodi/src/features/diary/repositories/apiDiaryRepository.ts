import {
  createIdempotencyKey,
  requestApi,
  requestJson,
} from '../../../shared/api/httpClient'
import { toApiRelativeUrl, toApiUrl } from '../../../shared/api/apiConfig'
import type { DiaryEntry, DiaryImage } from '../types/diaryDomain'
import type {
  CreateDiaryEntryInput,
  DiaryDraft,
  SaveDiaryDraftInput,
  UpdateDiaryEntryInput,
} from '../types/diaryInputs'
import type {
  ApiDiaryDataConfirmation,
  ApiDiaryDraftDto,
  ApiDiaryDraftResponse,
  ApiDiaryEntryDetailDto,
  ApiDiaryEntryDto,
  ApiDiaryEntrySummaryDto,
  ApiDiaryImportResponse,
  ApiDiaryListResponse,
} from '../types/diaryApi'
import type { DiaryRepository } from './DiaryRepository'

type DiaryWritePayload = {
  type?: DiaryEntry['type']
  diaryDate?: string
  title?: string | null
  content?: string | null
  contentHtml?: string | null
  shortNote?: string | null
  mood?: DiaryEntry['mood'] | null
  energy?: number | null
  activities?: DiaryEntry['activities']
  tags?: string[]
  imageIds?: string[]
  weather?: { condition: string | null; temperature: number | null } | null
  location?: { name: string | null } | null
  isFavorite?: boolean
  isLocked?: boolean
  shouldAnalyze?: boolean
}

/**
 * DiaryRepository의 HTTP 구현체다. UI/application model을 API DTO와 섞지 않고,
 * ETag·CSRF·idempotency는 이 infrastructure adapter 안에서만 처리한다.
 */
export class ApiDiaryRepository implements DiaryRepository {
  public readonly usesRemoteAnalysis = true
  private readonly entryEtags = new Map<string, string>()
  private draftEtag: string | null = null

  async getEntries(): Promise<DiaryEntry[]> {
    const summaries: ApiDiaryEntrySummaryDto[] = []
    let cursor: string | null = null

    do {
      const query = new URLSearchParams({ limit: '100' })
      if (cursor) query.set('cursor', cursor)
      const response = await requestApi<ApiDiaryListResponse>(`/api/v1/diary-entries?${query}`)

      summaries.push(...response.body.items)
      cursor = response.body.hasNext ? response.body.nextCursor : null
    } while (cursor)

    // 현재 UI의 검색·회고는 원문과 metadata 전체를 이용한다. 상세 endpoint를 통해
    // DTO를 보완해 domain state에 summary와 detail을 혼용하지 않는다.
    const entries = await Promise.all(summaries.map(async (summary) => {
      const entry = await this.getEntry(summary.id)
      if (!entry) throw new Error('목록에 있는 기록의 상세 정보를 불러오지 못했습니다.')
      return entry
    }))

    return entries
  }

  async getEntry(entryId: string): Promise<DiaryEntry | null> {
    try {
      const { entry } = await this.getEntryDetail(entryId)
      return entry
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async createEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry> {
    const response = await requestJson<ApiDiaryEntryDto>(
      '/api/v1/diary-entries',
      toCreatePayload(input),
      {
        method: 'POST',
        includeCsrfToken: true,
        idempotencyKey: createIdempotencyKey(),
      },
    )

    return this.rememberEntry(response.body, response.headers)
  }

  async updateEntry(entryId: string, input: UpdateDiaryEntryInput): Promise<DiaryEntry> {
    const { etag } = await this.getEntryDetail(entryId)
    const response = await requestJson<ApiDiaryEntryDto>(
      `/api/v1/diary-entries/${encodeURIComponent(entryId)}`,
      toUpdatePayload(input),
      {
        method: 'PATCH',
        headers: { 'If-Match': etag },
        includeCsrfToken: true,
      },
    )

    return this.rememberEntry(response.body, response.headers)
  }

  async deleteEntry(entryId: string): Promise<void> {
    const { etag } = await this.getEntryDetail(entryId)

    await requestApi<void>(`/api/v1/diary-entries/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
      headers: { 'If-Match': etag },
      includeCsrfToken: true,
    })
    this.entryEtags.delete(entryId)
  }

  async replaceEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]> {
    const confirmation = await this.getDataConfirmation()
    await requestJson<ApiDiaryImportResponse>(
      '/api/v1/diary-data',
      toLegacyImportEnvelope(entries),
      {
        method: 'PUT',
        headers: {
          'If-Match': confirmation.etag,
          'X-Data-Confirmation-Token': confirmation.confirmationToken,
        },
        includeCsrfToken: true,
        idempotencyKey: createIdempotencyKey(),
      },
    )

    this.entryEtags.clear()
    this.draftEtag = null
    return this.getEntries()
  }

  async getDraft(): Promise<DiaryDraft | null> {
    const response = await requestApi<ApiDiaryDraftResponse>('/api/v1/diary-draft')
    this.draftEtag = response.body.draft ? response.headers.get('ETag') : null

    return response.body.draft ? toDiaryDraft(response.body.draft) : null
  }

  async saveDraft(input: SaveDiaryDraftInput): Promise<DiaryDraft> {
    const existingDraft = await this.getDraft()
    const payload = toDraftPayload(input)
    const response = await requestJson<ApiDiaryDraftDto>('/api/v1/diary-draft', payload, {
      method: 'PUT',
      headers: this.draftEtag ? { 'If-Match': this.draftEtag } : undefined,
      includeCsrfToken: true,
    })

    void existingDraft
    this.draftEtag = response.headers.get('ETag')
    return toDiaryDraft(response.body)
  }

  async clearDraft(): Promise<void> {
    await this.getDraft()
    await requestApi<void>('/api/v1/diary-draft', {
      method: 'DELETE',
      headers: this.draftEtag ? { 'If-Match': this.draftEtag } : undefined,
      includeCsrfToken: true,
    })
    this.draftEtag = null
  }

  async deleteAllData(): Promise<void> {
    const confirmation = await this.getDataConfirmation()
    await requestApi<void>('/api/v1/diary-data', {
      method: 'DELETE',
      headers: {
        'If-Match': confirmation.etag,
        'X-Data-Confirmation-Token': confirmation.confirmationToken,
      },
      includeCsrfToken: true,
    })
    this.entryEtags.clear()
    this.draftEtag = null
  }

  private async getEntryDetail(entryId: string): Promise<{ entry: DiaryEntry; etag: string }> {
    const response = await requestApi<ApiDiaryEntryDetailDto>(
      `/api/v1/diary-entries/${encodeURIComponent(entryId)}`,
    )
    const etag = response.headers.get('ETag') ?? this.entryEtags.get(entryId)

    if (!etag) {
      throw new Error('기록의 최신 버전을 확인하지 못했습니다. 다시 불러온 뒤 시도해 주세요.')
    }

    const entry = this.rememberEntry(response.body.entry, response.headers)
    return { entry, etag }
  }

  private async getDataConfirmation(): Promise<ApiDiaryDataConfirmation> {
    const response = await requestApi<void>('/api/v1/diary-data', { method: 'HEAD' })
    const etag = response.headers.get('ETag')
    const confirmationToken = response.headers.get('X-Moodi-Data-Confirmation')

    if (!etag || !confirmationToken) {
      throw new Error('데이터 변경 확인 정보를 받지 못했습니다. 다시 시도해 주세요.')
    }

    return { etag, confirmationToken }
  }

  private rememberEntry(dto: ApiDiaryEntryDto, headers: Headers): DiaryEntry {
    const etag = headers.get('ETag')
    if (etag) this.entryEtags.set(dto.id, etag)

    return toDiaryEntry(dto)
  }
}

function toCreatePayload(input: CreateDiaryEntryInput): DiaryWritePayload {
  return {
    ...toWritePayload(input),
    type: input.type,
    diaryDate: input.diaryDate,
  }
}

function toUpdatePayload(input: UpdateDiaryEntryInput): DiaryWritePayload {
  return toWritePayload(input)
}

function toDraftPayload(input: SaveDiaryDraftInput): DiaryWritePayload & { id?: string; entryId?: string | null } {
  return {
    ...toWritePayload(input),
    id: input.id,
    entryId: input.entryId ?? null,
    type: input.type,
    diaryDate: input.diaryDate,
  }
}

function toWritePayload(
  input: CreateDiaryEntryInput | UpdateDiaryEntryInput | SaveDiaryDraftInput,
): DiaryWritePayload {
  const payload: DiaryWritePayload = {}

  if ('type' in input && input.type !== undefined) payload.type = input.type
  if ('diaryDate' in input && input.diaryDate !== undefined) payload.diaryDate = input.diaryDate
  if ('title' in input && input.title !== undefined) payload.title = input.title ?? null
  if ('content' in input && input.content !== undefined) payload.content = input.content ?? null
  if ('contentHtml' in input && input.contentHtml !== undefined) {
    payload.contentHtml = input.contentHtml ? normalizeHtmlForRequest(input.contentHtml) : null
  }
  if ('shortNote' in input && input.shortNote !== undefined) payload.shortNote = input.shortNote ?? null
  if ('mood' in input && input.mood !== undefined) payload.mood = input.mood ?? null
  if ('energy' in input && input.energy !== undefined) payload.energy = input.energy ?? null
  if ('activities' in input && input.activities !== undefined) payload.activities = input.activities
  if ('tags' in input && input.tags !== undefined) payload.tags = input.tags
  if ('images' in input && input.images !== undefined) payload.imageIds = input.images.map((image) => image.id)
  if ('weather' in input && input.weather !== undefined) {
    payload.weather = input.weather
      ? {
          condition: input.weather.condition ?? null,
          temperature: input.weather.temperature ?? null,
        }
      : null
  }
  if ('location' in input && input.location !== undefined) {
    payload.location = input.location ? { name: input.location.name ?? null } : null
  }
  if ('isFavorite' in input && input.isFavorite !== undefined) payload.isFavorite = input.isFavorite
  if ('isLocked' in input && input.isLocked !== undefined) payload.isLocked = input.isLocked
  if ('shouldAnalyze' in input && input.shouldAnalyze !== undefined) payload.shouldAnalyze = input.shouldAnalyze

  return payload
}

function toDiaryEntry(dto: ApiDiaryEntryDto): DiaryEntry {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title ?? undefined,
    content: dto.content ?? undefined,
    contentHtml: dto.contentHtml ? normalizeHtmlForDisplay(dto.contentHtml) : undefined,
    shortNote: dto.shortNote ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    diaryDate: dto.diaryDate,
    mood: dto.mood ? dto.mood as DiaryEntry['mood'] : undefined,
    energy: dto.energy ?? undefined,
    activities: dto.activities as DiaryEntry['activities'],
    tags: dto.tags,
    aiTopics: dto.aiTopics,
    images: dto.images.map(toDiaryImage),
    weather: dto.weather && (dto.weather.condition || dto.weather.temperature !== null)
      ? { condition: dto.weather.condition ?? undefined, temperature: dto.weather.temperature ?? undefined }
      : undefined,
    location: dto.location?.name ? { name: dto.location.name } : undefined,
    isFavorite: dto.isFavorite,
    isLocked: dto.isLocked,
  }
}

function toDiaryDraft(dto: ApiDiaryDraftDto): DiaryDraft {
  return {
    id: dto.id,
    entryId: dto.entryId ?? undefined,
    type: dto.type,
    diaryDate: dto.diaryDate,
    title: dto.title ?? '',
    content: dto.content ?? '',
    contentHtml: dto.contentHtml ? normalizeHtmlForDisplay(dto.contentHtml) : undefined,
    shortNote: dto.shortNote ?? '',
    mood: dto.mood ? dto.mood as DiaryEntry['mood'] : undefined,
    energy: dto.energy ?? undefined,
    activities: dto.activities as DiaryEntry['activities'],
    tags: dto.tags,
    images: dto.images.map(toDiaryImage),
    weather: dto.weather && (dto.weather.condition || dto.weather.temperature !== null)
      ? { condition: dto.weather.condition ?? undefined, temperature: dto.weather.temperature ?? undefined }
      : undefined,
    location: dto.location?.name ? { name: dto.location.name } : undefined,
    isFavorite: dto.isFavorite,
    isLocked: dto.isLocked,
    savedAt: dto.savedAt,
  }
}

function toDiaryImage(dto: { id: string; contentUrl: string; alt: string | null; role: 'cover' | 'inline' }): DiaryImage {
  return {
    id: dto.id,
    url: toApiUrl(dto.contentUrl),
    alt: dto.alt ?? undefined,
    role: dto.role,
  }
}

function toLegacyImportEnvelope(entries: DiaryEntry[]) {
  return {
    format: 'moodi-diary-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: entries.map((entry) => ({
      ...entry,
      contentHtml: entry.contentHtml ? normalizeHtmlForRequest(entry.contentHtml) : undefined,
      images: entry.images.map((image) => ({
        id: image.id,
        url: toApiRelativeUrl(image.url),
        alt: image.alt,
        role: image.role,
      })),
    })),
  }
}

function normalizeHtmlForDisplay(contentHtml: string): string {
  return contentHtml.replace(
    /(src=["'])\/(api\/v1\/diary-images\/[^"']+)/gi,
    (_match, prefix: string, path: string) => `${prefix}${toApiUrl(`/${path}`)}`,
  )
}

function normalizeHtmlForRequest(contentHtml: string): string {
  const apiOrigin = toApiUrl('/').replace(/\/$/, '')
  return apiOrigin ? contentHtml.replaceAll(apiOrigin, '') : contentHtml
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}
