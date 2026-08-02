import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
  diaryAnalysisService,
  type DiaryAnalysisInput,
  type DiaryAnalysisService,
} from '../services/diaryAnalysisService'
import {
  ApiDiaryRepository,
  type DiaryRepository,
} from '../repositories'
import type { DiaryEntry } from '../types/diaryDomain'
import type {
  CreateDiaryEntryInput,
  DiaryDraft,
  SaveDiaryDraftInput,
  UpdateDiaryEntryInput,
} from '../types/diaryInputs'

/** 최초 저장소 초기화 상태다. */
export type DiaryStoreStatus = 'idle' | 'loading' | 'ready' | 'error'
/** 사용자 변경 작업의 진행 상태다. */
export type DiaryMutationStatus =
  | 'idle'
  | 'saving'
  | 'deleting'
  | 'importing'
  | 'clearing'

/** 가져오기 저장과 기존 draft 정리 결과를 분리해 전달한다. */
export type DiaryImportResult = {
  entries: DiaryEntry[]
  draftCleanupFailed: boolean
}

/** Diary 화면 hook이 사용하는 전역 application state와 action 계약이다. */
export interface DiaryStoreState {
  entries: DiaryEntry[]
  draft: DiaryDraft | null
  status: DiaryStoreStatus
  mutationStatus: DiaryMutationStatus
  errorMessage: string | null
  initializationWarning: string | null
  initialize: () => Promise<void>
  createEntry: (input: CreateDiaryEntryInput) => Promise<DiaryEntry>
  updateEntry: (
    entryId: string,
    input: UpdateDiaryEntryInput,
  ) => Promise<DiaryEntry>
  deleteEntry: (entryId: string) => Promise<void>
  setFavorite: (entryId: string, isFavorite?: boolean) => Promise<DiaryEntry>
  saveDraft: (input: SaveDiaryDraftInput) => Promise<DiaryDraft>
  clearDraft: () => Promise<void>
  replaceEntries: (entries: DiaryEntry[]) => Promise<DiaryImportResult>
  deleteAllDiaryData: () => Promise<void>
  recoverDiaryStorage: () => Promise<void>
  clearError: () => void
  clearInitializationWarning: () => void
}

/** 주입 가능한 Zustand Diary store 타입이다. */
export type DiaryStore = UseBoundStore<StoreApi<DiaryStoreState>>

/**
 * Repository와 분석 구현체를 주입할 수 있는 Diary store factory다.
 * API Repository 전환 시 UI action 계약은 유지하고 주입 구현체만 교체한다.
 */
export function createDiaryStore(
  repository: DiaryRepository,
  analysisService: DiaryAnalysisService = diaryAnalysisService,
): DiaryStore {
  return create<DiaryStoreState>((set, get) => ({
    entries: [],
    draft: null,
    status: 'idle',
    mutationStatus: 'idle',
    errorMessage: null,
    initializationWarning: null,

    initialize: async () => {
      const currentStatus = get().status

      if (currentStatus === 'loading' || currentStatus === 'ready') {
        return
      }

      set({
        status: 'loading',
        errorMessage: null,
        initializationWarning: null,
      })

      try {
        const entries = await repository.getEntries()

        try {
          const draft = await repository.getDraft()
          set({
            entries,
            draft,
            status: 'ready',
            errorMessage: null,
            initializationWarning: null,
          })
        } catch {
          set({
            entries,
            draft: null,
            status: 'ready',
            errorMessage: null,
            initializationWarning:
              '임시저장만 불러오지 못했습니다. 기존 기록은 안전하게 유지했어요.',
          })
        }
      } catch (error) {
        set({
          status: 'error',
          errorMessage: getErrorMessage(error, '저장된 일기를 불러오지 못했습니다.'),
        })
      }
    },

    createEntry: async (input) => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'saving', errorMessage: null })

      try {
        const { shouldAnalyze = true, ...repositoryInput } = input
        const analysis = shouldAnalyze && !repository.usesRemoteAnalysis
          ? input.aiInsight ?? await analysisService.analyze(
              toAnalysisInput(input),
              get().entries,
            )
          : undefined
        const createdEntry = await repository.createEntry({
          ...repositoryInput,
          aiInsight: analysis,
          aiTopics: shouldAnalyze ? input.aiTopics ?? analysis?.topics ?? [] : [],
        })

        set((state) => ({
          entries: [createdEntry, ...state.entries],
          mutationStatus: 'idle',
          errorMessage: null,
        }))

        return createdEntry
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '일기를 저장하지 못했습니다.'),
        })
        throw error
      }
    },

    updateEntry: async (entryId, input) => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'saving', errorMessage: null })

      try {
        const { shouldAnalyze = true, ...repositoryInput } = input
        const existingEntry = requireStoreEntry(get().entries, entryId)
        const shouldRefreshAnalysis = hasAnalysisRelevantChanges(repositoryInput)
        const nextInput = !shouldAnalyze
          ? { ...repositoryInput, aiInsight: null, aiTopics: [] }
          : shouldRefreshAnalysis && !repositoryInput.aiInsight && !repository.usesRemoteAnalysis
            ? await withRefreshedAnalysis(
                entryId,
                existingEntry,
                repositoryInput,
                get().entries,
                analysisService,
              )
            : repositoryInput
        const updatedEntry = await repository.updateEntry(entryId, nextInput)

        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === entryId ? updatedEntry : entry,
          ),
          mutationStatus: 'idle',
          errorMessage: null,
        }))

        return updatedEntry
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '일기를 수정하지 못했습니다.'),
        })
        throw error
      }
    },

    deleteEntry: async (entryId) => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'deleting', errorMessage: null })
      const activeDraft = get().draft
      const linkedDraft = activeDraft?.entryId === entryId ? activeDraft : null

      try {
        if (linkedDraft) {
          await repository.clearDraft()
        }
        await repository.deleteEntry(entryId)
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== entryId),
          draft: linkedDraft ? null : state.draft,
          mutationStatus: 'idle',
          errorMessage: null,
          initializationWarning: state.initializationWarning,
        }))
      } catch (error) {
        if (linkedDraft) {
          await repository.saveDraft(linkedDraft).catch(() => undefined)
        }
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '일기를 삭제하지 못했습니다.'),
        })
        throw error
      }
    },

    setFavorite: async (entryId, isFavorite) => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'saving', errorMessage: null })

      try {
        const existingEntry = requireStoreEntry(get().entries, entryId)
        const updatedEntry = await repository.updateEntry(entryId, {
          isFavorite: isFavorite ?? !existingEntry.isFavorite,
        })

        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === entryId ? updatedEntry : entry,
          ),
          mutationStatus: 'idle',
          errorMessage: null,
        }))

        return updatedEntry
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '즐겨찾기를 변경하지 못했습니다.'),
        })
        throw error
      }
    },

    saveDraft: async (input) => {
      set({ mutationStatus: 'saving', errorMessage: null })

      try {
        const savedDraft = await repository.saveDraft(input)

        set({
          draft: savedDraft,
          mutationStatus: 'idle',
          errorMessage: null,
        })

        return savedDraft
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '임시 기록을 저장하지 못했습니다.'),
        })
        throw error
      }
    },

    clearDraft: async () => {
      set({ mutationStatus: 'saving', errorMessage: null })

      try {
        await repository.clearDraft()
        set({ draft: null, mutationStatus: 'idle', errorMessage: null })
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '임시 기록을 정리하지 못했습니다.'),
        })
        throw error
      }
    },

    replaceEntries: async (entries) => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'importing', errorMessage: null })

      try {
        const importedEntries = await repository.replaceEntries(entries)
        let draftCleanupFailed = false
        try {
          await repository.clearDraft()
        } catch {
          draftCleanupFailed = true
        }

        set({
          entries: importedEntries,
          draft: draftCleanupFailed ? get().draft : null,
          mutationStatus: 'idle',
          errorMessage: null,
          initializationWarning: null,
        })

        return { entries: importedEntries, draftCleanupFailed }
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '가져온 기록을 저장하지 못했습니다.'),
        })
        throw error
      }
    },

    deleteAllDiaryData: async () => {
      await ensureStoreReady(get)
      set({ mutationStatus: 'clearing', errorMessage: null })

      try {
        await repository.deleteAllData()
        set({
          entries: [],
          draft: null,
          mutationStatus: 'idle',
          errorMessage: null,
          initializationWarning: null,
        })
      } catch (error) {
        set({
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '전체 기록을 삭제하지 못했습니다.'),
        })
        throw error
      }
    },

    recoverDiaryStorage: async () => {
      set({ mutationStatus: 'clearing', errorMessage: null })

      try {
        await repository.deleteAllData()
        set({
          entries: [],
          draft: null,
          status: 'ready',
          mutationStatus: 'idle',
          errorMessage: null,
          initializationWarning: null,
        })
      } catch (error) {
        set({
          status: 'error',
          mutationStatus: 'idle',
          errorMessage: getErrorMessage(error, '손상된 저장소를 초기화하지 못했습니다.'),
        })
        throw error
      }
    },

    clearError: () => set({ errorMessage: null }),
    clearInitializationWarning: () => set({ initializationWarning: null }),
  }))
}

/** 앱 기본 backend API Repository singleton이다. */
export const diaryRepository: DiaryRepository = new ApiDiaryRepository()

/** 앱에서 사용하는 기본 backend API-backed Diary store다. */
export const useDiaryStore = createDiaryStore(diaryRepository)

async function ensureStoreReady(
  get: () => DiaryStoreState,
): Promise<void> {
  if (get().status !== 'ready') {
    await get().initialize()
  }

  if (get().status !== 'ready') {
    throw new Error(get().errorMessage ?? '일기 저장소를 준비하지 못했습니다.')
  }
}

function requireStoreEntry(entries: DiaryEntry[], entryId: string): DiaryEntry {
  const entry = entries.find((candidate) => candidate.id === entryId)

  if (!entry) {
    throw new Error('요청한 일기 기록을 찾을 수 없습니다.')
  }

  return entry
}

function toAnalysisInput(input: CreateDiaryEntryInput): DiaryAnalysisInput {
  return {
    type: input.type,
    diaryDate: input.diaryDate,
    title: input.title,
    content: input.content,
    shortNote: input.shortNote,
    mood: input.mood,
    activities: input.activities ?? [],
    tags: input.tags ?? [],
    analysisTone: input.analysisTone,
    analysisResponseLength: input.analysisResponseLength,
  }
}

async function withRefreshedAnalysis(
  entryId: string,
  existingEntry: DiaryEntry,
  input: UpdateDiaryEntryInput,
  entries: DiaryEntry[],
  analysisService: DiaryAnalysisService,
): Promise<UpdateDiaryEntryInput> {
  const mergedEntry = { ...existingEntry, ...input }
  const analysis = await analysisService.analyze(
    {
      entryId,
      type: mergedEntry.type,
      diaryDate: mergedEntry.diaryDate,
      title: mergedEntry.title,
      content: mergedEntry.content,
      shortNote: mergedEntry.shortNote,
      mood: mergedEntry.mood,
      activities: mergedEntry.activities,
      tags: mergedEntry.tags,
      analysisTone: input.analysisTone,
      analysisResponseLength: input.analysisResponseLength,
    },
    entries,
  )

  return {
    ...input,
    aiInsight: analysis,
    aiTopics: analysis.topics,
  }
}

function hasAnalysisRelevantChanges(input: UpdateDiaryEntryInput): boolean {
  return (
    input.type !== undefined ||
    input.diaryDate !== undefined ||
    input.title !== undefined ||
    input.content !== undefined ||
    input.shortNote !== undefined ||
    input.mood !== undefined ||
    input.activities !== undefined ||
    input.tags !== undefined
  )
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message ? error.message : fallbackMessage
}
