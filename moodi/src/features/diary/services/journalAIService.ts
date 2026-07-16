import type { JournalAIConversationRepository } from '../repositories/JournalAIConversationRepository'
import type { DiaryEntry, Mood } from '../types/diaryDomain'
import type {
  AIConversation,
  AIMessageResponse,
  JournalAIMessage,
  JournalAIService,
  JournalSource,
  SendAIMessageInput,
} from '../types/journalAI'

type DateRange = {
  from: string
  to: string
  label: string
}

type LocalSearchResult = {
  content: string
  sources: JournalSource[]
  suggestedQuestions: string[]
}

const MOOD_LABELS: Record<Mood, string> = {
  happy: '행복',
  calm: '편안함',
  excited: '설렘',
  neutral: '무난함',
  tired: '피곤함',
  anxious: '불안함',
  frustrated: '답답함',
  sad: '슬픔',
  angry: '화남',
}

const MOOD_QUERY_PATTERNS: Array<{ mood: Mood; pattern: RegExp }> = [
  { mood: 'happy', pattern: /행복|기쁘|좋았|좋아(?:졌|진|져|지)|즐거/ },
  { mood: 'calm', pattern: /편안|차분|평온|안도/ },
  { mood: 'excited', pattern: /설렘|설레|설렜|기대|신났/ },
  { mood: 'neutral', pattern: /무난|평범/ },
  { mood: 'tired', pattern: /피곤|지침|지쳤|힘들/ },
  { mood: 'anxious', pattern: /불안|걱정|긴장/ },
  { mood: 'frustrated', pattern: /답답|막막|막혔/ },
  { mood: 'sad', pattern: /슬픔|슬프|슬펐|울적/ },
  { mood: 'angry', pattern: /화남|화가|화났|짜증|분노/ },
]

const QUERY_STOP_WORDS = new Set([
  '기록',
  '기록을',
  '기록에서',
  '일기',
  '일기를',
  '감정',
  '기분',
  '내가',
  '나는',
  '관련',
  '관련된',
  '관련해서',
  '대해',
  '대한',
  '찾아줘',
  '찾아',
  '보여줘',
  '모아줘',
  '알려줘',
  '정리해줘',
  '요약해줘',
  '요약',
  '정리',
  '비교해줘',
  '비교',
  '어떤',
  '무엇',
  '뭐야',
  '가장',
  '자주',
  '언제',
  '나타났어',
  '나타난',
  '나타났는지',
  '있었어',
  '있었을까',
  '썼던',
  '쓴',
  '날들',
  '날의',
  '이번',
  '지난',
  '최근',
  '동안',
  '때문에',
  '계기',
  '날',
  '한달',
  '한 달',
  '이번주',
  '지난주',
  '이번달',
  '지난달',
  '올해',
  '작년',
  '상반기',
  '하반기',
  '부터',
  '까지',
  '봄',
  '여름',
  '가을',
  '겨울',
  '반복',
  '반복적으로',
  '등장한',
  '생각',
  '확인',
  '확인해줘',
  '흐름',
  '문장',
  '공통점',
  '주제',
])
const COMPARISON_SOURCE_LIMIT_PER_RANGE = 3

/**
 * 실제 외부 AI 대신 현재 브라우저의 일기만 검색·집계하는 명시적 local adapter다.
 * 외부 AI 계약이 확정되기 전에는 이 구현이 endpoint나 생성형 응답을 가장하지 않는다.
 */
export class LocalJournalAIService implements JournalAIService {
  private readonly repository: JournalAIConversationRepository
  private readonly now: () => Date
  private entries: DiaryEntry[]

  constructor(
    repository: JournalAIConversationRepository,
    entries: DiaryEntry[],
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository
    this.entries = entries
    this.now = now
  }

  setEntries(entries: DiaryEntry[]): void {
    this.entries = entries
  }

  async createConversation(): Promise<AIConversation> {
    const timestamp = this.now().toISOString()
    const conversation: AIConversation = {
      id: createId('conversation'),
      title: '새 대화',
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
    }

    return this.repository.createConversation(conversation)
  }

  async getConversations(): Promise<AIConversation[]> {
    const conversations = await this.repository.getConversations()

    return Promise.all(
      conversations.map((conversation) => this.refreshAndPersistConversation(conversation)),
    )
  }

  async getConversation(id: string): Promise<AIConversation | null> {
    const conversation = await this.repository.getConversation(id)

    return conversation ? this.refreshAndPersistConversation(conversation) : null
  }

  async sendMessage(input: SendAIMessageInput): Promise<AIMessageResponse> {
    const content = input.content.trim()

    if (!content) throw new Error('질문을 입력해 주세요.')
    if (content.length > 1_200) throw new Error('질문은 1,200자 이내로 입력해 주세요.')

    const storedConversation = await this.repository.getConversation(input.conversationId)

    if (!storedConversation) throw new Error('대화를 찾지 못했습니다. 새 대화를 시작해 주세요.')
    await this.refreshAndPersistConversation(storedConversation)

    const userMessage: JournalAIMessage = {
      id: createId('message'),
      role: 'user',
      content,
      createdAt: this.now().toISOString(),
      adapter: 'local-search',
      sources: [],
    }
    await this.updateExistingConversation(
      input.conversationId,
      input.signal,
      (currentConversation) => ({
        ...currentConversation,
        title: currentConversation.messages.length === 0
          ? createConversationTitle(content)
          : currentConversation.title,
        updatedAt: userMessage.createdAt,
        messages: [...currentConversation.messages, userMessage],
      }),
    )
    input.onProgress?.({ type: 'generating' })
    await waitForLocalSearch(input.signal)

    const localResult = buildLocalJournalResponse(content, this.getSearchableEntries(), this.now())
    await streamLocalResponse(localResult.content, input.onProgress, input.signal)
    const assistantMessage: JournalAIMessage = {
      id: createId('message'),
      role: 'assistant',
      content: localResult.content,
      createdAt: this.now().toISOString(),
      adapter: 'local-search',
      sources: localResult.sources,
    }

    await this.updateExistingConversation(
      input.conversationId,
      input.signal,
      (currentConversation) => {
        if (!currentConversation.messages.some((message) => message.id === userMessage.id)) {
          throw createAbortError()
        }

        return {
          ...currentConversation,
          updatedAt: assistantMessage.createdAt,
          messages: [...currentConversation.messages, assistantMessage],
        }
      },
    )

    return {
      message: assistantMessage,
      sources: assistantMessage.sources,
      suggestedQuestions: localResult.suggestedQuestions,
      resultKind: assistantMessage.sources.length > 0 ? 'answer' : 'no-results',
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await this.repository.deleteConversation(id)
  }

  async resetConversationStorage(): Promise<void> {
    await this.repository.clearConversations()
  }

  async renameConversation(id: string, title: string): Promise<AIConversation> {
    const normalizedTitle = title.trim()

    if (!normalizedTitle) throw new Error('대화 이름을 입력해 주세요.')
    if (normalizedTitle.length > 80) throw new Error('대화 이름은 80자 이내로 입력해 주세요.')

    const storedConversation = await this.repository.getConversation(id)

    if (!storedConversation) throw new Error('이름을 바꿀 대화를 찾지 못했습니다.')
    await this.refreshAndPersistConversation(storedConversation)

    return this.repository.updateConversation(id, (currentConversation) => ({
      ...currentConversation,
      title: normalizedTitle,
      updatedAt: this.now().toISOString(),
    }))
  }

  private getSearchableEntries(): DiaryEntry[] {
    return this.entries.filter(isSearchableUserEntry)
  }

  private async refreshAndPersistConversation(
    conversation: AIConversation,
  ): Promise<AIConversation> {
    const { conversation: refreshedConversation, didChange } =
      refreshConversationSources(conversation, this.getSearchableEntries())

    return didChange
      ? this.repository.updateConversation(conversation.id, (currentConversation) =>
          refreshConversationSources(
            currentConversation,
            this.getSearchableEntries(),
          ).conversation,
        )
      : refreshedConversation
  }

  private async updateExistingConversation(
    conversationId: string,
    signal: AbortSignal | undefined,
    update: (conversation: AIConversation) => AIConversation,
  ): Promise<AIConversation> {
    throwIfAborted(signal)

    return this.repository.updateConversation(conversationId, (currentConversation) => {
      throwIfAborted(signal)

      return update(currentConversation)
    })
  }
}

/** persistence 성공 여부와 무관하게 현재 entry 기준으로 민감한 출처를 가린다. */
export function sanitizeJournalConversations(
  conversations: AIConversation[],
  entries: DiaryEntry[],
): AIConversation[] {
  const searchableEntries = entries.filter(isSearchableUserEntry)

  return conversations.map((conversation) =>
    refreshConversationSources(conversation, searchableEntries).conversation,
  )
}

function refreshConversationSources(
  conversation: AIConversation,
  searchableEntries: DiaryEntry[],
): { conversation: AIConversation; didChange: boolean } {
  const entriesById = new Map(searchableEntries.map((entry) => [entry.id, entry]))
  let didChange = false

  const refreshedConversation = {
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (message.role !== 'assistant' || message.sources.length === 0) return message

      const refreshedSources = message.sources.flatMap((source) => {
        const entry = entriesById.get(source.entryId)

        return entry ? [toJournalSource(entry)] : []
      })
      const hasChangedSource = refreshedSources.some(
        (source, index) => !isSameSource(source, message.sources[index]),
      )

      if (refreshedSources.length !== message.sources.length || hasChangedSource) {
        didChange = true

        return {
          ...message,
          content:
            refreshedSources.length === message.sources.length
              ? '연결된 기록이 수정되어 오래된 로컬 검색 답변을 다시 표시하지 않아요. 현재 기록의 출처만 갱신했어요.'
              : '연결된 기록이 삭제되었거나 잠금 상태로 바뀌어 이전 로컬 검색 답변을 다시 표시하지 않아요.',
          sources: refreshedSources,
        }
      }

      return { ...message, sources: refreshedSources }
    }),
  }

  return { conversation: refreshedConversation, didChange }
}

/** 순수 local query builder를 단위 테스트에서 검증할 수 있도록 공개한다. */
export function buildLocalJournalResponse(
  query: string,
  entries: DiaryEntry[],
  referenceDate = new Date(),
): LocalSearchResult {
  const unlockedEntries = entries.filter(isSearchableUserEntry)
  const comparisonRanges = resolveComparisonRanges(query, referenceDate)
  const requestedMood = resolveRequestedMood(query)
  const keywords = extractKeywords(query)
  const suggestions = createSuggestedQuestions(query)

  if (comparisonRanges) {
    const [leftRange, rightRange] = comparisonRanges
    const leftMatches = searchEntries(unlockedEntries, keywords, requestedMood, leftRange)
    const rightMatches = searchEntries(unlockedEntries, keywords, requestedMood, rightRange)
    const leftEntries = leftMatches
      .slice(0, COMPARISON_SOURCE_LIMIT_PER_RANGE)
    const rightEntries = rightMatches
      .slice(0, COMPARISON_SOURCE_LIMIT_PER_RANGE)
    const combinedEntries = uniqueEntries([...leftEntries, ...rightEntries])

    if (combinedEntries.length === 0) {
      return createEmptyResult(
        `${leftRange.label}과 ${rightRange.label}에 비교할 수 있는 기록을 찾지 못했어요.`,
        suggestions,
      )
    }

    return {
      content: createComparisonAnswer(
        leftRange,
        leftEntries,
        leftMatches.length,
        rightRange,
        rightEntries,
        rightMatches.length,
      ),
      sources: combinedEntries.map(toJournalSource),
      suggestedQuestions: suggestions,
    }
  }

  const range = resolvePrimaryRange(query, referenceDate)
  const matches = searchEntries(unlockedEntries, keywords, requestedMood, range)

  if (matches.length === 0) {
    return createEmptyResult(
      range
        ? `${range.label}의 기록에서는 질문과 맞는 내용을 찾지 못했어요.`
        : '저장된 기록에서는 질문과 맞는 내용을 찾지 못했어요.',
      suggestions,
    )
  }

  const selectedEntries = matches.slice(0, 6)
  const wantsSummary = /요약|정리|공통|흐름|계기|반복|자주/.test(query)

  return {
    content: wantsSummary
      ? createSummaryAnswer(selectedEntries, matches.length, range)
      : createSearchAnswer(selectedEntries, matches.length, range),
    sources: selectedEntries.map(toJournalSource),
    suggestedQuestions: suggestions,
  }
}

function searchEntries(
  entries: DiaryEntry[],
  keywords: string[],
  requestedMood: Mood | undefined,
  range?: DateRange,
): DiaryEntry[] {
  return entries
    .filter((entry) => !range || (entry.diaryDate >= range.from && entry.diaryDate <= range.to))
    .map((entry) => ({ entry, score: scoreEntry(entry, keywords, requestedMood) }))
    .filter(({ score }) => score > 0 || (keywords.length === 0 && !requestedMood))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.entry.diaryDate.localeCompare(left.entry.diaryDate) ||
        right.entry.updatedAt.localeCompare(left.entry.updatedAt),
    )
    .map(({ entry }) => entry)
}

function scoreEntry(entry: DiaryEntry, keywords: string[], requestedMood?: Mood): number {
  const title = normalizeText(entry.title)
  const body = normalizeText([entry.content, entry.shortNote].filter(Boolean).join(' '))
  const metadata = normalizeText(
    [
      ...entry.tags,
      ...entry.aiTopics,
      ...entry.activities,
      entry.location?.name,
      entry.weather?.condition,
    ]
      .filter(Boolean)
      .join(' '),
  )
  let score = 0

  if (requestedMood) {
    const moodLabel = MOOD_LABELS[requestedMood]
    const moodEvidencePattern = MOOD_QUERY_PATTERNS.find(
      ({ mood }) => mood === requestedMood,
    )?.pattern
    const hasMoodEvidence =
      entry.mood === requestedMood ||
      title.includes(moodLabel) ||
      body.includes(moodLabel) ||
      Boolean(moodEvidencePattern?.test(`${title} ${body}`))

    if (!hasMoodEvidence) return 0
    score += entry.mood === requestedMood ? 5 : 2
  }

  let keywordMatchCount = 0

  for (const keyword of keywords) {
    const titleMatch = title.includes(keyword)
    const metadataMatch = metadata.includes(keyword)
    const bodyMatch = body.includes(keyword)

    if (titleMatch || metadataMatch || bodyMatch) keywordMatchCount += 1
    if (titleMatch) score += 5
    if (metadataMatch) score += 4
    if (bodyMatch) score += 3
  }

  if (requestedMood && keywords.length > 0 && keywordMatchCount === 0) return 0

  return score
}

function createSearchAnswer(
  entries: DiaryEntry[],
  totalMatches: number,
  range?: DateRange,
): string {
  const periodCopy = range ? `${range.label}에서 ` : ''
  const topMood = getTopMood(entries)
  const moodCopy = topMood ? ` 가장 자주 표시된 감정은 **${MOOD_LABELS[topMood]}**이에요.` : ''
  const matchCopy = totalMatches > entries.length
    ? `조건에 맞는 ${totalMatches}개 중 검색 점수가 높은 대표 ${entries.length}개의`
    : `${entries.length}개의`

  return [
    `**${periodCopy}${matchCopy} 실제 기록을 찾았어요.**`,
    '',
    `제목·본문·태그와 사용자가 남긴 감정 표시를 로컬에서 대조했어요.${moodCopy}`,
    '',
    '아래 출처 카드는 이번 답변에 실제로 사용한 기록만 보여줘요.',
  ].join('\n')
}

function createSummaryAnswer(
  entries: DiaryEntry[],
  totalMatches: number,
  range?: DateRange,
): string {
  const topMood = getTopMood(entries)
  const topTopics = getTopValues([
    ...entries.flatMap((entry) => entry.tags),
    ...entries.flatMap((entry) => entry.aiTopics),
  ]).slice(0, 3)
  const averageEnergyValues = entries
    .map((entry) => entry.energy)
    .filter((energy): energy is number => energy !== undefined)
  const energyLine = averageEnergyValues.length
    ? `- 기록된 에너지 평균: **${(
        averageEnergyValues.reduce((total, energy) => total + energy, 0) /
        averageEnergyValues.length
      ).toFixed(1)}/5**`
    : '- 에너지 값은 충분히 기록되지 않았어요.'
  const recurringTopics = topTopics.filter((item) => item.count >= 2)
  const topicLine = recurringTopics.length
    ? `- 2회 이상 등장한 태그·주제: **${recurringTopics.map((item) => item.value).join(', ')}**`
    : topTopics.length
      ? `- 출처 기록에 포함된 태그·주제: **${topTopics.map((item) => item.value).join(', ')}**`
      : '- 출처 기록에 태그나 주제가 표시되지 않았어요.'

  return [
    totalMatches > entries.length
      ? `**${range ? `${range.label}에서 ` : ''}조건에 맞는 ${totalMatches}개 중 검색 점수가 높은 대표 ${entries.length}개를 정리했어요.**`
      : `**${range ? `${range.label}의 ` : ''}${entries.length}개 기록을 로컬 규칙으로 정리했어요.**`,
    '',
    topMood
      ? `- 가장 자주 표시된 감정: **${MOOD_LABELS[topMood]}**`
      : '- 사용자가 선택한 감정 값은 충분하지 않아요.',
    topicLine,
    energyLine,
    '',
    '이 내용은 생성형 AI의 해석이 아니라, 아래 원문과 메타데이터의 개수·빈도를 정리한 결과예요.',
  ].join('\n')
}

function createComparisonAnswer(
  leftRange: DateRange,
  leftEntries: DiaryEntry[],
  leftTotalMatches: number,
  rightRange: DateRange,
  rightEntries: DiaryEntry[],
  rightTotalMatches: number,
): string {
  return [
    '**두 기간의 실제 기록을 비교했어요.**',
    '',
    `### ${leftRange.label}`,
    `- 검색 결과 ${leftTotalMatches}개 · 출처로 확인한 ${leftEntries.length}개${formatMoodComparison(leftEntries)}`,
    '',
    `### ${rightRange.label}`,
    `- 검색 결과 ${rightTotalMatches}개 · 출처로 확인한 ${rightEntries.length}개${formatMoodComparison(rightEntries)}`,
    '',
    '각 기간에서 검색 점수가 높은 실제 기록을 최대 3개씩 출처로 선택해 비교했어요.',
    '',
    '기록 수와 사용자가 선택한 감정만 비교했으며, 기록에 없는 원인이나 사건은 추정하지 않았어요.',
  ].join('\n')
}

function formatMoodComparison(entries: DiaryEntry[]): string {
  const topMood = getTopMood(entries)

  return topMood ? ` · 가장 잦은 감정 ${MOOD_LABELS[topMood]}` : ' · 감정 표시 없음'
}

function createEmptyResult(message: string, suggestions: string[]): LocalSearchResult {
  return {
    content: `${message}\n\n검색어 또는 기간을 바꿔 다시 물어볼 수 있어요. 잠긴 기록은 현재 검색에서 제외됩니다.`,
    sources: [],
    suggestedQuestions: suggestions,
  }
}

function toJournalSource(entry: DiaryEntry): JournalSource {
  const sourceText = [entry.content, entry.shortNote]
    .find((value) => Boolean(value?.trim()))
    ?.trim() ?? ''

  return {
    entryId: entry.id,
    entryUpdatedAt: entry.updatedAt,
    diaryDate: entry.diaryDate,
    title: entry.title || (entry.type === 'quick' ? '빠른 기록' : '제목 없는 기록'),
    excerpt: sourceText.length > 150 ? `${sourceText.slice(0, 150).trimEnd()}…` : sourceText,
    mood: entry.mood,
  }
}

function isSameSource(left: JournalSource, right: JournalSource | undefined): boolean {
  return Boolean(
    right &&
      left.entryId === right.entryId &&
      left.entryUpdatedAt === right.entryUpdatedAt &&
      left.diaryDate === right.diaryDate &&
      left.title === right.title &&
      left.excerpt === right.excerpt &&
      left.mood === right.mood,
  )
}

function resolveRequestedMood(query: string): Mood | undefined {
  return MOOD_QUERY_PATTERNS.find(({ pattern }) => pattern.test(query))?.mood
}

function extractKeywords(query: string): string[] {
  const normalizedQuery = query
    .toLowerCase()
    .replace(/\d{4}년\s*\d{1,2}월(?:\s*\d{1,2}일)?(?:\s*(?:부터|까지))?/g, ' ')
    .replace(/\d{1,2}월\s*\d{1,2}일?(?:\s*(?:부터|까지))?/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/[?.,!~·/()]/g, ' ')
  const matchedMoodPatterns = MOOD_QUERY_PATTERNS.filter(({ pattern }) => pattern.test(query))
  const moodWords = matchedMoodPatterns.flatMap(({ mood }) => [MOOD_LABELS[mood], mood])

  return Array.from(
    new Set(
      normalizedQuery
        .split(/\s+/)
        .map((token) => QUERY_STOP_WORDS.has(token) ? '' : stripKoreanParticles(token))
        .map(normalizeSemanticKeyword)
        .filter(
          (token) =>
            token.length >= 2 &&
            !QUERY_STOP_WORDS.has(token) &&
            !matchedMoodPatterns.some(({ pattern }) => pattern.test(token)) &&
            !moodWords.some((moodWord) => token.includes(moodWord.toLowerCase())),
        ),
    ),
  )
}

function normalizeSemanticKeyword(token: string): string {
  if (token === '학교생활') return '학교'

  return token
}

function stripKoreanParticles(token: string): string {
  let normalizedToken = token
  const particlePattern = /(?:에게서는|한테서는|으로부터|에서부터|에게는|한테는|에서는|부터는|까지는|에는|은|는|이|가|을|를|과|와|에서|에게|한테|으로|로|의)$/u

  for (let index = 0; index < 2; index += 1) {
    const nextToken = normalizedToken.replace(particlePattern, '')

    if (nextToken === normalizedToken) break
    normalizedToken = nextToken
  }

  if (normalizedToken.endsWith('에') && Array.from(normalizedToken).length >= 3) {
    normalizedToken = normalizedToken.slice(0, -1)
  }

  return normalizedToken
}

function resolveComparisonRanges(query: string, referenceDate: Date): [DateRange, DateRange] | null {
  if (!/비교|차이|달라/.test(query)) return null

  if (/지난달/.test(query) && /이번\s*달|이번달/.test(query)) {
    return [createMonthRange(addMonths(referenceDate, -1), '지난달'), createMonthRange(referenceDate, '이번 달')]
  }
  if (/작년/.test(query) && /올해/.test(query)) {
    return [createYearRange(referenceDate.getFullYear() - 1, '작년'), createYearRange(referenceDate.getFullYear(), '올해')]
  }
  if (/지난\s*주|지난주/.test(query) && /이번\s*주|이번주/.test(query)) {
    return [createWeekRange(addDays(referenceDate, -7), '지난주'), createWeekRange(referenceDate, '이번 주')]
  }

  const explicitMonths = Array.from(query.matchAll(/(\d{4})년\s*(\d{1,2})월/g))

  if (explicitMonths.length >= 2) {
    return explicitMonths.slice(0, 2).map((match) => {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)

      return createMonthRange(date, `${match[1]}년 ${Number(match[2])}월`)
    }) as [DateRange, DateRange]
  }

  return null
}

function resolvePrimaryRange(query: string, referenceDate: Date): DateRange | undefined {
  const explicitRange = query.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:부터|~|–|—)\s*(\d{4}-\d{2}-\d{2})/,
  )

  if (explicitRange) {
    return {
      from: explicitRange[1],
      to: explicitRange[2],
      label: `${formatShortDate(explicitRange[1])}부터 ${formatShortDate(explicitRange[2])}까지`,
    }
  }

  const koreanExplicitRange = query.match(
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일?\s*(?:부터|~|–|—)\s*(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일?\s*(?:까지)?/,
  )

  if (koreanExplicitRange) {
    const from = toValidatedDateKey(
      Number(koreanExplicitRange[1]),
      Number(koreanExplicitRange[2]),
      Number(koreanExplicitRange[3]),
    )
    const to = toValidatedDateKey(
      Number(koreanExplicitRange[4] ?? koreanExplicitRange[1]),
      Number(koreanExplicitRange[5]),
      Number(koreanExplicitRange[6]),
    )

    if (from && to && from <= to) {
      return {
        from,
        to,
        label: `${formatShortDate(from)}부터 ${formatShortDate(to)}까지`,
      }
    }
  }

  const relativeSeason = query.match(/(올해|작년)\s*(봄|여름|가을|겨울)/)

  if (relativeSeason) {
    const year = referenceDate.getFullYear() - (relativeSeason[1] === '작년' ? 1 : 0)

    return createSeasonRange(year, relativeSeason[2], `${relativeSeason[1]} ${relativeSeason[2]}`)
  }

  const explicitSeason = query.match(/(\d{4})년\s*(봄|여름|가을|겨울)/)

  if (explicitSeason) {
    return createSeasonRange(
      Number(explicitSeason[1]),
      explicitSeason[2],
      `${explicitSeason[1]}년 ${explicitSeason[2]}`,
    )
  }

  if (/이번\s*주|이번주/.test(query)) return createWeekRange(referenceDate, '이번 주')
  if (/지난\s*주|지난주/.test(query)) return createWeekRange(addDays(referenceDate, -7), '지난주')
  if (/지난달/.test(query)) return createMonthRange(addMonths(referenceDate, -1), '지난달')
  if (/이번\s*달|이번달/.test(query)) return createMonthRange(referenceDate, '이번 달')
  if (/최근\s*(?:한\s*)?달|최근\s*1개월/.test(query)) {
    return {
      from: toDateKey(addDays(referenceDate, -29)),
      to: toDateKey(referenceDate),
      label: '최근 한 달',
    }
  }
  if (/최근/.test(query)) {
    return {
      from: toDateKey(addDays(referenceDate, -29)),
      to: toDateKey(referenceDate),
      label: '최근 기록',
    }
  }
  if (/올해\s*상반기/.test(query)) {
    return { from: `${referenceDate.getFullYear()}-01-01`, to: `${referenceDate.getFullYear()}-06-30`, label: '올해 상반기' }
  }
  if (/올해/.test(query)) return createYearRange(referenceDate.getFullYear(), '올해')
  if (/작년/.test(query)) return createYearRange(referenceDate.getFullYear() - 1, '작년')

  const explicitMonth = query.match(/(\d{4})년\s*(\d{1,2})월/)

  if (explicitMonth) {
    const date = new Date(Number(explicitMonth[1]), Number(explicitMonth[2]) - 1, 1)

    return createMonthRange(date, `${explicitMonth[1]}년 ${Number(explicitMonth[2])}월`)
  }

  return undefined
}

function createWeekRange(referenceDate: Date, label: string): DateRange {
  const dayIndex = (referenceDate.getDay() + 6) % 7
  const monday = addDays(referenceDate, -dayIndex)

  return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)), label }
}

function createMonthRange(referenceDate: Date, label: string): DateRange {
  const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)

  return { from: toDateKey(firstDay), to: toDateKey(lastDay), label }
}

function createYearRange(year: number, label: string): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31`, label }
}

function createSeasonRange(year: number, season: string, label: string): DateRange {
  if (season === '봄') return { from: `${year}-03-01`, to: `${year}-05-31`, label }
  if (season === '여름') return { from: `${year}-06-01`, to: `${year}-08-31`, label }
  if (season === '가을') return { from: `${year}-09-01`, to: `${year}-11-30`, label }

  const lastDayOfFebruary = new Date(year + 1, 2, 0).getDate()

  return {
    from: `${year}-12-01`,
    to: `${year + 1}-02-${String(lastDayOfFebruary).padStart(2, '0')}`,
    label,
  }
}

function toValidatedDateKey(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day, 12)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return toDateKey(date)
}

function getTopMood(entries: DiaryEntry[]): Mood | undefined {
  return getTopValues(
    entries.map((entry) => entry.mood).filter((mood): mood is Mood => Boolean(mood)),
  )[0]?.value as Mood | undefined
}

function getTopValues(values: string[]): Array<{ value: string; count: number }> {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1

    return result
  }, {})

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
}

function createSuggestedQuestions(query: string): string[] {
  const defaults = [
    '이번 주 기록을 요약해줘',
    '최근에 가장 편안했던 날을 찾아줘',
    '프로젝트와 관련된 기록을 모아줘',
    '지난달과 이번 달의 기분을 비교해줘',
  ]

  return defaults.filter((question) => question !== query.trim()).slice(0, 3)
}

function uniqueEntries(entries: DiaryEntry[]): DiaryEntry[] {
  const seenIds = new Set<string>()

  return entries.filter((entry) => {
    if (seenIds.has(entry.id)) return false
    seenIds.add(entry.id)

    return true
  })
}

function normalizeText(value: string | undefined): string {
  return value?.toLowerCase().replace(/\s+/g, ' ').trim() ?? ''
}

function isSearchableUserEntry(entry: DiaryEntry): boolean {
  // 최초 화면용 seed는 사용자 기록이 아니므로 AI 근거로 사용하지 않는다.
  return !entry.isLocked && !entry.id.startsWith('seed-')
}

function createConversationTitle(content: string): string {
  return content.length > 34 ? `${content.slice(0, 34).trimEnd()}…` : content
}

function createId(prefix: string): string {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `${prefix}-${randomId}`
}

function waitForLocalSearch(signal?: AbortSignal): Promise<void> {
  return waitWithAbort(650, signal)
}

async function streamLocalResponse(
  content: string,
  onProgress: SendAIMessageInput['onProgress'],
  signal?: AbortSignal,
): Promise<void> {
  if (!onProgress) return

  const chunkSize = 56

  for (let end = chunkSize; end < content.length + chunkSize; end += chunkSize) {
    if (signal?.aborted) throw createAbortError()
    onProgress({
      type: 'streaming',
      content: content.slice(0, Math.min(end, content.length)),
    })

    if (end < content.length) await waitWithAbort(18, signal)
  }
}

function waitWithAbort(duration: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timeoutId = globalThis.setTimeout(finish, duration)
    const abort = () => {
      globalThis.clearTimeout(timeoutId)
      reject(createAbortError())
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

function createAbortError(): Error {
  const error = new Error('응답 생성을 취소했습니다.')
  error.name = 'AbortError'

  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12)
}

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-')

  return `${Number(month)}월 ${Number(day)}일`
}
