import { describe, expect, it } from 'vitest'
import type { JournalAIConversationRepository } from '../repositories/JournalAIConversationRepository'
import type { DiaryEntry } from '../types/diaryDomain'
import type { AIConversation } from '../types/journalAI'
import {
  buildLocalJournalResponse,
  LocalJournalAIService,
  sanitizeJournalConversations,
} from './journalAIService'

class MemoryConversationRepository implements JournalAIConversationRepository {
  private conversations: AIConversation[] = []
  failAssistantUpdate = false

  async getConversations(): Promise<AIConversation[]> {
    return structuredClone(this.conversations)
  }

  async getConversation(id: string): Promise<AIConversation | null> {
    return structuredClone(this.conversations.find((conversation) => conversation.id === id) ?? null)
  }

  async createConversation(conversation: AIConversation): Promise<AIConversation> {
    if (this.conversations.some(({ id }) => id === conversation.id)) {
      throw new Error('duplicate conversation')
    }
    this.conversations = [structuredClone(conversation), ...this.conversations]

    return structuredClone(conversation)
  }

  async updateConversation(
    id: string,
    update: (conversation: AIConversation) => AIConversation,
  ): Promise<AIConversation> {
    const currentConversation = this.conversations.find((conversation) => conversation.id === id)

    if (!currentConversation) {
      throw new Error('missing conversation')
    }
    const conversation = update(structuredClone(currentConversation))

    if (this.failAssistantUpdate && conversation.messages.at(-1)?.role === 'assistant') {
      throw new Error('AI 대화 기록을 브라우저에 저장하지 못했습니다.')
    }
    this.conversations = this.conversations.map((item) =>
      item.id === id ? structuredClone(conversation) : item,
    )

    return structuredClone(conversation)
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations = this.conversations.filter((conversation) => conversation.id !== id)
  }

  async removeEntryReferences(entryId: string): Promise<void> {
    this.conversations = this.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        sources: message.sources.filter((source) => source.entryId !== entryId),
      })),
    }))
  }

  async clearConversations(): Promise<void> {
    this.conversations = []
  }
}

const referenceDate = new Date(2026, 6, 14, 12)

describe('LocalJournalAIService', () => {
  it('실제 사용자 원문의 entry id와 substring만 출처로 반환한다', () => {
    const projectEntry = createEntry('user-project', {
      diaryDate: '2026-07-13',
      title: '프로젝트를 마무리한 날',
      content: '프로젝트의 마지막 오류를 고치고 팀과 함께 차분히 배포를 마쳤다.',
      tags: ['프로젝트'],
      mood: 'calm',
    })
    const result = buildLocalJournalResponse(
      '프로젝트와 관련된 기록을 찾아줘',
      [projectEntry],
      referenceDate,
    )

    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]).toMatchObject({
      entryId: projectEntry.id,
      diaryDate: projectEntry.diaryDate,
      title: projectEntry.title,
    })
    expect(projectEntry.content).toContain(result.sources[0].excerpt.replace(/…$/, ''))
    expect(result.content).toContain('실제 기록')
  })

  it('한 번만 표시된 태그를 자주 등장했다고 과장하지 않는다', () => {
    const result = buildLocalJournalResponse(
      '프로젝트 기록을 요약해줘',
      [createEntry('user-single-topic', { tags: ['프로젝트'] })],
      referenceDate,
    )

    expect(result.content).toContain('출처 기록에 포함된 태그·주제')
    expect(result.content).not.toContain('자주 등장한 태그·주제')
  })

  it('출처 제한 시 날짜가 아니라 검색 점수 상위 대표 기록이라고 설명한다', () => {
    const result = buildLocalJournalResponse(
      '프로젝트 기록을 요약해줘',
      Array.from({ length: 7 }, (_, index) =>
        createEntry(`user-project-${index}`, { tags: ['프로젝트'] }),
      ),
      referenceDate,
    )

    expect(result.sources).toHaveLength(6)
    expect(result.content).toContain('검색 점수가 높은 대표 6개')
    expect(result.content).not.toContain('최근 6개')
  })

  it('잠긴 기록과 최초 예시 기록을 검색 및 출처에서 제외한다', () => {
    const result = buildLocalJournalResponse(
      '비밀 프로젝트 기록을 찾아줘',
      [
        createEntry('locked-entry', { content: '비밀 프로젝트', isLocked: true }),
        createEntry('seed-project-night', { content: '비밀 프로젝트' }),
      ],
      referenceDate,
    )

    expect(result.sources).toEqual([])
    expect(result.content).toContain('찾지 못했어요')
  })

  it('감정을 선택하지 않은 원문의 자연어 활용형도 감정 질의 근거로 찾는다', () => {
    const anxiousEntry = createEntry('user-anxious-text', {
      diaryDate: '2026-07-08',
      mood: undefined,
      content: '발표를 앞두고 마음이 불안했고 결과가 계속 걱정됐다.',
    })
    const result = buildLocalJournalResponse(
      '최근 한 달 동안 불안함이 언제 자주 나타났어?',
      [anxiousEntry],
      referenceDate,
    )

    expect(result.sources.map((source) => source.entryId)).toEqual([anxiousEntry.id])
  })

  it('감정과 주제를 함께 물으면 두 조건을 모두 충족한 기록만 찾는다', () => {
    const projectEntry = createEntry('user-project-tired', {
      diaryDate: '2026-06-25',
      content: '프로젝트 마감을 앞두고 일이 힘들었다.',
      mood: undefined,
    })
    const unrelatedEntry = createEntry('user-unrelated-tired', {
      diaryDate: '2026-06-24',
      content: '잠을 설쳐 하루 종일 힘들었다.',
      mood: undefined,
    })
    const result = buildLocalJournalResponse(
      '지난달 프로젝트 때문에 힘들었던 날을 찾아줘',
      [projectEntry, unrelatedEntry],
      referenceDate,
    )

    expect(result.sources.map((source) => source.entryId)).toEqual([projectEntry.id])
  })

  it('복합 조사를 제거하고 직접 예시의 감정 활용형과 탐색 의도를 해석한다', () => {
    const schoolEntry = createEntry('user-school-friend', {
      diaryDate: '2026-06-20',
      content: '학교에서 친구와 나눈 대화가 오래 기억에 남았다.',
    })
    const happierEntry = createEntry('user-happier', {
      diaryDate: '2026-07-06',
      content: '저녁 산책을 하고 나서 기분이 좋아졌다.',
      mood: undefined,
    })
    const compoundParticleResult = buildLocalJournalResponse(
      '지난달에는 학교에서는 친구에게는 어떤 생각이 반복적으로 등장했는지 확인해줘',
      [schoolEntry, happierEntry],
      referenceDate,
    )
    const happierResult = buildLocalJournalResponse(
      '최근 한 달 동안 기분이 좋아진 계기를 찾아줘',
      [schoolEntry, happierEntry],
      referenceDate,
    )
    const recurringThoughtResult = buildLocalJournalResponse(
      '반복적으로 등장한 생각 확인해줘',
      [schoolEntry, happierEntry],
      referenceDate,
    )

    expect(compoundParticleResult.sources.map((source) => source.entryId)).toEqual([
      schoolEntry.id,
    ])
    expect(happierResult.sources.map((source) => source.entryId)).toEqual([
      happierEntry.id,
    ])
    expect(recurringThoughtResult.sources).toHaveLength(2)
  })

  it('제품 문서의 기간·공통점·주제·학교생활 예문을 그대로 처리한다', () => {
    const calmEntry = createEntry('user-calm-example', {
      diaryDate: '2026-07-13',
      content: '친구와 천천히 걸으며 마음이 편안하다고 느꼈다.',
      mood: undefined,
    })
    const anxiousEntry = createEntry('user-worry-example', {
      diaryDate: '2026-07-12',
      content: '발표 준비가 계속 걱정됐고 학교 과제가 떠올랐다.',
      mood: undefined,
      tags: ['학교'],
    })
    const lastYearSchoolEntry = createEntry('user-school-last-year', {
      diaryDate: '2025-09-02',
      content: '새 학기 학교 기록',
      tags: ['학교'],
    })
    const thisYearSchoolEntry = createEntry('user-school-this-year', {
      diaryDate: '2026-03-02',
      content: '올해 학교 기록',
      tags: ['학교'],
    })
    const entries = [calmEntry, anxiousEntry, lastYearSchoolEntry, thisYearSchoolEntry]

    expect(buildLocalJournalResponse(
      '이번 주 기록을 세 문장으로 정리해줘',
      entries,
      referenceDate,
    ).sources.length).toBeGreaterThan(0)
    expect(buildLocalJournalResponse(
      '최근에 편안하다고 쓴 날들의 공통점은 뭐야?',
      entries,
      referenceDate,
    ).sources.map((source) => source.entryId)).toContain(calmEntry.id)
    expect(buildLocalJournalResponse(
      '내가 자주 걱정한 주제를 찾아줘',
      entries,
      referenceDate,
    ).sources.map((source) => source.entryId)).toContain(anxiousEntry.id)
    expect(buildLocalJournalResponse(
      '작년과 올해의 학교생활 관련 기록을 비교해줘',
      entries,
      referenceDate,
    ).sources.map((source) => source.entryId)).toEqual(expect.arrayContaining([
      lastYearSchoolEntry.id,
      thisYearSchoolEntry.id,
    ]))
  })

  it('두 기간의 실제 기록 수와 감정만 비교한다', () => {
    const result = buildLocalJournalResponse(
      '지난달과 이번 달의 기분을 비교해줘',
      [
        createEntry('user-june', { diaryDate: '2026-06-18', mood: 'anxious' }),
        createEntry('user-july', { diaryDate: '2026-07-10', mood: 'calm' }),
        createEntry('user-old', { diaryDate: '2026-05-10', mood: 'happy' }),
      ],
      referenceDate,
    )

    expect(result.sources.map((source) => source.entryId)).toEqual([
      'user-june',
      'user-july',
    ])
    expect(result.content).toContain('지난달')
    expect(result.content).toContain('이번 달')
    expect(result.content).toContain('기록에 없는 원인이나 사건은 추정하지 않았어요')
  })

  it('비교 답변 계산에 사용한 양쪽 기간 기록을 모두 출처로 공개한다', () => {
    const juneEntries = Array.from({ length: 7 }, (_, index) =>
      createEntry(`user-june-${index + 1}`, {
        diaryDate: `2026-06-${String(10 + index).padStart(2, '0')}`,
        mood: 'anxious',
      }),
    )
    const julyEntry = createEntry('user-july-source', {
      diaryDate: '2026-07-10',
      mood: 'calm',
    })
    const result = buildLocalJournalResponse(
      '지난달과 이번 달의 기분을 비교해줘',
      [...juneEntries, julyEntry],
      referenceDate,
    )

    expect(result.sources).toHaveLength(4)
    expect(result.sources.map((source) => source.entryId)).toContain(julyEntry.id)
    expect(result.content).toContain('검색 결과 7개 · 출처로 확인한 3개 · 가장 잦은 감정 불안함')
    expect(result.content).toContain('검색 결과 1개 · 출처로 확인한 1개 · 가장 잦은 감정 편안함')
    expect(result.content).toContain('최대 3개씩 출처로 선택해 비교했어요')
  })

  it('한국어 날짜 범위와 계절 표현을 실제 날짜 범위로 해석한다', () => {
    const juneEntry = createEntry('user-june-range', { diaryDate: '2026-06-18' })
    const outsideEntry = createEntry('user-outside-range', { diaryDate: '2026-07-02' })
    const summerEntry = createEntry('user-last-summer', {
      diaryDate: '2025-08-03',
      content: '바닷가로 여행을 다녀온 기록이다.',
    })
    const koreanRangeResult = buildLocalJournalResponse(
      '2026년 6월 1일부터 6월 30일까지 기록을 요약해줘',
      [juneEntry, outsideEntry],
      referenceDate,
    )
    const seasonResult = buildLocalJournalResponse(
      '작년 여름에 여행 관련해서 쓴 기록 찾아줘',
      [summerEntry, juneEntry],
      referenceDate,
    )

    expect(koreanRangeResult.sources.map((source) => source.entryId)).toEqual([
      'user-june-range',
    ])
    expect(koreanRangeResult.content).toContain('6월 1일부터 6월 30일까지')
    expect(seasonResult.sources.map((source) => source.entryId)).toEqual([
      'user-last-summer',
    ])
    expect(seasonResult.content).toContain('작년 여름')
  })

  it('대화와 답변을 저장하고 현재 기록이 사라지면 출처와 답변을 가린다', async () => {
    const repository = new MemoryConversationRepository()
    const entry = createEntry('user-walk', {
      diaryDate: '2026-07-12',
      title: '저녁 산책',
      content: '동네를 천천히 걸으니 마음이 편안해졌다.',
      tags: ['산책'],
      mood: 'calm',
    })
    const service = new LocalJournalAIService(repository, [entry], () => referenceDate)
    const conversation = await service.createConversation()
    const progressEvents: Array<{ type: string; content?: string }> = []
    const response = await service.sendMessage({
      conversationId: conversation.id,
      content: '산책 기록을 찾아줘',
      onProgress: (event) => progressEvents.push(event),
    })

    expect(response.sources.map((source) => source.entryId)).toEqual(['user-walk'])
    expect(response.resultKind).toBe('answer')
    expect(progressEvents[0]).toEqual({ type: 'generating' })
    expect(progressEvents.some((event) => event.type === 'streaming')).toBe(true)
    expect(progressEvents.at(-1)).toEqual({
      type: 'streaming',
      content: response.message.content,
    })
    expect((await service.getConversation(conversation.id))?.messages).toHaveLength(2)

    service.setEntries([])
    const sanitizedConversation = await service.getConversation(conversation.id)
    const assistantMessage = sanitizedConversation?.messages.at(-1)

    expect(assistantMessage?.sources).toEqual([])
    expect(assistantMessage?.content).toContain('삭제되었거나 잠금 상태')

    const persistedConversation = await repository.getConversation(conversation.id)
    const persistedAssistantMessage = persistedConversation?.messages.at(-1)

    expect(persistedAssistantMessage?.sources).toEqual([])
    expect(persistedAssistantMessage?.content).toContain('삭제되었거나 잠금 상태')
    expect(JSON.stringify(persistedConversation)).not.toContain(entry.content)
  })

  it('출처 excerpt 밖의 metadata 수정도 updatedAt으로 감지해 오래된 답변을 영속 제거한다', async () => {
    const repository = new MemoryConversationRepository()
    const entry = createEntry('user-project-metadata', {
      content: '프로젝트 기록의 앞부분은 그대로 유지된다.',
      tags: ['프로젝트'],
      energy: 2,
    })
    const service = new LocalJournalAIService(repository, [entry], () => referenceDate)
    const conversation = await service.createConversation()

    await service.sendMessage({
      conversationId: conversation.id,
      content: '프로젝트 기록을 요약해줘',
    })
    service.setEntries([{
      ...entry,
      tags: ['완료'],
      energy: 5,
      updatedAt: '2026-07-14T12:00:00.000Z',
    }])

    const refreshedConversation = await service.getConversation(conversation.id)
    const refreshedAssistantMessage = refreshedConversation?.messages.at(-1)
    const persistedConversation = await repository.getConversation(conversation.id)

    expect(refreshedAssistantMessage?.content).toContain('수정되어')
    expect(refreshedAssistantMessage?.sources[0]?.entryUpdatedAt).toBe(
      '2026-07-14T12:00:00.000Z',
    )
    expect(persistedConversation?.messages.at(-1)?.content).toContain('수정되어')
  })

  it('전체 초기화가 응답 생성과 겹쳐도 삭제한 대화를 되살리지 않는다', async () => {
    const repository = new MemoryConversationRepository()
    const service = new LocalJournalAIService(repository, [createEntry('user-entry')])
    const conversation = await service.createConversation()
    const pendingResponse = service.sendMessage({
      conversationId: conversation.id,
      content: '기록을 찾아줘',
      onProgress: (event) => {
        if (event.type === 'generating') void repository.clearConversations()
      },
    })

    await expect(pendingResponse).rejects.toThrow('missing conversation')
    expect(await repository.getConversations()).toEqual([])
  })

  it('최종 답변 저장 실패 시 미저장 답변을 대화로 반환하지 않는다', async () => {
    const repository = new MemoryConversationRepository()
    const service = new LocalJournalAIService(repository, [createEntry('user-entry')])
    const conversation = await service.createConversation()
    repository.failAssistantUpdate = true

    await expect(service.sendMessage({
      conversationId: conversation.id,
      content: '기록을 찾아줘',
    })).rejects.toThrow('저장하지 못했습니다')

    const storedConversation = await repository.getConversation(conversation.id)

    expect(storedConversation?.messages).toHaveLength(1)
    expect(storedConversation?.messages[0].role).toBe('user')
  })

  it('출처 영속화가 실패해도 화면용 대화에서는 잠긴 기록 원문을 즉시 가린다', async () => {
    const entry = createEntry('user-private', { content: '화면에 남으면 안 되는 원문' })
    const conversation: AIConversation = {
      id: 'conversation-private',
      title: '비공개 기록',
      createdAt: '2026-07-14T09:00:00.000Z',
      updatedAt: '2026-07-14T09:01:00.000Z',
      messages: [{
        id: 'assistant-private',
        role: 'assistant',
        content: '이전 답변',
        createdAt: '2026-07-14T09:01:00.000Z',
        adapter: 'local-search',
        sources: [{
          entryId: entry.id,
          entryUpdatedAt: entry.updatedAt,
          diaryDate: entry.diaryDate,
          title: entry.title,
          excerpt: entry.content ?? '',
        }],
      }],
    }

    const visibleConversation = sanitizeJournalConversations(
      [conversation],
      [{ ...entry, isLocked: true }],
    )[0]

    expect(visibleConversation.messages[0].sources).toEqual([])
    expect(JSON.stringify(visibleConversation)).not.toContain(entry.content)
  })

  it('AbortSignal로 진행 중인 로컬 검색을 취소한다', async () => {
    const repository = new MemoryConversationRepository()
    const service = new LocalJournalAIService(repository, [createEntry('user-entry')])
    const conversation = await service.createConversation()
    const controller = new AbortController()
    let resolveGenerating!: () => void
    const generating = new Promise<void>((resolve) => {
      resolveGenerating = resolve
    })
    const pendingResponse = service.sendMessage({
      conversationId: conversation.id,
      content: '기록을 찾아줘',
      signal: controller.signal,
      onProgress: (event) => {
        if (event.type === 'generating') resolveGenerating()
      },
    })

    await generating
    controller.abort()

    await expect(pendingResponse).rejects.toMatchObject({ name: 'AbortError' })
    expect((await service.getConversation(conversation.id))?.messages).toHaveLength(1)
  })
})

function createEntry(id: string, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id,
    type: 'journal',
    title: '사용자 기록',
    content: '오늘의 실제 사용자 원문이다.',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    diaryDate: '2026-07-10',
    activities: [],
    tags: [],
    aiTopics: [],
    images: [],
    isFavorite: false,
    isLocked: false,
    ...overrides,
  }
}
