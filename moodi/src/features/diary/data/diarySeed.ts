import afternoonTableImageUrl from '../../../assets/diary-afternoon-table.webp'
import eveningWalkImageUrl from '../../../assets/diary-evening-walk.webp'
import type { AIInsight, DiaryEntry } from '../types/diaryDomain'

/**
 * 저장 key가 한 번도 생성되지 않은 브라우저에만 제공하는 초기 예시 기록을 만든다.
 * 사용자가 전체 삭제한 뒤에는 Repository가 이 seed를 다시 적용하지 않는다.
 */
export function createDiarySeedEntries(referenceDate = new Date()): DiaryEntry[] {
  const today = toDateKey(referenceDate)
  const yesterday = toDateKey(addDays(referenceDate, -1))
  const threeDaysAgo = toDateKey(addDays(referenceDate, -3))
  const fiveDaysAgo = toDateKey(addDays(referenceDate, -5))
  const oneYearAgo = toDateKey(addYears(referenceDate, -1))
  const generatedAt = toTimestamp(referenceDate, 22, 10)

  const projectEntryId = 'seed-project-night'
  const workshopEntryId = 'seed-workshop-day'
  const quickEntryId = 'seed-quiet-check-in'
  const walkEntryId = 'seed-evening-walk'
  const memoryEntryId = 'seed-on-this-day'

  return [
    {
      id: projectEntryId,
      type: 'journal',
      title: '미뤄 두었던 일을 끝낸 오후',
      content:
        '오늘 드디어 미뤄 두었던 작업을 정리했다.\n\n처음에는 어디서부터 손대야 할지 몰라 화면만 오래 바라봤는데, 하나씩 목록을 줄여가다 보니 생각했던 것만큼 복잡하지는 않았다.\n\n잠깐 창가에 앉아 따뜻한 차를 마셨다. 일을 끝낸 것보다 마음이 조금 가벼워졌다는 게 더 좋았다.',
      createdAt: toTimestamp(referenceDate, 21, 25),
      updatedAt: toTimestamp(referenceDate, 21, 25),
      diaryDate: today,
      mood: 'excited',
      energy: 3,
      activities: ['work'],
      tags: ['만들기', '오늘의생각'],
      aiTopics: ['프로젝트', '창작 에너지', '피로'],
      images: [
        {
          id: 'seed-afternoon-table-image',
          url: afternoonTableImageUrl,
          alt: '늦은 오후 창가의 나무 테이블 위에 펼쳐진 노트와 차 한 잔',
        },
      ],
      isFavorite: true,
      isLocked: false,
      aiInsight: createSeedInsight({
        summary: '미뤄 둔 일을 하나씩 끝내며 마음까지 조금 가벼워진 오후였어요.',
        emotions: ['설렘', '안도감'],
        topics: ['프로젝트', '마음의 여유'],
        patterns: ['복잡한 일을 작은 단위로 나눌 때 마음의 긴장도 함께 풀리는 흐름이 보여요.'],
        followUpQuestions: ['오늘 가장 마음을 가볍게 한 작은 완료는 무엇이었나요?'],
        relatedEntryIds: [walkEntryId],
        generatedAt,
      }),
    },
    {
      id: workshopEntryId,
      type: 'journal',
      title: '어색함과 안도감이 함께 있던 하루',
      content:
        '연구실 워크숍에 다녀왔다. 처음에는 괜히 눈치가 보였지만 익숙한 사람들과 식사를 하면서 긴장이 조금 풀렸다. 불편했던 순간만큼 안도한 순간도 기억해 두고 싶다.',
      createdAt: toTimestamp(addDays(referenceDate, -1), 20, 15),
      updatedAt: toTimestamp(addDays(referenceDate, -1), 20, 15),
      diaryDate: yesterday,
      mood: 'anxious',
      energy: 2,
      activities: ['people', 'meal'],
      tags: ['연구실', '사람들'],
      aiTopics: ['사회적 긴장', '안도감'],
      images: [],
      isFavorite: false,
      isLocked: false,
      aiInsight: createSeedInsight({
        summary: '낯선 분위기에서 긴장했지만 익숙한 관계가 마음을 안정시켜 준 하루예요.',
        emotions: ['불안함', '안도감'],
        topics: ['연구실', '관계'],
        patterns: ['모임 전에는 긴장이 커지지만 대화를 시작하면 빠르게 편안해지는 편이에요.'],
        followUpQuestions: ['오늘 편안함을 느끼게 한 사람이나 말은 무엇이었나요?'],
        relatedEntryIds: [memoryEntryId],
        generatedAt,
      }),
    },
    {
      id: quickEntryId,
      type: 'quick',
      shortNote: '오후에는 집중이 잘 안 됐지만 따뜻한 차를 마시며 잠깐 쉬었다.',
      createdAt: toTimestamp(addDays(referenceDate, -3), 16, 40),
      updatedAt: toTimestamp(addDays(referenceDate, -3), 16, 40),
      diaryDate: threeDaysAgo,
      mood: 'tired',
      energy: 2,
      activities: ['rest', 'meal'],
      tags: [],
      aiTopics: ['휴식', '에너지 저하'],
      images: [],
      isFavorite: false,
      isLocked: false,
      aiInsight: createSeedInsight({
        summary: '에너지가 낮아진 순간에 짧게 멈추는 선택을 한 기록이에요.',
        emotions: ['피곤함'],
        topics: ['휴식'],
        patterns: [],
        followUpQuestions: ['내일의 에너지를 위해 오늘 줄일 수 있는 일은 무엇인가요?'],
        relatedEntryIds: [projectEntryId],
        generatedAt,
      }),
    },
    {
      id: walkEntryId,
      type: 'journal',
      title: '저녁 산책에서 찾은 작은 여유',
      content:
        '일을 마치고 동네를 천천히 걸었다. 서늘한 공기와 밝은 창문을 보고 있으니 복잡했던 생각이 조금씩 정리됐다. 해결하지 않아도 잠시 내려놓을 수 있다는 걸 기억하고 싶다.',
      createdAt: toTimestamp(addDays(referenceDate, -5), 19, 5),
      updatedAt: toTimestamp(addDays(referenceDate, -5), 19, 5),
      diaryDate: fiveDaysAgo,
      mood: 'calm',
      energy: 3,
      activities: ['walk'],
      tags: ['저녁', '동네'],
      aiTopics: ['회복', '산책'],
      images: [
        {
          id: 'seed-evening-walk-image',
          url: eveningWalkImageUrl,
          alt: '비가 그친 저녁, 꽃다발을 들고 걷는 조용한 동네 산책길',
        },
      ],
      weather: { condition: '맑음', temperature: 18 },
      location: { name: '동네 산책길' },
      isFavorite: false,
      isLocked: false,
      aiInsight: createSeedInsight({
        summary: '산책이 복잡한 생각을 느슨하게 풀어 준 저녁이에요.',
        emotions: ['편안함'],
        topics: ['산책', '회복'],
        patterns: ['몸을 움직인 날에는 복잡한 생각을 더 쉽게 내려놓는 흐름이 보여요.'],
        followUpQuestions: ['다시 걷고 싶은 장면은 어디였나요?'],
        relatedEntryIds: [projectEntryId],
        generatedAt,
      }),
    },
    {
      id: memoryEntryId,
      type: 'journal',
      title: '작년 오늘, 처음 인사를 건넨 날',
      content:
        '먼저 말을 걸기까지 오래 망설였지만 막상 인사를 나누고 나니 생각보다 자연스러웠다. 작은 용기가 하루의 분위기를 바꿀 수 있다는 걸 배웠다.',
      createdAt: toTimestamp(addYears(referenceDate, -1), 22, 0),
      updatedAt: toTimestamp(addYears(referenceDate, -1), 22, 0),
      diaryDate: oneYearAgo,
      mood: 'happy',
      energy: 4,
      activities: ['people'],
      tags: ['용기', '관계'],
      aiTopics: ['새로운 관계', '용기'],
      images: [],
      isFavorite: true,
      isLocked: false,
      aiInsight: createSeedInsight({
        summary: '망설임을 넘어 건넨 인사가 하루의 분위기를 바꾼 기억이에요.',
        emotions: ['행복', '긴장'],
        topics: ['관계', '용기'],
        patterns: ['먼저 작은 행동을 시작했을 때 불안이 빠르게 줄어드는 편이에요.'],
        followUpQuestions: ['지금의 내가 그날의 나에게 해 주고 싶은 말은 무엇인가요?'],
        relatedEntryIds: [workshopEntryId],
        generatedAt,
      }),
    },
  ]
}

function createSeedInsight(input: Omit<AIInsight, 'source'>): AIInsight {
  return {
    ...input,
    source: 'local-rule-mock',
  }
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function addYears(date: Date, years: number): Date {
  const nextDate = new Date(date)
  nextDate.setFullYear(nextDate.getFullYear() + years)

  return nextDate
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toTimestamp(date: Date, hours: number, minutes: number): string {
  const timestamp = new Date(date)
  timestamp.setHours(hours, minutes, 0, 0)

  return timestamp.toISOString()
}
