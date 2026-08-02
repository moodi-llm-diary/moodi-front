export type ApiProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  requestId?: string
}

/** RFC 9457 problem response를 feature에서 처리할 typed error로 정규화한다. */
export class ApiRequestError extends Error {
  public readonly status: number
  public readonly code: string | null
  public readonly requestId: string | null

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

/** API 오류를 사용자에게 안전하게 보여 줄 한글 메시지로 변환한다. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error && error.message ? error.message : fallback
  }

  if (error.code === 'AUTH_REQUIRED' || error.code === 'SESSION_EXPIRED') {
    return '로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.'
  }
  if (error.code === 'CSRF_INVALID') {
    return '보안 확인이 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
  }
  if (error.code === 'VERSION_CONFLICT') {
    return '다른 곳에서 변경된 기록입니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.'
  }
  if (error.code === 'AI_SERVICE_UNAVAILABLE') {
    return 'AI 서비스를 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  }

  return error.message || fallback
}
