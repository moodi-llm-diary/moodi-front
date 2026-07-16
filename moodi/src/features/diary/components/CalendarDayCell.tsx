import type { CSSProperties } from 'react'
import type { CalendarDayViewModel } from '../types/diary'
import { getMoodVisual } from './diaryUiConfig'

type CalendarDayCellProps = {
  day: CalendarDayViewModel
  onSelect: (date: string) => void
}

/** 월간 달력에서 날짜와 최대 두 개의 조용한 기억 표시만 보여준다. */
export function CalendarDayCell({ day, onSelect }: CalendarDayCellProps) {
  const mood = getMoodVisual(day.representativeMood)
  const label = [
    formatFullDate(day.date),
    day.isToday ? '오늘' : '',
    day.entries.length > 0 ? `기록 ${day.entries.length}개` : '기록 없음',
    mood ? `대표 감정 ${mood.label}` : '',
    day.hasImages ? '사진 있음' : '',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <button
      aria-label={label}
      aria-pressed={day.isSelected}
      className={[
        'calendar-day-cell',
        day.isCurrentMonth ? '' : 'outside-month',
        day.isToday ? 'today' : '',
        day.isSelected ? 'selected' : '',
        day.entries.length > 0 ? 'has-entry' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(day.date)}
      style={{ '--mood-color': mood?.color ?? 'transparent' } as CSSProperties}
      type="button"
    >
      <span className="calendar-day-number">{day.dayNumber}</span>
      <span className="calendar-day-indicators" aria-hidden="true">
        {mood && <i className="calendar-day-mood-dot" />}
        {day.entries.length > 0 && (
          <i className={day.hasImages ? 'calendar-day-photo-dot' : 'calendar-day-entry-dot'} />
        )}
      </span>
    </button>
  )
}

function formatFullDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${dateKey}T00:00:00`))
}
