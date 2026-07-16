import { ChevronRight } from 'lucide-react'
import type { DiaryEntry } from '../types/diary'
import { getDiaryCoverImage } from '../services/diaryImageService'
import { MoodBadge } from './MoodBadge'

type DiaryListItemProps = {
  entry: DiaryEntry
  onOpen: (entryId: string) => void
  compact?: boolean
}

/** 날짜, 본문 단서, 대표 사진과 감정만 보여주는 기록 행이다. */
export function DiaryListItem({ entry, onOpen, compact = false }: DiaryListItemProps) {
  const preview = entry.shortNote || entry.content || '감정만 조용히 남긴 기록'
  const title = entry.title || (entry.type === 'quick' ? '짧게 남긴 오늘' : '제목 없는 기록')
  const coverImage = getDiaryCoverImage(entry)
  const hasThumbnail = !compact && Boolean(coverImage)

  return (
    <button
      aria-label={`${entry.diaryDate} ${title} 상세 보기`}
      className={[
        'diary-list-item',
        compact ? 'compact' : '',
        hasThumbnail ? 'has-thumbnail' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-mood={entry.mood ?? 'none'}
      onClick={() => onOpen(entry.id)}
      type="button"
    >
      <time dateTime={entry.diaryDate}>
        <strong>{new Date(`${entry.diaryDate}T00:00:00`).getDate()}</strong>
        <span>{formatMonth(entry.diaryDate)}</span>
      </time>
      {hasThumbnail && coverImage && (
        <span className="diary-list-thumbnail" aria-hidden="true">
          <img alt="" src={coverImage.url} />
        </span>
      )}
      <span className="diary-list-content">
        <span className="diary-list-title">{title}</span>
        <span className="diary-list-preview">{preview}</span>
        {(entry.mood || (!compact && entry.tags.length > 0)) && (
          <span className="diary-list-meta">
            <MoodBadge mood={entry.mood} />
            {!compact && entry.tags.length > 0 && (
              <span className="diary-list-tags">
                {entry.tags.slice(0, 2).map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </span>
            )}
          </span>
        )}
      </span>
      <ChevronRight aria-hidden="true" className="diary-list-arrow" size={18} />
    </button>
  )
}

function formatMonth(dateKey: string): string {
  return `${new Date(`${dateKey}T00:00:00`).getMonth() + 1}월`
}
