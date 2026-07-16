import type { Mood } from './diaryDomain'

/** 채팅 답변을 만든 구현체를 UI에서 정직하게 구분한다. */
export type JournalAIAdapterKind = 'local-search' | 'external-ai'

export type JournalAIMessageRole = 'user' | 'assistant'

export type JournalAIErrorCode =
  | 'network'
  | 'auth-expired'
  | 'service-unavailable'
  | 'source-load-failed'
  | 'storage-corrupted'
  | 'storage-unavailable'
  | 'unknown'

export type JournalAIProgressEvent =
  | { type: 'generating' }
  | { type: 'streaming'; content: string }

/** 답변의 근거가 된 실제 일기 스냅샷이다. */
export interface JournalSource {
  entryId: string
  entryUpdatedAt?: string
  diaryDate: string
  title?: string
  excerpt: string
  mood?: Mood
}

export interface JournalAIMessage {
  id: string
  role: JournalAIMessageRole
  content: string
  createdAt: string
  adapter: JournalAIAdapterKind
  sources: JournalSource[]
}

export interface AIConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: JournalAIMessage[]
}

export interface SendAIMessageInput {
  conversationId: string
  content: string
  signal?: AbortSignal
  onProgress?: (event: JournalAIProgressEvent) => void
}

export interface AIMessageResponse {
  message: JournalAIMessage
  sources: JournalSource[]
  suggestedQuestions: string[]
  resultKind: 'answer' | 'no-results'
}

/** AI 채팅 UI가 의존하는 application service 계약이다. */
export interface JournalAIService {
  createConversation(): Promise<AIConversation>
  getConversations(): Promise<AIConversation[]>
  getConversation(id: string): Promise<AIConversation | null>
  sendMessage(input: SendAIMessageInput): Promise<AIMessageResponse>
  cancelMessage?(requestId: string): Promise<void>
  deleteConversation(id: string): Promise<void>
  renameConversation(id: string, title: string): Promise<AIConversation>
  resetConversationStorage(): Promise<void>
}
