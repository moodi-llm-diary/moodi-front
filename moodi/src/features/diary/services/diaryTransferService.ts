import { isEntryType, isMood, type DiaryEntry } from '../types/diary'

const EXPORT_FORMAT = 'moodi-diary-export'
const EXPORT_VERSION = 1

type DiaryExportEnvelope = {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  exportedAt: string
  entries: DiaryEntry[]
}

/** 현재 브라우저의 기록을 Moodi JSON 파일로 내려받는다. */
export function downloadDiaryExport(entries: DiaryEntry[]): void {
  const envelope: DiaryExportEnvelope = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  }
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `moodi-diary-${toDateKey(new Date())}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Moodi export 파일을 읽고 저장 전에 최소 계약을 검증한다. */
export async function readDiaryImportFile(file: File): Promise<DiaryEntry[]> {
  if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
    throw new Error('Moodi JSON 파일을 선택해 주세요.')
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error('가져오기 파일은 12MB 이하여야 합니다.')
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('JSON 파일을 읽을 수 없습니다.')
  }

  if (!isRecord(parsedValue)) {
    throw new Error('Moodi 내보내기 파일 형식이 아닙니다.')
  }

  if (
    parsedValue.format !== EXPORT_FORMAT ||
    parsedValue.version !== EXPORT_VERSION ||
    !Array.isArray(parsedValue.entries)
  ) {
    throw new Error('지원하지 않는 Moodi 내보내기 파일입니다.')
  }

  if (!parsedValue.entries.every(isDiaryEntry)) {
    throw new Error('일부 기록의 데이터 형식이 올바르지 않습니다.')
  }

  return parsedValue.entries
}

function isDiaryEntry(value: unknown): value is DiaryEntry {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || !isEntryType(value.type)) return false
  if (typeof value.diaryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.diaryDate)) {
    return false
  }
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  if (value.mood !== undefined && !isMood(value.mood)) return false
  if (value.energy !== undefined && (!Number.isInteger(value.energy) || Number(value.energy) < 1 || Number(value.energy) > 5)) {
    return false
  }
  if (!isStringArray(value.activities) || !isStringArray(value.tags) || !isStringArray(value.aiTopics)) {
    return false
  }
  if (!Array.isArray(value.images)) return false
  if (typeof value.isFavorite !== 'boolean' || typeof value.isLocked !== 'boolean') return false

  return true
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
