import { createDiarySeedEntries } from '../data/diarySeed'
import {
  ACTIVITIES,
  ENTRY_TYPES,
  isActivity,
  isEntryType,
  isMood,
  type Activity,
  type AIInsight,
  type DiaryEntry,
  type DiaryImage,
  type EntryType,
  type LocationContext,
  type Mood,
  type WeatherContext,
} from '../types/diaryDomain'
import type {
  CreateDiaryEntryInput,
  DiaryDraft,
  SaveDiaryDraftInput,
  UpdateDiaryEntryInput,
} from '../types/diaryInputs'
import {
  DiaryRepositoryError,
  type DiaryRepository,
} from './DiaryRepository'

/** 현재 persistence envelope schema version이다. */
export const DIARY_STORAGE_SCHEMA_VERSION = 2 as const
/** canonical DiaryEntry envelope을 저장하는 key다. */
export const DIARY_STORAGE_KEY = 'moodi.diary.entries.v2'
/** 한국어 Mood와 body/date 필드를 사용한 구 MVP key다. */
export const LEGACY_DIARY_STORAGE_KEY = 'moodi.mvp.diary.entries.v1'
/** 작성 중인 단일 활성 초안을 저장하는 별도 key다. */
export const DIARY_DRAFT_STORAGE_KEY = 'moodi.diary.draft.v1'
const DIARY_STORAGE_WRITE_LOCK = 'moodi.diary.storage.write.v1'
const MAX_DIARY_IMAGE_COUNT = 3
const MAX_DIARY_IMAGE_BYTES = 350 * 1024
const BASE64_IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/]*={0,2})$/i

type StoredDiaryEntryV2 = {
  id: string
  type: EntryType
  title?: string
  content?: string
  contentHtml?: string
  shortNote?: string
  createdAt: string
  updatedAt: string
  diaryDate: string
  mood?: Mood
  energy?: number
  activities: Activity[]
  tags: string[]
  aiTopics: string[]
  images: DiaryImage[]
  weather?: WeatherContext
  location?: LocationContext
  isFavorite: boolean
  isLocked: boolean
  aiInsight?: AIInsight
}

type DiaryStorageEnvelopeV2 = {
  schemaVersion: typeof DIARY_STORAGE_SCHEMA_VERSION
  entries: StoredDiaryEntryV2[]
}

type StoredDiaryDraftV1 = DiaryDraft

type DiaryDraftEnvelopeV1 = {
  schemaVersion: 1
  draft: StoredDiaryDraftV1
}

/** localStorage adapter의 시간·id·seed 의존성을 테스트에서 교체하는 옵션이다. */
export interface LocalStorageDiaryRepositoryOptions {
  storage?: Storage
  now?: () => Date
  createId?: () => string
  createSeedEntries?: (referenceDate: Date) => DiaryEntry[]
}

const LEGACY_MOOD_MAP: Record<string, Mood> = {
  '몽글해요': 'calm',
  '괜찮아요': 'neutral',
  '지쳤어요': 'tired',
  '설레요': 'excited',
  '복잡해요': 'frustrated',
  '울적해요': 'sad',
}

const MOOD_LABELS: Record<Mood, string> = {
  happy: '행복',
  calm: '편안함',
  excited: '설렘',
  neutral: '무난함',
  tired: '피곤함',
  anxious: '불안함',
  frustrated: '답답함',
  sad: '슬픔',
  angry: '화남',
}

/**
 * localStorage persistence entity를 domain model로 변환하는 mock Repository다.
 * 빈 배열은 삭제 후의 유효한 상태로 보존하며 key가 전혀 없을 때만 seed를 만든다.
 */
export class LocalStorageDiaryRepository implements DiaryRepository {
  private readonly configuredStorage?: Storage
  private readonly now: () => Date
  private readonly createId: () => string
  private readonly createSeedEntries: (referenceDate: Date) => DiaryEntry[]
  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(options: LocalStorageDiaryRepositoryOptions = {}) {
    this.configuredStorage = options.storage
    this.now = options.now ?? (() => new Date())
    this.createId = options.createId ?? createDiaryId
    this.createSeedEntries = options.createSeedEntries ?? createDiarySeedEntries
  }

  async getEntries(): Promise<DiaryEntry[]> {
    const storage = this.getStorage()
    const currentValue = this.readItem(storage, DIARY_STORAGE_KEY)

    if (currentValue !== null) {
      return parseCurrentEnvelope(currentValue)
    }

    return this.runExclusive(async () => this.loadOrInitializeEntries(storage))
  }

  private loadOrInitializeEntries(storage: Storage): DiaryEntry[] {
    const currentValue = this.readItem(storage, DIARY_STORAGE_KEY)

    if (currentValue !== null) {
      return parseCurrentEnvelope(currentValue)
    }

    const legacyValue = this.readItem(storage, LEGACY_DIARY_STORAGE_KEY)

    if (legacyValue !== null) {
      const migratedEntries = migrateLegacyDiaryEntries(
        parseJson(legacyValue, LEGACY_DIARY_STORAGE_KEY),
        this.now(),
        this.createId,
      )

      this.persistEntries(storage, migratedEntries)

      return cloneEntries(migratedEntries)
    }

    const seededEntries = this.createSeedEntries(this.now())
    this.persistEntries(storage, seededEntries)

    return cloneEntries(seededEntries)
  }

  async getEntry(entryId: string): Promise<DiaryEntry | null> {
    const entries = await this.getEntries()

    return entries.find((entry) => entry.id === entryId) ?? null
  }

  async createEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry> {
    return this.runExclusive(async () => {
      validateCreateInput(input)

      const entries = this.loadOrInitializeEntries(this.getStorage())
      const timestamp = this.now().toISOString()
      const createdEntry: DiaryEntry = normalizeDomainEntry({
        id: this.createId(),
        type: input.type,
        title: normalizeOptionalText(input.title),
        content: normalizeOptionalText(input.content),
        contentHtml: normalizeOptionalHtml(input.contentHtml),
        shortNote: normalizeOptionalText(input.shortNote),
        createdAt: timestamp,
        updatedAt: timestamp,
        diaryDate: input.diaryDate,
        mood: input.mood,
        energy: normalizeEnergy(input.energy),
        activities: normalizeActivities(input.activities),
        tags: normalizeStringArray(input.tags),
        aiTopics: normalizeStringArray(input.aiTopics),
        images: normalizeImages(input.images),
        weather: normalizeWeather(input.weather),
        location: normalizeLocation(input.location),
        isFavorite: input.isFavorite ?? false,
        isLocked: input.isLocked ?? false,
        aiInsight: input.aiInsight ? normalizeAIInsight(input.aiInsight) : undefined,
      })
      const nextEntries = [createdEntry, ...entries]

      this.persistEntries(this.getStorage(), nextEntries)

      return cloneEntry(createdEntry)
    })
  }

  async updateEntry(
    entryId: string,
    input: UpdateDiaryEntryInput,
  ): Promise<DiaryEntry> {
    return this.runExclusive(async () => {
      const entries = this.loadOrInitializeEntries(this.getStorage())
      const entryIndex = entries.findIndex((entry) => entry.id === entryId)

      if (entryIndex < 0) {
        throw new DiaryRepositoryError(
          'NOT_FOUND',
          '수정할 일기 기록을 찾을 수 없습니다.',
        )
      }

      const currentEntry = entries[entryIndex]
      const updatedEntry = normalizeDomainEntry({
        ...currentEntry,
        ...pickDefinedUpdateFields(input),
        updatedAt: this.now().toISOString(),
      })

      validateEntryContent(
        updatedEntry.type,
        updatedEntry.content,
        updatedEntry.shortNote,
        updatedEntry.mood,
        updatedEntry.activities,
      )

      const nextEntries = entries.map((entry) =>
        entry.id === entryId ? updatedEntry : entry,
      )

      this.persistEntries(this.getStorage(), nextEntries)

      return cloneEntry(updatedEntry)
    })
  }

  async deleteEntry(entryId: string): Promise<void> {
    return this.runExclusive(async () => {
      const entries = this.loadOrInitializeEntries(this.getStorage())

      if (!entries.some((entry) => entry.id === entryId)) {
        throw new DiaryRepositoryError(
          'NOT_FOUND',
          '삭제할 일기 기록을 찾을 수 없습니다.',
        )
      }

      this.persistEntries(
        this.getStorage(),
        entries.filter((entry) => entry.id !== entryId),
      )
    })
  }

  async replaceEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]> {
    return this.runExclusive(async () => {
      const normalizedEntries = entries.map(normalizeDomainEntry)

      normalizedEntries.forEach((entry) =>
        validateEntryContent(
          entry.type,
          entry.content,
          entry.shortNote,
          entry.mood,
          entry.activities,
        ),
      )
      requireUniqueEntryIds(normalizedEntries, '가져온 기록에 중복된 id가 있습니다.')

      this.persistEntries(this.getStorage(), normalizedEntries)

      return cloneEntries(normalizedEntries)
    })
  }

  async getDraft(): Promise<DiaryDraft | null> {
    const rawValue = this.readItem(this.getStorage(), DIARY_DRAFT_STORAGE_KEY)

    if (rawValue === null) {
      return null
    }

    const parsedValue = parseJson(rawValue, DIARY_DRAFT_STORAGE_KEY)
    const envelope = requireRecord(parsedValue, DIARY_DRAFT_STORAGE_KEY)

    if (envelope.schemaVersion !== 1 || !('draft' in envelope)) {
      throw corruptDataError(DIARY_DRAFT_STORAGE_KEY)
    }

    return normalizeStoredDraft(envelope.draft)
  }

  async saveDraft(input: SaveDiaryDraftInput): Promise<DiaryDraft> {
    return this.runExclusive(async () => {
      const draft: DiaryDraft = {
        id: input.id?.trim() || this.createId(),
        entryId: normalizeOptionalText(input.entryId),
        type: isEntryType(input.type) ? input.type : 'journal',
        diaryDate: requireDateKey(input.diaryDate, '초안 날짜'),
        title: input.title.trim(),
        content: input.content,
        contentHtml: normalizeOptionalHtml(input.contentHtml) ?? '',
        shortNote: input.shortNote,
        mood: input.mood,
        energy: normalizeEnergy(input.energy),
        activities: normalizeActivities(input.activities),
        tags: normalizeStringArray(input.tags),
        images: normalizeImages(input.images),
        weather: normalizeWeather(input.weather),
        location: normalizeLocation(input.location),
        isFavorite: input.isFavorite,
        isLocked: input.isLocked,
        savedAt: this.now().toISOString(),
      }
      const envelope: DiaryDraftEnvelopeV1 = {
        schemaVersion: 1,
        draft,
      }

      this.writeItem(
        this.getStorage(),
        DIARY_DRAFT_STORAGE_KEY,
        JSON.stringify(envelope),
      )

      return cloneDraft(draft)
    })
  }

  async clearDraft(): Promise<void> {
    return this.runExclusive(async () => {
      this.removeItem(this.getStorage(), DIARY_DRAFT_STORAGE_KEY)
    })
  }

  async deleteAllData(): Promise<void> {
    return this.runExclusive(async () => {
      const storage = this.getStorage()
      const draftSnapshot = this.readItem(storage, DIARY_DRAFT_STORAGE_KEY)
      const legacySnapshot = this.readItem(storage, LEGACY_DIARY_STORAGE_KEY)

      try {
        this.removeItem(storage, DIARY_DRAFT_STORAGE_KEY)
        this.removeItem(storage, LEGACY_DIARY_STORAGE_KEY)
        this.persistEntries(storage, [])
      } catch (error) {
        this.restoreItem(storage, DIARY_DRAFT_STORAGE_KEY, draftSnapshot)
        this.restoreItem(storage, LEGACY_DIARY_STORAGE_KEY, legacySnapshot)
        throw error
      }
    })
  }

  private runExclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(DIARY_STORAGE_WRITE_LOCK, operation)
    }

    const pendingResult = this.mutationQueue.then(operation, operation)

    this.mutationQueue = pendingResult.then(
      () => undefined,
      () => undefined,
    )

    return pendingResult
  }

  private persistEntries(storage: Storage, entries: DiaryEntry[]): void {
    const envelope: DiaryStorageEnvelopeV2 = {
      schemaVersion: DIARY_STORAGE_SCHEMA_VERSION,
      entries: entries.map(toStoredEntry),
    }

    this.writeItem(storage, DIARY_STORAGE_KEY, JSON.stringify(envelope))
  }

  private restoreItem(storage: Storage, key: string, value: string | null): void {
    if (value === null) {
      this.removeItem(storage, key)
      return
    }

    this.writeItem(storage, key, value)
  }

  private getStorage(): Storage {
    if (this.configuredStorage) {
      return this.configuredStorage
    }

    if (typeof window === 'undefined') {
      throw new DiaryRepositoryError(
        'STORAGE_UNAVAILABLE',
        '이 환경에서는 일기 저장소를 사용할 수 없습니다.',
      )
    }

    try {
      return window.localStorage
    } catch (error) {
      throw new DiaryRepositoryError(
        'STORAGE_UNAVAILABLE',
        '브라우저의 일기 저장소에 접근할 수 없습니다.',
        { cause: error },
      )
    }
  }

  private readItem(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key)
    } catch (error) {
      throw new DiaryRepositoryError(
        'STORAGE_UNAVAILABLE',
        '저장된 일기를 읽을 수 없습니다.',
        { cause: error },
      )
    }
  }

  private writeItem(storage: Storage, key: string, value: string): void {
    try {
      storage.setItem(key, value)
    } catch (error) {
      throw new DiaryRepositoryError(
        'WRITE_FAILED',
        '일기를 브라우저 저장소에 저장하지 못했습니다.',
        { cause: error },
      )
    }
  }

  private removeItem(storage: Storage, key: string): void {
    try {
      storage.removeItem(key)
    } catch (error) {
      throw new DiaryRepositoryError(
        'WRITE_FAILED',
        '브라우저 저장소의 데이터를 정리하지 못했습니다.',
        { cause: error },
      )
    }
  }
}

/**
 * v1 배열을 canonical v2 domain model로 비파괴 변환한다.
 * 기존 regex tag는 사용자 tag가 아니라 aiTopics로 이동하고 score는 energy로 오인하지 않는다.
 */
export function migrateLegacyDiaryEntries(
  legacyValue: unknown,
  referenceDate = new Date(),
  createId: () => string = createDiaryId,
): DiaryEntry[] {
  if (!Array.isArray(legacyValue)) {
    throw corruptDataError(LEGACY_DIARY_STORAGE_KEY)
  }

  const usedIds = new Set<string>()
  const fallbackTimestamp = referenceDate.toISOString()

  return legacyValue.map((rawEntry, index) => {
    const entry = requireRecord(rawEntry, `${LEGACY_DIARY_STORAGE_KEY}[${index}]`)
    const requestedId = typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : createId()
    const id = usedIds.has(requestedId) ? createId() : requestedId
    usedIds.add(id)

    const legacyMood = typeof entry.mood === 'string'
      ? LEGACY_MOOD_MAP[entry.mood] ?? (isMood(entry.mood) ? entry.mood : undefined)
      : undefined
    const diaryDate = readLegacyDate(entry, referenceDate)
    const content = readOptionalString(entry.body) ?? readOptionalString(entry.text)
    const legacyTopics = normalizeStringArray(entry.tags)
    const legacyLine = normalizeOptionalText(readOptionalString(entry.line))
    const legacySummary = normalizeOptionalText(readOptionalString(entry.summary))
    const updatedAt = readTimestamp(entry.updatedAt, fallbackTimestamp)
    const createdAt = readTimestamp(entry.createdAt, updatedAt)
    const insightSummary = legacyLine ?? legacySummary
    const aiInsight: AIInsight | undefined =
      insightSummary || legacyTopics.length > 0 || legacyMood
        ? {
            summary: insightSummary,
            emotions: legacyMood ? [MOOD_LABELS[legacyMood]] : [],
            topics: legacyTopics,
            patterns: [],
            followUpQuestions: [],
            relatedEntryIds: [],
            source: 'local-rule-mock',
            generatedAt: updatedAt,
          }
        : undefined

    return normalizeDomainEntry({
      id,
      type: 'journal',
      title: normalizeOptionalText(readOptionalString(entry.title)),
      content,
      createdAt,
      updatedAt,
      diaryDate,
      mood: legacyMood,
      activities: [],
      tags: [],
      aiTopics: legacyTopics,
      images: [],
      isFavorite: false,
      isLocked: false,
      aiInsight,
    })
  })
}

function parseCurrentEnvelope(rawValue: string): DiaryEntry[] {
  const parsedValue = parseJson(rawValue, DIARY_STORAGE_KEY)
  const envelope = requireRecord(parsedValue, DIARY_STORAGE_KEY)

  if (
    envelope.schemaVersion !== DIARY_STORAGE_SCHEMA_VERSION ||
    !Array.isArray(envelope.entries)
  ) {
    throw corruptDataError(DIARY_STORAGE_KEY)
  }

  const normalizedEntries = envelope.entries.map((entry, index) =>
    normalizeStoredEntry(entry, `${DIARY_STORAGE_KEY}.entries[${index}]`),
  )

  requireUniqueEntryIds(
    normalizedEntries,
    `${DIARY_STORAGE_KEY}에 중복된 기록 id가 있어 자동으로 덮어쓰지 않았습니다.`,
    'CORRUPT_DATA',
  )

  return normalizedEntries
}

function normalizeStoredEntry(value: unknown, path: string): DiaryEntry {
  const entry = requireRecord(value, path)

  return normalizeDomainEntry({
    id: requireString(entry.id, `${path}.id`),
    type: requireEntryType(entry.type, `${path}.type`),
    title: readOptionalString(entry.title),
    content: readOptionalString(entry.content),
    contentHtml: readOptionalString(entry.contentHtml),
    shortNote: readOptionalString(entry.shortNote),
    createdAt: requireTimestamp(entry.createdAt, `${path}.createdAt`),
    updatedAt: requireTimestamp(entry.updatedAt, `${path}.updatedAt`),
    diaryDate: requireDateKey(entry.diaryDate, `${path}.diaryDate`),
    mood: readOptionalMood(entry.mood, `${path}.mood`),
    energy: normalizeEnergy(entry.energy),
    activities: requireActivities(entry.activities, `${path}.activities`),
    tags: requireStringArray(entry.tags, `${path}.tags`),
    aiTopics: requireStringArray(entry.aiTopics, `${path}.aiTopics`),
    images: requireImages(entry.images, `${path}.images`),
    weather: readOptionalWeather(entry.weather, `${path}.weather`),
    location: readOptionalLocation(entry.location, `${path}.location`),
    isFavorite: requireBoolean(entry.isFavorite, `${path}.isFavorite`),
    isLocked: requireBoolean(entry.isLocked, `${path}.isLocked`),
    aiInsight: readOptionalAIInsight(entry.aiInsight, `${path}.aiInsight`),
  })
}

function normalizeDomainEntry(entry: DiaryEntry): DiaryEntry {
  const normalizedEntry: DiaryEntry = {
    id: requireString(entry.id, 'DiaryEntry.id'),
    type: requireEntryType(entry.type, 'DiaryEntry.type'),
    title: normalizeOptionalText(entry.title),
    content: normalizeOptionalText(entry.content),
    contentHtml: normalizeOptionalHtml(entry.contentHtml),
    shortNote: normalizeOptionalText(entry.shortNote),
    createdAt: requireTimestamp(entry.createdAt, 'DiaryEntry.createdAt'),
    updatedAt: requireTimestamp(entry.updatedAt, 'DiaryEntry.updatedAt'),
    diaryDate: requireDateKey(entry.diaryDate, 'DiaryEntry.diaryDate'),
    mood: readOptionalMood(entry.mood, 'DiaryEntry.mood'),
    energy: normalizeEnergy(entry.energy),
    activities: normalizeActivities(entry.activities),
    tags: normalizeStringArray(entry.tags),
    aiTopics: normalizeStringArray(entry.aiTopics),
    images: normalizeImages(entry.images),
    weather: normalizeWeather(entry.weather),
    location: normalizeLocation(entry.location),
    isFavorite: requireBoolean(entry.isFavorite, 'DiaryEntry.isFavorite'),
    isLocked: requireBoolean(entry.isLocked, 'DiaryEntry.isLocked'),
    aiInsight: entry.aiInsight ? normalizeAIInsight(entry.aiInsight) : undefined,
  }

  return stripUndefinedFields(normalizedEntry)
}

function toStoredEntry(entry: DiaryEntry): StoredDiaryEntryV2 {
  return { ...cloneEntry(normalizeDomainEntry(entry)) }
}

function pickDefinedUpdateFields(input: UpdateDiaryEntryInput): Partial<DiaryEntry> {
  const fields: Partial<DiaryEntry> = {}

  if (hasOwn(input, 'type')) fields.type = input.type
  if (hasOwn(input, 'diaryDate')) fields.diaryDate = input.diaryDate
  if (hasOwn(input, 'title')) fields.title = input.title
  if (hasOwn(input, 'content')) fields.content = input.content
  if (hasOwn(input, 'contentHtml')) fields.contentHtml = input.contentHtml
  if (hasOwn(input, 'shortNote')) fields.shortNote = input.shortNote
  if (hasOwn(input, 'mood')) fields.mood = input.mood
  if (hasOwn(input, 'energy')) fields.energy = input.energy
  if (hasOwn(input, 'activities')) fields.activities = input.activities
  if (hasOwn(input, 'tags')) fields.tags = input.tags
  if (hasOwn(input, 'images')) fields.images = input.images
  if (hasOwn(input, 'weather')) fields.weather = input.weather
  if (hasOwn(input, 'location')) fields.location = input.location
  if (hasOwn(input, 'isFavorite')) fields.isFavorite = input.isFavorite
  if (hasOwn(input, 'isLocked')) fields.isLocked = input.isLocked
  if (hasOwn(input, 'aiInsight')) fields.aiInsight = input.aiInsight ?? undefined
  if (hasOwn(input, 'aiTopics')) fields.aiTopics = input.aiTopics

  return fields
}

function hasOwn<ObjectType extends object>(
  value: ObjectType,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function validateCreateInput(input: CreateDiaryEntryInput): void {
  if (!isEntryType(input.type)) {
    throw invalidDataError('지원하지 않는 기록 타입입니다.')
  }

  requireDateKey(input.diaryDate, '기록 날짜')
  validateEntryContent(input.type, input.content, input.shortNote, input.mood, input.activities ?? [])
}

function validateEntryContent(
  type: EntryType,
  content: string | undefined,
  shortNote: string | undefined,
  mood: Mood | undefined,
  activities: Activity[],
): void {
  if (type === 'journal' && !content?.trim()) {
    throw invalidDataError('긴 일기에는 본문이 필요합니다.')
  }

  if (type === 'quick' && !shortNote?.trim() && !mood && activities.length === 0) {
    throw invalidDataError('빠른 기록에는 감정, 활동 또는 한 줄 메모가 필요합니다.')
  }
}

function normalizeStoredDraft(value: unknown): DiaryDraft {
  const draft = requireRecord(value, `${DIARY_DRAFT_STORAGE_KEY}.draft`)

  return {
    id: requireString(draft.id, 'DiaryDraft.id'),
    entryId: readOptionalString(draft.entryId),
    type: requireEntryType(draft.type, 'DiaryDraft.type'),
    diaryDate: requireDateKey(draft.diaryDate, 'DiaryDraft.diaryDate'),
    title: requireString(draft.title, 'DiaryDraft.title'),
    content: requireString(draft.content, 'DiaryDraft.content'),
    contentHtml: readOptionalString(draft.contentHtml) ?? '',
    shortNote: requireString(draft.shortNote, 'DiaryDraft.shortNote'),
    mood: readOptionalMood(draft.mood, 'DiaryDraft.mood'),
    energy: normalizeEnergy(draft.energy),
    activities: requireActivities(draft.activities, 'DiaryDraft.activities'),
    tags: requireStringArray(draft.tags, 'DiaryDraft.tags'),
    images: requireImages(draft.images, 'DiaryDraft.images'),
    weather: readOptionalWeather(draft.weather, 'DiaryDraft.weather'),
    location: readOptionalLocation(draft.location, 'DiaryDraft.location'),
    isFavorite: requireBoolean(draft.isFavorite, 'DiaryDraft.isFavorite'),
    isLocked: requireBoolean(draft.isLocked, 'DiaryDraft.isLocked'),
    savedAt: requireTimestamp(draft.savedAt, 'DiaryDraft.savedAt'),
  }
}

function normalizeAIInsight(insight: AIInsight): AIInsight {
  return {
    summary: normalizeOptionalText(insight.summary),
    emotions: normalizeStringArray(insight.emotions),
    topics: normalizeStringArray(insight.topics),
    patterns: normalizeStringArray(insight.patterns),
    followUpQuestions: normalizeStringArray(insight.followUpQuestions),
    relatedEntryIds: normalizeStringArray(insight.relatedEntryIds),
    source: insight.source === 'external-ai' ? 'external-ai' : 'local-rule-mock',
    generatedAt: requireTimestamp(insight.generatedAt, 'AIInsight.generatedAt'),
  }
}

function readOptionalAIInsight(value: unknown, path: string): AIInsight | undefined {
  if (value === undefined || value === null) return undefined
  const insight = requireRecord(value, path)
  const source = insight.source

  if (source !== 'local-rule-mock' && source !== 'external-ai') {
    throw invalidDataError(`${path}.source 값이 올바르지 않습니다.`)
  }

  return normalizeAIInsight({
    summary: readOptionalString(insight.summary),
    emotions: requireStringArray(insight.emotions, `${path}.emotions`),
    topics: requireStringArray(insight.topics, `${path}.topics`),
    patterns: requireStringArray(insight.patterns, `${path}.patterns`),
    followUpQuestions: requireStringArray(insight.followUpQuestions, `${path}.followUpQuestions`),
    relatedEntryIds: requireStringArray(insight.relatedEntryIds, `${path}.relatedEntryIds`),
    source,
    generatedAt: requireTimestamp(insight.generatedAt, `${path}.generatedAt`),
  })
}

function normalizeImages(
  images: DiaryImage[] | undefined,
  path = 'DiaryImage',
): DiaryImage[] {
  const normalizedImages = images ?? []

  if (normalizedImages.length > MAX_DIARY_IMAGE_COUNT) {
    throw invalidDataError(`사진은 최대 ${MAX_DIARY_IMAGE_COUNT}장까지 저장할 수 있습니다.`)
  }

  return normalizedImages.map((image, index) => {
    const imagePath = `${path}[${index}]`
    const role = normalizeImageRole(image.role, `${imagePath}.role`)
    const url = requireDiaryImageUrl(
      requireString(image.url, `${imagePath}.url`),
      `${imagePath}.url`,
    )

    return {
      id: requireString(image.id, `${imagePath}.id`),
      url,
      alt: normalizeOptionalText(image.alt),
      ...(role ? { role } : {}),
    }
  })
}

function requireImages(value: unknown, path: string): DiaryImage[] {
  if (!Array.isArray(value)) throw invalidDataError(`${path}는 배열이어야 합니다.`)

  const images = value.map((image, index) => {
    const record = requireRecord(image, `${path}[${index}]`)

    return {
      id: requireString(record.id, `${path}[${index}].id`),
      url: requireString(record.url, `${path}[${index}].url`),
      alt: readOptionalString(record.alt),
      role: normalizeImageRole(readOptionalString(record.role), `${path}[${index}].role`),
    }
  })

  return normalizeImages(images, path)
}

function normalizeImageRole(value: string | undefined, path: string): 'cover' | 'inline' | undefined {
  if (value === undefined) return undefined
  if (value === 'cover' || value === 'inline') return value

  throw invalidDataError(`${path}는 cover 또는 inline이어야 합니다.`)
}

function requireDiaryImageUrl(url: string, path: string): string {
  if (isLocalImageAssetUrl(url)) return url

  const dataUrlMatch = BASE64_IMAGE_DATA_URL_PATTERN.exec(url)
  const encodedData = dataUrlMatch?.[1]

  if (encodedData === undefined || encodedData.length % 4 !== 0) {
    throw invalidDataError(
      `${path}는 앱 로컬 이미지 경로 또는 base64 형식의 image Data URL이어야 합니다.`,
    )
  }

  const paddingLength = encodedData.endsWith('==')
    ? 2
    : encodedData.endsWith('=')
      ? 1
      : 0
  const decodedByteLength = (encodedData.length / 4) * 3 - paddingLength

  if (decodedByteLength > MAX_DIARY_IMAGE_BYTES) {
    throw invalidDataError(`${path}는 350KB 이하여야 합니다.`)
  }

  return url
}

function isLocalImageAssetUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
}

function normalizeWeather(weather: WeatherContext | undefined): WeatherContext | undefined {
  if (!weather) return undefined

  const condition = normalizeOptionalText(weather.condition)
  const temperature = weather.temperature

  if (temperature !== undefined && !Number.isFinite(temperature)) {
    throw invalidDataError('날씨 온도는 유한한 숫자여야 합니다.')
  }

  return condition !== undefined || temperature !== undefined
    ? { condition, temperature }
    : undefined
}

function readOptionalWeather(value: unknown, path: string): WeatherContext | undefined {
  if (value === undefined || value === null) return undefined
  const weather = requireRecord(value, path)
  const temperature = weather.temperature

  if (temperature !== undefined && (typeof temperature !== 'number' || !Number.isFinite(temperature))) {
    throw invalidDataError(`${path}.temperature 값이 올바르지 않습니다.`)
  }

  return normalizeWeather({
    condition: readOptionalString(weather.condition),
    temperature,
  })
}

function normalizeLocation(location: LocationContext | undefined): LocationContext | undefined {
  const name = normalizeOptionalText(location?.name)

  return name ? { name } : undefined
}

function readOptionalLocation(value: unknown, path: string): LocationContext | undefined {
  if (value === undefined || value === null) return undefined
  const location = requireRecord(value, path)

  return normalizeLocation({ name: readOptionalString(location.name) })
}

function normalizeEnergy(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined

  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw invalidDataError('에너지는 1부터 5까지의 정수여야 합니다.')
  }

  return Number(value)
}

function normalizeActivities(value: unknown): Activity[] {
  if (value === undefined || value === null) return []

  if (!Array.isArray(value) || value.some((activity) => !isActivity(activity))) {
    throw invalidDataError(
      `활동은 ${ACTIVITIES.join(', ')} 중 하나여야 합니다.`,
    )
  }

  return Array.from(new Set(value)) as Activity[]
}

function requireActivities(value: unknown, path: string): Activity[] {
  try {
    return normalizeActivities(value)
  } catch (error) {
    throw new DiaryRepositoryError(
      'INVALID_DATA',
      `${path} 활동 값이 올바르지 않습니다.`,
      { cause: error },
    )
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw invalidDataError('문자열 목록 형식이 올바르지 않습니다.')

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw invalidDataError(`${path}는 문자열 배열이어야 합니다.`)
  }

  return normalizeStringArray(value)
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : undefined
}

/**
 * TipTap 문서 HTML은 외부 페이지로 직접 주입하지 않고 Editor parser를 통해서만 렌더링한다.
 * 저장 경계에서는 빈 문서만 제거하고 legacy 평문 content를 그대로 유지한다.
 */
function normalizeOptionalHtml(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim()

  if (!normalizedValue || normalizedValue === '<p></p>') return undefined

  if (normalizedValue.length > 2_500_000) {
    throw invalidDataError('블록 문서가 저장 가능한 크기를 초과했습니다.')
  }

  if (/<\/?(?:script|style|iframe|object|embed|form)\b|\son[a-z]+\s*=|javascript:/i.test(normalizedValue)) {
    throw invalidDataError('블록 문서에 허용되지 않은 HTML이 포함되어 있습니다.')
  }

  for (const match of normalizedValue.matchAll(/\ssrc=["']([^"']+)["']/gi)) {
    requireDiaryImageUrl(match[1], '블록 문서 이미지')
  }

  return normalizedValue
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw invalidDataError(`${path}는 문자열이어야 합니다.`)

  return value
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw invalidDataError(`${path}는 boolean이어야 합니다.`)

  return value
}

function requireUniqueEntryIds(
  entries: DiaryEntry[],
  message: string,
  errorCode: 'INVALID_DATA' | 'CORRUPT_DATA' = 'INVALID_DATA',
): void {
  const entryIds = new Set(entries.map((entry) => entry.id))

  if (entryIds.size !== entries.length) {
    throw new DiaryRepositoryError(errorCode, message)
  }
}

function readOptionalMood(value: unknown, path: string): Mood | undefined {
  if (value === undefined || value === null) return undefined
  if (!isMood(value)) throw invalidDataError(`${path} 감정 값이 올바르지 않습니다.`)

  return value
}

function requireEntryType(value: unknown, path: string): EntryType {
  if (!isEntryType(value)) {
    throw invalidDataError(`${path}는 ${ENTRY_TYPES.join(', ')} 중 하나여야 합니다.`)
  }

  return value
}

function requireDateKey(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalidDataError(`${path}는 YYYY-MM-DD 형식이어야 합니다.`)
  }

  const parsedDate = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime()) || toDateKey(parsedDate) !== value) {
    throw invalidDataError(`${path} 날짜가 올바르지 않습니다.`)
  }

  return value
}

function requireTimestamp(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw invalidDataError(`${path} timestamp가 올바르지 않습니다.`)
  }

  return value
}

function readTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
    ? value
    : fallback
}

function readLegacyDate(entry: Record<string, unknown>, referenceDate: Date): string {
  const dateValue = readOptionalString(entry.date) ?? readOptionalString(entry.diaryDate)

  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue
  }

  return toDateKey(referenceDate)
}

function parseJson(rawValue: string, key: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown
  } catch (error) {
    throw new DiaryRepositoryError(
      'CORRUPT_DATA',
      `${key}에 저장된 데이터가 손상되어 자동으로 덮어쓰지 않았습니다.`,
      { cause: error },
    )
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidDataError(`${path} 객체 형식이 올바르지 않습니다.`)
  }

  return value as Record<string, unknown>
}

function cloneEntry(entry: DiaryEntry): DiaryEntry {
  return structuredClone(entry)
}

function cloneEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return entries.map(cloneEntry)
}

function cloneDraft(draft: DiaryDraft): DiaryDraft {
  return structuredClone(draft)
}

function stripUndefinedFields<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T
}

function createDiaryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function invalidDataError(message: string): DiaryRepositoryError {
  return new DiaryRepositoryError('INVALID_DATA', message)
}

function corruptDataError(key: string): DiaryRepositoryError {
  return new DiaryRepositoryError(
    'CORRUPT_DATA',
    `${key}에 저장된 데이터 구조가 올바르지 않아 자동으로 덮어쓰지 않았습니다.`,
  )
}
