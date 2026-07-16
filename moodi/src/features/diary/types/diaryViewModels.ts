import type { DiaryEntry, Mood } from './diaryDomain'

/** 월간 캘린더의 날짜 한 칸을 표현한다. */
export interface CalendarDayViewModel {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  entries: DiaryEntry[]
  representativeMood?: Mood
  journalCount: number
  quickCount: number
  hasImages: boolean
}
