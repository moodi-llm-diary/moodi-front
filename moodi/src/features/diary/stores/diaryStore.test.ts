import { describe, expect, it, vi } from 'vitest'
import type { DiaryRepository } from '../repositories/DiaryRepository'
import type { DiaryEntry } from '../types/diaryDomain'
import type {
  CreateDiaryEntryInput,
  DiaryDraft,
  SaveDiaryDraftInput,
} from '../types/diaryInputs'
import { createDiaryStore } from './diaryStore'

describe('createDiaryStore', () => {
  it('기록 로드 후 초안 로드만 실패하면 기록을 유지한 ready 상태로 복구한다', async () => {
    const entry = createEntry('entry-loaded', '2026-07-13')
    const getDraft = vi.fn(async () => {
      throw new Error('draft read failed')
    })
    const repository = createRepository({
      getEntries: vi.fn(async () => [entry]),
      getDraft,
    })
    const store = createDiaryStore(repository)

    await store.getState().initialize()

    expect(store.getState()).toMatchObject({
      entries: [entry],
      draft: null,
      status: 'ready',
      errorMessage: null,
      initializationWarning:
        '임시저장만 불러오지 못했습니다. 기존 기록은 안전하게 유지했어요.',
    })
    expect(getDraft).toHaveBeenCalledOnce()
  })

  it('기록 로드가 실패하면 error 상태가 되고 초안 로드는 시도하지 않는다', async () => {
    const getDraft = vi.fn(async () => null)
    const repository = createRepository({
      getEntries: vi.fn(async () => {
        throw new Error('entries read failed')
      }),
      getDraft,
    })
    const store = createDiaryStore(repository)

    await store.getState().initialize()

    expect(store.getState()).toMatchObject({
      entries: [],
      draft: null,
      status: 'error',
      errorMessage: 'entries read failed',
    })
    expect(getDraft).not.toHaveBeenCalled()
  })

  it('가져오기 저장 후 초안 정리만 실패하면 새 기록과 기존 초안을 모두 보존한다', async () => {
    const originalEntry = createEntry('entry-original', '2026-07-12')
    const importedEntry = createEntry('entry-imported', '2026-07-13')
    const activeDraft = createDraft()
    const replaceEntries = vi.fn(async () => [importedEntry])
    const clearDraft = vi.fn(async () => {
      throw new Error('draft cleanup failed')
    })
    const repository = createRepository({
      getEntries: vi.fn(async () => [originalEntry]),
      getDraft: vi.fn(async () => activeDraft),
      replaceEntries,
      clearDraft,
    })
    const store = createDiaryStore(repository)

    await store.getState().initialize()
    const result = await store.getState().replaceEntries([importedEntry])

    expect(result).toEqual({
      entries: [importedEntry],
      draftCleanupFailed: true,
    })
    expect(store.getState()).toMatchObject({
      entries: [importedEntry],
      draft: activeDraft,
      status: 'ready',
      mutationStatus: 'idle',
      errorMessage: null,
    })
    expect(replaceEntries).toHaveBeenCalledWith([importedEntry])
    expect(clearDraft).toHaveBeenCalledOnce()
  })
})

function createRepository(
  overrides: Partial<DiaryRepository> = {},
): DiaryRepository {
  return {
    getEntries: async () => [],
    getEntry: async () => null,
    createEntry: async (input) => createEntryFromInput(input),
    updateEntry: async (entryId) => createEntry(entryId, '2026-07-13'),
    deleteEntry: async () => undefined,
    replaceEntries: async (entries) => entries,
    getDraft: async () => null,
    saveDraft: async (input) => createDraftFromInput(input),
    clearDraft: async () => undefined,
    deleteAllData: async () => undefined,
    ...overrides,
  }
}

function createEntry(id: string, diaryDate: string): DiaryEntry {
  return {
    id,
    type: 'journal',
    title: '하루의 기록',
    content: '오늘의 마음을 기록했습니다.',
    createdAt: `${diaryDate}T09:00:00.000Z`,
    updatedAt: `${diaryDate}T09:00:00.000Z`,
    diaryDate,
    activities: [],
    tags: [],
    aiTopics: [],
    images: [],
    isFavorite: false,
    isLocked: false,
  }
}

function createDraft(): DiaryDraft {
  return {
    id: 'draft-active',
    type: 'journal',
    diaryDate: '2026-07-13',
    title: '작성 중인 기록',
    content: '아직 저장하지 않은 내용',
    shortNote: '',
    activities: [],
    tags: [],
    images: [],
    isFavorite: false,
    isLocked: false,
    savedAt: '2026-07-13T10:00:00.000Z',
  }
}

function createEntryFromInput(input: CreateDiaryEntryInput): DiaryEntry {
  return {
    ...createEntry('entry-created', input.diaryDate),
    ...input,
    activities: input.activities ?? [],
    tags: input.tags ?? [],
    aiTopics: input.aiTopics ?? [],
    images: input.images ?? [],
    isFavorite: input.isFavorite ?? false,
    isLocked: input.isLocked ?? false,
  }
}

function createDraftFromInput(input: SaveDiaryDraftInput): DiaryDraft {
  return {
    ...input,
    id: input.id ?? 'draft-saved',
    savedAt: '2026-07-13T10:00:00.000Z',
  }
}
