import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  RotateCcw,
} from 'lucide-react'
import type { CalendarDayViewModel, DiaryEntry, Mood } from '../../types/diary'
import { MOODS } from '../../types/diary'
import { CalendarDayCell } from '../CalendarDayCell'
import { DiaryListItem } from '../DiaryListItem'
import { getMoodVisual } from '../diaryUiConfig'
import { EmptyState, PageHeader } from '../common'
import './views.css'

export type CalendarWorkspaceViewProps = {
  calendarDays: CalendarDayViewModel[]
  calendarTitle: string
  selectedDate: string
  selectedDateEntries: DiaryEntry[]
  weekdayLabels: string[]
  moodFilter?: Mood
  tagFilter?: string
  moodOptions?: readonly Mood[]
  tagOptions: string[]
  onMoveMonth: (offset: number) => void
  onMoveToToday: () => void
  onSelectDate: (date: string) => void
  onMoodFilterChange: (mood?: Mood) => void
  onTagFilterChange: (tag?: string) => void
  onOpenEntry: (entryId: string) => void
  onWriteSelectedDate: () => void
}

/** 월간 감정 흐름과 날짜 선택 event를 표시하는 calendar workspace다. */
export function CalendarWorkspaceView({
  calendarDays,
  calendarTitle,
  selectedDate,
  selectedDateEntries,
  weekdayLabels,
  moodFilter,
  tagFilter,
  moodOptions = MOODS,
  tagOptions,
  onMoveMonth,
  onMoveToToday,
  onSelectDate,
  onMoodFilterChange,
  onTagFilterChange,
  onOpenEntry,
  onWriteSelectedDate,
}: CalendarWorkspaceViewProps) {
  return (
    <div className="diary-view calendar-workspace-view">
      <PageHeader
        description="날짜를 눌러 그날의 기록을 다시 만나보세요."
        eyebrow="기억의 달력"
        title="캘린더"
      />

      <section className="calendar-workspace" aria-labelledby="calendar-workspace-title">
        <header className="calendar-workspace-header">
          <div className="calendar-title-controls">
            <h2 id="calendar-workspace-title">{calendarTitle}</h2>
            <div className="calendar-month-actions">
              <button aria-label="이전 달" onClick={() => onMoveMonth(-1)} type="button">
                <ChevronLeft aria-hidden="true" size={20} />
              </button>
              <button onClick={onMoveToToday} type="button">
                <RotateCcw aria-hidden="true" size={16} />
                오늘
              </button>
              <button aria-label="다음 달" onClick={() => onMoveMonth(1)} type="button">
                <ChevronRight aria-hidden="true" size={20} />
              </button>
            </div>
          </div>

          <details className="calendar-filter-disclosure">
            <summary>기록 좁혀보기</summary>
            <div className="calendar-filter-controls" aria-label="캘린더 기록 필터">
              <label>
                <span>감정</span>
                <select
                  onChange={(event) =>
                    onMoodFilterChange((event.target.value || undefined) as Mood | undefined)
                  }
                  value={moodFilter ?? ''}
                >
                  <option value="">모든 감정</option>
                  {moodOptions.map((mood) => (
                    <option key={mood} value={mood}>
                      {getMoodVisual(mood)?.label ?? mood}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>태그</span>
                <select
                  onChange={(event) => onTagFilterChange(event.target.value || undefined)}
                  value={tagFilter ?? ''}
                >
                  <option value="">모든 태그</option>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      #{tag}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
        </header>

        <div
          aria-label="월간 캘린더 가로 스크롤 영역"
          className="calendar-scroll-area"
          tabIndex={0}
        >
          <div className="calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div
            aria-label={`${calendarTitle} 월간 기록`}
            className="calendar-days-grid"
            role="group"
          >
            {calendarDays.map((day) => (
              <div key={day.date}>
                <CalendarDayCell day={day} onSelect={onSelectDate} />
              </div>
            ))}
          </div>
        </div>

      </section>

      <section className="calendar-mobile-selection" aria-labelledby="calendar-selected-title">
        <header className="view-section-heading">
          <div>
            <h2 id="calendar-selected-title">{formatSelectedDate(selectedDate)}</h2>
          </div>
          <button className="view-primary-button" onClick={onWriteSelectedDate} type="button">
            <Edit3 aria-hidden="true" size={16} />
            기록하기
          </button>
        </header>
        {selectedDateEntries.length > 0 ? (
          <div className="calendar-selected-list">
            {selectedDateEntries.map((entry) => (
              <DiaryListItem compact entry={entry} key={entry.id} onOpen={onOpenEntry} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={{ label: '이 날짜에 기록하기', onClick: onWriteSelectedDate }}
            description="감정 하나만 빠르게 남기거나 긴 일기를 시작할 수 있어요."
            title="선택한 날짜에 기록이 없어요"
          />
        )}
      </section>
    </div>
  )
}

function formatSelectedDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${dateKey}T00:00:00`))
}
