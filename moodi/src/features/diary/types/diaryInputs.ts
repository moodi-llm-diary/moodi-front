import type {
  AIInsight,
  Activity,
  DiaryImage,
  EntryType,
  LocationContext,
  Mood,
  WeatherContext,
} from './diaryDomain'

export type DiaryAnalysisTone =
  | 'kind-friend'
  | 'calm-guide'
  | 'analytical-observer'
  | 'minimal-feedback'

export type DiaryAnalysisResponseLength = 'brief' | 'balanced' | 'detailed'

/** 새 기록 생성에 필요한 application 입력 계약이다. */
export interface CreateDiaryEntryInput {
  type: EntryType
  diaryDate: string
  title?: string
  content?: string
  contentHtml?: string
  shortNote?: string
  mood?: Mood
  energy?: number
  activities?: Activity[]
  tags?: string[]
  images?: DiaryImage[]
  weather?: WeatherContext
  location?: LocationContext
  isFavorite?: boolean
  isLocked?: boolean
  /** application의 분석 service가 채우는 값이며 raw form 입력으로 사용하지 않는다. */
  aiInsight?: AIInsight
  /** application의 분석 service가 채우는 값이며 사용자 태그와 구분한다. */
  aiTopics?: string[]
  /** false면 local mock 분석도 실행하지 않고 분석 필드를 비운다. */
  shouldAnalyze?: boolean
  /** local mock 또는 향후 AI adapter에 전달하는 응답 말투다. */
  analysisTone?: DiaryAnalysisTone
  /** local mock 또는 향후 AI adapter에 전달하는 응답 길이다. */
  analysisResponseLength?: DiaryAnalysisResponseLength
}

/** 기존 기록에서 변경 가능한 필드만 표현하는 application 입력 계약이다. */
export interface UpdateDiaryEntryInput {
  type?: EntryType
  diaryDate?: string
  title?: string
  content?: string
  contentHtml?: string
  shortNote?: string
  mood?: Mood
  energy?: number
  activities?: Activity[]
  tags?: string[]
  images?: DiaryImage[]
  weather?: WeatherContext
  location?: LocationContext
  isFavorite?: boolean
  isLocked?: boolean
  /** null은 기존 분석 결과를 명시적으로 제거한다. */
  aiInsight?: AIInsight | null
  aiTopics?: string[]
  /** false면 local mock 분석도 실행하지 않고 분석 필드를 비운다. */
  shouldAnalyze?: boolean
  analysisTone?: DiaryAnalysisTone
  analysisResponseLength?: DiaryAnalysisResponseLength
}

/** 전체 기록 탐색에 적용하는 필터 조건이다. */
export interface DiaryEntryFilters {
  query?: string
  dateFrom?: string
  dateTo?: string
  moods?: Mood[]
  activities?: Activity[]
  tags?: string[]
  isFavorite?: boolean
  hasImages?: boolean
  entryTypes?: EntryType[]
}

/** 작성 화면을 나가도 복구할 수 있는 단일 활성 초안이다. */
export interface DiaryDraft {
  id: string
  entryId?: string
  type: EntryType
  diaryDate: string
  title: string
  content: string
  contentHtml?: string
  shortNote: string
  mood?: Mood
  energy?: number
  activities: Activity[]
  tags: string[]
  images: DiaryImage[]
  weather?: WeatherContext
  location?: LocationContext
  isFavorite: boolean
  isLocked: boolean
  savedAt: string
}

/** 자동 저장 시각을 제외한 초안 저장 입력이다. */
export type SaveDiaryDraftInput = Omit<DiaryDraft, 'id' | 'savedAt'> & {
  id?: string
}
