import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SettingsPreferences } from '../../settings/types/settings'
import type {
  DiaryEntry,
  DiaryImage,
  SaveDiaryDraftInput,
} from '../types/diary'
import { useDiaryStore } from '../stores/diaryStore'
import { toDateKey } from '../services/diaryQueryService'
import { appendDiaryDocumentParagraph } from '../services/diaryDocumentService'
import {
  getStandaloneDiaryImages,
  isDiaryImageReferenced,
} from '../services/diaryImageService'

export type DiaryAutoSaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'error'
  | 'restored'

type UseDiaryEditorOptions = {
  isActive: boolean
  entryId?: string
  settings: SettingsPreferences
  onSaved: (entry: DiaryEntry) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void
}

/**
 * 작성 form, 사진 변환, 자동 임시저장과 명시적 저장 흐름을 캡슐화한다.
 */
export function useDiaryEditor({
  isActive,
  entryId,
  settings,
  onSaved,
  onToast,
}: UseDiaryEditorOptions) {
  const entries = useDiaryStore((state) => state.entries)
  const persistedDraft = useDiaryStore((state) => state.draft)
  const storeStatus = useDiaryStore((state) => state.status)
  const mutationStatus = useDiaryStore((state) => state.mutationStatus)
  const createEntry = useDiaryStore((state) => state.createEntry)
  const updateEntry = useDiaryStore((state) => state.updateEntry)
  const saveDraftToStore = useDiaryStore((state) => state.saveDraft)
  const clearDraftFromStore = useDiaryStore((state) => state.clearDraft)
  const [value, setValue] = useState<SaveDiaryDraftInput>(() =>
    createEmptyEditorValue(settings.isEntryLockEnabledByDefault),
  )
  const [autoSaveStatus, setAutoSaveStatus] = useState<DiaryAutoSaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [changeRevision, setChangeRevision] = useState(0)
  const changeRevisionRef = useRef(0)
  const loadedEditorKeyRef = useRef<string | null>(null)
  const pendingSaveRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const preparedNewEntryRef = useRef(false)
  const latestValueRef = useRef(value)
  const suppressNextExitSaveRef = useRef(false)
  const exitSaveRequestedRef = useRef(false)

  const effectiveEditingEntryId =
    entryId ?? (isActive ? value.entryId ?? persistedDraft?.entryId : undefined)
  const editingEntry = useMemo(
    () =>
      effectiveEditingEntryId
        ? entries.find((entry) => entry.id === effectiveEditingEntryId)
        : undefined,
    [effectiveEditingEntryId, entries],
  )

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    if (!isActive) {
      loadedEditorKeyRef.current = null
      return
    }

    if (storeStatus !== 'ready') {
      return
    }

    const editorKey = entryId ? `entry:${entryId}` : 'new-entry'

    if (!entryId && preparedNewEntryRef.current) {
      preparedNewEntryRef.current = false
      loadedEditorKeyRef.current = editorKey
      return
    }

    if (loadedEditorKeyRef.current === editorKey) {
      return
    }

    if (entryId && persistedDraft?.entryId === entryId) {
      const frameId = window.requestAnimationFrame(() => {
        loadedEditorKeyRef.current = editorKey
        const nextValue = draftToEditorValue(persistedDraft)
        latestValueRef.current = nextValue
        setValue(nextValue)
        setAutoSaveStatus('restored')
        setErrorMessage(undefined)
        changeRevisionRef.current = 0
        setChangeRevision(0)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    if (entryId && editingEntry) {
      const frameId = window.requestAnimationFrame(() => {
        loadedEditorKeyRef.current = editorKey
        const nextValue = entryToEditorValue(editingEntry)
        latestValueRef.current = nextValue
        setValue(nextValue)
        setAutoSaveStatus('idle')
        setErrorMessage(undefined)
        changeRevisionRef.current = 0
        setChangeRevision(0)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    if (!entryId && persistedDraft) {
      const frameId = window.requestAnimationFrame(() => {
        loadedEditorKeyRef.current = editorKey
        const nextValue = draftToEditorValue(persistedDraft)
        latestValueRef.current = nextValue
        setValue(nextValue)
        setAutoSaveStatus('restored')
        setErrorMessage(undefined)
        changeRevisionRef.current = 0
        setChangeRevision(0)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    if (!entryId) {
      const frameId = window.requestAnimationFrame(() => {
        loadedEditorKeyRef.current = editorKey
        const nextValue = createEmptyEditorValue(settings.isEntryLockEnabledByDefault)
        latestValueRef.current = nextValue
        setValue(nextValue)
        setAutoSaveStatus('idle')
        setErrorMessage(undefined)
        changeRevisionRef.current = 0
        setChangeRevision(0)
      })

      return () => window.cancelAnimationFrame(frameId)
    }
  }, [
    editingEntry,
    entryId,
    isActive,
    persistedDraft,
    settings.isEntryLockEnabledByDefault,
    storeStatus,
  ])

  useEffect(() => {
    if (!isActive || changeRevision === 0) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        if (hasDraftContent(value, settings.isEntryLockEnabledByDefault)) {
          await saveDraftToStore(value)
        } else {
          await clearDraftFromStore()
        }
        setAutoSaveStatus('saved')
      } catch {
        setAutoSaveStatus('error')
      }
    }, 650)

    pendingSaveRef.current = timeoutId

    return () => {
      window.clearTimeout(timeoutId)
      if (pendingSaveRef.current === timeoutId) {
        pendingSaveRef.current = null
      }
    }
  }, [
    changeRevision,
    clearDraftFromStore,
    isActive,
    saveDraftToStore,
    settings.isEntryLockEnabledByDefault,
    value,
  ])

  useEffect(() => {
    const resetExitSaveState = () => {
      if (isActive) {
        exitSaveRequestedRef.current = false
        suppressNextExitSaveRef.current = false
      }
    }
    resetExitSaveState()

    const saveBeforePageExit = () => {
      if (
        isActive &&
        storeStatus === 'ready' &&
        !suppressNextExitSaveRef.current &&
        !exitSaveRequestedRef.current &&
        changeRevisionRef.current > 0
      ) {
        exitSaveRequestedRef.current = true
        const exitSave = hasDraftContent(
          latestValueRef.current,
          settings.isEntryLockEnabledByDefault,
        )
          ? saveDraftToStore(latestValueRef.current)
          : clearDraftFromStore()
        void exitSave.catch(() => undefined)
      }
    }

    window.addEventListener('pagehide', saveBeforePageExit)
    window.addEventListener('pageshow', resetExitSaveState)

    return () => {
      window.removeEventListener('pagehide', saveBeforePageExit)
      window.removeEventListener('pageshow', resetExitSaveState)
      saveBeforePageExit()
    }
  }, [
    clearDraftFromStore,
    isActive,
    saveDraftToStore,
    settings.isEntryLockEnabledByDefault,
    storeStatus,
  ])

  const updateField = useCallback(
    <Key extends keyof SaveDiaryDraftInput>(
      field: Key,
      fieldValue: SaveDiaryDraftInput[Key],
    ) => {
      const currentValue = latestValueRef.current
      const nextValue: SaveDiaryDraftInput = { ...currentValue, [field]: fieldValue }

      if (field === 'content' && typeof fieldValue === 'string' && currentValue.type === 'quick') {
        nextValue.shortNote = fieldValue
      }
      latestValueRef.current = nextValue
      setValue(nextValue)
      changeRevisionRef.current += 1
      setChangeRevision(changeRevisionRef.current)
      setAutoSaveStatus('saving')
      setErrorMessage(undefined)
    },
    [],
  )

  const appendPrompt = useCallback((prompt: string) => {
    const currentValue = latestValueRef.current
    const nextContent = `${currentValue.content}${currentValue.content ? '\n\n' : ''}${prompt}\n`
    const nextValue = {
      ...currentValue,
      content: nextContent,
      contentHtml: appendDiaryDocumentParagraph(currentValue.contentHtml, currentValue.content, prompt),
      shortNote: currentValue.type === 'quick' ? nextContent : currentValue.shortNote,
    }
    latestValueRef.current = nextValue
    setValue(nextValue)
    changeRevisionRef.current += 1
    setChangeRevision(changeRevisionRef.current)
    setAutoSaveStatus('saving')
  }, [])

  const updateDocument = useCallback(
    (content: string, contentHtml: string) => {
      const currentValue = latestValueRef.current
      const nextValue: SaveDiaryDraftInput = {
        ...currentValue,
        content,
        contentHtml,
        images: currentValue.images.filter((image) => {
          if (image.role === 'cover') return true
          if (image.role === 'inline') return isDiaryImageReferenced(image, contentHtml)

          const wasLegacyInline = isDiaryImageReferenced(image, currentValue.contentHtml)
          return !wasLegacyInline || isDiaryImageReferenced(image, contentHtml)
        }),
        shortNote: currentValue.type === 'quick' ? content : currentValue.shortNote,
      }
      latestValueRef.current = nextValue
      setValue(nextValue)
      changeRevisionRef.current += 1
      setChangeRevision(changeRevisionRef.current)
      setAutoSaveStatus('saving')
      setErrorMessage(undefined)
    },
    [],
  )

  const saveEditor = useCallback(async () => {
    const content = value.content.trim()
    const isQuickEntry = value.type === 'quick'

    if (
      (!isQuickEntry && !content) ||
      (isQuickEntry && !content && !value.mood && value.activities.length === 0)
    ) {
      setErrorMessage(
        isQuickEntry
          ? '빠른 기록에는 감정, 활동 또는 한 줄 중 하나를 남겨 주세요.'
          : '기록 내용을 한 줄 이상 입력해 주세요.',
      )
      return
    }

    if (pendingSaveRef.current !== null) {
      window.clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = null
    }

    let savedEntry: DiaryEntry

    try {
      const commonInput = {
        diaryDate: value.diaryDate,
        title: value.title.trim() || undefined,
        contentHtml: value.contentHtml || undefined,
        mood: value.mood,
        energy: value.energy,
        activities: value.activities,
        tags: value.tags,
        images: value.images,
        weather: value.weather,
        location: value.location,
        isFavorite: value.isFavorite,
        isLocked: value.isLocked,
        shouldAnalyze: settings.isAiAnalysisEnabled,
        analysisTone: settings.aiTone,
        analysisResponseLength: settings.aiResponseLength,
      }
      const input = isQuickEntry
        ? {
            ...commonInput,
            type: 'quick' as const,
            shortNote: content,
          }
        : {
            ...commonInput,
            type: 'journal' as const,
            content,
          }
      savedEntry = editingEntry
        ? await updateEntry(editingEntry.id, input)
        : await createEntry(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : '일기를 저장하지 못했습니다.'
      setErrorMessage(message)
      onToast(message, 'error')
      return
    }

    suppressNextExitSaveRef.current = true
    let draftCleanupFailed = false
    let draftRelinkFailed = false

    try {
      await clearDraftFromStore()
    } catch {
      draftCleanupFailed = true

      if (!editingEntry) {
        try {
          await saveDraftToStore({ ...value, entryId: savedEntry.id })
        } catch {
          draftRelinkFailed = true
        }
      }
    }

    setAutoSaveStatus('idle')
    changeRevisionRef.current = 0
    setChangeRevision(0)
    setErrorMessage(undefined)

    if (draftCleanupFailed) {
      onToast(
        draftRelinkFailed
          ? '일기는 저장했지만 남은 임시저장을 연결하지 못했어요.'
          : editingEntry
            ? '일기는 수정했지만 임시저장을 정리하지 못했어요.'
            : '일기는 저장했고, 남은 임시저장은 저장한 기록에 연결했어요.',
        'error',
      )
    } else {
      onToast(editingEntry ? '일기를 수정했어요.' : '오늘의 일기를 저장했어요.', 'success')
    }

    onSaved(savedEntry)
  }, [
    clearDraftFromStore,
    createEntry,
    editingEntry,
    onSaved,
    onToast,
    saveDraftToStore,
    settings.isAiAnalysisEnabled,
    settings.aiResponseLength,
    settings.aiTone,
    updateEntry,
    value,
  ])

  const discardDraft = useCallback(async () => {
    try {
      await clearDraftFromStore()
      const nextValue = editingEntry
        ? entryToEditorValue(editingEntry)
        : createEmptyEditorValue(settings.isEntryLockEnabledByDefault)
      latestValueRef.current = nextValue
      setValue(nextValue)
      changeRevisionRef.current = 0
      setChangeRevision(0)
      setAutoSaveStatus('idle')
      setErrorMessage(undefined)
      loadedEditorKeyRef.current = null
      onToast(
        editingEntry ? '저장 전 변경 내용을 되돌렸어요.' : '임시저장을 비웠어요.',
        'info',
      )
    } catch (error) {
      onToast(error instanceof Error ? error.message : '임시저장을 비우지 못했습니다.', 'error')
    }
  }, [
    clearDraftFromStore,
    editingEntry,
    onToast,
    settings.isEntryLockEnabledByDefault,
  ])

  const prepareNewEntry = useCallback(
    async (diaryDate = toDateKey(new Date()), initialContent = '') => {
      try {
        await clearDraftFromStore()
      } catch {
        onToast('기존 임시저장을 정리하지 못했습니다.', 'error')
        return
      }

      const nextValue = {
        ...createEmptyEditorValue(settings.isEntryLockEnabledByDefault),
        diaryDate,
        content: initialContent,
      }
      const shouldPersistPreparedDraft = hasDraftContent(
        nextValue,
        settings.isEntryLockEnabledByDefault,
      )
      let preparedDraftStatus: DiaryAutoSaveStatus = 'idle'
      let preparedDraftRevision = 0

      if (shouldPersistPreparedDraft) {
        try {
          await saveDraftToStore(nextValue)
          preparedDraftStatus = 'saved'
        } catch {
          preparedDraftStatus = 'error'
          preparedDraftRevision = 1
          onToast(
            '작성 내용은 열었지만 임시저장하지 못했어요. 작성 화면에서 다시 저장을 시도할게요.',
            'error',
          )
        }
      }

      latestValueRef.current = nextValue
      setValue(nextValue)
      setAutoSaveStatus(preparedDraftStatus)
      setErrorMessage(undefined)
      changeRevisionRef.current = preparedDraftRevision
      setChangeRevision(preparedDraftRevision)
      preparedNewEntryRef.current = true
      loadedEditorKeyRef.current = null
    },
    [
      clearDraftFromStore,
      onToast,
      saveDraftToStore,
      settings.isEntryLockEnabledByDefault,
    ],
  )

  const addCoverImage = useCallback(
    async (file: File): Promise<DiaryImage | null> => {
      const currentImages = latestValueRef.current.images
      const existingCover = getStandaloneDiaryImages(latestValueRef.current)[0]

      if (!existingCover && currentImages.length >= 3) {
        onToast('사진은 최대 3장까지 첨부할 수 있어요.', 'error')
        return null
      }
      if (!file.type.startsWith('image/') || file.size > 350 * 1024) {
        onToast('이미지 파일만 장당 350KB 이하로 첨부해 주세요.', 'error')
        return null
      }

      try {
        const image = { ...await readImageFile(file), role: 'cover' as const }
        const imagesWithoutCover = currentImages.filter(
          (candidate) => candidate.role !== 'cover' && candidate.id !== existingCover?.id,
        )
        updateField('images', [image, ...imagesWithoutCover])

        return image
      } catch {
        onToast('사진을 읽지 못했습니다.', 'error')
        return null
      }
    },
    [onToast, updateField],
  )

  const addInlineImage = useCallback(
    async (file: File): Promise<DiaryImage | null> => {
      const currentImages = latestValueRef.current.images

      if (currentImages.length >= 3) {
        onToast('사진은 최대 3장까지 첨부할 수 있어요.', 'error')
        return null
      }

      if (!file.type.startsWith('image/') || file.size > 350 * 1024) {
        onToast('이미지 파일만 장당 350KB 이하로 첨부해 주세요.', 'error')
        return null
      }

      try {
        const image = { ...await readImageFile(file), role: 'inline' as const }
        window.setTimeout(() => {
          const latestImages = latestValueRef.current.images

          if (!latestImages.some((existingImage) => existingImage.id === image.id)) {
            updateField('images', [...latestImages, image])
          }
        })

        return image
      } catch {
        onToast('사진을 읽지 못했습니다.', 'error')
        return null
      }
    },
    [onToast, updateField],
  )

  const removeImage = useCallback(
    (imageId: string) => {
      updateField(
        'images',
        latestValueRef.current.images.filter((image) => image.id !== imageId),
      )
    },
    [updateField],
  )

  return {
    value,
    autoSaveStatus,
    errorMessage,
    isEditing: Boolean(editingEntry),
    isSaving: mutationStatus === 'saving',
    appendPrompt,
    addInlineImage,
    addCoverImage,
    discardDraft,
    prepareNewEntry,
    removeImage,
    saveEditor,
    updateField,
    updateDocument,
  }
}

function createEmptyEditorValue(isLocked: boolean): SaveDiaryDraftInput {
  return {
    type: 'journal',
    diaryDate: toDateKey(new Date()),
    title: '',
    content: '',
    contentHtml: '',
    shortNote: '',
    activities: [],
    tags: [],
    images: [],
    isFavorite: false,
    isLocked,
  }
}

function entryToEditorValue(entry: DiaryEntry): SaveDiaryDraftInput {
  return {
    entryId: entry.id,
    type: entry.type,
    diaryDate: entry.diaryDate,
    title: entry.title ?? '',
    content: entry.content ?? entry.shortNote ?? '',
    contentHtml: entry.contentHtml ?? '',
    shortNote: entry.shortNote ?? '',
    mood: entry.mood,
    energy: entry.energy,
    activities: entry.activities,
    tags: entry.tags,
    images: entry.images,
    weather: entry.weather,
    location: entry.location,
    isFavorite: entry.isFavorite,
    isLocked: entry.isLocked,
  }
}

function draftToEditorValue(draft: NonNullable<ReturnType<typeof useDiaryStore.getState>['draft']>): SaveDiaryDraftInput {
  return {
    id: draft.id,
    entryId: draft.entryId,
    type: draft.type,
    diaryDate: draft.diaryDate,
    title: draft.title,
    content: draft.content,
    contentHtml: draft.contentHtml ?? '',
    shortNote: draft.shortNote,
    mood: draft.mood,
    energy: draft.energy,
    activities: draft.activities,
    tags: draft.tags,
    images: draft.images,
    weather: draft.weather,
    location: draft.location,
    isFavorite: draft.isFavorite,
    isLocked: draft.isLocked,
  }
}

function hasDraftContent(
  value: SaveDiaryDraftInput,
  isLockedByDefault: boolean,
): boolean {
  return Boolean(
    value.entryId ||
      value.type !== 'journal' ||
      value.diaryDate !== toDateKey(new Date()) ||
      value.title.trim() ||
      value.content.trim() ||
      value.shortNote.trim() ||
      value.mood ||
      value.energy ||
      value.activities.length ||
      value.tags.length ||
      value.images.length ||
      value.weather?.condition?.trim() ||
      value.weather?.temperature !== undefined ||
      value.location?.name?.trim() ||
      value.isFavorite ||
      value.isLocked !== isLockedByDefault,
  )
}

function readImageFile(file: File): Promise<DiaryImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(reader.error)
    reader.onload = () =>
      resolve({
        id: createImageId(),
        url: String(reader.result),
        alt: createUploadedImageAlt(file.name),
      })
    reader.readAsDataURL(file)
  })
}

function createImageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createUploadedImageAlt(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  const looksLikeCameraFileName = /^(img|dsc|pxl|photo)\s*\d+$/i.test(baseName)

  return baseName && !looksLikeCameraFileName
    ? `${baseName} 사진`
    : '사용자가 일기에 첨부한 사진'
}
