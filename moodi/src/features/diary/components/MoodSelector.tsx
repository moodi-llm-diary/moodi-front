import type { Mood } from '../types/diary'
import { MOOD_VISUAL_OPTIONS } from './diaryUiConfig'

type MoodSelectorProps = {
  value?: Mood
  onChange: (mood: Mood) => void
  compact?: boolean
  label?: string
  moods?: readonly Mood[]
  onClear?: () => void
}

/** 아이콘, 색상, 텍스트를 함께 제공하는 감정 선택 UI다. */
export function MoodSelector({
  value,
  onChange,
  compact = false,
  label = '현재 감정',
  moods,
  onClear,
}: MoodSelectorProps) {
  const visibleOptions = moods
    ? MOOD_VISUAL_OPTIONS.filter((option) => moods.includes(option.value))
    : MOOD_VISUAL_OPTIONS

  return (
    <fieldset className={`mood-selector ${compact ? 'compact' : ''}`}>
      <legend>{label}</legend>
      {value && onClear && (
        <button className="selector-clear-button" onClick={onClear} type="button">
          감정 선택 지우기
        </button>
      )}
      <div className="mood-selector-grid">
        {visibleOptions.map((option) => {
          const isSelected = value === option.value

          return (
            <button
              aria-label={`${option.label}: ${option.description}`}
              aria-pressed={isSelected}
              className={`mood-option ${isSelected ? 'selected' : ''}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              style={{ '--mood-color': option.color } as React.CSSProperties}
              type="button"
            >
              <span className="mood-option-icon">
                <option.Icon aria-hidden="true" size={compact ? 17 : 19} />
              </span>
              <span>{compact ? option.shortLabel : option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
