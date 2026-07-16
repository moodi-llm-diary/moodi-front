import { ArrowUpRight, RefreshCw } from 'lucide-react'

type JournalPromptCardProps = {
  prompt: string
  onUse: (prompt: string) => void
  onRefresh: () => void
}

/** 본문 흐름을 방해하지 않는 선택적 질문 하나를 표시한다. */
export function JournalPromptCard({ prompt, onUse, onRefresh }: JournalPromptCardProps) {
  return (
    <section className="journal-prompt-card" aria-labelledby="journal-prompt-title">
      <span>조금 더 적어보고 싶다면</span>
      <h2 id="journal-prompt-title">{prompt}</h2>
      <div className="prompt-actions">
        <button onClick={() => onUse(prompt)} type="button">
          본문에 담기
          <ArrowUpRight aria-hidden="true" size={15} />
        </button>
        <button aria-label="다른 질문 보기" onClick={onRefresh} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          다른 질문
        </button>
      </div>
    </section>
  )
}
