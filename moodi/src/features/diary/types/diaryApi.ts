/** Backend wire contract. Domain과 UI model은 이 DTO를 직접 사용하지 않는다. */
export type ApiDiaryImageDto = {
  id: string
  contentUrl: string
  alt: string | null
  role: 'cover' | 'inline'
  createdAt: string
}

export type ApiDiaryEntryDto = {
  id: string
  type: 'journal' | 'quick'
  title: string | null
  content: string | null
  contentHtml: string | null
  shortNote: string | null
  createdAt: string
  updatedAt: string
  diaryDate: string
  mood: string | null
  energy: number | null
  activities: string[]
  tags: string[]
  aiTopics: string[]
  images: ApiDiaryImageDto[]
  weather: { condition: string | null; temperature: number | null } | null
  location: { name: string | null } | null
  isFavorite: boolean
  isLocked: boolean
  aiInsight: null
  revision: number
}

export type ApiDiaryEntrySummaryDto = Pick<
  ApiDiaryEntryDto,
  | 'id'
  | 'type'
  | 'title'
  | 'diaryDate'
  | 'updatedAt'
  | 'mood'
  | 'energy'
  | 'activities'
  | 'tags'
  | 'isFavorite'
  | 'isLocked'
  | 'revision'
> & {
  excerpt: string
  coverImage: ApiDiaryImageDto | null
}

export type ApiDiaryEntryDetailDto = {
  entry: ApiDiaryEntryDto
  relatedEntries: ApiDiaryEntrySummaryDto[]
  previousEntry: ApiDiaryEntrySummaryDto | null
  nextEntry: ApiDiaryEntrySummaryDto | null
}

export type ApiDiaryListResponse = {
  items: ApiDiaryEntrySummaryDto[]
  nextCursor: string | null
  hasNext: boolean
}

export type ApiDiaryDraftDto = Omit<
  ApiDiaryEntryDto,
  'createdAt' | 'updatedAt' | 'aiTopics' | 'aiInsight' | 'images'
> & {
  id: string
  entryId: string | null
  savedAt: string
  images: ApiDiaryImageDto[]
}

export type ApiDiaryDraftResponse = {
  draft: ApiDiaryDraftDto | null
}

export type ApiDiaryDataConfirmation = {
  etag: string
  confirmationToken: string
}

export type ApiDiaryImportResponse = {
  importedEntryCount: number
  clearedDraft: boolean
  clearedConversationCount: number
  completedAt: string
}
