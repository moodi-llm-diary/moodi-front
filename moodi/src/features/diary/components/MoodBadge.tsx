import type { Mood } from '../types/diary'
import { getMoodVisual } from './diaryUiConfig'

type MoodBadgeProps = {
  mood?: Mood
  showLabel?: boolean
}

/** 기록의 대표 감정을 색상만이 아니라 아이콘과 라벨로 함께 표시한다. */
export function MoodBadge({ mood, showLabel = true }: MoodBadgeProps) {
  const option = getMoodVisual(mood)

  if (!option) {
    return <span className="mood-badge empty">감정 미선택</span>
  }

  return (
    <span
      aria-label={`감정: ${option.label}`}
      className="mood-badge"
      style={{ '--mood-color': option.color } as React.CSSProperties}
    >
      <option.Icon aria-hidden="true" size={14} />
      {showLabel && <span>{option.label}</span>}
    </span>
  )
}
