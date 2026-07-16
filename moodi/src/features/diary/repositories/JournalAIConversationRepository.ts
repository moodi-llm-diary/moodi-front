import type { AIConversation } from '../types/journalAI'

/** AI 대화 persistence 형식을 application service에서 분리하는 저장소 계약이다. */
export interface JournalAIConversationRepository {
  getConversations(): Promise<AIConversation[]>
  getConversation(id: string): Promise<AIConversation | null>
  createConversation(conversation: AIConversation): Promise<AIConversation>
  updateConversation(
    id: string,
    update: (conversation: AIConversation) => AIConversation,
  ): Promise<AIConversation>
  deleteConversation(id: string): Promise<void>
  removeEntryReferences(entryId: string): Promise<void>
  clearConversations(): Promise<void>
}
