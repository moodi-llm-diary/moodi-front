import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage, ApiRequestError } from '../../../shared/api/apiError'
import { ApiJournalAIService } from '../services/apiJournalAIService'
import type { DiaryEntry } from '../types/diaryDomain'
import type { AIConversation, JournalAIErrorCode } from '../types/journalAI'

export type JournalAIChatPhase =
  | 'loading'
  | 'idle'
  | 'sending'
  | 'generating'
  | 'streaming'
  | 'cancelling'
  | 'cancelled'
  | 'no-results'
  | 'error'

/** AI conversation/run/SSE use-case를 API service 위에서 조합한다. */
export function useJournalAIChat(_entries: DiaryEntry[], isDiaryReady: boolean) {
  const [service] = useState(() => new ApiJournalAIService())
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  const conversationMutationRef = useRef(false)
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [phase, setPhase] = useState<JournalAIChatPhase>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<JournalAIErrorCode | null>(null)
  const [pendingAssistantContent, setPendingAssistantContent] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isConversationMutating, setIsConversationMutating] = useState(false)
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null

  const replaceConversation = useCallback((conversation: AIConversation) => {
    setConversations((currentConversations) => {
      const exists = currentConversations.some((candidate) => candidate.id === conversation.id)
      const nextConversations = exists
        ? currentConversations.map((candidate) => candidate.id === conversation.id ? conversation : candidate)
        : [conversation, ...currentConversations]

      return [...nextConversations].sort(
        (left, right) => right.updatedAt.localeCompare(left.updatedAt),
      )
    })
  }, [])

  const loadConversation = useCallback(async (conversationId: string) => {
    const conversation = await service.getConversation(conversationId)
    if (!conversation) throw new Error('대화를 찾지 못했습니다.')
    replaceConversation(conversation)
    return conversation
  }, [replaceConversation, service])

  const refreshConversations = useCallback(async (preferredConversationId?: string | null) => {
    const summaries = await service.getConversations()
    const nextActiveId = preferredConversationId === undefined
      ? activeConversationId
      : preferredConversationId
    const safeActiveId = nextActiveId && summaries.some((conversation) => conversation.id === nextActiveId)
      ? nextActiveId
      : summaries[0]?.id ?? null

    if (safeActiveId) {
      const detail = await service.getConversation(safeActiveId)
      if (detail) {
        const nextConversations = summaries.map((conversation) =>
          conversation.id === detail.id ? detail : conversation,
        )
        setConversations(nextConversations)
      } else {
        setConversations(summaries)
      }
    } else {
      setConversations([])
    }
    setActiveConversationId(safeActiveId)
    return safeActiveId
  }, [activeConversationId, service])

  useEffect(() => {
    if (!isDiaryReady) {
      return
    }
    let isCurrent = true
    const timerId = window.setTimeout(() => {
      void refreshConversations(null)
        .then(() => {
          if (isCurrent) setPhase('idle')
        })
        .catch((error: unknown) => {
          if (!isCurrent) return
          setErrorMessage(getApiErrorMessage(error, 'AI 대화를 불러오지 못했습니다.'))
          setErrorCode(getErrorCode(error))
          setPhase('error')
        })
    }, 0)

    return () => {
      isCurrent = false
      window.clearTimeout(timerId)
    }
  }, [isDiaryReady, refreshConversations])

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    [],
  )

  const createConversation = useCallback(async () => {
    if (!isDiaryReady || abortControllerRef.current || conversationMutationRef.current || phase === 'loading') {
      return null
    }
    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      const conversation = await service.createConversation()
      replaceConversation(conversation)
      setActiveConversationId(conversation.id)
      setErrorMessage(null)
      setErrorCode(null)
      setStatusMessage(null)
      setPhase('idle')
      return conversation
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '새 대화를 만들지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return null
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }, [isDiaryReady, phase, replaceConversation, service])

  const openConversation = useCallback((conversationId: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return
    setPhase('loading')
    setErrorMessage(null)
    setErrorCode(null)
    setStatusMessage(null)

    void loadConversation(conversationId)
      .then(() => {
        setActiveConversationId(conversationId)
        setPhase('idle')
      })
      .catch((error: unknown) => {
        setErrorMessage(getApiErrorMessage(error, '대화를 열지 못했습니다.'))
        setErrorCode(getErrorCode(error))
        setPhase('error')
      })
  }, [loadConversation])

  const sendMessage = useCallback(async (content: string) => {
    if (
      abortControllerRef.current ||
      conversationMutationRef.current ||
      !isDiaryReady ||
      ['sending', 'generating', 'streaming', 'cancelling'].includes(phase)
    ) return false

    setErrorMessage(null)
    setErrorCode(null)
    setStatusMessage(null)
    setPendingAssistantContent('')

    let conversationId = activeConversationId
    if (!conversationId) {
      const conversation = await createConversation()
      if (!conversation) return false
      conversationId = conversation.id
    }
    const requestConversationId = conversationId
    const controller = new AbortController()
    abortControllerRef.current = controller
    activeRunIdRef.current = null
    setPhase('sending')

    try {
      const response = await service.sendMessage({
        conversationId: requestConversationId,
        content,
        signal: controller.signal,
        onProgress: (event) => {
          if (event.type === 'run-started') {
            activeRunIdRef.current = event.runId
            return
          }
          if (event.type === 'generating') {
            setPhase('generating')
            return
          }
          setPendingAssistantContent(event.content)
          setPhase('streaming')
        },
      })

      await refreshConversations(requestConversationId)
      setSuggestedQuestions(response.suggestedQuestions)
      setPendingAssistantContent('')
      setPhase(response.resultKind === 'no-results' ? 'no-results' : 'idle')
      return true
    } catch (error) {
      setPendingAssistantContent('')
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage('AI 응답 생성을 중단했어요.')
        setPhase('cancelled')
        return false
      }
      setErrorMessage(getApiErrorMessage(error, 'AI 응답을 만들지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return false
    } finally {
      abortControllerRef.current = null
      activeRunIdRef.current = null
    }
  }, [activeConversationId, createConversation, isDiaryReady, phase, refreshConversations, service])

  const cancelMessage = useCallback(() => {
    const runId = activeRunIdRef.current
    if (!abortControllerRef.current) return
    setPhase('cancelling')
    if (runId) void service.cancelMessage?.(runId).catch(() => undefined)
    abortControllerRef.current.abort()
  }, [service])

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      await service.deleteConversation(conversationId)
      await refreshConversations(activeConversationId === conversationId ? null : activeConversationId)
      setStatusMessage('대화를 삭제했어요.')
      setPhase('idle')
      return true
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '대화를 삭제하지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }, [activeConversationId, refreshConversations, service])

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      const conversation = await service.renameConversation(conversationId, title)
      replaceConversation({ ...conversation, messages: activeConversation?.id === conversationId ? activeConversation.messages : [] })
      setStatusMessage('대화 이름을 바꿨어요.')
      setPhase('idle')
      return true
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '대화 이름을 바꾸지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }, [activeConversation, replaceConversation, service])

  const retry = useCallback(async () => {
    setPhase('loading')
    setErrorMessage(null)
    setErrorCode(null)
    try {
      await refreshConversations(activeConversationId)
      setPhase('idle')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'AI 대화를 불러오지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
    }
  }, [activeConversationId, refreshConversations])

  const resetConversationStorage = useCallback(async () => {
    if (abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)
    try {
      await service.resetConversationStorage()
      setConversations([])
      setActiveConversationId(null)
      setStatusMessage('AI 대화만 초기화했어요. 일기 원문은 유지됩니다.')
      setPhase('idle')
      return true
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'AI 대화를 초기화하지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }, [service])

  const reportSourceLoadFailure = useCallback(() => {
    setErrorCode('source-load-failed')
    setErrorMessage('연결된 기록을 불러오지 못했습니다.')
    setPhase('error')
  }, [])

  return {
    activeConversation,
    activeConversationId,
    conversations,
    errorMessage,
    errorCode,
    pendingAssistantContent,
    phase,
    isConversationMutating,
    statusMessage,
    suggestedQuestions,
    cancelMessage,
    createConversation,
    deleteConversation,
    openConversation,
    renameConversation,
    reportSourceLoadFailure,
    resetConversationStorage,
    retry,
    sendMessage,
  }
}

function getErrorCode(error: unknown): JournalAIErrorCode {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'auth-expired'
    if (error.status === 503) return 'service-unavailable'
    if (error.status === 0) return 'network'
  }
  return 'unknown'
}
