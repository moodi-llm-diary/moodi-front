# Moodi 백엔드 기능 및 API 요구사항

> 문서 상태: 구현 전 참고 명세(Proposal)  
> 작성일: 2026-07-16  
> 대상: Moodi React 프런트엔드를 서버 기반 제품으로 전환하기 위한 백엔드  
> 위치 예외: 프로젝트 명세는 원칙적으로 `docs/`에 두지만, 이번 문서는 사용자의 명시적 요청에 따라 `.codex/ref_docs`에 작성한다. 실제 구현이 시작되면 확정된 계약만 `docs/api`, `docs/database`, `docs/architecture`로 옮겨 현재 구현과 동기화해야 한다.

## 1. 문서의 목적과 상태 표기

현재 Moodi에는 실제 HTTP API나 DB가 없다. Diary, draft, 설정, mock 사용자와 AI 대화는 브라우저 localStorage에 저장되고, AI 채팅은 브라우저 안의 `local-search` 구현이다. 따라서 이 문서의 endpoint와 table은 **현재 존재하는 계약이 아니라 백엔드 구현을 위한 제안 계약**이다.

이 문서에서는 다음 표기를 사용한다.

- **확정 요구사항**: 사용자 요청이나 현재 제품 기능에서 직접 도출된 동작이다.
- **권장 계약**: 구현을 시작할 수 있도록 제안한 API·상태·보안 계약이다. 백엔드 구현 전 최종 승인한다.
- **TODO(외부 계약 대기)**: 이미 구축된 로컬 LLM의 실제 upstream 계약이 제공되어야 확정할 수 있다. 값을 추정하거나 fake 구현으로 채우지 않는다.

## 2. 확정 요구사항

1. 로그인은 Google 로그인을 사용한다.
2. 브라우저에는 Google access token, Google refresh token, Moodi 세션 원문을 localStorage에 저장하지 않는다.
3. Google API 권한은 현재 필요하지 않으므로 Sign in with Google의 ID token을 백엔드에서 검증한 뒤 Moodi 자체 서버 세션을 발급한다.
4. 모든 Diary, draft, settings, image, AI 대화와 source는 인증된 내부 사용자에게 귀속한다.
5. 로컬 LLM은 이미 별도 시스템으로 구축되어 있으며 **Moodi 백엔드만** 접근한다.
6. React 브라우저는 로컬 LLM 주소, 인증 정보, 모델 내부 오류 또는 upstream DTO를 알 수 없다.
7. AI 채팅 응답 전송의 기본은 SSE다.
8. AI 답변은 현재 사용자의 실제 기록만 근거로 삼고, 사용한 기록 source를 반환한다.
9. 잠긴 기록과 삭제된 기록은 LLM context와 source에서 제외한다.
10. 현재 프런트 기능인 Diary CRUD, 검색·필터, 단일 draft, 이미지, 설정, 캘린더, 회고, 태그 집계, AI 대화, import/export, 전체 삭제를 서버 전환 뒤에도 유지한다.
11. 확인되지 않은 사진·캘린더·음악·날씨·프로젝트·GitHub provider 연동은 이번 범위에서 API로 확정하지 않는다.

## 3. 범위

### 3.1 P0 — 서버 전환 필수 범위

- Google Identity Services 기반 로그인과 서버 세션
- 사용자와 Google `sub` 연결
- CSRF 방어, 세션 만료·폐기, 로그아웃
- 사용자별 Diary CRUD, 검색, 필터, cursor pagination
- 사용자당 하나의 활성 draft와 optimistic concurrency
- Diary 이미지 업로드·조회·삭제
- 사용자 설정 조회·수정·초기화
- AI conversation/message/source 저장
- SSE 기반 local LLM 채팅, 취소, 재연결, idempotency
- 잠금·수정·삭제된 source의 재검증과 답변 redaction
- 기존 localStorage 데이터의 명시적 1회 이전
- Diary JSON export/import와 전체 데이터 삭제
- 공통 오류 모델, 관측성, 보안 이벤트

### 3.2 P1 — pagination 전환과 운영 완성에 필요한 범위

- 캘린더 월 집계 API
- 회고 집계 API
- 태그·활동·감정·AI topic facet API
- entry 저장 후 개별 AI insight 생성·재시도
- import/export 비동기 job화가 필요한 규모인지 검증
- local LLM capacity에 맞춘 rate limit과 backpressure

### 3.3 이번 범위에서 제외

- email/password 로그인
- Google Calendar, Photos 등 Google API 권한 요청
- 외부 SaaS provider 연결
- 관리자 UI, 결제, 조직·역할 기능
- 브라우저에서 local LLM 직접 호출
- 실제 PIN·생체 인증·필드 단위 암호화 잠금
- vector DB 또는 embedding 도입의 선결정
- local LLM upstream 계약의 임의 추정

## 4. 목표 시스템 구조

```text
React browser
  ├─ JSON / multipart / SSE
  ▼
Moodi Backend (/api/v1)
  ├─ Auth application service
  │    └─ Google ID token verifier
  ├─ Diary application service
  │    ├─ Diary repository
  │    ├─ Draft repository
  │    └─ Image storage port
  ├─ AI application service
  │    ├─ Conversation repository
  │    ├─ Diary retrieval port
  │    ├─ AI run/event buffer
  │    └─ LocalLlmGateway
  └─ Settings / data transfer service
       ├─ relational persistence
       └─ private object storage

LocalLlmGateway
  ▼ private network only
Existing Local LLM
```

### 4.1 의존성 원칙

```text
HTTP Controller / SSE Handler
  -> Application Service / Use Case
    -> Domain model and policy
      -> Repository or external Port
        -> DB, object storage, Google verifier, Local LLM Adapter
```

- Controller는 schema 검증, 인증 context 전달, HTTP status·header 변환만 담당한다.
- 사용자 소유권, 잠금 제외, source 검증, 상태 전이는 application/domain 계층이 담당한다.
- persistence entity, request DTO, response DTO, upstream LLM DTO를 분리한다.
- Local LLM Adapter는 upstream 응답을 내부 chunk/result DTO로 변환한다.
- UI는 backend service adapter만 호출하며 DB나 local LLM을 직접 호출하지 않는다.

### 4.2 배포 경계

- React와 API는 가능하면 같은 site에서 제공하고 `/api`를 backend로 reverse proxy한다.
- session cookie 기반 EventSource를 단순화하기 위해 cross-site API 배포를 기본안으로 삼지 않는다.
- local LLM은 private subnet, loopback, service mesh 또는 방화벽 allow-list 뒤에 두고 public ingress를 열지 않는다.
- 브라우저 번들, source map, API response, SSE event, 로그에 local LLM base URL이나 service credential을 넣지 않는다.

## 5. 핵심 리소스와 상태

| 리소스 | 소유자 | 목적 | 주요 상태 |
| --- | --- | --- | --- |
| `User` | system | 내부 사용자 profile | `active`, `deleting`, `deleted` |
| `AuthIdentity` | User | Google `sub` 연결 | `active`, `revoked` |
| `Session` | User | opaque 서버 세션 | `active`, `expired`, `revoked` |
| `UserSettings` | User | 서버 동기화 설정 | 단일 현재 값 |
| `DiaryEntry` | User | journal/quick 기록 | revision으로 동시성 제어 |
| `DiaryImage` | User | cover/inline 이미지 | `pending`, `attached`, `deleted` |
| `DiaryDraft` | User | 사용자당 단일 활성 초안 | revision으로 동시성 제어 |
| `DiaryAIInsight` | DiaryEntry | 자동/수동 entry 분석 | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `AIConversation` | User | AI 대화 metadata | active resource |
| `AIMessage` | Conversation | user/assistant 메시지 | `completed`, `redacted` |
| `AIMessageSource` | AIMessage | 사용자에게 표시할 현재 유효한 Diary 근거 snapshot | 유효하지 않게 되면 삭제 |
| `AIMessageContextEntry` | AIMessage | 모델에 전달된 모든 Diary privacy dependency | 사용자에게 직접 노출하지 않는 내부 관계 |
| `AIRun` | User/Conversation | 한 번의 LLM 생성 실행 | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `AIStreamEvent` | AIRun | SSE 재연결용 임시 event | sequence가 단조 증가 |
| `AuditEvent` | User optional | 보안·파괴 동작 감사 | immutable metadata |

### 5.1 상태 전이

```text
Session: active -> expired | revoked
DiaryImage: pending -> attached | deleted
DiaryAIInsight: queued -> running -> completed | failed | cancelled
AIRun: queued -> running -> completed | failed | cancelled
User: active -> deleting -> deleted
```

- `AIRun`은 정확히 하나의 terminal 상태로 끝난다.
- 이미 terminal인 run에 대한 cancel은 idempotent하게 현재 terminal 상태를 유지한다.
- SSE 연결 종료만으로 run을 취소하지 않는다. 명시적 cancel 또는 서버의 subscriber 부재 정책이 필요하다.
- assistant partial delta는 durable message가 아니다. `completed` 결과와 source 검증·저장이 모두 성공한 뒤에만 완성 메시지로 확정한다.

## 6. 공통 API 계약

### 6.1 기본 형식

| 항목 | 권장 계약 |
| --- | --- |
| Prefix | `/api/v1` |
| JSON field | `camelCase` |
| ID | opaque UUID string. 클라이언트는 형식에 비즈니스 의미를 두지 않음 |
| Timestamp | UTC ISO 8601, 예: `2026-07-16T09:10:11.123Z` |
| Diary date | timezone 없는 `YYYY-MM-DD` |
| Nullable | response에서 값이 없으면 명시적 `null`; 빈 배열은 `[]` |
| PATCH | omitted는 유지, nullable field의 `null`은 제거 |
| Pagination | opaque cursor, 기본 `limit=30`, 최대 `100` |
| Content type | JSON은 `application/json`; 오류는 `application/problem+json` |
| Request ID | response `X-Request-Id`; 오류 body의 `requestId`와 동일 |
| Private cache | Diary, session, AI response는 `Cache-Control: private, no-store`; SSE는 여기에 `no-cache, no-transform`을 추가하고 proxy/CDN cache를 우회 |

### 6.2 인증과 CSRF

- 인증 API를 제외한 모든 제품 API는 authenticated다.
- session cookie 권장 형태:

```http
Set-Cookie: __Host-moodi_session=<opaque-random-id>; Path=/; Secure; HttpOnly; SameSite=Lax
```

- `Domain`은 지정하지 않는다.
- opaque session token은 CSPRNG로 생성한 최소 256-bit 값으로 URL이나 response body에 넣지 않는다.
- 서버에는 session token 원문 대신 안전한 hash를 저장한다.
- 로그인 성공 시 기존 session ID를 폐기하고 새 ID를 발급한다.
- state-changing method인 `POST`, `PUT`, `PATCH`, `DELETE`는 `X-CSRF-Token`을 검증한다. Google GIS direct POST는 별도의 `g_csrf_token` double-submit 계약을 사용한다.
- `GET /auth/session` 응답의 `csrfToken`은 브라우저 메모리에만 둔다.
- CSRF token은 `HMAC(serverCsrfKey, opaqueSessionToken || csrfNonce)`처럼 서버만 가진 key, 요청 cookie의 현재 opaque token, session row의 nonce로 결정적으로 생성한다. DB에 원문 CSRF token을 저장하거나 hash에서 원문을 복원하려 하지 않는다.
- CSRF token은 GET마다 회전하지 않는다. session ID가 rotation되거나 폐기될 때 함께 바뀌며, 다중 탭은 새 session bootstrap 결과를 공유·재조회한다.
- 권장 초기 만료값은 idle 7일, absolute 30일이다. 운영 정책 확정 전 설정값으로 분리하고 문서·테스트를 함께 고정한다.
- 성공한 사용자 주도 authenticated HTTP 요청은 `lastSeenAt`을 throttled 방식으로 갱신할 수 있지만 SSE heartbeat/delta 자체는 idle 만료를 연장하지 않는다.
- 만료된 세션은 `401 SESSION_EXPIRED`, 인증이 없으면 `401 AUTH_REQUIRED`를 반환한다.
- 다른 사용자의 resource ID는 존재 여부를 노출하지 않도록 `404 RESOURCE_NOT_FOUND`로 처리한다. 실제 권한 부족은 `403`이다.

### 6.3 Idempotency와 optimistic concurrency

- `POST /diary-entries`, `POST /diary-images`, `POST /diary-entries/{id}/ai-insights`, `POST /ai-conversations`, `POST /ai-conversations/{id}/messages`, `PUT /diary-data`는 `Idempotency-Key`를 받는다.
- key는 클라이언트가 생성한 1~128자의 opaque ASCII 값이며 같은 사용자·scope 안에서만 비교한다.
- 같은 사용자·endpoint·key·동일 body의 재시도는 최초 응답을 재사용한다.
- 같은 key에 다른 body가 오면 `409 IDEMPOTENCY_CONFLICT`다.
- 인증·CSRF를 먼저 검증한 뒤 idempotency replay를 조회한다. 기존 성공 replay이면 이미 소비된 confirmation token이나 이미 증가한 dataset revision 때문에 다시 실패시키지 않고 저장된 resource 기준 응답을 재구성한다.
- DiaryEntry와 DiaryDraft 응답은 `ETag`를 포함한다.
- 수정·삭제는 `If-Match`를 요구한다. 누락은 `428 PRECONDITION_REQUIRED`, revision 불일치는 `412 VERSION_CONFLICT`다.

### 6.4 오류 형식

RFC 9457 기반 `application/problem+json`을 사용한다.

```json
{
  "type": "https://moodi.example/problems/validation-failed",
  "title": "요청 값이 올바르지 않습니다.",
  "status": 422,
  "detail": "입력 값을 확인해 주세요.",
  "instance": "/api/v1/diary-entries",
  "code": "VALIDATION_FAILED",
  "requestId": "req_...",
  "errors": [
    { "field": "energy", "code": "OUT_OF_RANGE", "message": "1에서 5 사이여야 합니다." }
  ]
}
```

공통 오류 code:

| HTTP | Code | 조건 |
| --- | --- | --- |
| 400 | `MALFORMED_REQUEST` | JSON, query 또는 header 형식이 깨짐 |
| 401 | `AUTH_REQUIRED` | 세션 없음 |
| 401 | `SESSION_EXPIRED` | 세션 만료 |
| 403 | `CSRF_INVALID` | CSRF 검증 실패 |
| 403 | `DATA_CONFIRMATION_INVALID` | 파괴 작업 confirmation이 없거나 만료·소비됨 |
| 403 | `RECENT_AUTH_REQUIRED` | 계정 삭제에 필요한 fresh Google 재인증 없음 |
| 403 | `FORBIDDEN` | 인증은 됐지만 허용되지 않은 동작 |
| 404 | `RESOURCE_NOT_FOUND` | 없거나 현재 사용자가 소유하지 않은 resource |
| 409 | `IDEMPOTENCY_CONFLICT` | 동일 key의 다른 요청 |
| 409 | `AI_RUN_ACTIVE` | 같은 conversation에 active run 존재 |
| 412 | `VERSION_CONFLICT` | `If-Match` revision 불일치 |
| 413 | `PAYLOAD_TOO_LARGE` | body 또는 file 제한 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 허용하지 않은 content/file type |
| 422 | `VALIDATION_FAILED` | schema 또는 domain validation 실패 |
| 428 | `PRECONDITION_REQUIRED` | 필요한 `If-Match` 누락 |
| 429 | `RATE_LIMITED` | 사용자별 limit 초과 |
| 503 | `AI_SERVICE_UNAVAILABLE` | local LLM에 요청을 시작할 수 없음 |
| 500 | `INTERNAL_ERROR` | 안전하게 정규화한 내부 오류 |

stack trace, SQL, 내부 host, local LLM 원문 오류, prompt 또는 diary 원문을 오류 응답에 넣지 않는다.

예시의 `moodi.example` problem type URI는 placeholder다. 실제 배포 전 영속적으로 유지할 canonical problem type base URI를 확정한다.

## 7. 공개 endpoint index

아래 endpoint는 모두 권장 계약이며 구현 시 `docs/api/endpoints.md`와 `docs/api/specification.md`의 동일한 endpoint set으로 확정해야 한다.

### 7.1 인증·계정

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login-attempts` | Public | GIS nonce와 일회성 login attempt 생성 |
| `POST` | `/api/v1/auth/google-credentials` | Public/GIS | Google ID token 검증 후 Moodi session 생성 |
| `GET` | `/api/v1/auth/session` | Optional session | 현재 session과 사용자 조회 |
| `DELETE` | `/api/v1/auth/session` | Authenticated | 현재 session 폐기 |
| `DELETE` | `/api/v1/users/me` | Authenticated | 계정과 서버 데이터를 삭제 |

### 7.2 설정

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users/me/settings` | Authenticated | 현재 사용자 설정 조회 |
| `PATCH` | `/api/v1/users/me/settings` | Authenticated | 설정 부분 수정 |
| `DELETE` | `/api/v1/users/me/settings` | Authenticated | 서버 설정을 기본값으로 초기화 |

### 7.3 Diary와 draft

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/diary-entries` | Authenticated | 검색·필터·pagination 목록 |
| `POST` | `/api/v1/diary-entries` | Authenticated | journal 또는 quick 생성 |
| `GET` | `/api/v1/diary-entries/{entryId}` | Authenticated | 상세 조회 |
| `PATCH` | `/api/v1/diary-entries/{entryId}` | Authenticated | 부분 수정 |
| `DELETE` | `/api/v1/diary-entries/{entryId}` | Authenticated | 삭제와 AI source 정리 |
| `GET` | `/api/v1/diary-draft` | Authenticated | 단일 활성 draft 조회 |
| `PUT` | `/api/v1/diary-draft` | Authenticated | 단일 draft 생성·교체 |
| `DELETE` | `/api/v1/diary-draft` | Authenticated | draft 삭제 |
| `POST` | `/api/v1/diary-entries/{entryId}/ai-insights` | Authenticated | entry AI insight 생성 또는 재시도 |

### 7.4 이미지와 집계

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/diary-images` | Authenticated | pending 이미지 업로드 |
| `GET` | `/api/v1/diary-images/{imageId}/content` | Authenticated | 이미지 binary 조회 |
| `DELETE` | `/api/v1/diary-images/{imageId}` | Authenticated | pending 또는 분리된 이미지 삭제 |
| `GET` | `/api/v1/diary-calendar-days` | Authenticated | 한 달의 날짜별 집계 |
| `GET` | `/api/v1/diary-insights` | Authenticated | 기간별 회고 집계 |
| `GET` | `/api/v1/diary-entry-facets` | Authenticated | 태그·활동·감정·AI topic 집계 |

### 7.5 AI 대화와 SSE

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/ai-conversations` | Authenticated | 대화 목록 |
| `POST` | `/api/v1/ai-conversations` | Authenticated | 새 대화 |
| `GET` | `/api/v1/ai-conversations/{conversationId}` | Authenticated | 대화 metadata 조회 |
| `PATCH` | `/api/v1/ai-conversations/{conversationId}` | Authenticated | 제목 변경 |
| `DELETE` | `/api/v1/ai-conversations/{conversationId}` | Authenticated | 대화 삭제 |
| `GET` | `/api/v1/ai-conversations/{conversationId}/messages` | Authenticated | message와 source 목록 |
| `POST` | `/api/v1/ai-conversations/{conversationId}/messages` | Authenticated | user message 저장과 AI run 생성 |
| `GET` | `/api/v1/ai-runs/{runId}` | Authenticated | run 상태·복구 정보 조회 |
| `GET` | `/api/v1/ai-runs/{runId}/events` | Authenticated | EventSource SSE 구독 |
| `PUT` | `/api/v1/ai-runs/{runId}/cancellation` | Authenticated | active run의 idempotent 취소 요청 |

### 7.6 데이터 이전

| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `HEAD` | `/api/v1/diary-data` | Authenticated | destructive 작업용 dataset revision 조회 |
| `GET` | `/api/v1/diary-data` | Authenticated | 호환 JSON export |
| `PUT` | `/api/v1/diary-data` | Authenticated | 검증 후 전체 Diary 교체 import |
| `DELETE` | `/api/v1/diary-data` | Authenticated | 계정은 유지하고 Diary·draft·AI 데이터를 삭제 |

## 8. 공통 DTO

### 8.1 User와 session

```ts
type UserDto = {
  id: string
  email: string
  displayName: string
  joinedAt: string
  lastLoginAt: string
}

type SessionDto = {
  user: UserDto
  authenticatedAt: string
  expiresAt: string
  absoluteExpiresAt: string
  csrfToken: string
}
```

- Google profile picture는 현재 UI 계약에 없으므로 임의 추가하지 않는다.
- email은 표시·연락 정보이고 외부 identity key가 아니다. Google `sub`가 identity key다.
- 같은 email의 다른 `sub`를 기존 계정에 자동 연결하지 않는다. 별도 account-linking 요구가 생기기 전에는 독립 identity로 취급한다.

### 8.2 Settings

```ts
type UserSettingsDto = {
  fontSize: 'small' | 'medium' | 'large'
  isEntryLockEnabledByDefault: boolean
  isAiAnalysisEnabled: boolean
  aiTone:
    | 'kind-friend'
    | 'calm-guide'
    | 'analytical-observer'
    | 'minimal-feedback'
  aiResponseLength: 'brief' | 'balanced' | 'detailed'
  isPersonalizedQuestionsEnabled: boolean
  updatedAt: string
}
```

Canonical server defaults:

```json
{
  "fontSize": "medium",
  "isEntryLockEnabledByDefault": false,
  "isAiAnalysisEnabled": true,
  "aiTone": "calm-guide",
  "aiResponseLength": "balanced",
  "isPersonalizedQuestionsEnabled": true
}
```

- `paper | midnight` theme과 sidebar 접힘은 P0에서 device-local UI preference로 유지한다.
- `isAiAnalysisEnabled`는 entry 저장 시 자동 insight를 제어한다. 사용자가 명시적으로 질문하는 AI 채팅 자체를 암묵적으로 차단하는 값으로 사용하지 않는다.

### 8.3 Diary enum

```ts
type EntryType = 'journal' | 'quick'

type Mood =
  | 'happy'
  | 'calm'
  | 'excited'
  | 'neutral'
  | 'tired'
  | 'anxious'
  | 'frustrated'
  | 'sad'
  | 'angry'

type Activity =
  | 'work'
  | 'people'
  | 'exercise'
  | 'study'
  | 'walk'
  | 'rest'
  | 'music'
  | 'meal'
  | 'self-care'
```

### 8.4 Diary image

```ts
type DiaryImageDto = {
  id: string
  contentUrl: string
  alt: string | null
  role: 'cover' | 'inline'
  createdAt: string
}
```

- `contentUrl`은 현재 origin의 인증된 안정 URL이다. presigned upstream URL을 domain field처럼 영구 저장하지 않는다.
- 현재 호환 제한은 entry당 최대 3장, 파일당 350 KiB다.
- v1 허용 MIME 권장값은 `image/jpeg`, `image/png`, `image/webp`다. 실제 decode로 형식을 검증하고 SVG는 허용하지 않는다.

### 8.5 Diary entry

```ts
type DiaryAIInsightDto = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  summary: string | null
  emotions: string[]
  topics: string[]
  patterns: string[]
  followUpQuestions: string[]
  relatedEntryIds: string[]
  generator: 'local-llm'
  generatedAt: string | null
}

type DiaryEntryDto = {
  id: string
  type: EntryType
  title: string | null
  content: string | null
  contentHtml: string | null
  shortNote: string | null
  createdAt: string
  updatedAt: string
  diaryDate: string
  mood: Mood | null
  energy: number | null
  activities: Activity[]
  tags: string[]
  aiTopics: string[]
  images: DiaryImageDto[]
  weather: { condition: string | null; temperature: number | null } | null
  location: { name: string | null } | null
  isFavorite: boolean
  isLocked: boolean
  aiInsight: DiaryAIInsightDto | null
  revision: number
}
```

```ts
type DiaryEntrySummaryDto = {
  id: string
  type: EntryType
  title: string | null
  excerpt: string
  diaryDate: string
  updatedAt: string
  mood: Mood | null
  energy: number | null
  activities: Activity[]
  tags: string[]
  coverImage: DiaryImageDto | null
  isFavorite: boolean
  isLocked: boolean
  revision: number
}

type DiaryEntryDetailDto = {
  entry: DiaryEntryDto
  relatedEntries: DiaryEntrySummaryDto[]
  previousEntry: DiaryEntrySummaryDto | null
  nextEntry: DiaryEntrySummaryDto | null
}
```

목록에는 전체 `contentHtml`을 넣지 않는다.

Create/Update request에서 허용하는 사용자 입력:

```ts
type DiaryEntryContentWriteDto = {
  type: EntryType
  diaryDate: string
  title?: string | null
  content?: string | null
  contentHtml?: string | null
  shortNote?: string | null
  mood?: Mood | null
  energy?: number | null
  activities?: Activity[]
  tags?: string[]
  imageIds?: string[]
  weather?: { condition?: string | null; temperature?: number | null } | null
  location?: { name?: string | null } | null
  isFavorite?: boolean
  isLocked?: boolean
}

type DiaryEntryWriteDto = DiaryEntryContentWriteDto & {
  shouldAnalyze?: boolean
}
```

- `aiInsight`, `aiTopics`, `createdAt`, `updatedAt`, `revision`, image URL은 server-owned라 request에서 받지 않는다.
- `shouldAnalyze`는 저장할 domain field가 아니라 entry create/update command field다. Draft DTO에는 포함하지 않는다.
- PATCH는 위 field를 모두 optional로 하고 `type`, `diaryDate`도 변경 가능하게 한다.
- `contentHtml`은 TipTap 문서 보존용이고 `content`는 검색·분석용 평문이다. 서버가 HTML을 sanitize하고 두 표현의 허용 가능한 일관성을 검사한다.

권장 validation:

| Field | 규칙 |
| --- | --- |
| `type` | enum 필수 |
| `diaryDate` | 유효한 `YYYY-MM-DD` 필수 |
| journal | 평문 `content`가 trim 후 비어 있지 않아야 함 |
| quick | `mood`, `shortNote`, `activities` 중 하나 이상; 현재 UI는 mood를 요구하므로 최종 계약 시 UI와 맞춤 |
| `energy` | `null` 또는 1~5 정수 |
| `activities` | 중복 없는 canonical enum |
| `tags` | trim·중복 제거, 대소문자 정규화 정책 확정 필요 |
| `imageIds` | 최대 3개, 모두 현재 사용자의 pending/attached image |
| `contentHtml` | script, event handler, unsafe URL 제거; 허용 tag/attribute allow-list |
| `isLocked` | true이면 모든 자동 LLM 분석과 채팅 retrieval에서 제외 |

제목·본문·태그의 정확한 최대 길이는 backend 구현 전 UI/DB/LLM context 한도를 함께 보고 확정한다. 확정 전 임의 truncate하지 말고 `VALIDATION_FAILED`로 처리한다.

집계 response의 exact DTO:

```ts
type CountDto<Value extends string> = { value: Value; count: number }

type DiaryCalendarDaysDto = {
  month: string
  days: Array<{
    date: string
    entryCount: number
    moods: Mood[]
    representativeMood: Mood | null
  }>
}

type DiaryInsightsDto = {
  range: { dateFrom: string; dateTo: string }
  entryCount: number
  averageEnergy: number | null
  moodCounts: Array<CountDto<Mood>>
  activityCounts: Array<CountDto<Activity>>
  topTopics: Array<CountDto<string>>
  trend: Array<{
    date: string
    entryCount: number
    averageEnergy: number | null
    moodCounts: Array<CountDto<Mood>>
  }>
  relatedEntries: DiaryEntrySummaryDto[]
}

type DiaryEntryFacetsDto = {
  tags: Array<CountDto<string>>
  activities: Array<CountDto<Activity>>
  moods: Array<CountDto<Mood>>
  aiTopics: Array<CountDto<string>>
}
```

### 8.6 Draft

```ts
type DiaryDraftDto = DiaryEntryContentWriteDto & {
  id: string
  entryId: string | null
  savedAt: string
  revision: number
}
```

- 사용자당 최대 하나다.
- `GET`은 `{ "draft": null }` 또는 `{ "draft": DiaryDraftDto }`를 반환한다.
- 자동저장은 현재 650ms debounce를 유지할 수 있지만 서버에는 동시에 하나만 전송한다.
- 기존 entry 저장이 성공하고 draft 삭제만 실패하면 draft를 저장된 `entryId`에 연결해 duplicate create를 막는다.

### 8.7 AI conversation, message, source, run

```ts
type AIConversationSummaryDto = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type JournalSourceDto = {
  entryId: string
  entryUpdatedAt: string
  diaryDate: string
  title: string | null
  excerpt: string
  mood: Mood | null
}

type AIMessageDto =
  | {
      id: string
      role: 'user'
      status: 'completed'
      content: string
      createdAt: string
      generator: null
      sources: []
      redactionReason: null
    }
  | {
      id: string
      role: 'assistant'
      status: 'completed'
      content: string
      createdAt: string
      generator: 'local-llm'
      sources: JournalSourceDto[]
      redactionReason: null
    }
  | {
      id: string
      role: 'assistant'
      status: 'redacted'
      content: null
      createdAt: string
      generator: 'local-llm'
      sources: []
      redactionReason: 'source-updated' | 'source-unavailable'
    }

type AIRunDto = {
  id: string
  conversationId: string
  userMessageId: string
  assistantMessageId: string | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  streamUrl: string
  failure: {
    code:
      | 'AI_SOURCE_LOAD_FAILED'
      | 'AI_SERVICE_UNAVAILABLE'
      | 'AI_TIMEOUT'
      | 'AI_OUTPUT_INVALID'
      | 'AI_PERSISTENCE_FAILED'
      | 'AI_INTERNAL_ERROR'
    message: string
    retryable: boolean
    requestId: string
  } | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}
```

- title은 trim 후 1~80자다.
- 질문 content는 trim 후 1~1,200자다.
- source excerpt는 canonical plain text의 실제 substring이며 최대 280 Unicode code point다.
- `generator: local-llm`을 새 API의 정확한 표현으로 사용한다. 기존 프런트의 `external-ai`로 로컬 모델을 가장하지 않는다.
- source excerpt는 실제 현재 평문 원문의 substring이어야 한다.
- source 또는 모델 context dependency가 수정되면 message를 `source-updated`, 삭제·잠금되면 `source-unavailable`로 redaction한다. redaction transaction은 저장된 assistant content와 source snapshot을 실제로 purge하고 response는 `content: null`, `sources: []`로 반환한다.
- API의 `AIConversationSummaryDto`와 paginated `AIMessageDto`를 application view model에서 조합한다. 기존 프런트의 messages 포함 `AIConversation` domain type에 HTTP response를 직접 대입하지 않는다.

## 9. Endpoint 상세 계약

### 9.1 `POST /api/v1/auth/login-attempts`

- 설명: GIS login을 시작하기 위한 일회성 nonce와 attempt를 만든다.
- P0 UX는 **공식 Sign in with Google 버튼 + redirect mode**로 고정하고 One Tap과 auto-select는 사용하지 않는다. `state`가 button click에서만 반환되는 제약을 계약에 반영한 선택이다.
- Auth: 일반 login은 Public, 계정 삭제 재인증 attempt는 기존 session 필요. `Origin`/Fetch Metadata allow-list 검증.
- Request JSON: `{ returnTo?: string, purpose?: 'login' | 'reauthenticate' }`. 같은 origin의 허용된 상대 경로만 가능하며 기본 `/`, purpose 기본 `login`.
- Response `201`:

```json
{
  "attemptId": "...",
  "nonce": "...",
  "expiresAt": "2026-07-16T09:15:00.000Z"
}
```

- Side effect: 고엔트로피 attempt ID, nonce, purpose, allow-listed `returnTo`, expiry, consumed 상태와 브라우저 binding을 가진 짧은 서버 transaction을 만든다. `reauthenticate`이면 현재 내부 user와 기대 Google `sub`도 binding한다. 자체 pre-login cookie를 쓰면 Google redirect POST에서 실제 전송되는 SameSite 동작을 지원 브라우저로 검증한다.
- Errors: reauthenticate에 session이 없으면 `401 AUTH_REQUIRED`; 그 밖에 `400 MALFORMED_REQUEST`, `422 VALIDATION_FAILED`, `429 RATE_LIMITED`.

React는 `nonce`를 GIS 설정에 전달하고 `attemptId`를 GIS button의 correlation `state`로 전달할 수 있다. 이 값은 OAuth Authorization Code flow의 CSRF `state`와 동일한 개념으로 취급하지 않는다. 실제 login CSRF는 GIS의 `g_csrf_token`과 server-side attempt binding으로 방어한다.

### 9.2 `POST /api/v1/auth/google-credentials`

- 설명: GIS가 발급한 ID token을 검증하고 사용자·세션을 생성한다.
- Auth: Public/GIS protocol endpoint.
- Content-Type: 기본 `application/x-www-form-urlencoded`.
- Required form fields:
  - `credential`: Google ID token JWT.
  - `g_csrf_token`: body 값. 동일 이름 cookie와 상수 시간 비교한다.
  - `state`: 앞서 발급한 `attemptId` correlation 값.
- Server validation:
  1. `g_csrf_token` cookie/body 일치.
  2. login attempt 존재, 미만료, 미소비, pre-login context 일치.
  3. Google 공식 library/JWKS로 JWT 서명 검증.
  4. `iss`, `aud`, `exp`, `nonce` 검증.
  5. `email_verified === true` 검증.
  6. `sub`로 `AuthIdentity` 조회 또는 생성. email로 계정을 연결하지 않는다.
     기존 identity면 검증된 현재 email/display name snapshot과 `lastLoginAt`을 갱신하되 내부 user ID는 유지한다.
  7. reauthenticate attempt이면 기존 attempt에 묶인 사용자의 Google `sub`와 일치하는지 검증한다.
  8. attempt를 일회성 소비하고 새 Moodi session을 발급한다. reauthenticate이면 session의 `lastAuthenticatedAt`을 갱신한다.
- 성공·실패 모두 login attempt와 pre-login cookie를 즉시 정리한다.
- Success: `303 See Other`, allow-listed `returnTo`로 redirect, `__Host-moodi_session` 설정.
- Failure: `303`으로 `/login?error=google-login-failed` 같은 고정된 안전 code에 redirect하거나 API client에는 Problem Details를 반환한다. token·내부 원인은 URL에 넣지 않는다.
- Errors: `401 GOOGLE_CREDENTIAL_INVALID`, `401 GOOGLE_EMAIL_UNVERIFIED`, `401 LOGIN_ATTEMPT_INVALID`, `403 CSRF_INVALID`, `403 GOOGLE_REAUTH_ACCOUNT_MISMATCH`, `409 LOGIN_ATTEMPT_CONSUMED`, `429 RATE_LIMITED`.

Google API 접근이 필요하지 않으므로 Google access/refresh token을 요청·저장하지 않는다.

### 9.3 `GET /api/v1/auth/session`

- 설명: 앱 bootstrap용 현재 session 조회.
- Auth: Optional session cookie.
- Request: body/query 없음.
- Response `200`: `SessionDto`, `Cache-Control: no-store`.
- Errors: 세션이 없으면 `401 AUTH_REQUIRED`, 만료면 cookie를 폐기하고 `401 SESSION_EXPIRED`.

### 9.4 `DELETE /api/v1/auth/session`

- 설명: 현재 서버 session 폐기와 cookie 만료.
- Auth: Authenticated + `X-CSRF-Token`.
- Response `204`, body 없음.
- 요청에 session cookie가 있으면 server row가 이미 폐기됐더라도 cookie를 다시 만료하고 `204`로 처리한다. cookie 자체가 없으면 `401 AUTH_REQUIRED`다.
- 해당 session에 등록된 열린 SSE를 즉시 닫는다. LLM run은 다른 active session/subscriber가 없을 때 subscriber 부재 정책에 따라 취소할 수 있지만, 폐기 session으로 delta를 더 보내지 않는다.
- Errors: `401 AUTH_REQUIRED`, `403 CSRF_INVALID`.

### 9.5 `DELETE /api/v1/users/me`

- 설명: 계정 탈퇴. 모든 사용자 데이터, identity, session을 삭제한다.
- Auth: Authenticated + CSRF + 최근 5분 이내의 동일 Google `sub` fresh 재인증 필수. 충족하지 않으면 `403 RECENT_AUTH_REQUIRED`이고 UI는 GIS login을 다시 수행한 뒤 사용자가 삭제를 재확인한다.
- Request: body 없음. UI의 명시적 confirmation은 별도 presentation 책임이다.
- Response `204`: active run 취소, 모든 session 폐기, 사용자 접근 차단과 DB의 논리적 삭제 경계가 완료됐음을 뜻한다. object와 backup의 물리 purge는 별도 확정 SLA 안에서 완료한다.
- active run은 오류로 막지 않고 generation fence를 먼저 닫은 뒤 cancel·buffer purge한다.
- Errors: `401`, `403 CSRF_INVALID`, `403 RECENT_AUTH_REQUIRED`.
- 계정 탈퇴와 `DELETE /diary-data`를 구분한다. 후자는 계정과 현재 session을 유지한다.

### 9.6 Settings endpoints

#### `GET /api/v1/users/me/settings`

- Response `200`: `UserSettingsDto`.
- 저장값이 없으면 서버가 canonical 기본값을 생성하거나 기본 DTO를 반환한다.
- Errors: `401`.

#### `PATCH /api/v1/users/me/settings`

- Request: `UserSettingsDto`에서 `updatedAt`을 뺀 partial object. 최소 하나의 field 필요. `null` 불가.
- Response `200`: 전체 최신 `UserSettingsDto`.
- Errors: `401`, `403 CSRF_INVALID`, `422 VALIDATION_FAILED`.

#### `DELETE /api/v1/users/me/settings`

- Response `204`; 다음 GET은 canonical 기본값을 반환한다.
- Errors: `401`, `403 CSRF_INVALID`.

### 9.7 Diary entry endpoints

#### `GET /api/v1/diary-entries`

Query:

| Field | Type | Required | 의미 |
| --- | --- | --- | --- |
| `query` | string | no | 제목·평문·short note·tag·topic 검색 |
| `dateFrom` | `YYYY-MM-DD` | no | inclusive |
| `dateTo` | `YYYY-MM-DD` | no | inclusive |
| `monthDay` | `MM-DD` | no | 과거의 오늘처럼 연도와 무관한 월·일 검색 |
| `mood` | repeated Mood | no | 여러 값 OR |
| `activity` | repeated Activity | no | 여러 값 OR |
| `tag` | repeated string | no | 여러 값 OR |
| `isFavorite` | boolean | no | favorite 필터 |
| `hasImages` | boolean | no | 이미지 존재 필터 |
| `entryType` | repeated EntryType | no | journal/quick |
| `sort` | enum | no | `diaryDateDesc`, `diaryDateAsc`, `updatedAtDesc`; 기본 `diaryDateDesc` |
| `cursor` | opaque string | no | 다음 page cursor |
| `limit` | integer 1..100 | no | 기본 30 |

Response `200`:

```json
{
  "items": [],
  "nextCursor": null,
  "hasNext": false
}
```

`items`는 `DiaryEntrySummaryDto[]`다. `diaryDateDesc`의 안정 tie-break는 `diaryDate DESC, updatedAt DESC, id DESC`다. 다른 sort도 마지막 tie-break에 ID를 포함한다. Errors: `401`, `422 VALIDATION_FAILED`.

`dateFrom`과 `dateTo`가 함께 있으면 `dateFrom <= dateTo`여야 한다. `monthDay`는 유효한 월·일이어야 하며 date range와 동시에 사용하지 않는다. repeated enum query는 같은 이름을 반복해 전달하며 comma parsing을 사용하지 않는다.

#### `POST /api/v1/diary-entries`

- Headers: `X-CSRF-Token`, `Idempotency-Key`.
- Request: full `DiaryEntryWriteDto`; `type`, `diaryDate` 필수.
- Response `201`: `DiaryEntryDto`, `Location` header, `ETag`.
- Side effects:
  - 요청의 pending image를 새 entry에 attach한다.
  - 자동 분석의 effective 값은 `UserSettings.isAiAnalysisEnabled && (shouldAnalyze ?? true)`다. effective가 true이고 `isLocked === false`이면 entry commit 후 `DiaryAIInsight`를 enqueue한다.
  - `shouldAnalyze === false`, settings disabled 또는 lock이면 신규 insight를 만들지 않는다. 사용자의 명시적 재생성은 별도 AI insight endpoint를 사용한다.
- Errors: `401`, `403`, `409 IDEMPOTENCY_CONFLICT`, `413`, `422`, `503`은 **entry 저장 자체**에 사용하지 않는다. LLM enqueue 실패는 entry를 롤백하지 않고 `aiInsight.status=failed` 또는 별도 안전 상태로 표현한다.

#### `GET /api/v1/diary-entries/{entryId}`

- Response `200`: `DiaryEntryDetailDto`, entry revision의 `ETag`.
- `relatedEntries`는 현재 entry를 제외하고 mood/topic/tag/activity overlap을 deterministic하게 계산한 최대 3개 summary다. owner의 일반 탐색 기능이므로 잠긴 entry도 제목·summary 정책 안에서 표시할 수 있지만 AI context에는 사용하지 않는다.
- `previousEntry`와 `nextEntry`는 `diaryDate`, `updatedAt`, `id`의 안정적인 순서에서 인접한 기록이며 없으면 `null`이다.
- Errors: `401`, `404 RESOURCE_NOT_FOUND`.

#### `PATCH /api/v1/diary-entries/{entryId}`

- Headers: `X-CSRF-Token`, `If-Match`.
- Request: partial `DiaryEntryWriteDto`, 최소 한 field.
- Response `200`: 전체 최신 `DiaryEntryDto`, 새 `ETag`.
- Side effects:
  - 빠진 image ID는 entry에서 detach하고 보존 필요가 없으면 삭제한다.
  - lock을 true로 바꾸면 진행 중 관련 AI insight/run을 취소하고 **AI retrieval/embedding index와 AI context cache**에서 제거하며 과거 dependency가 있는 답변을 redaction한다. owner의 일반 Diary 검색·목록에서는 제거하지 않는다.
  - source로 사용된 원문을 변경하면 관련 assistant message를 `source-updated`로 redaction한다.
- Errors: `401`, `403`, `404`, `412`, `413`, `422`, `428`.

#### `DELETE /api/v1/diary-entries/{entryId}`

- Headers: `X-CSRF-Token`, `If-Match`.
- Response `204`.
- 하나의 transaction 또는 신뢰 가능한 saga 안에서 entry, image, insight, search index와 source relation을 정리한다.
- 해당 source에 의존한 assistant content는 다시 노출하지 않는다.
- Errors: `401`, `403`, `404`, `412`, `428`.

#### `POST /api/v1/diary-entries/{entryId}/ai-insights`

- P1 권장 endpoint. 자동 분석 실패 또는 사용자 재생성에 사용한다.
- Headers: `X-CSRF-Token`, `Idempotency-Key`.
- Request:

```json
{
  "tone": "calm-guide",
  "responseLength": "balanced"
}
```

- 둘 다 optional이며 없으면 server settings를 사용한다.
- Response `202`: `DiaryAIInsightDto` with `queued` status.
- 잠긴 entry는 `409 LOCKED_ENTRY_AI_DISABLED`.
- `503`은 insight job을 만들기 전 readiness 거절에만 사용하고, `202` 뒤 실패는 insight `status=failed`로 관찰한다.
- Errors: `401`, `403`, `404`, `409`, `429`, `503`.

### 9.8 Draft endpoints

#### `GET /api/v1/diary-draft`

- Response `200`: `{ "draft": DiaryDraftDto | null }`. draft가 없어도 404가 아니다.
- draft가 있으면 resource revision에 해당하는 `ETag`를 포함한다.
- Errors: `401`.

#### `PUT /api/v1/diary-draft`

- Headers: `X-CSRF-Token`; 기존 draft가 있으면 `If-Match`.
- Request: `DiaryEntryContentWriteDto`와 optional `entryId`, optional `id`. `shouldAnalyze`는 허용하지 않는다.
- Response: 처음 생성은 `201`, 갱신은 `200`; `DiaryDraftDto`, `ETag`.
- 한 사용자에 하나만 존재한다.
- Errors: `401`, `403`, `412`, `413`, `422`, `428`.

#### `DELETE /api/v1/diary-draft`

- Headers: `X-CSRF-Token`, draft가 있으면 `If-Match`.
- Response `204`. draft가 없어도 idempotent `204`.
- Errors: `401`, `403`, `412`, `428`.

### 9.9 Image endpoints

#### `POST /api/v1/diary-images`

- Content-Type: `multipart/form-data`.
- Headers: `X-CSRF-Token`, `Idempotency-Key`.
- Parts:
  - `file`: required binary.
  - `role`: required `cover | inline`.
  - `alt`: optional string.
- Response `201`: `DiaryImageDto`, `Location`.
- 새 image는 `pending`; entry/draft가 image ID를 참조하면 attach한다.
- orphan pending image는 권장 24시간 후 정리한다. 보존값은 운영 정책에서 확정한다.
- Errors: `401`, `403`, `409`, `413 IMAGE_TOO_LARGE`, `415 IMAGE_TYPE_UNSUPPORTED`, `422 IMAGE_INVALID`.

#### `GET /api/v1/diary-images/{imageId}/content`

- Response `200`: 검증된 binary, 정확한 `Content-Type`, `X-Content-Type-Options: nosniff`, private cache 정책.
- 소유자 session을 매번 검사한다. image URL 자체를 bearer credential로 사용하지 않는다.
- Errors: `401`, `404`.

#### `DELETE /api/v1/diary-images/{imageId}`

- pending 또는 entry/draft에서 이미 분리된 image만 직접 삭제한다.
- 아직 참조 중이면 `409 IMAGE_IN_USE`.
- Response `204`.
- Errors: `401`, `403`, `404`, `409`.

### 9.10 집계 endpoints

#### `GET /api/v1/diary-calendar-days`

- Query: `month=YYYY-MM` required.
- Response `200`: `DiaryCalendarDaysDto`.

```json
{
  "month": "2026-07",
  "days": [
    {
      "date": "2026-07-16",
      "entryCount": 2,
      "moods": ["calm", "happy"],
      "representativeMood": "calm"
    }
  ]
}
```

- 잠금 여부와 관계없이 소유자의 캘린더 count에는 포함할 수 있지만, 응답에 원문은 포함하지 않는다.
- Errors: `401`, `422`.

#### `GET /api/v1/diary-insights`

- Query: `dateFrom`, `dateTo` required and inclusive.
- Response `200`: `DiaryInsightsDto`.
- 반복이라는 문구를 지원하는 count는 최소 2여야 한다.
- deterministic DB aggregation이며 local LLM availability에 의존하지 않는다.
- Errors: `401`, `422`.

#### `GET /api/v1/diary-entry-facets`

- Query: optional `dateFrom`, `dateTo`.
- Response `200`: `DiaryEntryFacetsDto`.

```json
{
  "tags": [{ "value": "프로젝트", "count": 3 }],
  "activities": [{ "value": "work", "count": 4 }],
  "moods": [{ "value": "calm", "count": 2 }],
  "aiTopics": [{ "value": "성장", "count": 2 }]
}
```

- user tag와 AI topic을 합치지 않는다.
- Errors: `401`, `422`.

### 9.11 AI conversation endpoints

#### `GET /api/v1/ai-conversations`

- Query: `cursor`, `limit`(기본 30, 최대 100).
- Response `200`: `{ items: AIConversationSummaryDto[], nextCursor, hasNext }`, `updatedAt DESC`.
- 대화 message를 이 목록에 embed하지 않는다.
- Errors: `401`.

#### `POST /api/v1/ai-conversations`

- Headers: `X-CSRF-Token`, `Idempotency-Key`.
- Request: `{ "title": "새 대화" }`; title optional, 기본값은 제품 고정 문자열.
- Response `201`: `AIConversationSummaryDto`, `Location`.
- Errors: `401`, `403`, `409`, `422`.

#### `GET /api/v1/ai-conversations/{conversationId}`

- Response `200`: `AIConversationSummaryDto`.
- Errors: `401`, `404`.

#### `PATCH /api/v1/ai-conversations/{conversationId}`

- Request: `{ "title": "..." }`, trim 후 1~80자.
- Response `200`: `AIConversationSummaryDto`.
- active run 중 rename을 허용할지 UI와 서버를 일치시킨다. 권장 P0는 `409 AI_RUN_ACTIVE`로 차단한다.
- Errors: `401`, `403`, `404`, `409`, `422`.

#### `DELETE /api/v1/ai-conversations/{conversationId}`

- active run이 있으면 generation fence를 원자적으로 닫고 cancel한 뒤 대화·message·source·context dependency·event buffer를 삭제한다. 늦게 도착한 chunk/finalizer는 conversation을 다시 만들거나 assistant message를 삽입할 수 없다.
- Response `204`.
- Errors: `401`, `403`, `404`.

#### `GET /api/v1/ai-conversations/{conversationId}/messages`

- Query: `cursor`, `limit`(기본 50, 최대 100). 첫 요청은 최신 message window를 가져오되 `items`는 시간 오름차순으로 반환하고, `nextCursor`는 더 오래된 window를 가리킨다.
- Response `200`: `{ items: AIMessageDto[], nextCursor, hasNext }`.
- 읽을 때마다 현재 Diary 소유권·잠금·updatedAt으로 source를 재검증한다.
- Errors: `401`, `404`.

#### `POST /api/v1/ai-conversations/{conversationId}/messages`

- 목적: user message를 durable 저장하고 정확히 하나의 `AIRun`을 만든다. 이 endpoint 자체는 SSE가 아니다.
- Headers: `X-CSRF-Token`, `Idempotency-Key`.
- Request:

```json
{
  "content": "최근 한 달 동안 기분이 좋아진 계기를 찾아줘",
  "timeZone": "Asia/Seoul"
}
```

- `timeZone`은 유효한 IANA time zone 필수값이다. backend는 이 zone에서 상대 날짜를 해석하며 주 시작은 월요일이다.

- Processing order:
  1. session, CSRF, conversation owner, content, rate/concurrency 검증.
  2. user message durable 저장.
  3. `AIRun(queued)` durable 저장.
  4. 첫 user message이고 title이 아직 기본값이면 질문에서 80자 이내 제목을 만들어 conversation title을 갱신한다. 사용자가 직접 바꾼 제목은 덮어쓰지 않는다.
  5. transaction commit 후 local LLM orchestration 시작.
- Response `202`:

```json
{
  "userMessage": {
    "id": "...",
    "role": "user",
    "status": "completed",
    "content": "최근 한 달 동안 기분이 좋아진 계기를 찾아줘",
    "createdAt": "2026-07-16T09:10:11.123Z",
    "generator": null,
    "sources": [],
    "redactionReason": null
  },
  "run": {
    "id": "...",
    "conversationId": "...",
    "userMessageId": "...",
    "assistantMessageId": null,
    "status": "queued",
    "streamUrl": "/api/v1/ai-runs/.../events",
    "failure": null,
    "createdAt": "2026-07-16T09:10:11.123Z",
    "startedAt": null,
    "completedAt": null
  }
}
```

- 한 conversation에는 active run 하나만 허용한다.
- capacity/readiness 거절은 transaction 전에만 `429` 또는 `503`으로 반환한다. user message와 run commit 뒤 orchestration 시작이 실패하면 같은 idempotent `202`를 반환하고 후속 상태를 `run.failed`로 기록한다.
- 동일 `Idempotency-Key` 재호출은 새 message/run을 만들지 않고 최초 `202`의 기존 resource를 반환한다.
- Errors: `401`, `403`, `404`, `409 AI_RUN_ACTIVE`, `422`, `429`, `503 AI_SERVICE_UNAVAILABLE`.

### 9.12 AI run and SSE endpoints

#### `GET /api/v1/ai-runs/{runId}`

- Response `200`: `{ "run": AIRunDto, "message": AIMessageDto | null }`. `message`는 completed일 때만 값이 있고 그 밖에는 `null`이다.
- transport 오류, page reload, event replay 만료 뒤 재동기화에 사용한다.
- Errors: `401`, `404`.

#### `GET /api/v1/ai-runs/{runId}/events`

- Auth: session cookie. run ID만으로 권한을 인정하지 않고 현재 session active 상태와 owner를 검사하며, 열린 stream을 session ID에 등록한다.
- Request headers: `Accept: text/event-stream`; browser reconnect 시 optional `Last-Event-ID`.
- Query: page reload 복구를 위한 optional `after=<eventId>`. `Last-Event-ID`가 있으면 header를 우선한다.
- cursor의 길이·형식, cursor 안 run ID와 URL `runId` 일치, 현재 저장된 sequence보다 미래 값이 아닌지를 검증한다.
- Success headers:

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: private, no-store, no-cache, no-transform
X-Accel-Buffering: no
```

`X-Accel-Buffering`은 지원 proxy에서만 사용한다. 모든 환경에서 CDN cache와 proxy buffering을 우회하고, SSE response compression을 끄며, event별 flush를 실제로 검증한다.

- 연결을 열기 전 errors는 `401`, `404`, `429`일 수 있지만 native EventSource는 status/body를 노출하지 않는다. 클라이언트는 아래 공통 `onerror` 복구 알고리즘만 사용한다.
- replay cursor가 hard TTL 밖이면 `200 text/event-stream`으로 `stream.resync-required` control event를 한 번 flush한 뒤 연결을 닫는다. 클라이언트는 partial text를 버리고 run이 terminal일 때까지 상태를 조회한 후 message 목록과 재동기화한다.
- `200 text/event-stream`을 보낸 뒤의 application 실패는 HTTP status가 아니라 `run.failed` terminal event로 보낸다.
- terminal event를 flush한 뒤 서버도 연결을 닫고, event를 받은 React도 `EventSource.close()`를 호출한다.
- session expiry·logout·account delete는 해당 session에 등록된 모든 stream의 추가 delta 전달을 즉시 중단한다. heartbeat는 session idle 만료를 연장하지 않는다.

#### `PUT /api/v1/ai-runs/{runId}/cancellation`

- Auth: session + CSRF.
- 목적: singleton cancellation resource를 idempotent하게 만들고 가능하면 Local LLM abort까지 전파한다.
- Request: body 없음.
- Response `200`: 현재 `AIRunDto`. cancel이 조건부 상태 전이를 이기면 `cancelled`, completion/failure가 먼저 terminal이 됐으면 그 기존 상태를 반환한다.
- 수신 측 `EventSource.close()`만으로 cancel이 보장되지 않는다.
- Errors: `401`, `403`, `404`.

### 9.13 Diary data endpoints

#### `HEAD /api/v1/diary-data`

- Response `200`, body 없음.
- Headers: `ETag: "diary-data-<revision>"`, `X-Moodi-Entry-Count: <count>`, `X-Moodi-Data-Confirmation: <opaque-token>`.
- confirmation token은 session, dataset revision, 짧은 만료에 binding하고 1회만 소비한다.
- React는 사용자가 파괴 동작을 확인한 직후 이 revision/token을 읽고 mutation의 `If-Match`와 `X-Data-Confirmation-Token`으로 보낸다.
- Errors: `401`.

#### `GET /api/v1/diary-data`

- Response `200`, streaming `application/json`, download disposition, dataset `ETag`.
- 서버가 새로 만드는 export는 version 2다.

```json
{
  "format": "moodi-diary-export",
  "version": 2,
  "exportedAt": "2026-07-16T09:10:11.123Z",
  "entries": []
}
```

Version 2 entry contract:

```ts
type DiaryExportImageV2 = {
  id: string
  dataUrl: string
  alt: string | null
  role: 'cover' | 'inline'
}

type DiaryExportEntryV2 = {
  id: string
  type: EntryType
  title: string | null
  content: string | null
  contentHtml: string | null
  shortNote: string | null
  createdAt: string
  updatedAt: string
  diaryDate: string
  mood: Mood | null
  energy: number | null
  activities: Activity[]
  tags: string[]
  images: DiaryExportImageV2[]
  weather: { condition: string | null; temperature: number | null } | null
  location: { name: string | null } | null
  isFavorite: boolean
  isLocked: boolean
}
```

- AI topic과 insight는 파생 데이터라 version 2 export에서 제외하고 import 뒤 필요할 때 재생성한다.
- 인증 cookie, session, Google identity, audit, pending run은 export하지 않는다.
- 이미지 binary는 `dataUrl`로 내보내고 `contentHtml` 안의 authenticated content URL도 해당 data URL로 rewrite한다.
- backend는 response를 stream하고, 자신이 export한 version 2 파일을 다시 import할 수 있어야 한다. 이미 저장을 허용한 dataset을 크기만으로 export 불가 상태로 만들지 않는다. 대규모 archive format이 필요하면 version 3으로 추가한다.
- Errors: `401`, 안전하게 정규화한 `500 INTERNAL_ERROR`.

#### `PUT /api/v1/diary-data`

- Headers: `X-CSRF-Token`, `Idempotency-Key`, dataset `If-Match`, `X-Data-Confirmation-Token`.
- Content-Type: `application/json`.
- Request: legacy version 1 또는 위 version 2 envelope. version 1은 현재 브라우저 계약에 맞춰 최대 12 MiB를 지원하고, version 2는 해당 계정에서 생성 가능한 export 크기 전체를 다시 받을 수 있게 infrastructure/body quota를 맞춘다.
- Legacy version 1 adapter는 image `{ id, url, alt?, role? }`와 `aiInsight.source: local-rule-mock | external-ai`를 인식한다. image `url` data URL을 v2 image로 옮기되 파생 `aiInsight`와 `aiTopics`는 가져오지 않는다. role이 없으면 `contentHtml` 참조 여부로 cover/inline을 정규화한다.
- Response `200`:

```json
{
  "importedEntryCount": 12,
  "clearedDraft": true,
  "clearedConversationCount": 4,
  "completedAt": "2026-07-16T09:10:11.123Z"
}
```

- Transaction order:
  1. 전체 payload, duplicate import-local ID, enum, HTML, image를 먼저 검증한다.
  2. image binary를 사용자에게 아직 보이지 않는 staging key로 저장하고 private image resource/HTML rewrite 계획을 만든다.
  3. imported ID는 authorization에 사용하지 않고 새 server ID로 remap하며 모든 내부 참조를 함께 rewrite한다.
  4. dataset `If-Match`를 다시 검사하고 generation fence를 닫아 진행 중 run의 후속 write를 차단한다.
  5. DB transaction에서 현재 Diary 교체, 새 image metadata 연결, draft·AI conversation/message/source/context/insight 정리, dataset revision 증가를 commit한다.
  6. commit 뒤 기존 object와 stale event buffer를 idempotent cleanup한다. upstream LLM abort와 object cleanup은 DB rollback 대상이 아니며 실패 시 retry/보상 cleanup queue로 처리한다.
  7. DB commit 전 실패하면 기존 user-visible DB state를 유지하고 staging object를 제거한다.
- 사용자의 확인 없이 자동 호출하지 않는다.
- Errors: `401`, `403 CSRF_INVALID`, `403 DATA_CONFIRMATION_INVALID`, `409 IDEMPOTENCY_CONFLICT`, `412 VERSION_CONFLICT`, `413`, `415`, `422 IMPORT_INVALID`, `428 PRECONDITION_REQUIRED`.

#### `DELETE /api/v1/diary-data`

- Headers: `X-CSRF-Token`, dataset `If-Match`, `X-Data-Confirmation-Token`.
- generation fence를 먼저 닫고 Diary, draft, image metadata, insight, conversation, message, source, context dependency, active run과 event buffer를 삭제한다. object binary는 idempotent cleanup queue로 물리 삭제한다.
- User, Google identity, current session은 유지한다. settings를 유지할지 초기화할지는 P0 기본안에서 **유지**한다.
- UI 문구는 이 동작을 `기록과 AI 대화 삭제`로 표시하고 계정 탈퇴와 혼동되는 `모든 계정 데이터 삭제`라고 부르지 않는다. settings 초기화는 별도 endpoint를 사용한다.
- Response `204`.
- Errors: `401`, `403 CSRF_INVALID`, `403 DATA_CONFIRMATION_INVALID`, `412 VERSION_CONFLICT`, `428 PRECONDITION_REQUIRED`.

## 10. SSE wire protocol

### 10.1 2단계 구조를 쓰는 이유

native `EventSource`는 URL과 credential mode만 설정할 수 있고 POST body나 임의 Authorization header를 제공하지 않는다. 따라서 message 생성과 stream 구독을 분리한다.

```text
POST /ai-conversations/{id}/messages
  -> durable user message + one AIRun
  -> 202 { runId, streamUrl }

GET /ai-runs/{runId}/events
  -> EventSource SSE subscription only
  -> reconnect해도 새 LLM run을 만들지 않음
```

Run은 EventSource 연결을 기다리지 않고 시작할 수 있으며 첫 event부터 buffer에 기록한다. 늦게 연결한 client는 보관 범위 안의 sequence 1부터 replay받는다.

### 10.2 event 공통 envelope

모든 replayable run event의 `data`는 한 줄 JSON이며 `version`, `runId`, `sequence`, `requestId`를 포함한다. `stream.resync-required`는 replay 대상이 아닌 control event라 `id`와 `sequence` 없이 `version`, `runId`, `requestId`, `reason`만 가진다.

```text
retry: 3000

id: <run-id>:1
event: run.started
data: {"version":1,"runId":"...","sequence":1,"requestId":"req_..."}

id: <run-id>:2
event: message.delta
data: {"version":1,"runId":"...","sequence":2,"requestId":"req_...","index":0,"delta":"기록상으로는"}

id: <run-id>:3
event: run.completed
data: {"version":1,"runId":"...","sequence":3,"requestId":"req_...","message":{},"suggestedQuestions":[],"resultKind":"answer"}

```

Event type:

| Event | Data 추가 field | 의미 |
| --- | --- | --- |
| `run.started` | 없음 | local LLM generation 시작 |
| `message.delta` | `index`, `delta` | 누적 본문이 아닌 새 delta; pending UI key는 run ID |
| `run.completed` | `message`, `suggestedQuestions`, `resultKind` | source 검증·저장까지 완료 |
| `run.failed` | `code`, `message`, `retryable` | 안전하게 정규화한 terminal 실패 |
| `run.cancelled` | 없음 | terminal 취소 |
| `stream.resync-required` | `reason` | replay 만료로 partial 표시를 버리고 REST 상태 조회 필요 |

- `resultKind`: `answer | no-results`.
- `isPersonalizedQuestionsEnabled=false`면 `suggestedQuestions`는 source/context에서 생성하지 않고 고정된 일반 질문만 반환한다.
- application event 이름을 `error`로 짓지 않는다. 브라우저 `EventSource.onerror` transport signal과 구분한다.
- `run.completed`, `run.failed`, `run.cancelled` 중 정확히 하나만 발생한다.
- 첫 `message.delta`가 발행된 뒤에는 backend가 새 upstream generation을 자동 재시도하지 않는다. 첫 delta 전 retry도 실제 upstream의 idempotency·timeout 계약이 확인된 경우에만 허용한다.
- source는 검증 완료된 `run.completed.message.sources`에만 포함한다. 미검증 중간 source를 stream하지 않는다.
- Markdown은 text delta일 뿐이며 React가 allow-list renderer로 안전하게 렌더링한다. raw HTML 실행을 허용하지 않는다.

`run.failed.code` 공개 값은 `AI_SOURCE_LOAD_FAILED`, `AI_SERVICE_UNAVAILABLE`, `AI_TIMEOUT`, `AI_OUTPUT_INVALID`, `AI_PERSISTENCE_FAILED`, `AI_INTERNAL_ERROR`로 제한한다. upstream 원문 오류를 그대로 사용하지 않는다.

### 10.3 재연결과 event 보관

- 각 replayable event는 run 내 단조 증가 `sequence`와 안정적인 `id`를 가진다.
- 서버는 `Last-Event-ID` 다음 event부터 순서대로 replay한다.
- 클라이언트는 event ID로 중복 적용을 막는다.
- page reload 시 마지막 ID를 보존했다면 `?after=`로 전달한다.
- 권장 초기 보관 계약은 terminal 후 10분이다. 실제 메모리·Redis 용량 검증 뒤 확정한다.
- replay 범위가 만료되면 새 LLM run을 만들지 않고 `stream.resync-required`를 보낸다. 클라이언트는 `GET /ai-runs/{id}`와 message 목록으로 재동기화한다.

Native EventSource transport 오류 복구는 다음 하나의 알고리즘으로 고정한다.

1. `onerror`에서 HTTP status를 추정하지 않고 현재 EventSource를 명시적으로 닫는다.
2. `GET /auth/session`으로 인증 만료를 확인한다.
3. 인증이 유효하면 `GET /ai-runs/{runId}`로 현재 상태를 조회한다.
4. terminal이면 message 목록을 다시 읽는다.
5. active이면 마지막 적용 event ID를 `after`로 넣고 backoff 후 새 EventSource를 연다.
6. 반복 실패 한도를 넘으면 network recovery UI를 표시하되 message POST를 다시 호출하지 않는다.

### 10.4 heartbeat와 연결 수명

```text
: heartbeat

```

- 약 15초마다 comment heartbeat를 flush한다.
- heartbeat에는 `id`를 붙이지 않는다.
- heartbeat 누락 하나만으로 run을 실패 처리하지 않는다.
- heartbeat와 delta 전송은 session의 idle TTL을 갱신하지 않는다.
- HTTP/1.1 브라우저 connection 제한을 고려하고 가능하면 HTTP/2를 사용한다.
- 사용자당 active stream/run 한도는 local LLM capacity test 뒤 확정하되, conversation당 active run은 1개로 고정한다.

### 10.5 저장과 오류 의미

1. user message와 run이 DB에 commit되지 않으면 `202`를 반환하지 않는다.
2. delta는 임시 event buffer에만 둔다.
3. assistant 최종 content, source allow-list, excerpt를 검증한다.
4. assistant message와 source를 transaction으로 저장한다.
5. 저장 성공 후에만 `run.completed`를 보낸다.
6. 저장 실패 시 user message는 유지하고 `run.failed`를 보낸다.
7. stream header 전 오류는 Problem Details HTTP response, header 후 오류는 safe terminal event다.
8. cancel/completion은 run 상태의 조건부 원자 update로 경쟁한다. 이긴 terminal 상태 하나만 event를 발행한다.
9. 모든 chunk 저장·전송과 final commit 직전에 session 전달 권한, run active 상태, context privacy revision을 확인한다. cancel·logout·lock 이후 도착한 upstream chunk/result는 폐기한다.

## 11. Local LLM 내부 연동 경계

### 11.1 내부 port

아래는 Moodi 내부 계약이며 upstream DTO가 아니다.

```ts
interface LocalLlmGateway {
  streamChat(
    request: LocalLlmChatRequest,
    signal: AbortSignal,
  ): AsyncIterable<LocalLlmChunk>

  analyzeDiaryEntry?(
    request: LocalLlmDiaryAnalysisRequest,
    signal: AbortSignal,
  ): Promise<LocalLlmDiaryAnalysisResult>
}
```

구현 class는 현재 미구현 상태로 둔다.

```ts
class ExistingLocalLlmClient implements LocalLlmGateway {
  async *streamChat(): AsyncIterable<LocalLlmChunk> {
    // TODO(외부 계약 대기): upstream endpoint, auth, request/response DTO,
    // streaming framing, connect/first-token/total timeout, cancel, retry,
    // model identifier, error mapping, health check를 실제 LLM 계약으로 확정한다.
    throw new Error('Local LLM upstream contract is not configured')
  }
}
```

문서 예시나 개발 fixture를 실제 upstream 응답처럼 표시하지 않는다.

### 11.2 backend retrieval 책임

Local LLM이 임의로 DB를 조회하거나 사용자 ID를 신뢰하게 하지 않는다.

```text
authenticated user + question
  -> backend date/mood/tag/text retrieval
  -> owner와 isLocked 재검증
  -> bounded context + 모든 context entry/revision dependency 저장
  -> LocalLlmGateway
  -> generated answer + attribution metadata(실제 upstream이 지원하는 경우)
  -> server context allow-list와 원문 substring 재검증
  -> durable assistant message + sources
```

- 후보는 현재 사용자 `userId` 조건을 DB query 자체에 포함한다.
- `isLocked=true`, deleted, seed/demo entry를 제외한다.
- LLM에 전달하는 source ID는 opaque alias로 바꿀 수 있다.
- Diary 원문은 신뢰하지 않는 data 영역으로 명확히 구분하고, 원문 안의 지시를 system/developer instruction으로 실행하지 않는다. P0 local LLM에는 DB·filesystem·network tool 권한을 주지 않는다.
- LLM이 반환한 임의 entry ID는 source로 저장하지 않는다.
- source excerpt는 server가 원문에서 다시 만든다.
- upstream attribution 계약이 확인되기 전에는 모델에 전달한 모든 context entry를 잠재적으로 사용된 source로 취급한다. 실제로 검증 가능한 citation metadata 계약이 확인된 뒤에만 표시 source를 더 좁힌다.
- 사용자에게 표시하는 cited source와 별도로 모델에 전달한 **모든** entry ID/revision을 privacy dependency로 저장한다. 수정·잠금·삭제 redaction은 cited source가 아니라 전체 dependency를 기준으로 한다.
- 대화 history를 prompt에 포함할 때 redacted message는 제외한다. 과거 assistant content를 포함하면 그 message의 context dependency를 현재 run에도 합쳐 transitive privacy dependency를 보존한다.
- 검색 결과가 없으면 LLM에게 사건을 추정시키지 않고 `no-results` 결과를 반환한다.
- 의료·정신 건강 진단이나 치료 판단을 생성하지 않도록 system policy와 output validation을 둔다.

### 11.3 TODO(외부 계약 대기)

| 항목 | 확인해야 할 실제 계약 |
| --- | --- |
| Endpoint | base URL, chat path, analysis path, health path |
| Transport | HTTP/1.1, HTTP/2, WebSocket 등 |
| Auth | network ACL, API key, mTLS, service identity |
| Request | model, messages, system prompt, context, generation options field |
| Response | delta framing, final marker, usage, finish reason, error body |
| Model | model identifier, context window, tokenizer, max output |
| Timeout | connect, first token, idle chunk, total generation |
| Cancel | client disconnect, abort request 또는 별도 cancel method |
| Retry | 첫 token 전 재시도 가능 조건, 횟수, backoff; 첫 token 후 자동 재시도 금지 여부 |
| Capacity | 동시 request, queue 길이, GPU/CPU saturation 신호 |
| Failure mapping | timeout, overload, invalid request, model crash, malformed chunk |
| Health | liveness와 readiness 의미, warm-up 상태 |
| Privacy | prompt/log 보존 여부, 외부 egress 여부, crash dump 원문 포함 여부 |

이 표가 실제 운영자에게 확인되기 전 `ExistingLocalLlmClient` 본문을 완료하지 않는다.

## 12. 제안 논리 DB 모델

DB 제품과 migration 도구는 미정이다. 아래는 relational storage를 기준으로 한 논리 모델이며 persistence entity를 API DTO로 직접 노출하지 않는다.

### 12.1 인증

#### `users`

- `id` UUID PK
- `email` normalized nullable string; `active`일 때 required, 삭제 tombstone에서는 `null`
- `display_name` nullable string; `active`일 때 required, 삭제 tombstone에서는 `null`
- `status` enum `active | deleting | deleted`, required
- `joined_at`, `last_login_at`, `created_at`, `updated_at` timestamp
- index: `status`, `last_login_at`
- 삭제 완료 뒤 row를 hard delete하거나 비식별 `deleted` tombstone만 유지한다. 어느 경우에도 email/display name을 남기지 않으며 backup purge SLA는 운영 정책으로 확정한다.

#### `auth_identities`

- `id` UUID PK
- `user_id` FK `users`, required, delete cascade
- `provider` enum, P0 값 `google`
- `provider_subject` string, required
- `email_snapshot` string, optional audit/display snapshot
- `created_at`, `last_verified_at`, `revoked_at`
- unique: `(provider, provider_subject)`
- Google 연결 key는 email이 아니라 `provider_subject = sub`

#### `sessions`

- `id` UUID PK
- `user_id` FK, required, delete cascade
- `token_hash` bytes/string, required, unique
- `csrf_nonce` high-entropy bytes/string, required. 원문 CSRF token이 아니라 server HMAC 입력이다.
- `created_at`, `authenticated_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`
- optional security metadata: coarse user-agent hash, IP prefix. 개인정보 최소화 필요
- expired/revoked session cleanup index: `idle_expires_at`, `absolute_expires_at`

#### `idempotency_records`

- `id` UUID PK, `user_id` FK required
- `scope` required: HTTP method + canonical path template
- `idempotency_key` required, `request_hash` required
- `response_status`, nullable `resource_type`, `resource_id`, 최소 replay response metadata
- `created_at`, `expires_at`
- unique `(user_id, scope, idempotency_key)`
- request body 원문, diary content, prompt, image bytes는 저장하지 않는다. response replay가 민감 field를 필요로 하면 기존 resource를 owner scope로 다시 읽어 DTO를 구성한다.
- AI run의 idempotency key는 이 공통 record와 연결하며 별도의 모순된 source of truth를 만들지 않는다.

### 12.2 Diary

#### `user_data_versions`

- `user_id` PK/FK
- `diary_revision` positive integer required
- Diary create/update/delete/import/bulk delete transaction에서 증가한다.
- `HEAD/GET /diary-data` ETag와 destructive mutation의 `If-Match` source of truth다.

#### `user_settings`

- `user_id` PK/FK
- canonical settings enum/boolean columns
- `created_at`, `updated_at`
- delete cascade; API default값과 DB default를 동일하게 유지

#### `diary_entries`

- `id` UUID PK, `user_id` FK required
- `entry_type` enum `journal | quick`
- `title`, `content_plain`, `content_html`, `short_note` nullable text
- `diary_date` date required
- `mood` nullable enum, `energy` nullable integer check 1..5
- `activities`와 `tags`는 normalized child table 또는 DB array/JSON 중 구현 DB에 맞게 선택
- `weather_condition`, `weather_temperature`, `location_name` nullable
- `is_favorite`, `is_locked` boolean required default false
- `revision` positive integer required
- `created_at`, `updated_at`
- index: `(user_id, diary_date desc, updated_at desc)`, `(user_id, is_favorite)`, `(user_id, updated_at desc)`
- full-text index는 DB 선택 뒤 확정
- 다른 사용자의 row와 ID가 섞이지 않게 모든 query에 owner scope 적용

#### `diary_entry_tags`, `diary_entry_activities`, `diary_entry_ai_topics`

- 각각 `entry_id`, normalized value
- PK/unique로 entry 내부 중복 방지
- tag와 ai_topic은 별도 table/column으로 유지

#### `diary_images`

- `id` UUID PK, `user_id` FK required
- `entry_id` nullable FK, `draft_id` nullable FK
- `storage_key` required unique; public URL 저장 금지
- `mime_type`, `byte_size`, `checksum`, `width`, `height`
- `role` enum `cover | inline`, `alt`, `position`
- `status` enum `pending | attached | deleted`
- `pending_expires_at`, `created_at`, `deleted_at`
- owner + status/expiry cleanup index

#### `diary_drafts`

- `id` UUID PK, `user_id` FK unique required
- optional `entry_id` FK
- Diary write field와 별도 `revision`, `saved_at`
- 사용자당 하나라는 unique constraint를 DB에서 보장

#### `diary_ai_insights`

- `id` UUID PK, `entry_id` FK required, `user_id` FK required
- `entry_revision` required: 어떤 원문 revision을 분석했는지 표시
- `status` enum
- summary와 emotions/topics/patterns/questions/related IDs는 persistence model로 저장
- `generator` enum P0 `local_llm`
- `created_at`, `started_at`, `generated_at`, `failed_at`
- entry가 수정되면 이전 insight를 stale 처리하고 API에서 최신 원문 분석처럼 반환하지 않는다.

#### `diary_ai_insight_context_entries`

- `insight_id`, `entry_id`, `entry_revision`
- insight 생성에 전달한 현재 entry와 관련 entry의 전체 privacy dependency다.
- dependency가 수정·잠금·삭제되면 insight text와 관련 snapshot을 purge하고 stale/failed 상태로 전환한다.

### 12.3 AI conversation

#### `ai_conversations`

- `id` UUID PK, `user_id` FK required
- `title` required, max 80
- `created_at`, `updated_at`
- index `(user_id, updated_at desc)`

#### `ai_messages`

- `id` UUID PK, `conversation_id` FK required
- `sequence` integer required, unique `(conversation_id, sequence)`
- `role` enum `user | assistant`
- `status` enum `completed | redacted`
- `content` nullable text
- `generator` nullable enum `local_llm`
- `redaction_reason` nullable enum `source_updated | source_unavailable`
- `created_at`
- conversation delete cascade

#### `ai_message_sources`

- `id` UUID PK, `message_id` FK, `entry_id` FK
- `entry_updated_at` snapshot
- `diary_date`, `title`, `excerpt`, `mood` snapshot
- unique `(message_id, entry_id)`
- entry delete/lock/update는 application transaction에서 source와 assistant redaction을 함께 처리

#### `ai_run_context_entries`, `ai_message_context_entries`

- `run_id` 또는 `message_id`, `entry_id`, `entry_revision`
- 모델에 전달된 모든 Diary context의 privacy dependency이며 사용자에게 표시하는 citation과 분리한다.
- active run에서는 `ai_run_context_entries`, completed message에서는 `ai_message_context_entries`로 보존한다.
- entry 수정·잠금·삭제 시 dependency가 있는 assistant content를 DB에서 `null`로 purge하고 `status=redacted`, `redaction_reason`을 설정하며 source snapshot과 replay buffer도 즉시 제거한다.
- context 원문이나 excerpt를 이 relation에 중복 저장하지 않는다.

#### `ai_runs`

- `id` UUID PK, `user_id`, `conversation_id`, `user_message_id`
- nullable `assistant_message_id`
- `status` enum `queued | running | completed | failed | cancelled`
- optional `idempotency_record_id` FK. key/hash의 canonical 소유자는 `idempotency_records`
- safe `failure_code`, `retryable`; upstream raw error 저장 금지
- `created_at`, `started_at`, `completed_at`
- partial unique constraint 또는 application lock으로 conversation당 active run 하나 보장

#### SSE event buffer

- 장기 DB 보존이 기본 요구는 아니다.
- Redis stream, bounded in-memory buffer 또는 별도 event table 중 배포 구조에 맞게 선택한다.
- 최소 field: `run_id`, `sequence`, `event_type`, `data`, `created_at`, `expires_at`.
- terminal 후 초기 권장 10분 보존과 `Last-Event-ID` replay를 보장해야 한다.
- owner/run scope ACL, run당 최대 byte/event 수, hard TTL을 둔다. persistence 가능한 store라면 at-rest 보호를 적용하고 일반 backup에서 제외한다.
- lock, delete, redaction, account delete와 session privacy event는 TTL을 기다리지 않고 민감한 delta/completed event를 즉시 purge한다. 필요한 경우 비민감한 `run.cancelled` 또는 `stream.resync-required`만 남긴다.

### 12.4 Audit

#### `audit_events`

- `id`, nullable `user_id`, `event_type`, `target_type`, `target_id`, safe metadata, `created_at`
- 대상: login success/failure category, logout, data import/export, bulk delete, account delete
- diary 원문, prompt, message content, session token, Google credential, LLM delta를 저장하지 않는다.
- 보존 기간과 운영자 접근 권한은 배포 전 확정한다.
- 계정 삭제 시 audit가 정책상 남아야 한다면 `user_id`와 target ID를 즉시 비가역 de-identify한다. 그렇지 않으면 함께 삭제한다.

## 13. 보안·개인정보 요구사항

### 13.1 인증과 접근 제어

- 모든 repository method는 `userId`를 필수 scope로 받는다.
- controller에서 ID를 조회한 뒤 나중에 owner를 비교하는 방식보다 owner 조건을 query 자체에 포함한다.
- Google ID token은 공식 library로 서명, `iss`, `aud`, `exp`, optional nonce를 검증한다.
- Google `sub`를 immutable external key로 사용한다.
- session, Google credential, CSRF secret을 로그에 남기지 않는다.
- mutation에는 session cookie와 별도 CSRF 검증을 함께 적용한다.
- CORS를 넓게 허용하지 않는다. same-origin을 기본으로 하고 필요한 exact origin만 allow-list한다.

### 13.2 Diary와 rich text

- `contentHtml`은 신뢰하지 않고 server allow-list sanitizer를 거친다.
- script, inline event handler, `javascript:` URL, unsafe iframe/object/embed를 제거한다.
- 저장된 image `src`는 현재 사용자가 소유한 `/api/v1/diary-images/{id}/content`로 정규화하고 임의 외부 tracking URL을 허용하지 않는다.
- plain content와 HTML을 각각 저장하되 검색·LLM context에는 검증된 plain text만 사용한다.
- 이미지 MIME은 header만 보지 않고 decode와 magic bytes를 검사한다.
- object storage key는 추측하기 어려워도 authorization 대체 수단이 아니다.

### 13.3 잠금과 AI

- `isLocked`는 P0에서 암호화 잠금이 아니라 **AI 제외 및 UI privacy metadata**다.
- 인증된 owner의 일반 Diary 상세 권한과 `isLocked`를 혼동하지 않는다.
- 잠긴 entry는 자동 AI insight, chat retrieval, embedding/index, cache, source에 포함하지 않는다.
- false→true 전환 시 관련 AI retrieval/embedding index와 AI context cache를 제거하고, cited source 여부와 무관하게 privacy dependency가 있는 과거 assistant 답변을 redaction한다.
- true→false로 바뀌어도 과거 답변에 자동 재삽입하지 않는다. 새 질문·분석에서만 사용한다.

### 13.4 Local LLM privacy

- local LLM과 backend 사이 network egress 정책을 문서화한다.
- prompt/context/delta를 일반 request log, APM span, error tracker breadcrumb에 기록하지 않는다.
- 운영 debug logging은 기본 off이며 필요한 경우 명시적 제한·마스킹·짧은 보존을 둔다.
- LLM crash dump, tracing, model server access log가 원문을 포함하는지 확인한다.
- source에 사용한 entry IDs와 최소 운영 metadata만 구조화해 측정한다.

### 13.5 삭제와 보존

- production DB, object storage, event buffer와 backup은 at-rest encryption과 최소 권한 service identity를 사용한다.
- Diary 삭제 시 DB row, image, AI retrieval index/cache, AI source, context dependency와 노출 가능한 assistant content를 함께 정리한다.
- redaction은 response에서만 숨기는 동작이 아니다. assistant content와 source title/excerpt/mood를 durable store에서 purge하고 관련 SSE replay event도 즉시 제거한다.
- 계정 삭제 시 active session과 AI run을 먼저 폐기한다.
- backup에서의 최종 purge SLA, audit 보존, orphan image TTL, SSE event TTL을 운영 전 확정한다.
- 이미 사용자 기기에 내려받은 export 파일은 backend가 삭제할 수 없음을 개인정보 안내에 명시한다.

## 14. 기존 프런트엔드에서의 마이그레이션

### 14.1 현재와 목표 adapter

```text
현재
DiaryRepository -> LocalStorageDiaryRepository
JournalAIService -> LocalJournalAIService
ConversationRepository -> LocalStorageConversationRepository
Auth -> authMockService

목표
DiaryRepository -> HttpDiaryRepository
JournalAIService -> SseJournalAIService
ConversationRepository -> HttpConversationRepository
Auth -> GoogleSessionService
```

UI component는 위 adapter 교체 때문에 HTTP 세부사항을 알지 않아야 한다.

### 14.2 1회 데이터 이전

1. 로그인 전 기존 localStorage Diary가 있는지 client application 계층에서 검사한다.
2. Google 로그인 뒤 서버 데이터와 로컬 데이터의 개수·최근 수정 시각을 비교해 사용자에게 이전 방식을 설명한다.
3. 사용자의 명시적 확인 직후 `HEAD /api/v1/diary-data`로 dataset revision과 confirmation token을 받고 `PUT /api/v1/diary-data`를 호출한다.
4. seed/demo ID는 사용자 데이터로 업로드하거나 LLM context에 넣지 않는다.
5. import 성공 뒤 서버에서 entry count와 표본 detail을 재조회해 검증한다.
6. 검증 전 localStorage를 삭제하지 않는다.
7. 삭제 여부를 사용자에게 알리고, 실패하면 다시 시도할 수 있게 idempotency key를 유지한다.
8. 자동 병합은 P0에서 하지 않는다. `replace` 의미를 명확히 표시한다.

### 14.3 프런트 변경이 필요한 계약

- 기존 email/password mock form을 GIS button과 session bootstrap으로 교체한다.
- `AuthUser`는 session response의 `UserDto`로 mapping한다.
- entry 목록은 full list가 아니라 cursor page와 summary를 사용한다.
- 캘린더·회고·태그는 서버 집계 endpoint를 사용한다.
- image Data URL을 먼저 upload하고 반환된 image ID를 draft/entry에 연결한다.
- 현재 `local-search | external-ai` adapter enum은 API view model과 분리하고 `local-llm`을 정확히 표현한다.
- 대화 metadata와 paginated message response를 application 계층에서 조합해 기존 화면 view model을 만든다. HTTP conversation summary를 messages 포함 기존 `AIConversation` domain model로 직접 사용하지 않는다.
- redacted assistant의 nullable content를 별도 discriminated API/view model로 처리하고 기존 `content: string` 타입에 강제 대입하지 않는다.
- AI message POST 후 반환된 `streamUrl`로 EventSource를 연다.
- terminal SSE event, `EventSource.onerror`, session 만료, cancel을 서로 다른 상태로 처리한다.
- 설정의 “백엔드나 외부 AI로 전송하지 않는다”라는 현재 안내는 더 이상 사실이 아니므로, Moodi backend와 local LLM 처리 범위·보존·삭제 정책으로 수정한다.

## 15. 운영과 관측성

### 15.1 내부 health

배포용 endpoint는 public product API와 분리한다.

- `/health/live`: process liveness만 확인.
- `/health/ready`: DB와 필수 session store 준비 상태 확인.
- Local LLM 장애가 Diary API 전체 readiness를 실패시키지는 않는다. AI dependency 상태는 별도 readiness component/metric으로 노출하고 AI endpoint만 503으로 degrade한다.
- health endpoint는 local LLM URL, model path, secret, DB 연결 문자열을 반환하지 않는다.

### 15.2 로그와 metric

필수 구조화 metadata:

- `requestId`, authenticated internal `userId`의 비가역 운영 식별값
- endpoint, status, latency, response bytes
- run ID, run status, queue wait, first-token latency, total latency
- SSE active connection, reconnect, replay, cancel, terminal event count
- local LLM safe failure category와 saturation
- Diary mutation revision conflict와 import transaction 결과

금지:

- Google credential/ID token
- session/cookie/CSRF token
- diary title/content/HTML/short note
- AI question, prompt, source excerpt, delta, completed answer
- local LLM raw error body

### 15.3 rate limit과 backpressure

- login attempt와 credential 검증은 IP+attempt 기준 제한.
- AI는 사용자별 active run, queue 길이, request rate를 제한한다.
- conversation당 active run은 1개다.
- overload는 run을 받은 뒤 무한 queue하지 말고 stream 시작 전에 `429` 또는 `503`으로 명확히 거절한다.
- 정확한 숫자는 local LLM capacity/load test 결과로 확정한다.

## 16. 테스트와 수용 기준

### 16.1 인증

- 위조·만료·잘못된 `aud`/`iss`/nonce의 Google token이 거절된다.
- `g_csrf_token` cookie/body 불일치가 거절된다.
- 동일 login attempt 재사용이 거절된다.
- login 시 session fixation이 불가능하고 logout 뒤 session 재사용이 불가능하다.
- Google ID/access/refresh token이 localStorage, log, URL에 남지 않는다.
- CSRF token을 받은 여러 탭이 session rotation 전 정상 mutation하고, rotation 뒤에는 새 token을 재조회한다.
- P0에서 One Tap/auto-select 또는 `state` 없는 credential 제출은 허용하지 않는다.

### 16.2 authorization과 Diary

- 두 사용자로 모든 resource에 IDOR 테스트를 수행한다.
- list/detail/update/delete/image/content/SSE 모두 owner scope를 검사한다.
- Diary revision 충돌에서 늦은 저장이 최신 내용을 덮지 않는다.
- journal/quick validation, enum, 날짜, energy, image count/size가 client와 server에서 일치한다.
- HTML sanitizer가 script, handler, unsafe URL을 제거한다.
- import는 전체 실패 시 기존 데이터를 그대로 유지한다.

### 16.3 AI와 SSE

- message POST 재시도가 같은 idempotency key에서 user message/run을 중복 생성하지 않는다.
- SSE reconnect는 새 local LLM 요청을 만들지 않는다.
- event sequence가 증가하고 `Last-Event-ID` 뒤 event만 replay한다.
- 각 run이 terminal event 하나로만 끝난다.
- 약 15초 heartbeat가 proxy를 통과해 실제 flush된다.
- cancel API가 가능한 경우 local LLM abort까지 전파된다.
- 첫 token 후 transport 오류를 자동으로 새 생성으로 재시도하지 않는다.
- user message는 남고 incomplete assistant message는 확정되지 않는다.
- 잠금·삭제 entry가 context/source에 들어가지 않는다.
- source ID는 retrieval allow-list 안에 있고 excerpt는 실제 원문의 substring이다.
- source 수정·삭제·잠금 뒤 과거 assistant content가 redaction된다.
- citation에는 없지만 모델 context에 포함된 entry를 수정·잠금·삭제해도 해당 assistant content와 replay event가 redaction/purge된다.
- 다른 탭에서 logout한 직후 기존 stream에 추가 delta가 전달되지 않는다.
- cancel/completion 경합에서 DB terminal 상태와 terminal event가 정확히 하나다.
- 다른 run의 `Last-Event-ID`, 미래 sequence, 지나치게 긴 cursor가 거절되고 데이터가 섞이지 않는다.
- browser network trace에 local LLM host 요청이 하나도 없다.

### 16.4 부하·복구

- HTTP/2 또는 실제 운영 proxy에서 동시 EventSource 연결 수를 검증한다.
- backend restart, event buffer restart, LLM timeout, DB final-save 실패 시 복구 의미를 검증한다.
- replay 보관 만료 후 `GET /ai-runs/{id}`와 message 목록으로 일관되게 복구한다.
- local LLM 장애 중에도 인증·Diary·settings API는 정상 동작한다.

## 17. 구현 순서

### Phase 0 — 계약 확정

1. backend language/framework, relational DB, object storage, session store 결정.
2. production origin, Google Web Client ID, GIS login URI 등록.
3. Local LLM 운영자에게 11.3 TODO 계약 수집.
4. session TTL, content 길이, retention, deletion SLA 확정.
5. OpenAPI와 migration ownership 결정.

### Phase 1 — 인증과 데이터 기반

1. User/AuthIdentity/Session/Settings schema와 migration.
2. GIS token verification과 session/CSRF.
3. Diary CRUD/draft/image와 owner-scoped repository.
4. import/export/delete transaction.
5. React HTTP repository와 1회 migration UI.

### Phase 2 — AI persistence와 SSE

1. Conversation/Message/Source/Run schema.
2. message POST와 EventSource GET 분리.
3. event buffer, replay, heartbeat, active-session stream registry, cancellation fence, idempotency.
4. LocalLlmGateway 미구현 adapter 경계와 safe error mapping.
5. 실제 upstream 계약이 확인된 뒤에만 client 본문 구현.

### Phase 3 — retrieval와 source 안전성

1. owner/lock-aware Diary retrieval.
2. bounded context 구성과 source alias.
3. 전체 context dependency 저장, output/source validation과 stale/unavailable durable purge/redaction.
4. 캘린더·회고·facet 집계.
5. entry AI insight 비동기화.

### Phase 4 — 운영 검증

1. proxy buffering/HTTP2/SSE load test.
2. auth/IDOR/CSRF/security test.
3. LLM capacity와 timeout/rate limit 조정.
4. privacy 문구, retention, deletion runbook 확정.
5. 실제 구현에 맞춰 root `docs/`의 API, DB, architecture 문서를 갱신.

## 18. 구현 전 최종 TODO 체크리스트

- [ ] backend stack과 배포 topology
- [ ] React와 API의 exact production origin
- [ ] Google Web Client ID, allowed origin, GIS login URI
- [ ] login attempt와 nonce 저장 방식
- [ ] session idle/absolute TTL과 rotation 주기
- [ ] CSRF token 발급·회전 방식
- [ ] idempotency record와 data confirmation token 보존 시간
- [ ] content/title/tag 확정 길이 제한
- [ ] 허용 TipTap HTML tag/attribute schema
- [ ] 이미지 MIME, byte, dimension, orphan TTL
- [ ] DB와 object storage backup/purge SLA
- [ ] Local LLM base URL과 endpoint
- [ ] Local LLM auth/network ACL
- [ ] Local LLM request/response/stream framing
- [ ] model/context/output limit
- [ ] connect/first-token/idle/total timeout
- [ ] upstream cancel과 health method
- [ ] first-token 전 retry와 overload mapping
- [ ] AI event buffer 구현과 terminal 보관 시간
- [ ] run당 event buffer 최대 byte/event 수와 persistence/backup 정책
- [ ] 사용자별 AI concurrency/rate limit
- [ ] subscriber 부재 grace time과 자동 cancel 정책
- [ ] retrieval 방식과 context budget
- [ ] entry 자동 insight의 polling/UI 상태
- [ ] guest local mode 종료 여부와 최초 로그인 gate
- [ ] 개인정보 처리 안내와 계정 삭제 SLA

## 19. 근거 문서

### 저장소 내부

- [기존 모바일·AI 제품 목표](./goal-mobile-ai.md)
- [기존 전면 재설계 목표](./goal.md)
- [현재 API 상태](../../docs/api/specification.md)
- [현재 DB 상태](../../docs/database/schema.md)
- [현재 아키텍처](../../docs/architecture/architecture.md)
- [현재 상태 계약](../../docs/architecture/state.md)
- [현재 기능 흐름](../../docs/architecture/flow.md)

### 공식 외부 문서

- [Google Identity Services 통합](https://developers.google.com/identity/gsi/web/guides/integrate)
- [Google ID token 서버 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google Identity Services JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
- [Google Identity Services HTML API와 direct POST](https://developers.google.com/identity/gsi/web/reference/html-reference)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
