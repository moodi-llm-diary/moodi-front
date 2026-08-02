import {
  API_BASE_URL,
  createIdempotencyKey,
  requestApi,
  requestJson,
} from '../../../shared/api/httpClient'
import { ApiRequestError } from '../../../shared/api/apiError'
import type {
  AIConversation,
  AIMessageResponse,
  JournalAIMessage,
  JournalAIService,
  JournalSource,
  SendAIMessageInput,
} from '../types/journalAI'
import type { Mood } from '../types/diaryDomain'

type ApiConversationSummaryDto = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type ApiJournalSourceDto = {
  entryId: string
  entryUpdatedAt: string
  diaryDate: string
  title: string | null
  excerpt: string
  mood: Mood | null
}

type ApiMessageDto = {
  id: string
  role: 'user' | 'assistant'
  status: 'completed' | 'redacted'
  content: string | null
  createdAt: string
  generator: 'local-llm' | null
  sources: ApiJournalSourceDto[]
  redactionReason: 'source-updated' | 'source-unavailable' | null
}

type ApiRunDto = {
  id: string
  conversationId: string
  userMessageId: string
  assistantMessageId: string | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  failure: { code: string; message: string; retryable: boolean; requestId: string } | null
}

type ApiPage<T> = { items: T[]; nextCursor: string | null; hasNext: boolean }

type ApiPostMessageResponse = { userMessage: ApiMessageDto; run: ApiRunDto }

type ApiRunResponse = { run: ApiRunDto; message: ApiMessageDto | null }

/** backend의 durable conversation/run/SSE contract를 JournalAIService로 감싼 adapter다. */
export class ApiJournalAIService implements JournalAIService {
  async createConversation(): Promise<AIConversation> {
    const response = await requestJson<ApiConversationSummaryDto>(
      '/api/v1/ai-conversations',
      {},
      {
        method: 'POST',
        includeCsrfToken: true,
        idempotencyKey: createIdempotencyKey(),
      },
    )

    return toConversation(response.body)
  }

  async getConversations(): Promise<AIConversation[]> {
    const summaries = await this.getAllPages<ApiConversationSummaryDto>('/api/v1/ai-conversations')
    return summaries.map(toConversation)
  }

  async getConversation(id: string): Promise<AIConversation | null> {
    try {
      const summary = await requestApi<ApiConversationSummaryDto>(
        `/api/v1/ai-conversations/${encodeURIComponent(id)}`,
      )
      const messages = await this.getAllPages<ApiMessageDto>(
        `/api/v1/ai-conversations/${encodeURIComponent(id)}/messages`,
        50,
      )

      return {
        ...toConversation(summary.body),
        messages: messages.map(toMessage),
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null
      throw error
    }
  }

  async sendMessage(input: SendAIMessageInput): Promise<AIMessageResponse> {
    const content = input.content.trim()
    if (!content) throw new Error('질문을 입력해 주세요.')
    if (content.length > 1_200) throw new Error('질문은 1,200자 이내로 입력해 주세요.')

    const response = await requestJson<ApiPostMessageResponse>(
      `/api/v1/ai-conversations/${encodeURIComponent(input.conversationId)}/messages`,
      {
        content,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      {
        method: 'POST',
        includeCsrfToken: true,
        idempotencyKey: createIdempotencyKey(),
        signal: input.signal,
      },
    )
    input.onProgress?.({ type: 'run-started', runId: response.body.run.id })
    input.onProgress?.({ type: 'generating' })

    return waitForRunCompletion(response.body.run, input.onProgress, input.signal)
  }

  async cancelMessage(runId: string): Promise<void> {
    await requestApi<ApiRunDto>(`/api/v1/ai-runs/${encodeURIComponent(runId)}/cancellation`, {
      method: 'PUT',
      includeCsrfToken: true,
    })
  }

  async deleteConversation(id: string): Promise<void> {
    await requestApi<void>(`/api/v1/ai-conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      includeCsrfToken: true,
    })
  }

  async renameConversation(id: string, title: string): Promise<AIConversation> {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) throw new Error('대화 이름을 입력해 주세요.')
    if (normalizedTitle.length > 80) throw new Error('대화 이름은 80자 이내로 입력해 주세요.')

    const response = await requestJson<ApiConversationSummaryDto>(
      `/api/v1/ai-conversations/${encodeURIComponent(id)}`,
      { title: normalizedTitle },
      { method: 'PATCH', includeCsrfToken: true },
    )

    return toConversation(response.body)
  }

  async resetConversationStorage(): Promise<void> {
    const conversations = await this.getConversations()
    await Promise.all(conversations.map((conversation) => this.deleteConversation(conversation.id)))
  }

  private async getAllPages<T>(path: string, limit = 100): Promise<T[]> {
    const values: T[] = []
    let cursor: string | null = null

    do {
      const query = new URLSearchParams({ limit: String(limit) })
      if (cursor) query.set('cursor', cursor)
      const separator = path.includes('?') ? '&' : '?'
      const response = await requestApi<ApiPage<T>>(`${path}${separator}${query}`)
      values.push(...response.body.items)
      cursor = response.body.hasNext ? response.body.nextCursor : null
    } while (cursor)

    return values
  }
}

function waitForRunCompletion(
  run: ApiRunDto,
  onProgress: SendAIMessageInput['onProgress'],
  signal?: AbortSignal,
): Promise<AIMessageResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    const eventSource = new EventSource(
      `${API_BASE_URL}/api/v1/ai-runs/${encodeURIComponent(run.id)}/events`,
      { withCredentials: true },
    )
    let pendingContent = ''
    let settled = false

    const close = () => {
      eventSource.close()
      signal?.removeEventListener('abort', abort)
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      close()
      callback()
    }
    const abort = () => finish(() => reject(createAbortError()))

    signal?.addEventListener('abort', abort, { once: true })

    eventSource.addEventListener('message.delta', (event) => {
      const payload = parseEventData<{ delta: string }>(event)
      if (!payload) return
      pendingContent += payload.delta
      onProgress?.({ type: 'streaming', content: pendingContent })
    })
    eventSource.addEventListener('run.completed', (event) => {
      const payload = parseEventData<{
        message: ApiMessageDto
        suggestedQuestions: string[]
        resultKind: 'answer' | 'no-results'
      }>(event)
      if (!payload) {
        finish(() => reject(new Error('AI 완료 응답 형식이 올바르지 않습니다.')))
        return
      }
      const message = toMessage(payload.message)
      finish(() => resolve({
        message,
        sources: message.sources,
        suggestedQuestions: payload.suggestedQuestions,
        resultKind: payload.resultKind,
      }))
    })
    eventSource.addEventListener('run.failed', (event) => {
      const payload = parseEventData<{ code: string; message: string }>(event)
      finish(() => reject(new ApiRequestError(
        payload?.message ?? 'AI 실행에 실패했습니다.',
        503,
        payload?.code ?? 'AI_SERVICE_UNAVAILABLE',
      )))
    })
    eventSource.addEventListener('run.cancelled', () => {
      finish(() => reject(createAbortError()))
    })
    eventSource.onerror = () => {
      if (settled) return
      eventSource.close()
      void requestApi<ApiRunResponse>(`/api/v1/ai-runs/${encodeURIComponent(run.id)}`)
        .then((response) => {
          if (response.body.run.status === 'completed' && response.body.message) {
            const message = toMessage(response.body.message)
            finish(() => resolve({
              message,
              sources: message.sources,
              suggestedQuestions: [],
              resultKind: message.sources.length > 0 ? 'answer' : 'no-results',
            }))
            return
          }
          if (response.body.run.status === 'cancelled') {
            finish(() => reject(createAbortError()))
            return
          }
          if (response.body.run.status === 'failed') {
            finish(() => reject(new ApiRequestError(
              response.body.run.failure?.message ?? 'AI 실행에 실패했습니다.',
              503,
              response.body.run.failure?.code ?? 'AI_SERVICE_UNAVAILABLE',
            )))
            return
          }
          finish(() => reject(new ApiRequestError(
            'AI 실행 상태 연결이 끊어졌습니다. 대화를 다시 열어 상태를 확인해 주세요.',
            0,
            'NETWORK_ERROR',
          )))
        })
        .catch(() => finish(() => reject(new ApiRequestError(
          'AI 실행 상태 연결이 끊어졌습니다. 대화를 다시 열어 상태를 확인해 주세요.',
          0,
          'NETWORK_ERROR',
        ))))
    }
  })
}

function toConversation(dto: ApiConversationSummaryDto): AIConversation {
  return {
    id: dto.id,
    title: dto.title,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    messages: [],
  }
}

function toMessage(dto: ApiMessageDto): JournalAIMessage {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content ?? '연결된 기록을 현재 상태에서 다시 확인할 수 없어 답변을 가렸어요.',
    createdAt: dto.createdAt,
    adapter: 'backend-ai',
    sources: dto.sources.map(toSource),
    status: dto.status,
    redactionReason: dto.redactionReason ?? undefined,
  }
}

function toSource(dto: ApiJournalSourceDto): JournalSource {
  return {
    entryId: dto.entryId,
    entryUpdatedAt: dto.entryUpdatedAt,
    diaryDate: dto.diaryDate,
    title: dto.title ?? undefined,
    excerpt: dto.excerpt,
    mood: dto.mood ?? undefined,
  }
}

function parseEventData<T>(event: Event): T | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return null

  try {
    return JSON.parse(event.data) as T
  } catch {
    return null
  }
}

function createAbortError(): Error {
  const error = new Error('AI 응답 생성을 취소했습니다.')
  error.name = 'AbortError'
  return error
}
