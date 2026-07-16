import type {
  CalendarDayViewModel,
  DiaryEntry,
  DiaryEntryFilters,
  Mood,
} from '../types/diary'

export type MoodDistributionItem = {
  mood: Mood
  count: number
  percentage: number
}

export type CountedLabel = {
  label: string
  count: number
}

export type WeeklyDiaryPoint = {
  label: string
  date: string
  mood?: Mood
  energy?: number
  hasEntry: boolean
}

export type DiaryInsights = {
  totalEntries: number
  recordedDays: number
  currentMonthEntries: number
  streakDays: number
  averageEnergy?: number
  topMood?: Mood
  moodDistribution: MoodDistributionItem[]
  topActivities: CountedLabel[]
  topTags: CountedLabel[]
  topTopics: CountedLabel[]
  topPeople: CountedLabel[]
  topLocations: CountedLabel[]
  recurringPatterns: CountedLabel[]
  weeklyPoints: WeeklyDiaryPoint[]
  summary: string
  hasEnoughData: boolean
}

export type TagIndexCategory = 'user' | 'activity' | 'mood' | 'aiTopic'

export type TagIndexGroup = {
  category: TagIndexCategory
  label: string
  items: Array<{ value: string; label: string; count: number }>
}

/** 기록을 날짜와 수정 시각의 역순으로 정렬한다. */
export function sortDiaryEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort(
    (left, right) =>
      right.diaryDate.localeCompare(left.diaryDate) ||
      right.updatedAt.localeCompare(left.updatedAt),
  )
}

/** 제목, 본문, 태그, AI 주제와 복합 필터를 함께 적용한다. */
export function filterDiaryEntries(
  entries: DiaryEntry[],
  filters: DiaryEntryFilters,
): DiaryEntry[] {
  const query = filters.query?.trim().toLowerCase()

  return sortDiaryEntries(entries).filter((entry) => {
    const searchableText = [
      entry.title,
      entry.content,
      entry.shortNote,
      entry.mood ? getMoodLabel(entry.mood) : undefined,
      ...entry.tags,
      ...entry.aiTopics,
      ...entry.activities,
      ...entry.activities.map(getActivityLabel),
      entry.location?.name,
      entry.weather?.condition,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase()

    if (query && !searchableText.includes(query)) return false
    if (filters.dateFrom && entry.diaryDate < filters.dateFrom) return false
    if (filters.dateTo && entry.diaryDate > filters.dateTo) return false
    if (filters.moods?.length && (!entry.mood || !filters.moods.includes(entry.mood))) {
      return false
    }
    if (
      filters.activities?.length &&
      !filters.activities.some((activity) => entry.activities.includes(activity))
    ) {
      return false
    }
    if (filters.tags?.length && !filters.tags.some((tag) => entry.tags.includes(tag))) {
      return false
    }
    if (filters.isFavorite && !entry.isFavorite) return false
    if (filters.hasImages && entry.images.length === 0) return false
    if (filters.entryTypes?.length && !filters.entryTypes.includes(entry.type)) return false

    return true
  })
}

/** 표시 월의 월요일 시작 42개 날짜 셀 view model을 만든다. */
export function buildCalendarDays(
  cursor: Date,
  entries: DiaryEntry[],
  selectedDate: string,
  todayKey: string,
): CalendarDayViewModel[] {
  const firstDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const startOffset = (firstDate.getDay() + 6) % 7
  const startDate = addDays(firstDate, -startOffset)
  const entriesByDate = entries.reduce<Record<string, DiaryEntry[]>>((group, entry) => {
    group[entry.diaryDate] = [...(group[entry.diaryDate] ?? []), entry]

    return group
  }, {})

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = addDays(startDate, index)
    const date = toDateKey(currentDate)
    const dayEntries = sortDiaryEntries(entriesByDate[date] ?? [])
    const moodCounts = countValues(dayEntries.map((entry) => entry.mood).filter(isDefined))
    const representativeMood = moodCounts[0]?.label as Mood | undefined

    return {
      date,
      dayNumber: currentDate.getDate(),
      isCurrentMonth: currentDate.getMonth() === cursor.getMonth(),
      isToday: date === todayKey,
      isSelected: date === selectedDate,
      entries: dayEntries,
      representativeMood,
      journalCount: dayEntries.filter((entry) => entry.type === 'journal').length,
      quickCount: dayEntries.filter((entry) => entry.type === 'quick').length,
      hasImages: dayEntries.some((entry) => entry.images.length > 0),
    }
  })
}

/** 연속 기록 일수를 오늘부터 과거 방향으로 계산한다. */
export function calculateDiaryStreak(entries: DiaryEntry[], todayKey: string): number {
  const recordedDates = new Set(entries.map((entry) => entry.diaryDate))
  let cursor = parseDateKey(todayKey)
  let streakDays = 0

  while (recordedDates.has(toDateKey(cursor)) && streakDays < 3650) {
    streakDays += 1
    cursor = addDays(cursor, -1)
  }

  return streakDays
}

/** 기준일을 포함한 최근 7일의 수치와 사람이 읽을 수 있는 요약 문장을 함께 계산한다. */
export function buildDiaryInsights(
  entries: DiaryEntry[],
  referenceDate = new Date(),
): DiaryInsights {
  const todayKey = toDateKey(referenceDate)
  const recentWeekStart = addDays(referenceDate, -6)
  const weekEntries = entries.filter(
    (entry) =>
      entry.diaryDate >= toDateKey(recentWeekStart) && entry.diaryDate <= todayKey,
  )
  const monthPrefix = todayKey.slice(0, 7)
  const moodDistribution = countValues(
    weekEntries.map((entry) => entry.mood).filter(isDefined),
  ).map((item) => ({
    mood: item.label as Mood,
    count: item.count,
    percentage: weekEntries.length
      ? Math.round((item.count / weekEntries.length) * 100)
      : 0,
  }))
  const energyValues = weekEntries
    .map((entry) => entry.energy)
    .filter((energy): energy is number => typeof energy === 'number')
  const weeklyPoints = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(recentWeekStart, index)
    const dateKey = toDateKey(date)
    const dateEntries = sortDiaryEntries(
      weekEntries.filter((entry) => entry.diaryDate === dateKey),
    )
    const representativeEntry = dateEntries[0]
    const dateEnergyValues = dateEntries
      .map((entry) => entry.energy)
      .filter((energy): energy is number => typeof energy === 'number')

    return {
      label: getWeekdayLabel(date),
      date: dateKey,
      mood: representativeEntry?.mood,
      energy: dateEnergyValues.length
        ? Math.round(
            dateEnergyValues.reduce((total, energy) => total + energy, 0) /
              dateEnergyValues.length,
          )
        : undefined,
      hasEntry: dateEntries.length > 0,
    }
  })
  const topActivities = countValues(weekEntries.flatMap((entry) => entry.activities))
    .slice(0, 6)
    .map((item) => ({ ...item, label: getActivityLabel(item.label) }))
  const topTags = countValues(weekEntries.flatMap((entry) => entry.tags)).slice(0, 8)
  const topTopics = countValues(weekEntries.flatMap((entry) => entry.aiTopics)).slice(0, 8)
  const topPeople = countValues(weekEntries.flatMap(extractPeopleLabels)).slice(0, 6)
  const topLocations = countValues(
    weekEntries
      .map((entry) => entry.location?.name?.trim())
      .filter((location): location is string => Boolean(location)),
  ).slice(0, 6)
  const recurringPatterns = countValues(
    weekEntries.flatMap((entry) => entry.aiInsight?.patterns ?? []),
  ).slice(0, 6)
  const weeklyTopMood = countValues(
    weekEntries.map((entry) => entry.mood).filter(isDefined),
  )[0]?.label as Mood | undefined
  const weeklyTopActivity = countValues(
    weekEntries.flatMap((entry) => entry.activities),
  )[0]
  const summary = createInsightsSummary(
    weekEntries,
    weeklyTopMood,
    weeklyTopActivity
      ? { ...weeklyTopActivity, label: getActivityLabel(weeklyTopActivity.label) }
      : undefined,
    energyValues,
  )

  return {
    totalEntries: entries.length,
    recordedDays: new Set(entries.map((entry) => entry.diaryDate)).size,
    currentMonthEntries: entries.filter((entry) => entry.diaryDate.startsWith(monthPrefix)).length,
    streakDays: calculateDiaryStreak(entries, todayKey),
    averageEnergy: energyValues.length
      ? Math.round(
          (energyValues.reduce((total, energy) => total + energy, 0) / energyValues.length) * 10,
        ) / 10
      : undefined,
    topMood: weeklyTopMood,
    moodDistribution,
    topActivities,
    topTags,
    topTopics,
    topPeople,
    topLocations,
    recurringPatterns,
    weeklyPoints,
    summary,
    hasEnoughData: weekEntries.length >= 3,
  }
}

/** 같은 월·일에 작성된 이전 연도의 기록을 찾는다. */
export function findOnThisDayEntries(
  entries: DiaryEntry[],
  referenceDate = new Date(),
): DiaryEntry[] {
  const monthDay = toDateKey(referenceDate).slice(5)
  const currentYear = referenceDate.getFullYear().toString()

  return sortDiaryEntries(
    entries.filter(
      (entry) => entry.diaryDate.slice(5) === monthDay && !entry.diaryDate.startsWith(currentYear),
    ),
  )
}

/** 회고 화면에 연결할 최근 7일 기록을 최대 개수만큼 반환한다. */
export function findWeeklyReflectionEntries(
  entries: DiaryEntry[],
  referenceDate: Date,
  limit = 2,
): DiaryEntry[] {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 0), 2)
  const sortedEntries = sortDiaryEntries(entries)
  const weeklyEntries = findEntriesInRecentWeek(sortedEntries, referenceDate)
  const weeklyEntryIds = new Set(weeklyEntries.map((entry) => entry.id))
  const fallbackEntries = sortedEntries.filter((entry) => !weeklyEntryIds.has(entry.id))

  return [...weeklyEntries, ...fallbackEntries].slice(0, boundedLimit)
}

/** 최근 7일 기록에서 자주 등장한 주제·사용자 태그·활동을 반환한다. */
export function findWeeklyReflectionThemes(
  entries: DiaryEntry[],
  referenceDate: Date,
  limit = 4,
): string[] {
  const weeklyEntries = findEntriesInRecentWeek(entries, referenceDate)

  return countValues([
    ...weeklyEntries.flatMap((entry) => entry.aiTopics),
    ...weeklyEntries.flatMap((entry) => entry.tags),
    ...weeklyEntries.flatMap((entry) => entry.activities).map(getActivityLabel),
  ])
    .filter((item) => item.count >= 2)
    .slice(0, limit)
    .map((item) => item.label)
}

/** 최근 7일 분석에서 가장 자주 반복된 생각 한 가지를 반환한다. */
export function findWeeklyReflectionThought(
  entries: DiaryEntry[],
  referenceDate: Date,
): string {
  const weeklyEntries = findEntriesInRecentWeek(entries, referenceDate)
  const recurringPattern = countValues(
    weeklyEntries.flatMap((entry) => entry.aiInsight?.patterns ?? []),
  ).find((item) => item.count >= 2)?.label

  if (recurringPattern) return recurringPattern

  const recurringTheme = countValues([
    ...weeklyEntries.flatMap((entry) => entry.aiTopics),
    ...weeklyEntries.flatMap((entry) => entry.tags),
    ...weeklyEntries.flatMap((entry) => entry.activities).map(getActivityLabel),
  ]).find((item) => item.count >= 2)?.label

  if (recurringTheme) {
    return `최근 일주일에는 ${recurringTheme}이 두 개 이상의 기록에 반복해서 표시됐어요.`
  }

  const recurringMood = countValues(
    weeklyEntries.map((entry) => entry.mood).filter(isDefined),
  ).find((item) => item.count >= 2)?.label as Mood | undefined

  if (recurringMood) {
    return `최근 일주일에는 ${getMoodLabel(recurringMood)}을 두 번 이상 기록했어요.`
  }

  if (weeklyEntries.length > 0) {
    return `최근 일주일 동안 ${weeklyEntries.length}개의 기록을 남겼어요. 짧은 문장도 한 주의 흐름을 이어 줍니다.`
  }

  return '최근 일주일의 기록이 아직 없어요. 오늘의 마음 한 줄부터 천천히 이어가 봐요.'
}

/** 서로 다른 소유권의 태그와 주제를 category별 index로 만든다. */
export function buildTagIndex(entries: DiaryEntry[]): TagIndexGroup[] {
  return [
    {
      category: 'user',
      label: '사용자 태그',
      items: countValues(entries.flatMap((entry) => entry.tags)).map((item) => ({
        value: item.label,
        label: `#${item.label}`,
        count: item.count,
      })),
    },
    {
      category: 'activity',
      label: '활동',
      items: countValues(entries.flatMap((entry) => entry.activities)).map((item) => ({
        value: item.label,
        label: getActivityLabel(item.label),
        count: item.count,
      })),
    },
    {
      category: 'mood',
      label: '감정',
      items: countValues(entries.map((entry) => entry.mood).filter(isDefined)).map((item) => ({
        value: item.label,
        label: getMoodLabel(item.label as Mood),
        count: item.count,
      })),
    },
    {
      category: 'aiTopic',
      label: 'Moodi 주제',
      items: countValues(entries.flatMap((entry) => entry.aiTopics)).map((item) => ({
        value: item.label,
        label: item.label,
        count: item.count,
      })),
    },
  ]
}

/** 태그 index에서 선택한 단서에 해당하는 기록만 반환한다. */
export function findEntriesForTagIndex(
  entries: DiaryEntry[],
  category: TagIndexCategory,
  value: string,
): DiaryEntry[] {
  return sortDiaryEntries(
    entries.filter((entry) => {
      if (category === 'user') return entry.tags.includes(value)
      if (category === 'activity') return entry.activities.includes(value as DiaryEntry['activities'][number])
      if (category === 'mood') return entry.mood === value

      return entry.aiTopics.includes(value)
    }),
  )
}

/** 날짜 key를 로컬 기준 YYYY-MM-DD로 만든다. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`)
}

function findEntriesInRecentWeek(
  entries: DiaryEntry[],
  referenceDate: Date,
): DiaryEntry[] {
  const rangeStart = toDateKey(addDays(referenceDate, -6))
  const rangeEnd = toDateKey(referenceDate)

  return entries.filter(
    (entry) => entry.diaryDate >= rangeStart && entry.diaryDate <= rangeEnd,
  )
}

function createInsightsSummary(
  weekEntries: DiaryEntry[],
  topMood: Mood | undefined,
  topActivity: CountedLabel | undefined,
  energyValues: number[],
): string {
  if (weekEntries.length === 0) {
    return '이번 주 기록이 아직 없어요. 감정 하나만 남겨도 다음 회고가 시작됩니다.'
  }

  const tiredCount = weekEntries.filter((entry) => entry.mood === 'tired').length
  const topTiredActivity = countValues(
    weekEntries
      .filter((entry) => entry.mood === 'tired')
      .flatMap((entry) => entry.activities),
  )[0]

  if (tiredCount >= 2 && topTiredActivity && topTiredActivity.count >= 2) {
    return `이번 주에는 피곤함을 ${tiredCount}번 기록했고, 그중 ${topTiredActivity.count}번 ${getActivityLabel(topTiredActivity.label)} 활동도 함께 남겼어요.`
  }

  if (topMood && topActivity) {
    return `이번 주에는 ${getMoodLabel(topMood)}이 가장 자주 보였고, ${topActivity.label} 활동을 ${topActivity.count}번 남겼어요.`
  }

  if (energyValues.length > 0) {
    const average = energyValues.reduce((total, energy) => total + energy, 0) / energyValues.length

    return `이번 주 ${weekEntries.length}개의 기록에서 평균 에너지는 ${average.toFixed(1)}단계였어요.`
  }

  return `이번 주 ${weekEntries.length}개의 기록이 쌓였어요. 조금 더 기록하면 반복되는 흐름을 발견할 수 있어요.`
}

function countValues(values: string[]): CountedLabel[] {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1

    return result
  }, {})

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function getMoodLabel(mood: Mood): string {
  const labels: Record<Mood, string> = {
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

  return labels[mood]
}

function getActivityLabel(activity: string): string {
  const labels: Record<string, string> = {
    work: '일·프로젝트',
    people: '사람들과 함께',
    exercise: '운동',
    study: '공부·독서',
    walk: '산책·이동',
    rest: '휴식',
    music: '음악',
    meal: '식사',
    'self-care': '나를 돌봄',
  }

  return labels[activity] ?? activity
}

const RELATION_TAGS = new Set([
  '가족',
  '친구',
  '동료',
  '팀',
  '사람',
  '사람들',
  '관계',
  '연인',
  '엄마',
  '아빠',
  '어머니',
  '아버지',
  '언니',
  '오빠',
  '누나',
  '형',
  '동생',
  '선생님',
  '상사',
])

/** 명시적인 사람 태그와 관계 활동만 사용해 사람 단서를 보수적으로 집계한다. */
function extractPeopleLabels(entry: DiaryEntry): string[] {
  const taggedPeople = entry.tags.flatMap((tag) => {
    const normalizedTag = tag.trim()
    const explicitPerson = /^(?:사람|person|with)\s*[:：]\s*(.+)$/i.exec(normalizedTag)?.[1]

    if (explicitPerson?.trim()) return [explicitPerson.trim()]
    if (RELATION_TAGS.has(normalizedTag.toLowerCase())) return [normalizedTag]

    return []
  })

  if (taggedPeople.length > 0) return taggedPeople

  return entry.activities.includes('people') ? ['사람들과 함께'] : []
}

function getWeekdayLabel(date: Date): string {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function isDefined<Value>(value: Value | undefined): value is Value {
  return value !== undefined
}
