import {
  ArrowUp,
  BookOpenText,
  Check,
  History,
  LoaderCircle,
  MessageCircleMore,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { JournalAIChatPhase } from '../../hooks/useJournalAIChat'
import type {
  AIConversation,
  JournalAIErrorCode,
  JournalAIMessage,
  JournalSource,
} from '../../types/journalAI'
import { getMoodVisual } from '../diaryUiConfig'
import { ConfirmDialog } from '../common/ConfirmDialog'
import './AIChatView.css'

const EMPTY_STATE_QUESTIONS = [
  '이번 주 기록을 요약해줘',
  '최근에 가장 편안했던 날을 찾아줘',
  '프로젝트와 관련된 기록을 모아줘',
  '지난달과 이번 달의 기분을 비교해줘',
]

export type AIChatViewProps = {
  activeConversation: AIConversation | null
  activeConversationId: string | null
  conversations: AIConversation[]
  errorCode: JournalAIErrorCode | null
  errorMessage: string | null
  isConversationMutating: boolean
  pendingAssistantContent: string
  phase: JournalAIChatPhase
  statusMessage: string | null
  suggestedQuestions: string[]
  onCancel: () => void
  onCreateConversation: () => Promise<AIConversation | null>
  onDeleteConversation: (conversationId: string) => Promise<boolean>
  onOpenConversation: (conversationId: string) => void
  onOpenEntry: (entryId: string) => void
  onOpenInsights: () => void
  onRenameConversation: (conversationId: string, title: string) => Promise<boolean>
  onRetry: () => Promise<void>
  onResetConversationStorage: () => Promise<boolean>
  onSendMessage: (content: string) => Promise<boolean>
}

/** 실제 기록 출처와 local adapter 상태를 분명히 드러내는 AI 탐색 화면이다. */
export function AIChatView({
  activeConversation,
  activeConversationId,
  conversations,
  errorCode,
  errorMessage,
  isConversationMutating,
  pendingAssistantContent,
  phase,
  statusMessage,
  suggestedQuestions,
  onCancel,
  onCreateConversation,
  onDeleteConversation,
  onOpenConversation,
  onOpenEntry,
  onOpenInsights,
  onRenameConversation,
  onRetry,
  onResetConversationStorage,
  onSendMessage,
}: AIChatViewProps) {
  const [composerValue, setComposerValue] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<AIConversation | null>(null)
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const composerContainerRef = useRef<HTMLFormElement>(null)
  const historyReturnFocusRef = useRef<HTMLButtonElement>(null)
  const historyDialogRef = useRef<HTMLElement>(null)
  const conversationRegionRef = useRef<HTMLDivElement>(null)
  const historyTitleId = useId()
  const isBusy = isConversationMutating ||
    ['sending', 'generating', 'streaming', 'cancelling'].includes(phase)

  useEffect(() => {
    const textarea = composerRef.current

    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 124)}px`
  }, [composerValue])

  useEffect(() => {
    const composer = composerContainerRef.current
    const page = composer?.closest<HTMLElement>('.ai-chat-page')

    if (!composer || !page) return
    const updateComposerHeight = () => {
      page.style.setProperty(
        '--ai-composer-height',
        `${Math.ceil(composer.getBoundingClientRect().height)}px`,
      )
    }
    const resizeObserver = new ResizeObserver(updateComposerHeight)

    updateComposerHeight()
    resizeObserver.observe(composer)

    return () => {
      resizeObserver.disconnect()
      page.style.removeProperty('--ai-composer-height')
    }
  }, [])

  useEffect(() => {
    if (!isHistoryOpen) return

    const previousOverflow = document.body.style.overflow
    const dialog = historyDialogRef.current
    const focusableSelector =
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
    const closeHistory = () => {
      setIsHistoryOpen(false)
      window.requestAnimationFrame(() => historyReturnFocusRef.current?.focus())
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHistory()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (!firstElement || !lastElement) return
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => dialog?.querySelector<HTMLElement>(focusableSelector)?.focus())

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isHistoryOpen])

  useEffect(() => {
    const region = conversationRegionRef.current
    if (!region || activeConversation?.messages.length === 0) return

    const latestMessage = region.querySelector<HTMLElement>('.ai-message-list > article:last-child')

    if (!latestMessage) return
    const regionBox = region.getBoundingClientRect()
    const messageBox = latestMessage.getBoundingClientRect()
    const messageTop = region.scrollTop + messageBox.top - regionBox.top

    region.scrollTo({ top: Math.max(0, messageTop - 8), behavior: 'smooth' })
  }, [activeConversation?.messages.length])

  useEffect(() => {
    if (!isBusy || isHistoryOpen) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCancel()
    }

    document.addEventListener('keydown', cancelOnEscape)

    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [isBusy, isHistoryOpen, onCancel])

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault()
    const content = composerValue.trim()

    if (!content || isBusy) return
    setComposerValue('')
    const didSend = await onSendMessage(content)

    if (!didSend) setComposerValue((currentValue) => currentValue.trim() ? currentValue : content)
  }

  const askQuestion = async (question: string) => {
    if (isBusy) return
    setComposerValue('')
    const didSend = await onSendMessage(question)

    if (!didSend) setComposerValue((currentValue) => currentValue.trim() ? currentValue : question)
  }

  const createConversation = async () => {
    if (isBusy) return
    const conversation = await onCreateConversation()

    if (conversation) {
      setIsHistoryOpen(false)
      window.requestAnimationFrame(() => composerRef.current?.focus())
    }
  }

  return (
    <section className="ai-chat-page" aria-labelledby="ai-chat-title">
      <header className="ai-chat-desktop-header">
        <div>
          <span className="ai-chat-eyebrow">
            <Search aria-hidden="true" size={15} /> 내 기록 탐색
          </span>
          <h1 id="ai-chat-title">Moodi AI</h1>
          <p>{activeConversation?.title ?? '새 대화'}</p>
        </div>
        <div className="ai-chat-header-actions">
          <button
            aria-expanded={isHistoryOpen}
            className="ai-chat-secondary-button"
            onClick={(event) => {
              historyReturnFocusRef.current = event.currentTarget
              setIsHistoryOpen(true)
            }}
            type="button"
          >
            <History aria-hidden="true" size={18} /> 대화 기록
          </button>
          <button
            className="ai-chat-primary-button"
            disabled={isBusy}
            onClick={() => void createConversation()}
            type="button"
          >
            <Plus aria-hidden="true" size={18} /> 새 대화
          </button>
        </div>
      </header>

      <div className="ai-local-disclosure" role="note">
        <span>안전한 기록 기반 AI</span>
        <p>서버가 권한이 있는 실제 기록만 근거로 답변을 만들어요. 잠긴 기록은 답변과 출처에서 제외됩니다.</p>
        <button
          aria-expanded={isHistoryOpen}
          aria-label="대화 기록 열기"
          className="ai-mobile-history-trigger"
          onClick={(event) => {
            historyReturnFocusRef.current = event.currentTarget
            setIsHistoryOpen(true)
          }}
          type="button"
        >
          <History aria-hidden="true" size={18} />
        </button>
      </div>

      <div
        aria-busy={isBusy}
        aria-live="polite"
        className="ai-conversation-region"
        ref={conversationRegionRef}
      >
        {phase === 'loading' ? (
          <div className="ai-chat-loading" role="status">
            <LoaderCircle aria-hidden="true" className="spin" size={22} />
            <span>대화 기록을 불러오고 있어요…</span>
          </div>
        ) : activeConversation?.messages.length ? (
          <div className="ai-message-list">
            {activeConversation.messages.map((message) => (
              <AIMessageItem key={message.id} message={message} onOpenEntry={onOpenEntry} />
            ))}
          </div>
        ) : (
          <AIEmptyState
            disabled={isBusy}
            onAsk={(question) => void askQuestion(question)}
            onOpenInsights={onOpenInsights}
          />
        )}

        {phase === 'streaming' && pendingAssistantContent && (
          <AIStreamingMessage content={pendingAssistantContent} />
        )}

        {['sending', 'generating', 'streaming', 'cancelling'].includes(phase) && (
          <div className="ai-search-progress" role="status">
            <span>
              <LoaderCircle aria-hidden="true" className="spin" size={18} />
              {getProgressMessage(phase)}
            </span>
            <button
              aria-label="AI 응답 생성 중단"
              disabled={phase === 'cancelling'}
              onClick={onCancel}
              type="button"
            >
              <X aria-hidden="true" size={17} /> 중단
            </button>
          </div>
        )}
        {phase === 'no-results' && (
          <p className="ai-chat-status" role="status">검색 결과가 없어 범위를 넓혀 다시 물어볼 수 있어요.</p>
        )}
        {errorMessage && (
          <div className="ai-chat-error" role="alert">
            <div>
              <strong>{getErrorHeading(errorCode)}</strong>
              <p>{errorMessage}</p>
            </div>
            <div className="ai-chat-error-actions">
              <button onClick={() => void onRetry()} type="button">다시 불러오기</button>
              {errorCode === 'storage-corrupted' && (
                <button onClick={() => setIsResetConfirmationOpen(true)} type="button">
                  AI 대화 기록 초기화
                </button>
              )}
            </div>
          </div>
        )}
        {statusMessage && <p className="ai-chat-status" role="status">{statusMessage}</p>}

        {activeConversation?.messages.length && !isBusy && suggestedQuestions.length > 0 ? (
          <section className="ai-follow-up" aria-label="이어 묻기">
            <span>이어 묻기</span>
            <div>
              {suggestedQuestions.map((question) => (
                <button key={question} onClick={() => void askQuestion(question)} type="button">
                  {question}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <form className="ai-composer" onSubmit={submitMessage} ref={composerContainerRef}>
        <label htmlFor="moodi-ai-composer">내 기록에 질문하기</label>
        <div>
          <textarea
            aria-describedby="moodi-ai-composer-help"
            disabled={phase === 'loading'}
            id="moodi-ai-composer"
            maxLength={1_200}
            onChange={(event) => setComposerValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="내 기록에 대해 무엇이든 물어보세요"
            ref={composerRef}
            rows={1}
            value={composerValue}
          />
          <button
            aria-label="질문 보내기"
            disabled={!composerValue.trim() || isBusy || phase === 'loading'}
            type="submit"
          >
            <ArrowUp aria-hidden="true" size={20} />
          </button>
        </div>
        <small id="moodi-ai-composer-help">Enter로 보내고 Shift+Enter로 줄을 바꿔요.</small>
      </form>

      {isHistoryOpen && (
        <div
          className="ai-history-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsHistoryOpen(false)
              window.requestAnimationFrame(() => historyReturnFocusRef.current?.focus())
            }
          }}
          role="presentation"
        >
          <aside
            aria-labelledby={historyTitleId}
            aria-modal="true"
            className="ai-history-dialog"
            ref={historyDialogRef}
            role="dialog"
          >
            <header>
              <div>
                <span>내 기록 탐색</span>
                <h2 id={historyTitleId}>대화 기록</h2>
              </div>
              <button
                aria-label="대화 기록 닫기"
                onClick={() => {
                  setIsHistoryOpen(false)
                  window.requestAnimationFrame(() => historyReturnFocusRef.current?.focus())
                }}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </header>

            <button className="ai-history-new" disabled={isBusy} onClick={() => void createConversation()} type="button">
              <Plus aria-hidden="true" size={18} /> 새 대화
            </button>

            <div className="ai-history-list">
              {conversations.length === 0 ? (
                <p>저장된 대화가 아직 없어요.</p>
              ) : (
                conversations.map((conversation) => (
                  <article
                    className={conversation.id === activeConversationId ? 'is-active' : undefined}
                    key={conversation.id}
                  >
                    {editingConversationId === conversation.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          if (isBusy) return
                          void onRenameConversation(conversation.id, editingTitle).then((didRename) => {
                            if (didRename) setEditingConversationId(null)
                          })
                        }}
                      >
                        <label>
                          <span className="sr-only">대화 이름</span>
                          <input
                            autoFocus
                            disabled={isBusy}
                            maxLength={80}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            value={editingTitle}
                          />
                        </label>
                        <button aria-label="대화 이름 저장" disabled={isBusy} type="submit"><Check aria-hidden="true" size={17} /></button>
                        <button aria-label="대화 이름 변경 취소" onClick={() => setEditingConversationId(null)} type="button"><X aria-hidden="true" size={17} /></button>
                      </form>
                    ) : (
                      <>
                        <button
                          className="ai-history-open"
                          disabled={isBusy}
                          onClick={() => {
                            onOpenConversation(conversation.id)
                            setIsHistoryOpen(false)
                          }}
                          type="button"
                        >
                          <MessageCircleMore aria-hidden="true" size={18} />
                          <span>
                            <strong>{conversation.title}</strong>
                            <small>{formatConversationDate(conversation.updatedAt)}</small>
                          </span>
                        </button>
                        <div className="ai-history-actions">
                          <button
                            aria-label={`${conversation.title} 이름 바꾸기`}
                            disabled={isBusy}
                            onClick={() => {
                              setEditingConversationId(conversation.id)
                              setEditingTitle(conversation.title)
                            }}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          <button
                            aria-label={`${conversation.title} 삭제`}
                            disabled={isBusy}
                            onClick={() => setConversationToDelete(conversation)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        confirmLabel="대화 삭제"
        description={conversationToDelete ? `“${conversationToDelete.title}” 대화를 서버에서 삭제합니다.` : ''}
        isOpen={conversationToDelete !== null}
        isPending={isBusy}
        onCancel={() => setConversationToDelete(null)}
        onConfirm={() => {
          if (!conversationToDelete || isBusy) return
          void onDeleteConversation(conversationToDelete.id).then((didDelete) => {
            if (didDelete) setConversationToDelete(null)
          })
        }}
        title="이 대화를 삭제할까요?"
        tone="danger"
      />

      <ConfirmDialog
        confirmLabel="AI 대화만 초기화"
        description="AI 대화만 서버에서 삭제합니다. 저장한 일기 원문은 유지됩니다."
        isOpen={isResetConfirmationOpen}
        isPending={isConversationMutating}
        onCancel={() => setIsResetConfirmationOpen(false)}
        onConfirm={() => {
          void onResetConversationStorage().then((didReset) => {
            if (didReset) setIsResetConfirmationOpen(false)
          })
        }}
        title="AI 대화 기록을 초기화할까요?"
        tone="danger"
      />
    </section>
  )
}

function AIEmptyState({
  disabled,
  onAsk,
  onOpenInsights,
}: {
  disabled: boolean
  onAsk: (question: string) => void
  onOpenInsights: () => void
}) {
  return (
    <div className="ai-empty-state">
      <span className="ai-empty-icon"><BookOpenText aria-hidden="true" size={23} /></span>
      <div>
        <h2>내 기록에서 찾아볼게요.</h2>
        <p>언제 있었던 일인지 찾거나, 최근의 감정과 생각을 실제 기록 안에서 함께 정리할 수 있어요.</p>
      </div>
      <div className="ai-suggested-questions" aria-label="추천 질문">
        {EMPTY_STATE_QUESTIONS.map((question) => (
          <button disabled={disabled} key={question} onClick={() => onAsk(question)} type="button">
            <Search aria-hidden="true" size={16} />
            <span>{question}</span>
          </button>
        ))}
      </div>
      <button className="ai-open-insights" onClick={onOpenInsights} type="button">
        <Sparkles aria-hidden="true" size={17} /> 최근 회고 보기
      </button>
      <p className="ai-empty-privacy">대화와 답변은 로그인한 내 계정의 서버 저장소에만 보관해요.</p>
    </div>
  )
}

function AIMessageItem({
  message,
  onOpenEntry,
}: {
  message: JournalAIMessage
  onOpenEntry: (entryId: string) => void
}) {
  if (message.role === 'user') {
    return (
      <article aria-label="내 질문" className="ai-user-message">
        <span>나</span>
        <p>{message.content}</p>
      </article>
    )
  }

  return (
    <article aria-label="Moodi AI 답변" className="ai-assistant-message">
      <header>
        <span className="ai-assistant-mark"><Search aria-hidden="true" size={16} /></span>
        <div>
          <strong>Moodi</strong>
          <small>기록 기반 AI 답변</small>
        </div>
      </header>
      <div className="ai-message-content">
        <SafeMessageContent content={message.content} />
      </div>
      {message.sources.length > 0 && (
        <section className="ai-message-sources" aria-label="답변에 사용한 기록">
          <header>
            <BookOpenText aria-hidden="true" size={17} />
            <h3>답변에 사용한 기록</h3>
            <span>{message.sources.length}</span>
          </header>
          <div>
            {message.sources.map((source) => (
              <JournalSourceCard key={`${message.id}-${source.entryId}`} onOpen={onOpenEntry} source={source} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

function AIStreamingMessage({ content }: { content: string }) {
  return (
    <article aria-label="Moodi AI 부분 답변" className="ai-assistant-message ai-streaming-message">
      <header>
        <span className="ai-assistant-mark"><Search aria-hidden="true" size={16} /></span>
        <div>
          <strong>Moodi</strong>
          <small>기록 기반 답변 생성 중</small>
        </div>
      </header>
      <div className="ai-message-content">
        <SafeMessageContent content={content} />
      </div>
    </article>
  )
}

function JournalSourceCard({
  source,
  onOpen,
}: {
  source: JournalSource
  onOpen: (entryId: string) => void
}) {
  const mood = source.mood ? getMoodVisual(source.mood) : undefined
  const MoodIcon = mood?.Icon

  return (
    <button className="journal-source-card" onClick={() => onOpen(source.entryId)} type="button">
      <span className="journal-source-date">{formatDiaryDate(source.diaryDate)}</span>
      <strong>{source.title ?? '제목 없는 기록'}</strong>
      {source.excerpt ? (
        <q>{source.excerpt}</q>
      ) : (
        <span className="journal-source-empty">이 기록에는 본문 미리보기가 없어요.</span>
      )}
      <span className="journal-source-footer">
        {mood && <span>{MoodIcon && <MoodIcon aria-hidden="true" size={14} />} {mood.label}</span>}
        <span>기록 열기 <BookOpenText aria-hidden="true" size={15} /></span>
      </span>
    </button>
  )
}

function SafeMessageContent({ content }: { content: string }) {
  const blocks = content.split('\n')
  const rendered: ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    rendered.push(
      <ul key={`list-${rendered.length}`}>
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{renderInline(item)}</li>)}
      </ul>,
    )
    listItems = []
  }

  blocks.forEach((line, index) => {
    if (line.startsWith('- ')) {
      listItems.push(line.slice(2))
      return
    }

    flushList()
    if (!line.trim()) return
    if (line.startsWith('### ')) {
      rendered.push(<h3 key={`heading-${index}`}>{renderInline(line.slice(4))}</h3>)
      return
    }
    rendered.push(<p key={`paragraph-${index}`}>{renderInline(line)}</p>)
  })
  flushList()

  return <>{rendered}</>
}

function renderInline(content: string): ReactNode {
  return content.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      : <Fragment key={`${part}-${index}`}>{part}</Fragment>,
  )
}

function formatDiaryDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
}

function formatConversationDate(timestamp: string): string {
  const date = new Date(timestamp)

  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date)
}

function getProgressMessage(phase: JournalAIChatPhase): string {
  if (phase === 'sending') return '질문을 대화에 저장하고 있어요…'
  if (phase === 'cancelling') return 'AI 응답 생성을 중단하고 있어요…'
  if (phase === 'streaming') return 'AI 답변을 표시하고 있어요…'

  return '실제 기록을 찾고 답변을 정리하고 있어요…'
}

function getErrorHeading(errorCode: JournalAIErrorCode | null): string {
  const headings: Record<JournalAIErrorCode, string> = {
    network: '네트워크에 연결할 수 없어요',
    'auth-expired': '로그인 정보가 만료되었어요',
    'service-unavailable': 'AI 서비스를 사용할 수 없어요',
    'source-load-failed': '기록 출처를 불러오지 못했어요',
    'storage-corrupted': 'AI 대화 기록이 손상됐어요',
    'storage-unavailable': '브라우저 저장소를 사용할 수 없어요',
    unknown: '요청을 완료하지 못했어요',
  }

  return headings[errorCode ?? 'unknown']
}
