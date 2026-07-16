import {
  ArrowLeft,
  BatteryMedium,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Edit3,
  Heart,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Star,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { DiaryEntry } from '../../types/diary'
import { AIInsightCard } from '../AIInsightCard'
import { MoodBadge } from '../MoodBadge'
import { RelatedEntryCard } from '../RelatedEntryCard'
import { getActivityLabel } from '../diaryUiConfig'
import { getStandaloneDiaryImages } from '../../services/diaryImageService'
import { EmptyState, PageHeader } from '../common'
import './views.css'
import { DiaryDocumentReader } from '../editor/DiaryDocumentReader'

export type EntryDetailViewProps = {
  entry: DiaryEntry | null
  previousEntry?: DiaryEntry
  nextEntry?: DiaryEntry
  relatedEntries: DiaryEntry[]
  isAIExpanded: boolean
  onBack: () => void
  onEdit: (entryId: string) => void
  onDelete: (entryId: string) => void
  onToggleFavorite: (entryId: string, isFavorite: boolean) => void
  onToggleAI: () => void
  onOpenEntry: (entryId: string) => void
}

/** 사용자 기록 원문과 Moodi 분석을 명확히 분리해 표시하는 읽기 화면이다. */
export function EntryDetailView({
  entry,
  previousEntry,
  nextEntry,
  relatedEntries,
  isAIExpanded,
  onBack,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleAI,
  onOpenEntry,
}: EntryDetailViewProps) {
  const menuDetailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!entry) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const menuDetails = menuDetailsRef.current

      if (menuDetails?.open && !menuDetails.contains(event.target as Node)) {
        menuDetails.open = false
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      const menuDetails = menuDetailsRef.current

      if (event.key !== 'Escape' || !menuDetails?.open) return

      event.preventDefault()
      menuDetails.open = false
      menuDetails.querySelector<HTMLElement>('summary')?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [entry])

  if (!entry) {
    return (
      <div className="diary-view entry-detail-view">
        <EmptyState
          action={{ label: '전체 기록으로 돌아가기', onClick: onBack }}
          description="삭제되었거나 찾을 수 없는 기록일 수 있어요."
          title="기록을 찾을 수 없어요"
        />
      </div>
    )
  }

  const standaloneImages = getStandaloneDiaryImages(entry)
  const [coverImage, ...additionalImages] = standaloneImages
  const entryTitle =
    entry.title || (entry.type === 'quick' ? '짧게 남긴 오늘' : '제목 없는 기록')
  const closeEntryMenu = () => {
    if (menuDetailsRef.current) menuDetailsRef.current.open = false
  }
  const hasContext = Boolean(
    entry.energy ||
      entry.activities.length ||
      entry.weather ||
      entry.location?.name ||
      entry.tags.length ||
      entry.aiTopics.length,
  )

  return (
    <div className="diary-view entry-detail-view">
      <PageHeader
        actions={
          <div className="entry-detail-actions">
            <button
              aria-label={entry.isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
              aria-pressed={entry.isFavorite}
              className={`view-icon-button ${entry.isFavorite ? 'is-favorite' : ''}`}
              onClick={() => onToggleFavorite(entry.id, !entry.isFavorite)}
              type="button"
            >
              <Heart
                aria-hidden="true"
                fill={entry.isFavorite ? 'currentColor' : 'none'}
                size={19}
              />
            </button>
          </div>
        }
        description={entry.type === 'quick' ? '빠른 기록' : '긴 일기'}
        eyebrow={formatEntryDateTime(entry)}
        leading={
          <button aria-label="이전 화면으로 돌아가기" className="view-icon-button" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        }
        meta={
          <div className="entry-detail-header-meta">
            <MoodBadge mood={entry.mood} />
            {entry.energy && (
              <span>
                <BatteryMedium aria-hidden="true" size={14} /> 에너지 {entry.energy}/5
              </span>
            )}
            {entry.tags.slice(0, 2).map((tag) => (
              <span className="entry-detail-header-tag" key={tag}>
                #{tag}
              </span>
            ))}
            {entry.isLocked && (
              <span>
                <LockKeyhole aria-hidden="true" size={14} /> 잠금 표시
              </span>
            )}
          </div>
        }
        title={entryTitle}
      />

      <article
        className="entry-reader"
        aria-label="사용자가 작성한 일기 본문"
        data-mood={entry.mood ?? 'none'}
      >
        {coverImage && (
          <div className="entry-image-grid count-1">
            <figure>
              <img alt={coverImage.alt ?? '일기 대표 사진'} src={coverImage.url} />
            </figure>
          </div>
        )}

        <div className="entry-reader-content">
          {entry.type === 'quick' ? (
            <p className="entry-short-note">
              {entry.shortNote || '감정과 활동만 남긴 빠른 기록입니다.'}
            </p>
          ) : (
            <DiaryDocumentReader content={entry.content} contentHtml={entry.contentHtml} />
          )}
        </div>

        {additionalImages.length > 0 && (
          <div
            className={`entry-image-grid entry-additional-images count-${Math.min(additionalImages.length, 3)}`}
            aria-label="일기의 추가 사진"
          >
            {additionalImages.map((image) => (
              <figure key={image.id}>
                <img alt={image.alt ?? '일기에 첨부된 추가 사진'} src={image.url} />
              </figure>
            ))}
          </div>
        )}

        {hasContext && (
          <details className="entry-context-details">
            <summary>기록 정보</summary>
            <div className="entry-context-content">
              <dl className="entry-metadata">
                {entry.energy && (
                  <div>
                    <dt>
                      <BatteryMedium aria-hidden="true" size={16} /> 에너지
                    </dt>
                    <dd>{entry.energy}/5</dd>
                  </div>
                )}
                {entry.activities.length > 0 && (
                  <div>
                    <dt>
                      <CalendarDays aria-hidden="true" size={16} /> 활동
                    </dt>
                    <dd>{entry.activities.map(getActivityLabel).join(', ')}</dd>
                  </div>
                )}
                {entry.weather && (
                  <div>
                    <dt>
                      <CloudSun aria-hidden="true" size={16} /> 날씨
                    </dt>
                    <dd>
                      {[entry.weather.condition, formatTemperature(entry.weather.temperature)]
                        .filter(Boolean)
                        .join(' · ') || '직접 입력한 날씨 정보'}
                    </dd>
                  </div>
                )}
                {entry.location?.name && (
                  <div>
                    <dt>
                      <MapPin aria-hidden="true" size={16} /> 장소
                    </dt>
                    <dd>{entry.location.name}</dd>
                  </div>
                )}
              </dl>

              <div className="entry-tag-groups">
                {entry.tags.length > 0 && (
                  <div>
                    <span>내가 남긴 태그</span>
                    <ul>
                      {entry.tags.map((tag) => (
                        <li key={tag}>#{tag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {entry.aiTopics.length > 0 && (
                  <div>
                    <span>
                      <Star aria-hidden="true" size={14} /> Moodi가 찾은 주제
                    </span>
                    <ul className="ai-topic-list">
                      {entry.aiTopics.map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </details>
        )}
      </article>

      <section className="entry-ai-section" aria-label="Moodi가 남긴 한마디">
        <AIInsightCard
          insight={entry.aiInsight}
          isExpanded={isAIExpanded}
          onToggle={onToggleAI}
        />
      </section>

      {relatedEntries.length > 0 && (
        <section className="entry-related-section" aria-labelledby="entry-related-title">
          <header className="view-section-heading">
            <div>
              <span className="view-eyebrow">connected memories</span>
              <h2 id="entry-related-title">관련된 과거 기록</h2>
            </div>
          </header>
          <div className="entry-related-grid">
            {relatedEntries.slice(0, 3).map((relatedEntry) => (
              <RelatedEntryCard
                entry={relatedEntry}
                key={relatedEntry.id}
                onOpen={onOpenEntry}
              />
            ))}
          </div>
        </section>
      )}

      <section className="entry-management-section" aria-label="기록 관리">
        <div>
          <span>이 기록 관리</span>
          <small>필요할 때 내용을 고치거나 기록을 삭제할 수 있어요.</small>
        </div>
        <details className="entry-detail-menu" ref={menuDetailsRef}>
          <summary aria-label="기록 관리 메뉴">
            <MoreHorizontal aria-hidden="true" size={20} />
          </summary>
          <div>
            <button
              onClick={() => {
                closeEntryMenu()
                onEdit(entry.id)
              }}
              type="button"
            >
              <Edit3 aria-hidden="true" size={17} />
              수정
            </button>
            <button
              className="is-danger"
              onClick={() => {
                closeEntryMenu()
                onDelete(entry.id)
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" size={17} />
              삭제
            </button>
          </div>
        </details>
      </section>

      <nav className="entry-sibling-navigation" aria-label="이전 및 다음 기록">
        {previousEntry ? (
          <button onClick={() => onOpenEntry(previousEntry.id)} type="button">
            <ChevronLeft aria-hidden="true" size={19} />
            <span>
              <small>이전 기록</small>
              <strong>{previousEntry.title || '제목 없는 기록'}</strong>
            </span>
          </button>
        ) : (
          <span />
        )}
        {nextEntry && (
          <button onClick={() => onOpenEntry(nextEntry.id)} type="button">
            <span>
              <small>다음 기록</small>
              <strong>{nextEntry.title || '제목 없는 기록'}</strong>
            </span>
            <ChevronRight aria-hidden="true" size={19} />
          </button>
        )}
      </nav>
    </div>
  )
}

function formatEntryDateTime(entry: DiaryEntry): string {
  const createdAt = new Date(entry.createdAt)
  const diaryDate = new Date(`${entry.diaryDate}T00:00:00`)
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(diaryDate)

  if (Number.isNaN(createdAt.getTime())) return dateLabel

  return `${dateLabel} · ${new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(createdAt)}`
}

function formatTemperature(temperature?: number): string | undefined {
  return typeof temperature === 'number' ? `${temperature}℃` : undefined
}
