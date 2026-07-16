import { describe, expect, it } from 'vitest'

import type { DiaryEntry } from '../types/diaryDomain'
import {
  DIARY_DRAFT_STORAGE_KEY,
  DIARY_STORAGE_KEY,
  DIARY_STORAGE_SCHEMA_VERSION,
  LEGACY_DIARY_STORAGE_KEY,
  LocalStorageDiaryRepository,
} from './localStorageDiaryRepository'

class MemoryStorage implements Storage {
  protected readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class FailingEntriesWriteStorage extends MemoryStorage {
  private shouldFailEntriesWrite = false

  failEntriesWrite(): void {
    this.shouldFailEntriesWrite = true
  }

  override setItem(key: string, value: string): void {
    if (this.shouldFailEntriesWrite && key === DIARY_STORAGE_KEY) {
      throw new Error('entries write failed')
    }

    super.setItem(key, value)
  }
}

function createDiaryEntry(id: string): DiaryEntry {
  return {
    id,
    type: 'journal',
    content: `${id} 기록 본문`,
    createdAt: '2026-07-13T09:00:00.000Z',
    updatedAt: '2026-07-13T09:00:00.000Z',
    diaryDate: '2026-07-13',
    activities: [],
    tags: [],
    aiTopics: [],
    images: [],
    isFavorite: false,
    isLocked: false,
  }
}

function createRepository(storage: Storage): LocalStorageDiaryRepository {
  return new LocalStorageDiaryRepository({
    storage,
    createSeedEntries: () => [],
  })
}

describe('LocalStorageDiaryRepository', () => {
  it('가져온 기록에 중복 id가 있으면 기존 저장값을 변경하지 않는다', async () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)

    await expect(
      repository.replaceEntries([
        createDiaryEntry('duplicate-id'),
        createDiaryEntry('duplicate-id'),
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_DATA' })

    expect(storage.getItem(DIARY_STORAGE_KEY)).toBeNull()
  })

  it('외부 이미지 URL이 포함된 기록을 저장하지 않는다', async () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)
    const entryWithExternalImage: DiaryEntry = {
      ...createDiaryEntry('external-image'),
      images: [
        {
          id: 'image-1',
          url: 'https://example.com/private-diary.jpg',
        },
      ],
    }

    await expect(
      repository.replaceEntries([entryWithExternalImage]),
    ).rejects.toMatchObject({ code: 'INVALID_DATA' })

    expect(storage.getItem(DIARY_STORAGE_KEY)).toBeNull()
  })

  it('TipTap 블록 HTML과 검색용 평문을 분리해 왕복 저장한다', async () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)
    const blockEntry: DiaryEntry = {
      ...createDiaryEntry('block-entry'),
      content: '기억하고 싶은 장면',
      contentHtml: '<h2>저녁의 장면</h2><p>기억하고 싶은 장면</p>',
    }

    await repository.replaceEntries([blockEntry])

    await expect(repository.getEntry(blockEntry.id)).resolves.toMatchObject({
      content: blockEntry.content,
      contentHtml: blockEntry.contentHtml,
    })
  })

  it('실행 가능한 HTML이나 외부 source가 있는 블록 문서를 저장하지 않는다', async () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)

    await expect(repository.replaceEntries([{
      ...createDiaryEntry('unsafe-block-entry'),
      contentHtml: '<script>alert(1)</script><img src="https://example.com/tracker.png">',
    }])).rejects.toMatchObject({ code: 'INVALID_DATA' })

    expect(storage.getItem(DIARY_STORAGE_KEY)).toBeNull()
  })

  it('전체 삭제에 성공하면 빈 entries envelope을 남기고 초안과 legacy 데이터를 제거한다', async () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)

    await repository.replaceEntries([createDiaryEntry('entry-before-delete')])
    storage.setItem(DIARY_DRAFT_STORAGE_KEY, 'draft-before-delete')
    storage.setItem(LEGACY_DIARY_STORAGE_KEY, 'legacy-before-delete')

    await repository.deleteAllData()

    expect(JSON.parse(storage.getItem(DIARY_STORAGE_KEY) ?? '')).toEqual({
      schemaVersion: DIARY_STORAGE_SCHEMA_VERSION,
      entries: [],
    })
    expect(storage.getItem(DIARY_DRAFT_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_DIARY_STORAGE_KEY)).toBeNull()
  })

  it('전체 삭제의 최종 entries 기록이 실패하면 기존 entries와 초안, legacy 데이터를 복구한다', async () => {
    const storage = new FailingEntriesWriteStorage()
    const repository = createRepository(storage)

    await repository.replaceEntries([createDiaryEntry('entry-before-failure')])
    storage.setItem(DIARY_DRAFT_STORAGE_KEY, 'draft-before-failure')
    storage.setItem(LEGACY_DIARY_STORAGE_KEY, 'legacy-before-failure')

    const entriesSnapshot = storage.getItem(DIARY_STORAGE_KEY)
    const draftSnapshot = storage.getItem(DIARY_DRAFT_STORAGE_KEY)
    const legacySnapshot = storage.getItem(LEGACY_DIARY_STORAGE_KEY)

    storage.failEntriesWrite()

    await expect(repository.deleteAllData()).rejects.toMatchObject({
      code: 'WRITE_FAILED',
    })

    expect(storage.getItem(DIARY_STORAGE_KEY)).toBe(entriesSnapshot)
    expect(storage.getItem(DIARY_DRAFT_STORAGE_KEY)).toBe(draftSnapshot)
    expect(storage.getItem(LEGACY_DIARY_STORAGE_KEY)).toBe(legacySnapshot)
  })
})
