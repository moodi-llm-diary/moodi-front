import { describe, expect, it } from 'vitest'
import type { AIConversation } from '../types/journalAI'
import { LocalStorageJournalAIConversationRepository } from './localStorageJournalAIConversationRepository'

const STORAGE_KEY = 'moodi.journal-ai.conversations.v1'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('LocalStorageJournalAIConversationRepository', () => {
  it('versioned envelope로 대화를 저장하고 삭제한다', async () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageJournalAIConversationRepository(storage)
    const conversation = createConversation()

    await repository.createConversation(conversation)
    expect(await repository.getConversation(conversation.id)).toEqual(conversation)
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ schemaVersion: 1 })

    await repository.deleteConversation(conversation.id)
    expect(await repository.getConversations()).toEqual([])
  })

  it('기록 삭제 시 저장된 출처와 답변 원문을 함께 가린다', async () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageJournalAIConversationRepository(storage)
    const conversation = createConversation()

    await repository.createConversation(conversation)
    await repository.removeEntryReferences('user-entry')
    const assistantMessage = (await repository.getConversation(conversation.id))?.messages[0]

    expect(assistantMessage?.sources).toEqual([])
    expect(assistantMessage?.content).toContain('기록이 삭제되어')
  })

  it('손상된 envelope을 빈 대화로 오인하지 않는다', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{"schemaVersion":1,"conversations":"invalid"}')
    const repository = new LocalStorageJournalAIConversationRepository(storage)

    await expect(repository.getConversations()).rejects.toMatchObject({
      code: 'storage-corrupted',
      message: expect.stringContaining('대화 목록 형식'),
    })

    storage.setItem('moodi.diary.entries.v2', 'keep-diary-data')
    await repository.clearConversations()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem('moodi.diary.entries.v2')).toBe('keep-diary-data')
  })

  it('81번째 메시지를 저장할 때 최신 80개로 제한한 뒤 검증한다', async () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageJournalAIConversationRepository(storage)
    const conversation = createConversation()
    const messages = Array.from({ length: 80 }, (_, index) => ({
      id: `message-${index + 1}`,
      role: 'user' as const,
      content: `질문 ${index + 1}`,
      createdAt: `2026-07-14T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
      adapter: 'local-search' as const,
      sources: [],
    }))

    await repository.createConversation({ ...conversation, messages })
    const updated = await repository.updateConversation(conversation.id, (currentConversation) => ({
      ...currentConversation,
      messages: [
        ...messages,
        {
          id: 'message-81',
          role: 'assistant',
          content: '최신 답변',
          createdAt: '2026-07-14T10:30:00.000Z',
          adapter: 'local-search',
          sources: [],
        },
      ],
    }))

    expect(updated.messages).toHaveLength(80)
    expect(updated.messages[0].id).toBe('message-2')
    expect(updated.messages.at(-1)?.id).toBe('message-81')
  })

  it('삭제 또는 전체 초기화 뒤 update가 대화를 되살리지 않는다', async () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageJournalAIConversationRepository(storage)
    const conversation = createConversation()

    await repository.createConversation(conversation)
    await repository.deleteConversation(conversation.id)
    await expect(
      repository.updateConversation(conversation.id, () => conversation),
    ).rejects.toThrow('다시 저장할 수 없습니다')
    expect(await repository.getConversations()).toEqual([])

    await repository.createConversation(conversation)
    await repository.clearConversations()
    await expect(
      repository.updateConversation(conversation.id, () => conversation),
    ).rejects.toThrow('다시 저장할 수 없습니다')
    expect(await repository.getConversations()).toEqual([])
  })
})

function createConversation(): AIConversation {
  return {
    id: 'conversation-1',
    title: '산책 기록',
    createdAt: '2026-07-14T09:00:00.000Z',
    updatedAt: '2026-07-14T09:01:00.000Z',
    messages: [
      {
        id: 'message-1',
        role: 'assistant',
        content: '실제 기록 한 개를 찾았어요.',
        createdAt: '2026-07-14T09:01:00.000Z',
        adapter: 'local-search',
        sources: [
          {
            entryId: 'user-entry',
            diaryDate: '2026-07-14',
            title: '산책 기록',
            excerpt: '저녁에 동네를 걸었다.',
            mood: 'calm',
          },
        ],
      },
    ],
  }
}
