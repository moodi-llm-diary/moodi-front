import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { RefreshCw, X } from 'lucide-react'

const QUESTIONS = [
  '오늘 가장 마음에 오래 남은 순간은 무엇이었어?',
  '오늘의 나에게 가장 다정했던 선택은 무엇이었어?',
  '지금의 마음을 색으로 표현한다면 어떤 빛일까?',
  '오늘 다시 만나고 싶은 장면이 하나 있다면?',
]

/** 에디터 안에서 질문을 새로 받거나 닫고 일반 문단으로 바꾸는 전용 블록이다. */
export function MoodiQuestionNodeView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const question = String(node.attrs.question)

  return (
    <NodeViewWrapper className={`moodi-question-block ${selected ? 'is-selected' : ''}`}>
      <div className="moodi-question-heading" contentEditable={false}>
        <span className="moodi-question-label">Moodi · 조금 더 적어보고 싶다면</span>
        <div>
          <button
            aria-label="새 질문 받기"
            onClick={() => {
              const currentIndex = QUESTIONS.indexOf(question)
              updateAttributes({ question: QUESTIONS[(currentIndex + 1) % QUESTIONS.length] })
            }}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} />
          </button>
          <button
            aria-label="질문 닫기"
            onClick={() => {
              const position = getPos()
              if (typeof position === 'number') editor.chain().focus().deleteRange({ from: position, to: position + node.nodeSize }).run()
            }}
            type="button"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
      <p className="moodi-question-copy" contentEditable={false}>{question}</p>
      <NodeViewContent className="moodi-question-answer" />
      <button
        className="moodi-question-convert"
        contentEditable={false}
        onClick={() => {
          const position = getPos()
          if (typeof position !== 'number') return
          editor
            .chain()
            .focus()
            .deleteRange({ from: position, to: position + node.nodeSize })
            .insertContentAt(position, { type: 'paragraph', content: [{ type: 'text', text: question }] })
            .run()
        }}
        type="button"
      >
        일반 문단으로 바꾸기
      </button>
    </NodeViewWrapper>
  )
}
