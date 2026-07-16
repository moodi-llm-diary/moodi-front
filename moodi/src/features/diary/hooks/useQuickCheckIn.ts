import { useCallback, useState } from 'react'
import type { SettingsPreferences } from '../../settings/types/settings'
import { useDiaryStore } from '../stores/diaryStore'
import { toDateKey } from '../services/diaryQueryService'
import type { DailyCheckIn, DiaryEntry, Mood } from '../types/diary'

type UseQuickCheckInOptions = {
  settings: SettingsPreferences
  onSaved: (entry: DiaryEntry) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void
}

/** 빠른 기록 dialog의 form 상태와 저장 use-case를 조합한다. */
export function useQuickCheckIn({
  settings,
  onSaved,
  onToast,
}: UseQuickCheckInOptions) {
  const createEntry = useDiaryStore((state) => state.createEntry)
  const mutationStatus = useDiaryStore((state) => state.mutationStatus)
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState<DailyCheckIn>(() => createEmptyCheckIn())

  const open = useCallback(() => {
    setValue(createEmptyCheckIn())
    setIsOpen(true)
  }, [])

  const openWithMood = useCallback((mood: Mood) => {
    setValue({ ...createEmptyCheckIn(), mood })
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const updateField = useCallback(
    <Key extends keyof DailyCheckIn>(field: Key, fieldValue: DailyCheckIn[Key]) => {
      setValue((currentValue) => ({ ...currentValue, [field]: fieldValue }))
    },
    [],
  )

  const save = useCallback(async () => {
    if (!value.mood) {
      onToast('지금 감정을 먼저 선택해 주세요.', 'error')
      return
    }

    try {
      const savedEntry = await createEntry({
        type: 'quick',
        diaryDate: value.date,
        shortNote: value.shortNote?.trim() || undefined,
        mood: value.mood,
        energy: value.energy,
        activities: value.activities,
        tags: [],
        images: [],
        isFavorite: false,
        isLocked: settings.isEntryLockEnabledByDefault,
        shouldAnalyze: settings.isAiAnalysisEnabled,
        analysisTone: settings.aiTone,
        analysisResponseLength: settings.aiResponseLength,
      })

      setIsOpen(false)
      setValue(createEmptyCheckIn())
      onToast('빠른 기록을 저장했어요.', 'success')
      onSaved(savedEntry)
    } catch (error) {
      onToast(error instanceof Error ? error.message : '빠른 기록을 저장하지 못했습니다.', 'error')
    }
  }, [createEntry, onSaved, onToast, settings, value])

  return {
    isOpen,
    value,
    isSaving: mutationStatus === 'saving',
    close,
    open,
    openWithMood,
    save,
    updateField,
  }
}

function createEmptyCheckIn(): DailyCheckIn {
  return {
    date: toDateKey(new Date()),
    activities: [],
    shortNote: '',
  }
}
