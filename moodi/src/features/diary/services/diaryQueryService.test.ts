import { describe, expect, it } from 'vitest'
import type { Activity, DiaryEntry, Mood } from '../types/diaryDomain'
import {
  buildDiaryInsights,
  filterDiaryEntries,
  findWeeklyReflectionEntries,
  findWeeklyReflectionThemes,
  findWeeklyReflectionThought,
} from './diaryQueryService'

describe('findWeeklyReflectionEntries', () => {
  it('최근 7일 기록이 부족하면 그 이전의 최신 기록으로 채우되 최대 2개만 반환한다', () => {
    const referenceDate = new Date(2026, 6, 13, 12)
    const weeklyEntry = createEntry({
      id: 'entry-weekly',
      diaryDate: '2026-07-12',
    })
    const latestFallbackEntry = createEntry({
      id: 'entry-fallback-latest',
      diaryDate: '2026-07-06',
    })
    const oldestEntry = createEntry({
      id: 'entry-fallback-oldest',
      diaryDate: '2026-07-01',
    })

    const result = findWeeklyReflectionEntries(
      [oldestEntry, latestFallbackEntry, weeklyEntry],
      referenceDate,
      99,
    )

    expect(result.map((entry) => entry.id)).toEqual([
      'entry-weekly',
      'entry-fallback-latest',
    ])
    expect(result).toHaveLength(2)
  })
})

describe('buildDiaryInsights', () => {
  it('피곤함과 활동이 실제로 같은 기록에 반복될 때만 함께 나타났다고 설명한다', () => {
    const referenceDate = new Date(2026, 6, 14, 12)
    const unrelated = buildDiaryInsights(
      [
        createEntry({ id: 'tired-1', diaryDate: '2026-07-13', mood: 'tired' }),
        createEntry({ id: 'tired-2', diaryDate: '2026-07-14', mood: 'tired' }),
        createEntry({ id: 'walk-1', diaryDate: '2026-07-12', activities: ['walk'] }),
        createEntry({ id: 'walk-2', diaryDate: '2026-07-11', activities: ['walk'] }),
      ],
      referenceDate,
    )
    const cooccurring = buildDiaryInsights(
      [
        createEntry({ id: 'tired-walk-1', diaryDate: '2026-07-13', mood: 'tired', activities: ['walk'] }),
        createEntry({ id: 'tired-walk-2', diaryDate: '2026-07-14', mood: 'tired', activities: ['walk'] }),
      ],
      referenceDate,
    )

    expect(unrelated.summary).not.toContain('함께 나타났어요')
    expect(cooccurring.summary).toContain('그중 2번 산책·이동 활동도 함께 남겼어요')
  })
})

describe('weekly reflection evidence wording', () => {
  it('한 번 등장한 값은 반복 주제나 반복 생각으로 표시하지 않는다', () => {
    const referenceDate = new Date(2026, 6, 14, 12)
    const entry = {
      ...createEntry({ id: 'single-theme', diaryDate: '2026-07-14' }),
      tags: ['프로젝트'],
    }

    expect(findWeeklyReflectionThemes([entry], referenceDate)).toEqual([])
    expect(findWeeklyReflectionThought([entry], referenceDate)).toContain('1개의 기록')
    expect(findWeeklyReflectionThought([entry], referenceDate)).not.toContain('오래 머물렀어요')
  })

  it('두 기록에서 확인된 값만 반복 주제와 생각으로 표시한다', () => {
    const referenceDate = new Date(2026, 6, 14, 12)
    const entries = [
      { ...createEntry({ id: 'theme-1', diaryDate: '2026-07-13' }), tags: ['프로젝트'] },
      { ...createEntry({ id: 'theme-2', diaryDate: '2026-07-14' }), tags: ['프로젝트'] },
    ]

    expect(findWeeklyReflectionThemes(entries, referenceDate)).toEqual(['프로젝트'])
    expect(findWeeklyReflectionThought(entries, referenceDate)).toContain('두 개 이상의 기록에 반복')
  })
})

describe('filterDiaryEntries', () => {
  it('감정과 활동의 한국어 표시명으로 기록을 검색한다', () => {
    const tiredWalkEntry = createEntry({
      id: 'entry-tired-walk',
      diaryDate: '2026-07-13',
      mood: 'tired',
      activities: ['walk'],
    })
    const happyRestEntry = createEntry({
      id: 'entry-happy-rest',
      diaryDate: '2026-07-12',
      mood: 'happy',
      activities: ['rest'],
    })
    const entries = [happyRestEntry, tiredWalkEntry]

    expect(
      filterDiaryEntries(entries, { query: '피곤함' }).map((entry) => entry.id),
    ).toEqual(['entry-tired-walk'])
    expect(
      filterDiaryEntries(entries, { query: '산책' }).map((entry) => entry.id),
    ).toEqual(['entry-tired-walk'])
  })
})

function createEntry({
  id,
  diaryDate,
  mood,
  activities = [],
}: {
  id: string
  diaryDate: string
  mood?: Mood
  activities?: Activity[]
}): DiaryEntry {
  return {
    id,
    type: 'journal',
    title: `${id} 제목`,
    content: `${id} 본문`,
    createdAt: `${diaryDate}T09:00:00.000Z`,
    updatedAt: `${diaryDate}T09:00:00.000Z`,
    diaryDate,
    mood,
    activities,
    tags: [],
    aiTopics: [],
    images: [],
    isFavorite: false,
    isLocked: false,
  }
}
