import { ArrowRight } from 'lucide-react'
import type { DiaryEntry } from '../types/diary'
import { getDiaryCoverImage } from '../services/diaryImageService'
import { MoodBadge } from './MoodBadge'

type FeaturedDiaryEntryProps = {
  entry: DiaryEntry
  onOpen: (entryId: string) => void
}

/** 사진과 원문 미리보기를 중심으로 최근 기록 한 건을 강조한다. */
export function FeaturedDiaryEntry({ entry, onOpen }: FeaturedDiaryEntryProps) {
  const title = entry.title || (entry.type === 'quick' ? '짧게 남긴 오늘' : '제목 없는 기록')
  const preview = entry.content || entry.shortNote || '감정만 조용히 남긴 기록'
  const coverImage = getDiaryCoverImage(entry)

  return (
    <article
      className={`featured-diary-entry ${coverImage ? 'has-image' : 'without-image'}`}
      data-mood={entry.mood ?? 'none'}
    >
      {coverImage && (
        <div className="featured-diary-image">
          <img alt={coverImage.alt ?? '기록에 담긴 대표 사진'} src={coverImage.url} />
        </div>
      )}
      <div className="featured-diary-content">
        <div className="featured-diary-meta">
          <time dateTime={entry.diaryDate}>{formatEntryDate(entry.diaryDate)}</time>
          <MoodBadge mood={entry.mood} />
        </div>
        <h3>{title}</h3>
        <p>{preview}</p>
        {entry.tags.length > 0 && (
          <ul aria-label="기록 태그">
            {entry.tags.slice(0, 2).map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}
        <button onClick={() => onOpen(entry.id)} type="button">
          계속 읽기
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      </div>
    </article>
  )
}

function formatEntryDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateKey}T00:00:00`))
}
