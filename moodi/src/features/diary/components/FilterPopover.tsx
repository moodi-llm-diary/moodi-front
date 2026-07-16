import { useEffect, useRef, type RefObject } from 'react'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import type { Activity, DiaryEntryFilters, EntryType, Mood } from '../types/diary'
import { ACTIVITY_OPTIONS, MOOD_VISUAL_OPTIONS } from './diaryUiConfig'

type FilterPopoverProps = {
  isOpen: boolean
  filters: DiaryEntryFilters
  availableTags: string[]
  triggerRef?: RefObject<HTMLElement | null>
  onChange: (filters: DiaryEntryFilters) => void
  onClose: () => void
  onClear: () => void
}

/** 전체 기록의 복합 필터를 한 패널에서 편집한다. */
export function FilterPopover({
  isOpen,
  filters,
  availableTags,
  triggerRef,
  onChange,
  onClose,
  onClear,
}: FilterPopoverProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const frameId = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (
        !panelRef.current?.contains(target) &&
        !triggerRef?.current?.contains(target)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) {
    return null
  }

  const toggleMood = (mood: Mood) => {
    const moods = filters.moods ?? []
    onChange({
      ...filters,
      moods: moods.includes(mood)
        ? moods.filter((candidate) => candidate !== mood)
        : [...moods, mood],
    })
  }

  const toggleActivity = (activity: Activity) => {
    const activities = filters.activities ?? []
    onChange({
      ...filters,
      activities: activities.includes(activity)
        ? activities.filter((candidate) => candidate !== activity)
        : [...activities, activity],
    })
  }

  const toggleTag = (tag: string) => {
    const tags = filters.tags ?? []
    onChange({
      ...filters,
      tags: tags.includes(tag)
        ? tags.filter((candidate) => candidate !== tag)
        : [...tags, tag],
    })
  }

  const toggleEntryType = (entryType: EntryType) => {
    const entryTypes = filters.entryTypes ?? []
    onChange({
      ...filters,
      entryTypes: entryTypes.includes(entryType)
        ? entryTypes.filter((candidate) => candidate !== entryType)
        : [...entryTypes, entryType],
    })
  }

  return (
    <section
      aria-labelledby="filter-panel-title"
      className="filter-popover"
      ref={panelRef}
      role="dialog"
    >
      <header>
        <div>
          <SlidersHorizontal aria-hidden="true" size={17} />
          <h2 id="filter-panel-title">기록 필터</h2>
        </div>
        <button
          aria-label="필터 닫기"
          className="icon-button"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="filter-grid">
        <fieldset>
          <legend>날짜 범위</legend>
          <div className="date-filter-row">
            <label>
              <span>시작일</span>
              <input
                onChange={(event) => onChange({ ...filters, dateFrom: event.target.value || undefined })}
                type="date"
                value={filters.dateFrom ?? ''}
              />
            </label>
            <label>
              <span>종료일</span>
              <input
                onChange={(event) => onChange({ ...filters, dateTo: event.target.value || undefined })}
                type="date"
                value={filters.dateTo ?? ''}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>기록 종류</legend>
          <div className="filter-chip-row">
            {(['journal', 'quick'] as EntryType[]).map((entryType) => (
              <button
                aria-pressed={filters.entryTypes?.includes(entryType) ?? false}
                className={filters.entryTypes?.includes(entryType) ? 'selected' : ''}
                key={entryType}
                onClick={() => toggleEntryType(entryType)}
                type="button"
              >
                {entryType === 'journal' ? '긴 일기' : '빠른 기록'}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-span-full">
          <legend>감정</legend>
          <div className="filter-chip-row">
            {MOOD_VISUAL_OPTIONS.map((option) => (
              <button
                aria-pressed={filters.moods?.includes(option.value) ?? false}
                className={filters.moods?.includes(option.value) ? 'selected' : ''}
                key={option.value}
                onClick={() => toggleMood(option.value)}
                type="button"
              >
                <option.Icon aria-hidden="true" size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-span-full">
          <legend>활동</legend>
          <div className="filter-chip-row">
            {ACTIVITY_OPTIONS.map((option) => (
              <button
                aria-pressed={filters.activities?.includes(option.value) ?? false}
                className={filters.activities?.includes(option.value) ? 'selected' : ''}
                key={option.value}
                onClick={() => toggleActivity(option.value)}
                type="button"
              >
                <option.Icon aria-hidden="true" size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {availableTags.length > 0 && (
          <fieldset className="filter-span-full">
            <legend>사용자 태그</legend>
            <div className="filter-chip-row">
              {availableTags.map((tag) => (
                <button
                  aria-pressed={filters.tags?.includes(tag) ?? false}
                  className={filters.tags?.includes(tag) ? 'selected' : ''}
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  type="button"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>추가 조건</legend>
          <div className="filter-toggle-list">
            <label>
              <input
                checked={filters.isFavorite ?? false}
                onChange={(event) => onChange({ ...filters, isFavorite: event.target.checked || undefined })}
                type="checkbox"
              />
              즐겨찾기만
            </label>
            <label>
              <input
                checked={filters.hasImages ?? false}
                onChange={(event) => onChange({ ...filters, hasImages: event.target.checked || undefined })}
                type="checkbox"
              />
              사진이 있는 기록만
            </label>
          </div>
        </fieldset>
      </div>

      <footer>
        <button className="ghost-button" onClick={onClear} type="button">
          <RotateCcw aria-hidden="true" size={16} />
          모두 초기화
        </button>
        <button className="primary-button" onClick={onClose} type="button">필터 적용</button>
      </footer>
    </section>
  )
}
