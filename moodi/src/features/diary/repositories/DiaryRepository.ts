import type { DiaryEntry } from '../types/diaryDomain'
import type {
  CreateDiaryEntryInput,
  DiaryDraft,
  SaveDiaryDraftInput,
  UpdateDiaryEntryInput,
} from '../types/diaryInputs'

/** Repository 실패를 UI-safe 상태로 매핑할 때 사용하는 오류 분류다. */
export type DiaryRepositoryErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'CORRUPT_DATA'
  | 'INVALID_DATA'
  | 'NOT_FOUND'
  | 'WRITE_FAILED'

/** localStorage와 향후 API adapter가 공통으로 반환하는 저장 오류다. */
export class DiaryRepositoryError extends Error {
  public readonly code: DiaryRepositoryErrorCode

  constructor(
    code: DiaryRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DiaryRepositoryError'
    this.code = code
  }
}

/**
 * Diary application 계층이 의존하는 비동기 저장 계약이다.
 * 실제 API 전환 TODO: endpoint, auth, pagination, timeout, retry, optimistic conflict,
 * HTTP/error mapping 계약이 확정되면 이 인터페이스의 API adapter를 추가한다.
 */
export interface DiaryRepository {
  /** 저장된 전체 기록을 반환한다. */
  getEntries(): Promise<DiaryEntry[]>
  /** id에 해당하는 기록 또는 null을 반환한다. */
  getEntry(entryId: string): Promise<DiaryEntry | null>
  /** 새 기록을 생성하고 저장된 domain model을 반환한다. */
  createEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry>
  /** 기존 기록을 부분 수정한다. */
  updateEntry(entryId: string, input: UpdateDiaryEntryInput): Promise<DiaryEntry>
  /** id에 해당하는 기록을 삭제한다. */
  deleteEntry(entryId: string): Promise<void>
  /** 가져오기 등에서 전체 기록을 검증한 목록으로 교체한다. */
  replaceEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]>
  /** 자동 저장된 활성 초안을 반환한다. */
  getDraft(): Promise<DiaryDraft | null>
  /** 활성 초안을 생성하거나 갱신한다. */
  saveDraft(input: SaveDiaryDraftInput): Promise<DiaryDraft>
  /** 활성 초안을 제거한다. */
  clearDraft(): Promise<void>
  /** 기록은 빈 배열로 저장하고 초안은 제거한다. */
  deleteAllData(): Promise<void>
}
