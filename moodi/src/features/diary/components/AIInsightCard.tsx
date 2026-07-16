import { ChevronDown, Sparkles } from 'lucide-react'
import type { AIInsight } from '../types/diary'

type AIInsightCardProps = {
  insight?: AIInsight
  isExpanded: boolean
  onToggle: () => void
}

/** 로컬 분석을 한마디와 선택적 질문으로 제한해 원문 뒤에 표시한다. */
export function AIInsightCard({ insight, isExpanded, onToggle }: AIInsightCardProps) {
  const pattern = insight?.patterns[0]
  const question = insight?.followUpQuestions[0]
  const hasMore = Boolean(pattern || question)

  return (
    <section className="ai-insight-card" aria-labelledby="ai-insight-title">
      <div className="ai-insight-heading">
        <span className="ai-insight-icon">
          <Sparkles aria-hidden="true" size={17} />
        </span>
        <div>
          <small id="ai-insight-title">Moodi가 남긴 한마디</small>
          <p>
            {insight?.summary ?? '이 기록에는 아직 Moodi가 덧붙인 메모가 없어요.'}
          </p>
        </div>
        {hasMore && (
          <button aria-expanded={isExpanded} onClick={onToggle} type="button">
            {isExpanded ? '접기' : '조금 더 보기'}
            <ChevronDown aria-hidden="true" className={isExpanded ? 'rotated' : ''} size={17} />
          </button>
        )}
      </div>

      {isExpanded && hasMore && (
        <div className="ai-insight-content">
          {pattern && (
            <p>
              <span>함께 떠올려 본 것</span>
              {pattern}
            </p>
          )}
          {question && (
            <p>
              <span>조금 더 생각해 볼 질문</span>
              {question}
            </p>
          )}
          <small>현재 브라우저 안에서 만든 규칙 기반 메모이며 의료적 판단이 아닙니다.</small>
        </div>
      )}
    </section>
  )
}
