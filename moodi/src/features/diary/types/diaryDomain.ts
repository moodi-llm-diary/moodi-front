/** Moodi가 일관되게 사용하는 아홉 가지 감정 값이다. */
export const MOODS = [
  'happy',
  'calm',
  'excited',
  'neutral',
  'tired',
  'anxious',
  'frustrated',
  'sad',
  'angry',
] as const

/** 긴 일기와 빠른 기록을 구분하는 저장 타입이다. */
export const ENTRY_TYPES = ['journal', 'quick'] as const

/** 빠른 기록과 필터에서 공유하는 canonical 활동 값이다. */
export const ACTIVITIES = [
  'work',
  'people',
  'exercise',
  'study',
  'walk',
  'rest',
  'music',
  'meal',
  'self-care',
] as const

export type Mood = (typeof MOODS)[number]
export type EntryType = (typeof ENTRY_TYPES)[number]
export type Activity = (typeof ACTIVITIES)[number]
/** 분석 결과가 local demo인지 계약된 외부 AI인지 구분한다. */
export type AIInsightSource = 'local-rule-mock' | 'external-ai'
export type DiaryImageRole = 'cover' | 'inline'

/** 일기에 연결된 이미지 메타데이터다. 실제 업로드 파일 계약과는 분리한다. */
export interface DiaryImage {
  id: string
  url: string
  alt?: string
  /** cover와 block 본문 이미지를 구분한다. 기존 데이터는 role 없이도 유효하다. */
  role?: DiaryImageRole
}

/** 사용자가 명시적으로 기록한 날씨 문맥이다. */
export interface WeatherContext {
  condition?: string
  temperature?: number
}

/** 사용자가 명시적으로 기록한 위치 문맥이다. */
export interface LocationContext {
  name?: string
}

/** 사용자 원문과 분리해 표시하는 Moodi 분석 결과다. */
export interface AIInsight {
  summary?: string
  emotions: string[]
  topics: string[]
  patterns: string[]
  followUpQuestions: string[]
  relatedEntryIds: string[]
  source: AIInsightSource
  generatedAt: string
}

/** 저장소와 application 계층이 사용하는 일기 도메인 모델이다. */
export interface DiaryEntry {
  id: string
  type: EntryType
  title?: string
  content?: string
  /** TipTap 문서의 구조와 서식을 보존하는 HTML이다. content의 검색/분석용 평문과 분리한다. */
  contentHtml?: string
  shortNote?: string
  createdAt: string
  updatedAt: string
  diaryDate: string
  mood?: Mood
  /** 1(매우 낮음)부터 5(매우 높음)까지의 선택적 에너지 값이다. */
  energy?: number
  activities: Activity[]
  tags: string[]
  aiTopics: string[]
  images: DiaryImage[]
  weather?: WeatherContext
  location?: LocationContext
  isFavorite: boolean
  isLocked: boolean
  aiInsight?: AIInsight
}

/** 빠른 기록 UI에서 사용하는 입력 도메인 모델이다. */
export interface DailyCheckIn {
  date: string
  mood?: Mood
  energy?: number
  activities: Activity[]
  shortNote?: string
}

/** unknown 값이 canonical Mood인지 검사한다. */
export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && MOODS.includes(value as Mood)
}

/** unknown 값이 지원되는 EntryType인지 검사한다. */
export function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && ENTRY_TYPES.includes(value as EntryType)
}

/** unknown 값이 지원되는 canonical Activity인지 검사한다. */
export function isActivity(value: unknown): value is Activity {
  return typeof value === 'string' && ACTIVITIES.includes(value as Activity)
}
