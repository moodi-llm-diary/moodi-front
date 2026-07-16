import {
  ArrowRight,
  CalendarClock,
  Clock3,
  PenLine,
  Sparkles,
  Timer,
} from 'lucide-react'
import type { DiaryEntry, DiaryDraft, Mood } from '../../types/diary'
import { DiaryListItem } from '../DiaryListItem'
import { FeaturedDiaryEntry } from '../FeaturedDiaryEntry'
import { MoodSelector } from '../MoodSelector'
import { RelatedEntryCard } from '../RelatedEntryCard'
import { EmptyState, PageHeader } from '../common'
import './views.css'

const HOME_MOODS: readonly Mood[] = [
  'happy',
  'calm',
  'excited',
  'neutral',
  'tired',
  'anxious',
  'sad',
]

export type TodayViewProps = {
  entries: DiaryEntry[]
  todayEntries: DiaryEntry[]
  draft: DiaryDraft | null
  onThisDayEntries: DiaryEntry[]
  dailySentence: string
  question: string
  onOpenQuick: () => void
  onSelectMood: (mood: Mood) => void
  onStartJournal: () => void
  onStartFromQuestion: (question: string) => void
  onResumeDraft: () => void
  onOpenEntry: (entryId: string) => void
  onOpenEntries: () => void
  onOpenInsights: () => void
}

/** 오늘 한 가지 기록 행동과 필요한 기억만 차분하게 보여주는 시작 화면이다. */
export function TodayView({
  entries,
  todayEntries,
  draft,
  onThisDayEntries,
  dailySentence,
  question,
  onOpenQuick,
  onSelectMood,
  onStartJournal,
  onStartFromQuestion,
  onResumeDraft,
  onOpenEntry,
  onOpenEntries,
  onOpenInsights,
}: TodayViewProps) {
  const now = new Date()
  const featuredEntry = entries[0]
  const recentEntries = entries.slice(1, 3)
  const representativeEntry = todayEntries.find((entry) => entry.mood) ?? todayEntries[0]
  const onThisDayEntry = onThisDayEntries[0]

  return (
    <div className="diary-view today-view">
      <PageHeader
        description={dailySentence}
        eyebrow={formatTodayDate(now)}
        title={getGreeting(now.getHours())}
      />

      <section className="today-hero" aria-labelledby="today-hero-title">
        <div className="today-hero-copy">
          <div>
            <h2 id="today-hero-title">오늘은 어떤 하루였어?</h2>
            <p>정리되지 않은 마음도 그대로 남겨두면 괜찮아요.</p>
          </div>
          <div className="today-hero-actions">
            <button className="today-journal-cta" onClick={onStartJournal} type="button">
              <PenLine aria-hidden="true" size={18} />
              오늘 기록하기
            </button>
            <button className="today-quick-cta" onClick={onOpenQuick} type="button">
              <Timer aria-hidden="true" size={17} />
              기분만 남기기
            </button>
          </div>
        </div>
        <div className="today-mood-check-in">
          <MoodSelector
            compact
            label={representativeEntry?.mood ? '오늘 남긴 마음' : '지금 마음은 어디에 가까워?'}
            moods={HOME_MOODS}
            onChange={onSelectMood}
            value={representativeEntry?.mood}
          />
          <span>하나를 고르면 10초 기록으로 이어져요.</span>
        </div>
      </section>

      {draft && (
        <section className="today-draft" aria-labelledby="today-draft-title">
          <Clock3 aria-hidden="true" size={19} />
          <div>
            <span>쓰다 만 기록</span>
            <h2 id="today-draft-title">{draft.title || '작성 중인 기록'}</h2>
            <p>{draft.content.trim() || draft.shortNote.trim() || '아직 첫 문장을 기다리고 있어요.'}</p>
          </div>
          <button onClick={onResumeDraft} type="button">
            이어쓰기
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </section>
      )}

      <section className="today-list-section" aria-labelledby="today-recent-title">
        <header className="view-section-heading">
          <h2 id="today-recent-title">최근 기록</h2>
          {recentEntries.length > 0 && (
            <button className="view-text-button" onClick={onOpenEntries} type="button">
              모두 보기
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          )}
        </header>

        {featuredEntry ? (
          <div className="today-memory-stack">
            <FeaturedDiaryEntry entry={featuredEntry} onOpen={onOpenEntry} />
            {recentEntries.length > 0 && (
              <div className="today-recent-list">
                {recentEntries.map((entry) => (
                  <DiaryListItem compact entry={entry} key={entry.id} onOpen={onOpenEntry} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            action={{ label: '첫 기록 남기기', onClick: onStartJournal }}
            description="한 문장만 남겨도 다음에 다시 만날 기억이 시작돼요."
            title="아직 기록이 없어요"
          />
        )}
      </section>

      <section className="today-question-section" aria-labelledby="today-question-title">
        <Sparkles aria-hidden="true" size={19} />
        <div>
          <span className="view-eyebrow">오늘의 질문</span>
          <h2 id="today-question-title">{question}</h2>
        </div>
        <button onClick={() => onStartFromQuestion(question)} type="button">
          이 질문으로 쓰기
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </section>

      {onThisDayEntry && (
        <section className="today-on-this-day" aria-labelledby="today-memory-title">
          <header className="view-section-heading">
            <div>
              <CalendarClock aria-hidden="true" size={18} />
              <h2 id="today-memory-title">과거의 오늘</h2>
            </div>
          </header>
          <RelatedEntryCard entry={onThisDayEntry} onOpen={onOpenEntry} />
        </section>
      )}

      {entries.length > 0 && (
        <button className="today-reflection-link" onClick={onOpenInsights} type="button">
          이번 주를 조용히 돌아보기
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      )}
    </div>
  )
}

function getGreeting(hour: number): string {
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '잠시, 오늘에 머물러 봐요'

  return '오늘도 수고했어요'
}

function formatTodayDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}
