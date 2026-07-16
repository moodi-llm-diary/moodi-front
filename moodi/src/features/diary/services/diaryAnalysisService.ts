import type {
  AIInsight,
  Activity,
  DiaryEntry,
  EntryType,
  Mood,
} from '../types/diaryDomain'
import type {
  DiaryAnalysisResponseLength,
  DiaryAnalysisTone,
} from '../types/diaryInputs'

/** local mock 분석에 전달하는 최소 application 입력이다. */
export interface DiaryAnalysisInput {
  entryId?: string
  type: EntryType
  diaryDate: string
  title?: string
  content?: string
  shortNote?: string
  mood?: Mood
  activities: Activity[]
  tags: string[]
  analysisTone?: DiaryAnalysisTone
  analysisResponseLength?: DiaryAnalysisResponseLength
}

/** 일기 분석 구현체가 지켜야 하는 application 경계다. */
export interface DiaryAnalysisService {
  analyze(input: DiaryAnalysisInput, existingEntries: DiaryEntry[]): Promise<AIInsight>
}

type TopicRule = {
  pattern: RegExp
  topic: string
}

const TOPIC_RULES: TopicRule[] = [
  { pattern: /프로젝트|개발|코드|디자인|앱|서비스/i, topic: '프로젝트' },
  { pattern: /회사|업무|회의|마감|할 일|일했|작업/i, topic: '업무' },
  { pattern: /친구|가족|동료|팀|사람|대화/i, topic: '관계' },
  { pattern: /산책|운동|달리기|요가|스트레칭/i, topic: '움직임' },
  { pattern: /잠|수면|피곤|지쳤|졸/i, topic: '휴식' },
  { pattern: /식사|밥|커피|차|맛있/i, topic: '식사' },
  { pattern: /불안|걱정|긴장|눈치/i, topic: '불안' },
  { pattern: /기대|설렘|재밌|즐거|행복/i, topic: '기대' },
]

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

const ACTIVITY_TOPIC_LABELS: Record<Activity, string> = {
  work: '업무',
  people: '관계',
  exercise: '운동',
  study: '공부',
  walk: '산책',
  rest: '휴식',
  music: '음악',
  meal: '식사',
  'self-care': '자기 돌봄',
}

/**
 * 외부 통신 없이 현재 브라우저의 기록만 사용하는 명시적 데모 분석 구현체다.
 * 실제 AI 전환 TODO: endpoint와 request/response field, 인증 방식, timeout, retry,
 * cancellation, rate limit, error mapping 계약이 확정되면 별도 adapter로 교체한다.
 */
export class LocalRuleBasedDiaryAnalysisService implements DiaryAnalysisService {
  async analyze(
    input: DiaryAnalysisInput,
    existingEntries: DiaryEntry[],
  ): Promise<AIInsight> {
    const sourceText = [input.title, input.content, input.shortNote]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' ')
    const detectedTopics = TOPIC_RULES.filter((rule) => rule.pattern.test(sourceText)).map(
      (rule) => rule.topic,
    )
    const itemLimit = getResponseItemLimit(input.analysisResponseLength)
    const topics = uniqueValues([
      ...input.activities.map((activity) => ACTIVITY_TOPIC_LABELS[activity]),
      ...input.tags,
      ...detectedTopics,
    ]).slice(0, itemLimit.topics)
    const relatedEntries = findRelatedEntries(input, topics, existingEntries)

    return {
      summary: createSummary(input, sourceText),
      emotions: createEmotionLabels(input.mood, sourceText),
      topics,
      patterns: createPatterns(input, topics, relatedEntries).slice(0, itemLimit.patterns),
      followUpQuestions: createFollowUpQuestions(input, topics).slice(0, itemLimit.questions),
      relatedEntryIds: relatedEntries.map((entry) => entry.id),
      source: 'local-rule-mock',
      generatedAt: new Date().toISOString(),
    }
  }
}

/** 기본 local mock 분석 구현체다. */
export const diaryAnalysisService: DiaryAnalysisService =
  new LocalRuleBasedDiaryAnalysisService()

function findRelatedEntries(
  input: DiaryAnalysisInput,
  topics: string[],
  entries: DiaryEntry[],
): DiaryEntry[] {
  const topicSet = new Set(topics.map(normalizeToken))
  const activitySet = new Set(input.activities.map(normalizeToken))
  const tagSet = new Set(input.tags.map(normalizeToken))

  return entries
    .filter(
      (entry) =>
        entry.id !== input.entryId &&
        entry.diaryDate <= input.diaryDate &&
        !entry.isLocked &&
        !entry.id.startsWith('seed-'),
    )
    .map((entry) => {
      const comparableTopics = uniqueValues([
        ...entry.aiTopics,
        ...entry.activities,
        ...entry.tags,
      ]).map(normalizeToken)
      const topicOverlap = comparableTopics.filter((topic) => topicSet.has(topic)).length
      const activityOverlap = entry.activities
        .map(normalizeToken)
        .filter((activity) => activitySet.has(activity)).length
      const tagOverlap = entry.tags
        .map(normalizeToken)
        .filter((tag) => tagSet.has(tag)).length
      const moodScore = input.mood && entry.mood === input.mood ? 3 : 0
      const score = topicOverlap * 2 + activityOverlap * 2 + tagOverlap * 2 + moodScore

      return { entry, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.entry.diaryDate.localeCompare(left.entry.diaryDate) ||
        right.entry.updatedAt.localeCompare(left.entry.updatedAt),
    )
    .slice(0, 3)
    .map((candidate) => candidate.entry)
}

function createSummary(input: DiaryAnalysisInput, sourceText: string): string {
  const trimmedText = sourceText.replace(/\s+/g, ' ').trim()

  if (trimmedText) {
    const excerpt = trimmedText.length > 92 ? `${trimmedText.slice(0, 92)}…` : trimmedText
    const moodPrefix = input.mood ? `${MOOD_LABELS[input.mood]}이 담긴 기록이에요. ` : ''

    return applyTone(`${moodPrefix}${excerpt}`, input.analysisTone)
  }

  if (input.mood) {
    return applyTone(
      `${MOOD_LABELS[input.mood]}을 남긴 짧은 기록이에요.`,
      input.analysisTone,
    )
  }

  return applyTone('오늘의 상태를 짧게 남긴 기록이에요.', input.analysisTone)
}

function applyTone(summary: string, tone: DiaryAnalysisTone | undefined): string {
  if (tone === 'kind-friend') return `천천히 돌아보면, ${summary}`
  if (tone === 'analytical-observer') return `기록 기준으로 보면, ${summary}`
  if (tone === 'minimal-feedback') return summary.replace(/이에요\.$/, '입니다.')

  return summary
}

function getResponseItemLimit(length: DiaryAnalysisResponseLength | undefined) {
  if (length === 'brief') return { topics: 4, patterns: 1, questions: 1 }
  if (length === 'detailed') return { topics: 8, patterns: 3, questions: 3 }

  return { topics: 6, patterns: 2, questions: 2 }
}

function createEmotionLabels(mood: Mood | undefined, sourceText: string): string[] {
  const emotions = mood ? [MOOD_LABELS[mood]] : []

  if (/피곤|지쳤|졸|기운 없/i.test(sourceText)) emotions.push('피곤함')
  if (/불안|걱정|긴장|눈치/i.test(sourceText)) emotions.push('불안함')
  if (/기대|설렘|재밌|즐거|행복/i.test(sourceText)) emotions.push('기대감')
  if (/화나|짜증|분노/i.test(sourceText)) emotions.push('화남')
  if (/슬프|울적|눈물/i.test(sourceText)) emotions.push('슬픔')

  return uniqueValues(emotions).slice(0, 4)
}

function createPatterns(
  input: DiaryAnalysisInput,
  topics: string[],
  relatedEntries: DiaryEntry[],
): string[] {
  const patterns: string[] = []
  const hasSupportingProjectEntry = relatedEntries.some(
    (entry) => entry.mood === 'tired' && entryHasTopic(entry, '프로젝트'),
  )

  if (input.mood === 'tired' && topics.includes('프로젝트') && hasSupportingProjectEntry) {
    patterns.push('프로젝트를 기록한 날에는 피곤함이 함께 나타나는 흐름이 있어요.')
  }

  const supportingMovementEntries = relatedEntries.filter(
    (entry) =>
      (entry.mood === 'calm' || entry.mood === 'happy') &&
      (entry.activities.includes('walk') ||
        entry.activities.includes('exercise') ||
        entryHasTopic(entry, '움직임')),
  )

  if (
    (input.mood === 'calm' || input.mood === 'happy') &&
    (topics.includes('움직임') ||
      input.activities.some((activity) => activity === 'walk' || activity === 'exercise')) &&
    supportingMovementEntries.length > 0
  ) {
    const movementMoodLabels = uniqueValues(
      [input.mood, ...supportingMovementEntries.map((entry) => entry.mood)]
        .filter((mood): mood is Mood => mood === 'calm' || mood === 'happy')
        .map((mood) => MOOD_LABELS[mood]),
    )

    patterns.push(`몸을 움직인 날에는 ${movementMoodLabels.join(' 또는 ')} 감정이 함께 기록됐어요.`)
  }

  if (relatedEntries.length >= 2) {
    const repeatedTopic = topics.find(
      (topic) => relatedEntries.filter((entry) => entryHasTopic(entry, topic)).length >= 2,
    )
    const hasRepeatedMood = Boolean(
      input.mood && relatedEntries.filter((entry) => entry.mood === input.mood).length >= 2,
    )

    if (repeatedTopic) {
      patterns.push(`${repeatedTopic} 주제가 이전 기록에도 반복해서 등장했어요.`)
    } else if (hasRepeatedMood) {
      patterns.push('같은 감정을 선택한 과거 기록이 두 번 이상 다시 연결됐어요.')
    }
  }

  return uniqueValues(patterns).slice(0, 3)
}

function entryHasTopic(entry: DiaryEntry, topic: string): boolean {
  const directTopics = uniqueValues([
    ...entry.aiTopics,
    ...entry.tags,
    ...entry.activities.map((activity) => ACTIVITY_TOPIC_LABELS[activity]),
  ])

  if (directTopics.includes(topic)) return true

  const sourceText = [entry.title, entry.content, entry.shortNote]
    .filter(Boolean)
    .join(' ')

  return TOPIC_RULES.some((rule) => rule.topic === topic && rule.pattern.test(sourceText))
}

function createFollowUpQuestions(
  input: DiaryAnalysisInput,
  topics: string[],
): string[] {
  const questions: string[] = []

  if (input.mood === 'tired' || input.mood === 'frustrated') {
    questions.push('지금 가장 먼저 덜어내고 싶은 부담은 무엇인가요?')
  } else if (input.mood === 'happy' || input.mood === 'excited') {
    questions.push('오늘의 좋은 감정을 만든 가장 작은 순간은 무엇이었나요?')
  } else if (input.mood === 'anxious') {
    questions.push('걱정 속에서도 내가 통제할 수 있는 한 가지는 무엇인가요?')
  }

  if (topics.includes('관계')) {
    questions.push('오늘의 관계에서 오래 기억하고 싶은 말은 무엇인가요?')
  } else if (topics.includes('프로젝트') || topics.includes('업무')) {
    questions.push('오늘 한 일 중 내일의 나를 도와줄 결정은 무엇이었나요?')
  }

  questions.push('오늘의 나에게 짧은 문장을 남긴다면 무엇인가요?')

  return uniqueValues(questions).slice(0, 2)
}

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  )
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}
