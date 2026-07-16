import { ArrowRight, Sparkles } from 'lucide-react'
import type { DiaryEntry } from '../../types/diary'
import type { DiaryInsights } from '../../services/diaryQueryService'
import { DiaryListItem } from '../DiaryListItem'
import { WeeklyMoodChart } from '../WeeklyMoodChart'
import { getMoodVisual } from '../diaryUiConfig'
import { EmptyState, PageHeader } from '../common'
import './views.css'

export type InsightsViewProps = {
  insights: DiaryInsights
  reflectionEntries: DiaryEntry[]
  reflectionThemes: string[]
  reflectionThought?: string
  onOpenEntry: (entryId: string) => void
  onStartWriting: () => void
}

/** 한 문장, 한 시각화, 몇 개의 단서와 기록으로 주간 회고를 구성한다. */
export function InsightsView({
  insights,
  reflectionEntries,
  reflectionThemes,
  reflectionThought,
  onOpenEntry,
  onStartWriting,
}: InsightsViewProps) {
  const topMood = getMoodVisual(insights.topMood)
  return (
    <div className="diary-view insights-view">
      <PageHeader
        description="숫자보다 이번 주에 남은 마음을 먼저 바라봐요."
        eyebrow="한 주의 기록"
        title="이번 주 돌아보기"
      />

      {insights.totalEntries === 0 ? (
        <EmptyState
          action={{ label: '첫 기록 남기기', onClick: onStartWriting }}
          description="감정 하나만 남겨도 첫 번째 흐름이 시작돼요."
          title="아직 돌아볼 기록이 없어요"
        />
      ) : (
        <>
          <section className="insights-summary" aria-labelledby="insights-summary-title">
            <span className="insights-summary-icon">
              <Sparkles aria-hidden="true" size={20} />
            </span>
            <div>
              <span>이번 주의 한마디</span>
              <h2 id="insights-summary-title">{insights.summary}</h2>
              <p>
                이번 달 {insights.currentMonthEntries}개의 기록 · {insights.streakDays}일 이어짐
              </p>
            </div>
          </section>

          {!insights.hasEnoughData && (
            <p className="insights-growing-notice">
              아직 첫 흐름을 만드는 중이에요. 조금 더 쌓이면 반복되는 마음을 보여드릴게요.
            </p>
          )}

          <section className="insights-chart-panel" aria-labelledby="weekly-chart-title">
            <header className="view-section-heading">
              <div>
                <h2 id="weekly-chart-title">감정의 흐름</h2>
                {topMood && (
                  <p>
                    {(insights.moodDistribution[0]?.count ?? 0) >= 2
                      ? `${topMood.label}을 이번 주에 가장 자주 기록했어요.`
                      : `${topMood.label}을 이번 주 기록에 남겼어요.`}
                  </p>
                )}
              </div>
            </header>
            <WeeklyMoodChart points={insights.weeklyPoints} />
          </section>

          {reflectionThemes.length > 0 && (
            <section className="insights-themes" aria-labelledby="insights-themes-title">
              <h2 id="insights-themes-title">자주 머문 이야기</h2>
              <ul>
                {reflectionThemes.map((theme) => (
                  <li key={theme}>{theme}</li>
                ))}
              </ul>
            </section>
          )}

          {reflectionEntries.length > 0 && (
            <section className="insights-related" aria-labelledby="insights-related-title">
              <header className="view-section-heading">
                <h2 id="insights-related-title">이번 회고와 이어진 기록</h2>
              </header>
              <div>
                {reflectionEntries.map((entry) => (
                  <DiaryListItem compact entry={entry} key={entry.id} onOpen={onOpenEntry} />
                ))}
              </div>
            </section>
          )}

          {reflectionThought && (
            <section className="insights-moodi-note" aria-labelledby="insights-moodi-note-title">
              <span>Moodi가 남긴 회고</span>
              <p id="insights-moodi-note-title">{reflectionThought}</p>
              <button onClick={onStartWriting} type="button">
                오늘의 마음 이어 쓰기
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
