export type FontSizePreference = 'small' | 'medium' | 'large'

export type AiTonePreference =
  | 'kind-friend'
  | 'calm-guide'
  | 'analytical-observer'
  | 'minimal-feedback'

export type AiResponseLengthPreference = 'brief' | 'balanced' | 'detailed'

export type ExternalDataSource =
  | 'photos'
  | 'calendar'
  | 'music'
  | 'weather'
  | 'projects'
  | 'github'

export type SettingsOption<Value extends string> = {
  value: Value
  label: string
  description: string
}

export type ExternalDataConnectionOption = {
  source: ExternalDataSource
  label: string
  description: string
  consentDescription: string
}

export type SettingsPreferences = {
  fontSize: FontSizePreference
  isEntryLockEnabledByDefault: boolean
  isAiAnalysisEnabled: boolean
  aiTone: AiTonePreference
  aiResponseLength: AiResponseLengthPreference
  isPersonalizedQuestionsEnabled: boolean
}

export const DEFAULT_SETTINGS_PREFERENCES: SettingsPreferences = {
  fontSize: 'medium',
  isEntryLockEnabledByDefault: false,
  isAiAnalysisEnabled: true,
  aiTone: 'calm-guide',
  aiResponseLength: 'balanced',
  isPersonalizedQuestionsEnabled: true,
}

export const FONT_SIZE_OPTIONS: SettingsOption<FontSizePreference>[] = [
  {
    value: 'small',
    label: '작게',
    description: '한 화면에서 더 많은 기록을 볼 수 있어요.',
  },
  {
    value: 'medium',
    label: '보통',
    description: '읽기 편한 기본 글자 크기예요.',
  },
  {
    value: 'large',
    label: '크게',
    description: '본문과 메뉴 글자를 여유 있게 보여줘요.',
  },
]

export const AI_TONE_OPTIONS: SettingsOption<AiTonePreference>[] = [
  {
    value: 'kind-friend',
    label: '다정한 친구',
    description: '따뜻하고 친근한 말투로 기록을 돌아봐요.',
  },
  {
    value: 'calm-guide',
    label: '차분한 기록 도우미',
    description: '감정을 단정하지 않고 차분하게 정리해요.',
  },
  {
    value: 'analytical-observer',
    label: '분석적인 관찰자',
    description: '반복되는 주제와 흐름을 중심으로 이야기해요.',
  },
  {
    value: 'minimal-feedback',
    label: '최소한의 피드백',
    description: '꼭 필요한 한두 문장만 간결하게 보여줘요.',
  },
]

export const AI_RESPONSE_LENGTH_OPTIONS: SettingsOption<AiResponseLengthPreference>[] = [
  {
    value: 'brief',
    label: '짧게',
    description: '핵심만 한두 문장으로 정리해요.',
  },
  {
    value: 'balanced',
    label: '적당히',
    description: '요약과 질문을 균형 있게 보여줘요.',
  },
  {
    value: 'detailed',
    label: '자세히',
    description: '감정, 주제, 관련 기록을 충분히 설명해요.',
  },
]

export const EXTERNAL_DATA_CONNECTION_OPTIONS: ExternalDataConnectionOption[] = [
  {
    source: 'photos',
    label: '오늘 찍은 사진',
    description: '사진을 오늘의 기록 소재로 제안해요.',
    consentDescription: '선택한 사진만 동의 후 불러옵니다.',
  },
  {
    source: 'calendar',
    label: '오늘의 일정',
    description: '일정을 하루 회고의 단서로 제안해요.',
    consentDescription: '허용한 캘린더만 동의 후 연결합니다.',
  },
  {
    source: 'music',
    label: '자주 들은 음악',
    description: '오늘 자주 들은 음악을 기록 소재로 제안해요.',
    consentDescription: '연결할 음악 서비스와 범위를 먼저 확인합니다.',
  },
  {
    source: 'weather',
    label: '오늘의 날씨',
    description: '기록한 날의 날씨 맥락을 함께 남겨요.',
    consentDescription: '위치 사용 범위를 확인하고 동의 후 연결합니다.',
  },
  {
    source: 'projects',
    label: '오늘 작업한 프로젝트',
    description: '직접 선택한 프로젝트 활동을 회고 소재로 제안해요.',
    consentDescription: '연결할 작업 공간과 프로젝트를 직접 선택합니다.',
  },
  {
    source: 'github',
    label: 'GitHub 활동',
    description: '선택한 저장소의 활동을 기록 소재로 제안해요.',
    consentDescription: '저장소 접근 범위를 확인하고 동의 후 연결합니다.',
  },
]
