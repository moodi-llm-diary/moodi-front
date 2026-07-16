import { Check } from 'lucide-react'
import type { Activity } from '../types/diary'
import { ACTIVITY_OPTIONS } from './diaryUiConfig'

type ActivitySelectorProps = {
  value: Activity[]
  onChange: (activities: Activity[]) => void
  compact?: boolean
  label?: string
}

/** 활동 값을 중복 없이 추가·제거하는 다중 선택 UI다. */
export function ActivitySelector({
  value,
  onChange,
  compact = false,
  label = '오늘 한 활동',
}: ActivitySelectorProps) {
  const toggleActivity = (activity: Activity) => {
    onChange(
      value.includes(activity)
        ? value.filter((selectedActivity) => selectedActivity !== activity)
        : [...value, activity],
    )
  }

  return (
    <fieldset className={`activity-selector ${compact ? 'compact' : ''}`}>
      <legend>{label}</legend>
      <div className="activity-options">
        {ACTIVITY_OPTIONS.map((option) => {
          const isSelected = value.includes(option.value)

          return (
            <button
              aria-pressed={isSelected}
              className={isSelected ? 'selected' : ''}
              key={option.value}
              onClick={() => toggleActivity(option.value)}
              type="button"
            >
              <option.Icon aria-hidden="true" size={17} />
              <span>{option.label}</span>
              {isSelected && <Check aria-hidden="true" className="selection-check" size={14} />}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
