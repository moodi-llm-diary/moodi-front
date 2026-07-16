import type { AIConversation, JournalAIMessage, JournalSource } from '../types/journalAI'
import { isMood } from '../types/diaryDomain'
import type { JournalAIConversationRepository } from './JournalAIConversationRepository'

const STORAGE_KEY = 'moodi.journal-ai.conversations.v1'
const SCHEMA_VERSION = 1
const MAX_CONVERSATIONS = 40
const MAX_MESSAGES_PER_CONVERSATION = 80
const MAX_SERIALIZED_LENGTH = 1_500_000

type ConversationEnvelope = {
  schemaVersion: 1
  conversations: AIConversation[]
}

export class JournalAIConversationCorruptionError extends Error {
  readonly code = 'storage-corrupted' as const

  constructor(message: string) {
    super(message)
    this.name = 'JournalAIConversationCorruptionError'
  }
}

/** 외부 API 없이 AI 대화 기록만 브라우저에 보관하는 localStorage adapter다. */
export class LocalStorageJournalAIConversationRepository
  implements JournalAIConversationRepository
{
  private readonly storage?: Storage

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)
  }

  async getConversations(): Promise<AIConversation[]> {
    const envelope = this.readEnvelope()

    return [...envelope.conversations].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
  }

  async getConversation(id: string): Promise<AIConversation | null> {
    return this.readEnvelope().conversations.find((conversation) => conversation.id === id) ?? null
  }

  async createConversation(conversation: AIConversation): Promise<AIConversation> {
    const normalized = normalizeConversationForSave(conversation)
    const envelope = this.readEnvelope()

    if (envelope.conversations.some((item) => item.id === normalized.id)) {
      throw new Error('같은 ID의 AI 대화가 이미 존재합니다.')
    }

    const boundedConversations = [normalized, ...envelope.conversations]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_CONVERSATIONS)

    this.writeEnvelope({ schemaVersion: SCHEMA_VERSION, conversations: boundedConversations })

    return normalized
  }

  async updateConversation(
    id: string,
    update: (conversation: AIConversation) => AIConversation,
  ): Promise<AIConversation> {
    const envelope = this.readEnvelope()
    const currentConversation = envelope.conversations.find((item) => item.id === id)

    if (!currentConversation) {
      throw new Error('삭제되었거나 초기화된 AI 대화는 다시 저장할 수 없습니다.')
    }
    const normalized = normalizeConversationForSave(update(currentConversation))

    if (normalized.id !== id) throw new Error('AI 대화 ID는 변경할 수 없습니다.')

    const nextConversations = envelope.conversations
      .map((item) => (item.id === id ? normalized : item))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    this.writeEnvelope({ schemaVersion: SCHEMA_VERSION, conversations: nextConversations })

    return normalized
  }

  async deleteConversation(id: string): Promise<void> {
    const envelope = this.readEnvelope()

    this.writeEnvelope({
      schemaVersion: SCHEMA_VERSION,
      conversations: envelope.conversations.filter((conversation) => conversation.id !== id),
    })
  }

  async removeEntryReferences(entryId: string): Promise<void> {
    const envelope = this.readEnvelope()
    const nextConversations = envelope.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => {
        if (!message.sources.some((source) => source.entryId === entryId)) return message

        return {
          ...message,
          content: '연결된 기록이 삭제되어 이전 로컬 검색 답변을 다시 표시하지 않아요.',
          sources: message.sources.filter((source) => source.entryId !== entryId),
        }
      }),
    }))

    this.writeEnvelope({ schemaVersion: SCHEMA_VERSION, conversations: nextConversations })
  }

  async clearConversations(): Promise<void> {
    try {
      this.requireStorage().removeItem(STORAGE_KEY)
    } catch {
      throw new Error('AI 대화 기록을 브라우저에서 삭제하지 못했습니다.')
    }
  }

  private readEnvelope(): ConversationEnvelope {
    let rawValue: string | null

    try {
      rawValue = this.requireStorage().getItem(STORAGE_KEY)
    } catch {
      throw new Error('AI 대화 기록을 브라우저에서 읽지 못했습니다.')
    }

    if (!rawValue) return { schemaVersion: SCHEMA_VERSION, conversations: [] }

    try {
      const parsedValue: unknown = JSON.parse(rawValue)

      if (!isRecord(parsedValue) || parsedValue.schemaVersion !== SCHEMA_VERSION) {
        throw new Error('지원하지 않는 AI 대화 저장 형식입니다.')
      }
      if (!Array.isArray(parsedValue.conversations)) {
        throw new Error('AI 대화 목록 형식이 올바르지 않습니다.')
      }
      if (parsedValue.conversations.length > MAX_CONVERSATIONS) {
        throw new Error('AI 대화 목록이 저장 한도를 초과했습니다.')
      }

      const conversations = parsedValue.conversations.map((conversation, index) =>
        normalizeConversation(conversation, `conversations[${index}]`),
      )
      const ids = new Set(conversations.map((conversation) => conversation.id))

      if (ids.size !== conversations.length) {
        throw new Error('AI 대화 ID가 중복되어 있습니다.')
      }

      return { schemaVersion: SCHEMA_VERSION, conversations }
    } catch (error) {
      throw new JournalAIConversationCorruptionError(
        error instanceof Error ? error.message : 'AI 대화 기록을 해석하지 못했습니다.',
      )
    }
  }

  private writeEnvelope(envelope: ConversationEnvelope): void {
    try {
      const serializedEnvelope = JSON.stringify(envelope)

      if (serializedEnvelope.length > MAX_SERIALIZED_LENGTH) {
        throw new Error('AI 대화 기록이 브라우저 저장 한도를 초과했습니다.')
      }

      this.requireStorage().setItem(STORAGE_KEY, serializedEnvelope)
    } catch {
      throw new Error('AI 대화 기록을 브라우저에 저장하지 못했습니다.')
    }
  }

  private requireStorage(): Storage {
    if (!this.storage) throw new Error('AI 대화 기록을 사용할 브라우저 저장소가 없습니다.')

    return this.storage
  }
}

/** Diary 삭제 흐름과 AI hook이 공유하는 기본 대화 저장소다. */
export const journalAIConversationRepository =
  new LocalStorageJournalAIConversationRepository()

function normalizeConversationForSave(conversation: AIConversation): AIConversation {
  return normalizeConversation(
    {
      ...conversation,
      messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    },
    'conversation',
  )
}

function normalizeConversation(value: unknown, path: string): AIConversation {
  if (!isRecord(value)) throw new Error(`${path} 형식이 올바르지 않습니다.`)

  const id = requireString(value.id, `${path}.id`, 160)
  const title = requireString(value.title, `${path}.title`, 80)
  const createdAt = requireTimestamp(value.createdAt, `${path}.createdAt`)
  const updatedAt = requireTimestamp(value.updatedAt, `${path}.updatedAt`)

  if (!Array.isArray(value.messages)) throw new Error(`${path}.messages 형식이 올바르지 않습니다.`)
  if (value.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    throw new Error(`${path}.messages가 저장 한도를 초과했습니다.`)
  }

  return {
    id,
    title,
    createdAt,
    updatedAt,
    messages: value.messages.map((message, index) =>
      normalizeMessage(message, `${path}.messages[${index}]`),
    ),
  }
}

function normalizeMessage(value: unknown, path: string): JournalAIMessage {
  if (!isRecord(value)) throw new Error(`${path} 형식이 올바르지 않습니다.`)
  if (value.role !== 'user' && value.role !== 'assistant') {
    throw new Error(`${path}.role 값이 올바르지 않습니다.`)
  }
  if (value.adapter !== 'local-search' && value.adapter !== 'external-ai') {
    throw new Error(`${path}.adapter 값이 올바르지 않습니다.`)
  }
  if (!Array.isArray(value.sources)) throw new Error(`${path}.sources 형식이 올바르지 않습니다.`)

  return {
    id: requireString(value.id, `${path}.id`, 160),
    role: value.role,
    content: requireString(value.content, `${path}.content`, 12_000),
    createdAt: requireTimestamp(value.createdAt, `${path}.createdAt`),
    adapter: value.adapter,
    sources: value.sources.map((source, index) =>
      normalizeSource(source, `${path}.sources[${index}]`),
    ),
  }
}

function normalizeSource(value: unknown, path: string): JournalSource {
  if (!isRecord(value)) throw new Error(`${path} 형식이 올바르지 않습니다.`)

  return {
    entryId: requireString(value.entryId, `${path}.entryId`, 160),
    entryUpdatedAt: readOptionalTimestamp(
      value.entryUpdatedAt,
      `${path}.entryUpdatedAt`,
    ),
    diaryDate: requireDate(value.diaryDate, `${path}.diaryDate`),
    title: readOptionalString(value.title, `${path}.title`, 80),
    excerpt: readString(value.excerpt, `${path}.excerpt`, 280),
    mood: isMood(value.mood) ? value.mood : undefined,
  }
}

function requireString(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${path} 값이 올바르지 않습니다.`)
  }

  return value.trim()
}

function readString(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${path} 값이 올바르지 않습니다.`)
  }

  return value.trim()
}

function readOptionalString(value: unknown, path: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined

  return requireString(value, path, maxLength)
}

function requireTimestamp(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${path} 값이 올바른 시각이 아닙니다.`)
  }

  return value
}

function readOptionalTimestamp(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined

  return requireTimestamp(value, path)
}

function requireDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} 값이 올바른 날짜가 아닙니다.`)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
