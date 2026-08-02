import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../../settings/stores/settingsStore'
import type { MoodiRouteKey, ToastTone } from '../components/common'
import { JOURNAL_PROMPTS, DAILY_SENTENCES } from '../components/diaryUiConfig'
import {
  buildCalendarDays,
  buildDiaryInsights,
  buildTagIndex,
  filterDiaryEntries,
  findEntriesForTagIndex,
  findOnThisDayEntries,
  findWeeklyReflectionEntries,
  findWeeklyReflectionThemes,
  findWeeklyReflectionThought,
  parseDateKey,
  sortDiaryEntries,
  toDateKey,
  type TagIndexCategory,
} from '../services/diaryQueryService'
import {
  downloadDiaryExport,
  readDiaryImportFile,
} from '../services/diaryTransferService'
import { useDiaryStore } from '../stores/diaryStore'
import type { DiaryEntry, DiaryEntryFilters, Mood } from '../types/diary'
import { useDiaryEditor } from './useDiaryEditor'
import { useDiaryRoute, type DiaryLocation } from './useDiaryRoute'
import { useQuickCheckIn } from './useQuickCheckIn'
import { useJournalAIChat } from './useJournalAIChat'

type ToastState = {
  message: string | null
  tone: ToastTone
}

export type ConfirmationState =
  | { kind: 'entry'; entryId: string; title: string }
  | { kind: 'edit'; entryId: string; title: string }
  | { kind: 'all' }
  | { kind: 'import'; entries: DiaryEntry[] }
  | { kind: 'new' }
  | { kind: 'recover' }
  | null

/**
 * Moodi의 route별 UI use-case를 store, query service, editor hook 위에서 조합한다.
 */
export function useDiaryWorkspace() {
  const entries = useDiaryStore((state) => state.entries)
  const draft = useDiaryStore((state) => state.draft)
  const status = useDiaryStore((state) => state.status)
  const mutationStatus = useDiaryStore((state) => state.mutationStatus)
  const storeErrorMessage = useDiaryStore((state) => state.errorMessage)
  const initializationWarning = useDiaryStore((state) => state.initializationWarning)
  const initialize = useDiaryStore((state) => state.initialize)
  const deleteEntryFromStore = useDiaryStore((state) => state.deleteEntry)
  const setFavoriteInStore = useDiaryStore((state) => state.setFavorite)
  const replaceEntries = useDiaryStore((state) => state.replaceEntries)
  const deleteAllDiaryData = useDiaryStore((state) => state.deleteAllDiaryData)
  const recoverDiaryStorage = useDiaryStore((state) => state.recoverDiaryStorage)
  const saveDraftForPrompt = useDiaryStore((state) => state.saveDraft)
  const clearDraftFromStore = useDiaryStore((state) => state.clearDraft)
  const clearInitializationWarning = useDiaryStore(
    (state) => state.clearInitializationWarning,
  )
  const settings = useSettingsStore((state) => state.preferences)
  const { location, navigate, goBack } = useDiaryRoute()
  const previousLocationRef = useRef(location)
  const [toast, setToast] = useState<ToastState>({ message: null, tone: 'info' })
  const [filters, setFilters] = useState<DiaryEntryFilters>({})
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [calendarMoodFilter, setCalendarMoodFilter] = useState<Mood | 'all'>('all')
  const [calendarTagFilter, setCalendarTagFilter] = useState<string>('all')
  const [promptIndex, setPromptIndex] = useState(0)
  const [expandedAiInsightEntryId, setExpandedAiInsightEntryId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null)
  const [selectedTag, setSelectedTag] = useState<{
    category: TagIndexCategory
    value: string
  } | null>(
    null,
  )

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    let timeoutId: number | undefined

    const scheduleNextDay = () => {
      const now = new Date()
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      )

      timeoutId = window.setTimeout(() => {
        setTodayKey(toDateKey(new Date()))
        scheduleNextDay()
      }, nextDay.getTime() - now.getTime())
    }

    scheduleNextDay()

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (
      status !== 'ready' ||
      confirmation ||
      location.name !== 'write' ||
      !location.entryId
    ) {
      return
    }

    const targetEntry = entries.find((entry) => entry.id === location.entryId)

    if (targetEntry && (!draft || draft.entryId === location.entryId)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!targetEntry) {
        navigate({ name: 'entries' }, { replace: true })
        return
      }

      setConfirmation({
        kind: 'edit',
        entryId: targetEntry.id,
        title: targetEntry.title || '제목 없는 기록',
      })
      navigate({ name: 'entryDetail', entryId: targetEntry.id }, { replace: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [confirmation, draft, entries, location, navigate, status])

  useEffect(() => {
    if (!toast.message) return

    const timeoutId = window.setTimeout(
      () => setToast((current) => ({ ...current, message: null })),
      toast.tone === 'error' ? 5200 : 3200,
    )

    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    const previousLocation = previousLocationRef.current
    const isSameLocation =
      previousLocation.name === location.name &&
      ('entryId' in previousLocation ? previousLocation.entryId : undefined) ===
        ('entryId' in location ? location.entryId : undefined)

    if (isSameLocation) {
      return
    }

    previousLocationRef.current = location

    if (location.name === 'write') return

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById('moodi-main-content')?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [location])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => setToast({ message, tone }),
    [],
  )

  const handleEditorSaved = useCallback(
    (entry: DiaryEntry) => navigate({ name: 'entryDetail', entryId: entry.id }),
    [navigate],
  )

  const editor = useDiaryEditor({
    isActive: location.name === 'write',
    entryId: location.name === 'write' ? location.entryId : undefined,
    settings,
    onSaved: handleEditorSaved,
    onToast: showToast,
  })

  const quickCheckIn = useQuickCheckIn({
    settings,
    onSaved: () => undefined,
    onToast: showToast,
  })
  const journalAI = useJournalAIChat(entries, status === 'ready')

  const sortedEntries = useMemo(() => sortDiaryEntries(entries), [entries])
  const filteredEntries = useMemo(
    () => filterDiaryEntries(entries, filters),
    [entries, filters],
  )
  const todayEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.diaryDate === todayKey),
    [sortedEntries, todayKey],
  )
  const onThisDayEntries = useMemo(
    () => findOnThisDayEntries(entries, parseDateKey(todayKey)),
    [entries, todayKey],
  )
  const insights = useMemo(
    () => buildDiaryInsights(entries, parseDateKey(todayKey)),
    [entries, todayKey],
  )
  const reflectionEntries = useMemo(
    () => findWeeklyReflectionEntries(entries, parseDateKey(todayKey)),
    [entries, todayKey],
  )
  const reflectionThemes = useMemo(
    () => findWeeklyReflectionThemes(entries, parseDateKey(todayKey)),
    [entries, todayKey],
  )
  const reflectionThought = useMemo(
    () => findWeeklyReflectionThought(entries, parseDateKey(todayKey)),
    [entries, todayKey],
  )
  const availableTags = useMemo(
    () => Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort(),
    [entries],
  )
  const availableAiTopics = useMemo(
    () => Array.from(new Set(entries.flatMap((entry) => entry.aiTopics))).sort(),
    [entries],
  )
  const tagGroups = useMemo(() => buildTagIndex(entries), [entries])
  const tagMatchingEntries = useMemo(
    () =>
      selectedTag
        ? findEntriesForTagIndex(entries, selectedTag.category, selectedTag.value)
        : [],
    [entries, selectedTag],
  )
  const selectedTagLabel = useMemo(
    () =>
      selectedTag
        ? tagGroups
            .find((group) => group.category === selectedTag.category)
            ?.items.find((item) => item.value === selectedTag.value)?.label
        : undefined,
    [selectedTag, tagGroups],
  )

  const calendarEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesMood = calendarMoodFilter === 'all' || entry.mood === calendarMoodFilter
        const matchesTag =
          calendarTagFilter === 'all' ||
          entry.tags.includes(calendarTagFilter) ||
          entry.aiTopics.includes(calendarTagFilter)

        return matchesMood && matchesTag
      }),
    [calendarMoodFilter, calendarTagFilter, entries],
  )
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarCursor, calendarEntries, selectedDate, todayKey),
    [calendarCursor, calendarEntries, selectedDate, todayKey],
  )
  const selectedDateEntries = useMemo(
    () =>
      sortDiaryEntries(
        calendarEntries.filter((entry) => entry.diaryDate === selectedDate),
      ),
    [calendarEntries, selectedDate],
  )

  const currentEntry = useMemo(
    () =>
      location.name === 'entryDetail' && location.entryId
        ? entries.find((entry) => entry.id === location.entryId)
        : undefined,
    [entries, location],
  )
  const isAiInsightExpanded = currentEntry?.id === expandedAiInsightEntryId
  const setIsAiInsightExpanded = useCallback(
    (isExpanded: boolean) =>
      setExpandedAiInsightEntryId(isExpanded && currentEntry ? currentEntry.id : null),
    [currentEntry],
  )
  const currentEntryIndex = currentEntry
    ? sortedEntries.findIndex((entry) => entry.id === currentEntry.id)
    : -1
  const previousEntry = currentEntryIndex >= 0 ? sortedEntries[currentEntryIndex + 1] : undefined
  const nextEntry = currentEntryIndex > 0 ? sortedEntries[currentEntryIndex - 1] : undefined
  const relatedEntries = useMemo(() => {
    if (!currentEntry) return []

    const relatedIds = currentEntry.aiInsight?.relatedEntryIds ?? []
    const explicitRelatedEntries = relatedIds
      .map((entryId) => entries.find((entry) => entry.id === entryId))
      .filter(
        (entry): entry is DiaryEntry =>
          Boolean(entry && !entry.isLocked && !entry.id.startsWith('seed-')),
      )

    if (explicitRelatedEntries.length > 0) return explicitRelatedEntries

    return sortedEntries
      .filter(
        (entry) =>
          entry.id !== currentEntry.id &&
          !entry.isLocked &&
          !entry.id.startsWith('seed-') &&
          (entry.mood === currentEntry.mood ||
            entry.aiTopics.some((topic) => currentEntry.aiTopics.includes(topic))),
      )
      .slice(0, 3)
  }, [currentEntry, entries, sortedEntries])

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])
  const activeRoute: MoodiRouteKey =
    location.name === 'entryDetail' ? 'entries' : location.name
  const dailySentence = DAILY_SENTENCES[new Date().getDate() % DAILY_SENTENCES.length]
  const promptPool = useMemo(() => {
    if (!settings.isAiAnalysisEnabled || !settings.isPersonalizedQuestionsEnabled) {
      return JOURNAL_PROMPTS
    }

    const personalizedQuestions = Array.from(
      new Set(
        sortedEntries.flatMap(
          (entry) => entry.aiInsight?.followUpQuestions ?? [],
        ),
      ),
    )

    return personalizedQuestions.length > 0 ? personalizedQuestions : JOURNAL_PROMPTS
  }, [settings.isAiAnalysisEnabled, settings.isPersonalizedQuestionsEnabled, sortedEntries])
  const currentPrompt = promptPool[promptIndex % promptPool.length]

  const navigateTo = useCallback(
    (nextLocation: DiaryLocation) => {
      navigate(nextLocation)
    },
    [navigate],
  )

  const navigateFromShell = useCallback(
    (route: MoodiRouteKey) => navigateTo({ name: route }),
    [navigateTo],
  )

  const openEntry = useCallback(
    (entryId: string) => navigateTo({ name: 'entryDetail', entryId }),
    [navigateTo],
  )

  const editEntry = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId)

      if (draft && draft.entryId !== entryId) {
        setConfirmation({
          kind: 'edit',
          entryId,
          title: entry?.title || '제목 없는 기록',
        })
        return
      }

      navigateTo({ name: 'write', entryId })
    },
    [draft, entries, navigateTo],
  )

  const toggleFavorite = useCallback(
    async (entryId: string, isFavorite?: boolean) => {
      try {
        await setFavoriteInStore(entryId, isFavorite)
        showToast(isFavorite ? '즐겨찾기에 추가했어요.' : '즐겨찾기에서 뺐어요.', 'success')
      } catch (error) {
        showToast(error instanceof Error ? error.message : '즐겨찾기를 바꾸지 못했습니다.', 'error')
      }
    },
    [setFavoriteInStore, showToast],
  )

  const requestEntryDelete = useCallback(
    (entry: DiaryEntry) =>
      setConfirmation({
        kind: 'entry',
        entryId: entry.id,
        title: entry.title || '제목 없는 기록',
      }),
    [],
  )

  const confirmPendingAction = useCallback(async () => {
    if (!confirmation) return

    if (['entry', 'all', 'recover', 'import'].includes(confirmation.kind)) {
      journalAI.cancelMessage()
    }

    try {
      if (confirmation.kind === 'entry') {
        await deleteEntryFromStore(confirmation.entryId)
        setConfirmation(null)
        showToast('기록을 삭제했어요.', 'success')
        navigate({ name: 'entries' })
        return
      }

      if (confirmation.kind === 'edit') {
        await clearDraftFromStore()
        setConfirmation(null)
        navigate({ name: 'write', entryId: confirmation.entryId })
        return
      }

      if (confirmation.kind === 'all') {
        await deleteAllDiaryData()
        setConfirmation(null)
        showToast('일기, 임시저장, 사진과 AI 대화를 모두 삭제했어요. 계정과 설정은 유지됩니다.', 'success')
        navigate({ name: 'home' })
        return
      }

      if (confirmation.kind === 'new') {
        await editor.prepareNewEntry(todayKey)
        setConfirmation(null)
        navigate({ name: 'write' })
        return
      }

      if (confirmation.kind === 'recover') {
        await recoverDiaryStorage()
        setConfirmation(null)
        showToast('손상된 저장소를 비우고 새로 시작할 준비를 마쳤어요.', 'success')
        navigate({ name: 'home' })
        return
      }

      const importResult = await replaceEntries(confirmation.entries)
      setConfirmation(null)
      showToast(
        importResult.draftCleanupFailed
          ? `${importResult.entries.length}개의 기록을 가져왔지만 기존 임시저장을 정리하지 못했어요.`
          : `${importResult.entries.length}개의 기록을 가져왔어요.`,
        importResult.draftCleanupFailed ? 'error' : 'success',
      )
      navigate({ name: 'entries' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.', 'error')
    }
  }, [
    confirmation,
    clearDraftFromStore,
    deleteAllDiaryData,
    deleteEntryFromStore,
    editor,
    journalAI,
    navigate,
    replaceEntries,
    recoverDiaryStorage,
    showToast,
    todayKey,
  ])

  const exportEntries = useCallback(async () => {
    try {
      await downloadDiaryExport()
      showToast('기록 내보내기 파일을 만들었어요.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '기록을 내보내지 못했습니다.', 'error')
    }
  }, [showToast])

  const requestImport = useCallback(
    async (file: File) => {
      try {
        const importedEntries = await readDiaryImportFile(file)
        setConfirmation({ kind: 'import', entries: importedEntries })
      } catch (error) {
        showToast(error instanceof Error ? error.message : '파일을 가져오지 못했습니다.', 'error')
      }
    },
    [showToast],
  )

  const moveCalendarMonth = useCallback((offset: number) => {
    const nextCursor = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth() + offset,
      1,
    )

    setCalendarCursor(nextCursor)
    setSelectedDate(toDateKey(nextCursor))
  }, [calendarCursor])

  const moveCalendarToToday = useCallback(() => {
    const today = new Date()
    setCalendarCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(toDateKey(today))
  }, [])

  const selectCalendarDate = useCallback((date: string) => setSelectedDate(date), [])

  const writeSelectedDate = useCallback(async () => {
    if (!draft) {
      await editor.prepareNewEntry(selectedDate)
    } else {
      showToast('작성 중이던 임시저장을 먼저 이어서 열었어요.', 'info')
    }
    navigate({ name: 'write' })
  }, [draft, editor, navigate, selectedDate, showToast])

  const requestStartNewJournal = useCallback(async () => {
    if (draft) {
      setConfirmation({ kind: 'new' })
      return
    }

    await editor.prepareNewEntry(todayKey)
    navigate({ name: 'write' })
  }, [draft, editor, navigate, todayKey])

  const startWritingFromPrompt = useCallback(
    async (prompt: string) => {
      try {
        if (draft) {
          await saveDraftForPrompt({
            ...draft,
            content: `${draft.content}${draft.content ? '\n\n' : ''}${prompt}\n`,
          })
        } else {
          await editor.prepareNewEntry(todayKey, `${prompt}\n`)
        }

        navigate({ name: 'write' })
      } catch (error) {
        showToast(error instanceof Error ? error.message : '질문을 임시저장에 넣지 못했습니다.', 'error')
      }
    },
    [draft, editor, navigate, saveDraftForPrompt, showToast, todayKey],
  )

  const clearFilters = useCallback(() => setFilters({}), [])
  const toggleFilter = useCallback(
    () => setIsFilterOpen((currentValue) => !currentValue),
    [],
  )
  const refreshPrompt = useCallback(() => {
    setPromptIndex((index) => index + 1)
  }, [])

  return {
    activeFilterCount,
    activeRoute,
    availableAiTopics,
    availableTags,
    calendarDays,
    calendarMoodFilter,
    calendarTagFilter,
    calendarTitle: `${calendarCursor.getFullYear()}년 ${calendarCursor.getMonth() + 1}월`,
    confirmation,
    currentEntry,
    currentPrompt,
    dailySentence,
    draft,
    editor,
    entries,
    filteredEntries,
    filters,
    insights,
    journalAI,
    initializationWarning,
    isAiInsightExpanded,
    isFilterOpen,
    location,
    mutationStatus,
    nextEntry,
    onThisDayEntries,
    previousEntry,
    quickCheckIn,
    reflectionEntries,
    reflectionThemes,
    reflectionThought,
    relatedEntries,
    selectedDate,
    selectedDateEntries,
    selectedTag,
    settings,
    sortedEntries,
    status,
    storeErrorMessage,
    startWritingFromPrompt,
    tagGroups,
    tagMatchingEntries,
    toast,
    todayEntries,
    todayKey,
    selectedTagLabel,
    writeSelectedDate,
    cancelConfirmation: () => setConfirmation(null),
    clearFilters,
    clearInitializationWarning,
    confirmPendingAction,
    editEntry,
    exportEntries,
    goBack,
    moveCalendarMonth,
    moveCalendarToToday,
    navigateFromShell,
    navigateTo,
    openEntry,
    refreshPrompt,
    retryInitialize: initialize,
    requestDeleteAll: () => setConfirmation({ kind: 'all' }),
    requestEntryDelete,
    requestImport,
    requestStorageRecovery: () => setConfirmation({ kind: 'recover' }),
    requestStartNewJournal,
    selectCalendarDate,
    setCalendarMoodFilter,
    setCalendarTagFilter,
    setFilters,
    setIsAiInsightExpanded,
    setIsFilterOpen,
    setSelectedTag,
    setToast,
    showToast,
    toggleFavorite,
    toggleFilter,
  }
}

function countActiveFilters(filters: DiaryEntryFilters): number {
  return [
    filters.dateFrom,
    filters.dateTo,
    filters.moods?.length,
    filters.activities?.length,
    filters.tags?.length,
    filters.isFavorite,
    filters.hasImages,
    filters.entryTypes?.length,
  ].filter(Boolean).length
}
