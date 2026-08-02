# 엔드포인트 목록 - moodi

이 문서는 구현된 backend API의 목록 전용 index다. 세부 wire 계약은 `specification.md`에 둔다.

| Method | URL | Auth | 설명 |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login-attempts` | Public | Google 로그인 시도 생성 |
| POST | `/api/v1/auth/google-credentials` | Public/GIS | Google credential 교환과 session 생성 |
| GET | `/api/v1/auth/session` | Optional session | 현재 session 조회 |
| DELETE | `/api/v1/auth/session` | Session + CSRF | 현재 session 로그아웃 |
| DELETE | `/api/v1/users/me` | Session + CSRF + recent auth | 계정 삭제 |
| GET | `/api/v1/users/me/settings` | Session | 서버 설정 조회 |
| PATCH | `/api/v1/users/me/settings` | Session + CSRF | 서버 설정 변경 |
| DELETE | `/api/v1/users/me/settings` | Session + CSRF | 서버 설정 초기화 |
| GET | `/api/v1/diary-entries` | Session | 기록 목록 조회 |
| POST | `/api/v1/diary-entries` | Session + CSRF + idempotency | 기록 생성 |
| GET | `/api/v1/diary-entries/{entryId}` | Session | 기록 상세 조회 |
| PATCH | `/api/v1/diary-entries/{entryId}` | Session + CSRF + If-Match | 기록 수정 |
| DELETE | `/api/v1/diary-entries/{entryId}` | Session + CSRF + If-Match | 기록 삭제 |
| GET | `/api/v1/diary-draft` | Session | 단일 draft 조회 |
| PUT | `/api/v1/diary-draft` | Session + CSRF + If-Match(기존) | 단일 draft 저장 |
| DELETE | `/api/v1/diary-draft` | Session + CSRF + If-Match(기존) | draft 삭제 |
| POST | `/api/v1/diary-images` | Session + CSRF + idempotency | pending 이미지 업로드 |
| GET | `/api/v1/diary-images/{imageId}/content` | Session | 인증 이미지 content 조회 |
| DELETE | `/api/v1/diary-images/{imageId}` | Session + CSRF | pending/unlinked 이미지 삭제 |
| GET | `/api/v1/ai-conversations` | Session | 대화 목록 조회 |
| POST | `/api/v1/ai-conversations` | Session + CSRF + idempotency | 대화 생성 |
| GET | `/api/v1/ai-conversations/{conversationId}` | Session | 대화 metadata 조회 |
| PATCH | `/api/v1/ai-conversations/{conversationId}` | Session + CSRF | 대화 제목 변경 |
| DELETE | `/api/v1/ai-conversations/{conversationId}` | Session + CSRF | 대화와 run 삭제 |
| GET | `/api/v1/ai-conversations/{conversationId}/messages` | Session | 대화 메시지 조회 |
| POST | `/api/v1/ai-conversations/{conversationId}/messages` | Session + CSRF + idempotency | AI run 생성 |
| GET | `/api/v1/ai-runs/{runId}` | Session | AI run 상태 조회 |
| GET | `/api/v1/ai-runs/{runId}/events` | Session | AI run SSE 수신 |
| PUT | `/api/v1/ai-runs/{runId}/cancellation` | Session + CSRF | AI run 취소 |
| HEAD | `/api/v1/diary-data` | Session | destructive data mutation 확인 token 획득 |
| GET | `/api/v1/diary-data` | Session | canonical JSON export 다운로드 |
| PUT | `/api/v1/diary-data` | Session + CSRF + confirmation | import로 Diary data 교체 |
| DELETE | `/api/v1/diary-data` | Session + CSRF + confirmation | Diary data 전체 삭제 |
| GET | `/health/live` | Internal/public | process liveness |
| GET | `/health/ready` | Internal/public | dependency readiness |
