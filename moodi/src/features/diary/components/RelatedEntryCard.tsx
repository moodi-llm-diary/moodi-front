import { ArrowUpRight } from 'lucide-react'
import type { DiaryEntry } from '../types/diary'
import { MoodBadge } from './MoodBadge'

type RelatedEntryCardProps = {
  entry: DiaryEntry
  onOpen: (entryId: string) => void
}

/** 현재 기록과 연결된 과거 기록으로 이동하는 작은 문맥 카드다. */
export function RelatedEntryCard({ entry, onOpen }: RelatedEntryCardProps) {
  return (
    <button className="related-entry-card" onClick={() => onOpen(entry.id)} type="button">
      <span>
        <time dateTime={entry.diaryDate}>{formatDate(entry.diaryDate)}</time>
        <strong>{entry.title || '제목 없는 기록'}</strong>
        <MoodBadge mood={entry.mood} />
      </span>
      <ArrowUpRight aria-hidden="true" size={17} />
    </button>
  )
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(`${dateKey}T00:00:00`),
  )
}
