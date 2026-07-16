import { describe, expect, it } from 'vitest'
import type { DiaryEntry } from '../types/diaryDomain'
import { LocalRuleBasedDiaryAnalysisService } from './diaryAnalysisService'

describe('LocalRuleBasedDiaryAnalysisService', () => {
  it('관련 기록 후보에서 잠긴 기록과 seed 예시 기록을 제외한다', async () => {
    const service = new LocalRuleBasedDiaryAnalysisService()
    const insight = await service.analyze(
      {
        entryId: 'current-entry',
        type: 'journal',
        diaryDate: '2026-07-14',
        title: '프로젝트 회고',
        content: '프로젝트를 차분하게 마무리했다.',
        mood: 'calm',
        activities: ['work'],
        tags: ['프로젝트'],
      },
      [
        createEntry('user-related'),
        createEntry('locked-related', { isLocked: true }),
        createEntry('seed-related'),
      ],
    )

    expect(insight.relatedEntryIds).toEqual(['user-related'])
  })

  it('단일 기록만으로 감정과 주제의 반복 상관을 단정하지 않는다', async () => {
    const service = new LocalRuleBasedDiaryAnalysisService()
    const insight = await service.analyze(
      {
        entryId: 'current-entry',
        type: 'journal',
        diaryDate: '2026-07-14',
        title: '프로젝트 마감',
        content: '프로젝트를 마치느라 피곤했다.',
        mood: 'tired',
        activities: ['work'],
        tags: ['프로젝트'],
      },
      [],
    )

    expect(insight.patterns).not.toContain('프로젝트를 기록한 날에는 피곤함이 함께 나타나는 흐름이 있어요.')
  })

  it('같은 감정과 주제가 확인된 실제 과거 기록이 있을 때만 반복 흐름을 표시한다', async () => {
    const service = new LocalRuleBasedDiaryAnalysisService()
    const insight = await service.analyze(
      {
        entryId: 'current-entry',
        type: 'journal',
        diaryDate: '2026-07-14',
        title: '프로젝트 마감',
        content: '프로젝트를 마치느라 피곤했다.',
        mood: 'tired',
        activities: ['work'],
        tags: ['프로젝트'],
      },
      [createEntry('supporting-entry', { mood: 'tired' })],
    )

    expect(insight.patterns).toContain('프로젝트를 기록한 날에는 피곤함이 함께 나타나는 흐름이 있어요.')
  })

  it('움직임 패턴은 실제로 선택된 행복과 편안함 감정명을 보존한다', async () => {
    const service = new LocalRuleBasedDiaryAnalysisService()
    const insight = await service.analyze(
      {
        entryId: 'current-happy-walk',
        type: 'journal',
        diaryDate: '2026-07-14',
        content: '산책을 하고 즐거웠다.',
        mood: 'happy',
        activities: ['walk'],
        tags: [],
      },
      [createEntry('supporting-happy-walk', { mood: 'happy', activities: ['walk'] })],
    )

    expect(insight.patterns).toContain('몸을 움직인 날에는 행복 감정이 함께 기록됐어요.')
    expect(insight.patterns.join(' ')).not.toContain('편안한 감정')
  })
})

function createEntry(id: string, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id,
    type: 'journal',
    title: '프로젝트 기록',
    content: '프로젝트를 진행한 날이다.',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    diaryDate: '2026-07-10',
    mood: 'calm',
    activities: ['work'],
    tags: ['프로젝트'],
    aiTopics: ['프로젝트'],
    images: [],
    isFavorite: false,
    isLocked: false,
    ...overrides,
  }
}
