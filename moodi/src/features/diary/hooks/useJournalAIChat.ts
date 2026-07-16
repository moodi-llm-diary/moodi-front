import { useEffect, useMemo, useRef, useState } from 'react'
import { journalAIConversationRepository } from '../repositories/localStorageJournalAIConversationRepository'
import {
  LocalJournalAIService,
  sanitizeJournalConversations,
} from '../services/journalAIService'
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

/** AI 채팅 화면의 대화·전송·취소 use-case를 JournalAIService 위에서 조합한다. */
export function useJournalAIChat(entries: DiaryEntry[], isDiaryReady: boolean) {
  const [service] = useState(
    () => new LocalJournalAIService(journalAIConversationRepository, entries),
  )
  const abortControllerRef = useRef<AbortController | null>(null)
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
  const visibleConversations = useMemo(
    () => isDiaryReady ? sanitizeJournalConversations(conversations, entries) : [],
    [conversations, entries, isDiaryReady],
  )
  const activeConversation =
    visibleConversations.find((conversation) => conversation.id === activeConversationId) ?? null

  useEffect(() => {
    service.setEntries(entries)
  }, [entries, service])

  useEffect(() => {
    if (!isDiaryReady) return
    let isCurrent = true

    service
      .getConversations()
      .then((storedConversations) => {
        if (!isCurrent) return
        setConversations(storedConversations)
        setActiveConversationId(storedConversations[0]?.id ?? null)
        setPhase('idle')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setErrorMessage(getErrorMessage(error, 'AI 대화 기록을 불러오지 못했습니다.'))
        setErrorCode(getErrorCode(error))
        setPhase('error')
      })

    return () => {
      isCurrent = false
    }
  }, [isDiaryReady, service])

  useEffect(() => {
    if (!isDiaryReady) return
    if (
      phase === 'loading' ||
      phase === 'sending' ||
      phase === 'generating' ||
      phase === 'streaming' ||
      phase === 'cancelling'
    ) return

    void service
      .getConversations()
      .then((nextConversations) => setConversations(nextConversations))
      .catch((error: unknown) => {
        setConversations((currentConversations) =>
          sanitizeJournalConversations(currentConversations, entries),
        )
        setErrorMessage(getErrorMessage(error, 'AI 대화 기록을 갱신하지 못했습니다.'))
        setErrorCode(getErrorCode(error))
        setPhase('error')
      })
  }, [entries, isDiaryReady, phase, service])

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    [],
  )

  const refreshConversations = async (preferredConversationId?: string | null) => {
    const nextConversations = await service.getConversations()
    const nextActiveId = preferredConversationId === undefined
      ? activeConversationId
      : preferredConversationId
    const safeActiveId = nextActiveId && nextConversations.some(({ id }) => id === nextActiveId)
      ? nextActiveId
      : nextConversations[0]?.id ?? null

    setConversations(nextConversations)
    setActiveConversationId(safeActiveId)

    return { nextConversations, safeActiveId }
  }

  const refreshConversationsBestEffort = async (
    preferredConversationId?: string | null,
  ) => {
    try {
      await refreshConversations(preferredConversationId)
    } catch {
      // The originating send/cancel error owns the visible terminal state.
    }
  }

  const createConversation = async () => {
    if (
      !isDiaryReady ||
      abortControllerRef.current ||
      conversationMutationRef.current ||
      phase === 'loading'
    ) {
      return null
    }

    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      setErrorMessage(null)
      setErrorCode(null)
      setStatusMessage(null)
      const conversation = await service.createConversation()
      await refreshConversations(conversation.id)
      setPhase('idle')

      return conversation
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '새 대화를 만들지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')

      return null
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }

  const openConversation = (conversationId: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return
    setActiveConversationId(conversationId)
    setErrorMessage(null)
    setErrorCode(null)
    setStatusMessage(null)
  }

  const sendMessage = async (content: string) => {
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
    setPhase('sending')

    try {
      const response = await service.sendMessage({
        conversationId: requestConversationId,
        content,
        signal: controller.signal,
        onProgress: (event) => {
          if (event.type === 'generating') {
            setPhase('generating')
            void refreshConversationsBestEffort(requestConversationId)
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
      await refreshConversationsBestEffort(requestConversationId)

      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage('로컬 기록 검색을 중단했어요.')
        setPhase('cancelled')
        return false
      }

      setErrorMessage(getErrorMessage(error, '기록을 검색하지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
      return false
    } finally {
      abortControllerRef.current = null
    }
  }

  const cancelMessage = () => {
    if (!abortControllerRef.current) return
    setPhase('cancelling')
    abortControllerRef.current.abort()
  }

  const reportSourceLoadFailure = () => {
    setErrorCode('source-load-failed')
    setErrorMessage('연결된 기록이 삭제되었거나 잠금 상태로 바뀌었습니다.')
    setPhase('error')
  }

  const deleteConversation = async (conversationId: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      await service.deleteConversation(conversationId)
      await refreshConversations(
        activeConversationId === conversationId ? null : activeConversationId,
      )
      setStatusMessage('대화를 삭제했어요.')
      setErrorMessage(null)
      setErrorCode(null)
      setPhase('idle')

      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '대화를 삭제하지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')

      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }

  const renameConversation = async (conversationId: string, title: string) => {
    if (abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)

    try {
      await service.renameConversation(conversationId, title)
      await refreshConversations(conversationId)
      setStatusMessage('대화 이름을 바꿨어요.')
      setErrorMessage(null)
      setErrorCode(null)

      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '대화 이름을 바꾸지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')

      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }

  const retry = async () => {
    if (abortControllerRef.current || conversationMutationRef.current) return
    setPhase('loading')
    setErrorMessage(null)
    setErrorCode(null)

    try {
      await refreshConversations(activeConversationId)
      setPhase('idle')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'AI 대화 기록을 불러오지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')
    }
  }

  const resetConversationStorage = async () => {
    if (!isDiaryReady || abortControllerRef.current || conversationMutationRef.current) return false
    conversationMutationRef.current = true
    setIsConversationMutating(true)
    setPhase('loading')

    try {
      await service.resetConversationStorage()
      setConversations([])
      setActiveConversationId(null)
      setErrorMessage(null)
      setErrorCode(null)
      setPendingAssistantContent('')
      setSuggestedQuestions([])
      setStatusMessage('손상된 AI 대화 기록을 초기화했어요. 일기 원문은 삭제하지 않았습니다.')
      setPhase('idle')

      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'AI 대화 기록을 초기화하지 못했습니다.'))
      setErrorCode(getErrorCode(error))
      setPhase('error')

      return false
    } finally {
      conversationMutationRef.current = false
      setIsConversationMutating(false)
    }
  }

  return {
    activeConversation,
    activeConversationId,
    conversations: visibleConversations,
    errorMessage,
    errorCode,
    pendingAssistantContent,
    phase,
    isConversationMutating,
    statusMessage,
    suggestedQuestions,
    adapterKind: 'local-search' as const,
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message ? error.message : fallbackMessage
}

function getErrorCode(error: unknown): JournalAIErrorCode {
  if (isErrorWithCode(error)) return error.code
  if (
    error instanceof Error &&
    /브라우저|저장|localStorage|대화.*(?:형식|ID)|지원하지 않는 AI 대화/i.test(error.message)
  ) {
    return 'storage-unavailable'
  }

  return 'unknown'
}

function isErrorWithCode(error: unknown): error is Error & { code: JournalAIErrorCode } {
  if (!(error instanceof Error) || !('code' in error)) return false

  return [
    'network',
    'auth-expired',
    'service-unavailable',
    'source-load-failed',
    'storage-corrupted',
    'storage-unavailable',
    'unknown',
  ].includes(String(error.code))
}
