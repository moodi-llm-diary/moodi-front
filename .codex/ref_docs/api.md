# Moodi API 명세

## 1. 계약 상태

이 문서는 현재 구현 대상으로 채택한 P0 제품 API 33개와 운영 health API 2개의 wire contract다. `endpoints.md`의 현재 endpoint set과 동일하다. P1 4개는 문서 끝의 비활성 단계에만 기록하며 현재 route가 아니다.

## 2. 공통 wire 규칙

| 항목 | 계약 |
| --- | --- |
| Product prefix | `/api/v1` |
| JSON | `application/json`, field는 `camelCase` |
| 오류 | RFC 9457 `application/problem+json` |
| ID | opaque UUID string; 필수·non-null unless stated |
| Timestamp | UTC ISO 8601 string, 예: `2026-07-16T09:10:11.123Z` |
| Diary date/month | `YYYY-MM-DD` / `YYYY-MM` |
| Nullable | 값이 없으면 field를 생략하지 않고 명시적 `null`; collection은 `[]` |
| PATCH | omitted는 유지, nullable field의 `null`은 제거 |
| Pagination | opaque cursor; 기본 30, 최대 100 unless stated |
| Private response | `Cache-Control: private, no-store` |
| Request correlation | 모든 response `X-Request-Id`; problem body `requestId`와 동일 |

### 2.1 Session과 CSRF

- session cookie: `__Host-moodi_session=<opaque>`; `Secure; HttpOnly; SameSite=Lax; Path=/`; `Domain` 없음.
- 권장 초기 expiry는 idle 7일, absolute 30일이며 배포 설정과 테스트를 함께 바꾼다.
- `POST`, `PUT`, `PATCH`, `DELETE`는 `X-CSRF-Token`을 요구한다. 예외인 GIS redirect POST는 `g_csrf_token` cookie/body double-submit을 사용한다.
- 세션 없음은 `401 AUTH_REQUIRED`, 만료는 `401 SESSION_EXPIRED`, 실제 권한 부족은 `403 FORBIDDEN`이다. 다른 사용자의 resource는 `404 RESOURCE_NOT_FOUND`다.

### 2.2 Idempotency와 revision

- `Idempotency-Key`는 1~128자 opaque ASCII다. P0 적용: entry/image/conversation/message POST와 diary-data PUT.
- 같은 user+method+canonical path+key+body는 최초 resource/status를 재구성한다. body가 다르면 `409 IDEMPOTENCY_CONFLICT`다.
- Entry와 Draft는 response `ETag`를 가진다. 기존 resource 수정/삭제는 `If-Match`가 필수다. 누락 `428 PRECONDITION_REQUIRED`, 불일치 `412 VERSION_CONFLICT`다.
- 파괴적 Diary data mutation은 `HEAD /diary-data`의 dataset `ETag`와 1회 `X-Data-Confirmation-Token`을 함께 요구한다.

### 2.3 Problem Details

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `type` | URI string | yes | no | 영속적인 problem type |
| `title` | string | yes | no | 사용자 안전 요약 |
| `status` | integer | yes | no | HTTP status |
| `detail` | string | yes | no | 원문/secret 없는 설명 |
| `instance` | path string | yes | no | 요청 path |
| `code` | string | yes | no | 아래 공개 code |
| `requestId` | string | yes | no | `X-Request-Id`와 동일 |
| `errors` | array of field error | no | no | validation 실패일 때; 없으면 생략 |
| `errors[].field` | string | yes | no | JSON/query/header field path |
| `errors[].code` | string | yes | no | 안전한 validation 분류 |
| `errors[].message` | string | yes | no | 사용자 안전 설명 |

공통 code: `MALFORMED_REQUEST(400)`, `AUTH_REQUIRED(401)`, `SESSION_EXPIRED(401)`, `CSRF_INVALID(403)`, `DATA_CONFIRMATION_INVALID(403)`, `RECENT_AUTH_REQUIRED(403)`, `FORBIDDEN(403)`, `RESOURCE_NOT_FOUND(404)`, `IDEMPOTENCY_CONFLICT(409)`, `AI_RUN_ACTIVE(409)`, `VERSION_CONFLICT(412)`, `PAYLOAD_TOO_LARGE(413)`, `UNSUPPORTED_MEDIA_TYPE(415)`, `VALIDATION_FAILED(422)`, `PRECONDITION_REQUIRED(428)`, `RATE_LIMITED(429)`, `AI_SERVICE_UNAVAILABLE(503)`, `INTERNAL_ERROR(500)`.

## 3. 공통 enum과 DTO

### 3.1 Enum

| Type | 허용 값 |
| --- | --- |
| `EntryType` | `journal`, `quick` |
| `Mood` | `happy`, `calm`, `excited`, `neutral`, `tired`, `anxious`, `frustrated`, `sad`, `angry` |
| `Activity` | `work`, `people`, `exercise`, `study`, `walk`, `rest`, `music`, `meal`, `self-care` |
| `ImageRole` | `cover`, `inline` |
| `FontSize` | `small`, `medium`, `large` |
| `AiTone` | `kind-friend`, `calm-guide`, `analytical-observer`, `minimal-feedback` |
| `AiResponseLength` | `brief`, `balanced`, `detailed` |
| `RunStatus` | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `RunFailureCode` | `AI_SOURCE_LOAD_FAILED`, `AI_SERVICE_UNAVAILABLE`, `AI_TIMEOUT`, `AI_OUTPUT_INVALID`, `AI_PERSISTENCE_FAILED`, `AI_INTERNAL_ERROR` |

### 3.2 User/Session DTO

| DTO.field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `UserDto.id` | ID string | yes | no | 내부 user ID |
| `UserDto.email` | email string | yes | no | 검증된 표시/연락 snapshot; identity key 아님 |
| `UserDto.displayName` | string | yes | no | 표시 이름 |
| `UserDto.joinedAt` | timestamp | yes | no | 가입 시각 |
| `UserDto.lastLoginAt` | timestamp | yes | no | 마지막 로그인 |
| `SessionDto.user` | `UserDto` | yes | no | 현재 사용자 |
| `SessionDto.authenticatedAt` | timestamp | yes | no | 현재 session 인증 시각 |
| `SessionDto.expiresAt` | timestamp | yes | no | idle expiry |
| `SessionDto.absoluteExpiresAt` | timestamp | yes | no | absolute expiry |
| `SessionDto.csrfToken` | string | yes | no | 메모리 전용 mutation token |

### 3.3 UserSettingsDto

| Field | Type | Required | Nullable | 의미/default |
| --- | --- | --- | --- | --- |
| `fontSize` | `FontSize` | yes | no | default `medium` |
| `isEntryLockEnabledByDefault` | boolean | yes | no | default `false` |
| `isAiAnalysisEnabled` | boolean | yes | no | default `true`; P1 자동 insight 제어 |
| `aiTone` | `AiTone` | yes | no | default `calm-guide` |
| `aiResponseLength` | `AiResponseLength` | yes | no | default `balanced` |
| `isPersonalizedQuestionsEnabled` | boolean | yes | no | default `true` |
| `updatedAt` | timestamp | yes | no | server-owned |

theme과 sidebar 접힘은 device-local UI state다.

### 3.4 DiaryImageDto

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `id` | ID string | yes | no | image resource ID |
| `contentUrl` | same-origin path string | yes | no | 인증된 stable content URL |
| `alt` | string | yes | yes | 대체 텍스트 |
| `role` | `ImageRole` | yes | no | 표시 역할 |
| `createdAt` | timestamp | yes | no | 생성 시각 |

허용 MIME은 JPEG/PNG/WebP, 파일당 최대 350 KiB, entry당 최대 3장이다. SVG와 decode 실패는 거절한다.

### 3.5 Diary write schema

`DiaryEntryContentWrite` field는 create에서 `type`, `diaryDate`만 항상 필수다. PATCH/PUT draft에서는 표의 endpoint 규칙이 필수 여부를 재정의한다.

| Field | Type | Required(create) | Nullable | 의미/validation |
| --- | --- | --- | --- | --- |
| `type` | `EntryType` | yes | no | entry 형식 |
| `diaryDate` | date string | yes | no | 유효한 날짜 |
| `title` | string | no | yes | trim 후 최대 80자 |
| `content` | string | no | yes | plain text, 최대 2,500,000자 |
| `contentHtml` | string | no | yes | TipTap HTML, 최대 2,500,000자, server sanitize |
| `shortNote` | string | no | yes | quick는 최대 180자 |
| `mood` | `Mood` | no | yes | 감정 |
| `energy` | integer | no | yes | 1..5 |
| `activities` | `Activity[]` | no | no | 중복 없는 값; omitted는 create에서 `[]` |
| `tags` | `string[]` | no | no | 최대 8개, 각 trim 후 1..24자, 중복 금지 |
| `imageIds` | ID string[] | no | no | 최대 3개, 현재 owner image |
| `weather` | object | no | yes | 사용자 입력 weather snapshot |
| `weather.condition` | string | no | yes | condition |
| `weather.temperature` | number | no | yes | 섭씨 snapshot |
| `location` | object | no | yes | 사용자 입력 location snapshot |
| `location.name` | string | no | yes | 표시 장소 |
| `isFavorite` | boolean | no | no | omitted default `false` |
| `isLocked` | boolean | no | no | omitted는 settings 기본값; true이면 AI 제외 |
| `shouldAnalyze` | boolean | no | no | command-only; P0 저장/응답 field 아님 |

- journal은 trim한 `content`가 비어 있지 않아야 한다.
- quick은 `mood`, trim한 `shortNote`, `activities` 중 하나 이상이어야 한다. Quick Check-In 프런트의 mood 강제는 별도 UI 조정사항이다.
- server-owned `id`, timestamp, revision, content URL, `aiTopics`, `aiInsight`는 request에서 거절한다.

### 3.6 Diary response DTO

| DTO.field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `DiaryEntryDto.id` | ID string | yes | no | entry ID |
| `.type` | `EntryType` | yes | no | 형식 |
| `.title` | string | yes | yes | 제목 |
| `.content` | string | yes | yes | plain content |
| `.contentHtml` | string | yes | yes | sanitized HTML |
| `.shortNote` | string | yes | yes | quick note |
| `.createdAt` | timestamp | yes | no | 생성 시각 |
| `.updatedAt` | timestamp | yes | no | 수정 시각 |
| `.diaryDate` | date | yes | no | Diary 날짜 |
| `.mood` | `Mood` | yes | yes | 감정 |
| `.energy` | integer | yes | yes | 1..5 |
| `.activities` | `Activity[]` | yes | no | 활동 |
| `.tags` | `string[]` | yes | no | 사용자 tags |
| `.aiTopics` | `string[]` | yes | no | P0에서는 항상 `[]`; P1 insight 활성화 전 미생성 |
| `.images` | `DiaryImageDto[]` | yes | no | 최대 3개 |
| `.weather` | object | yes | yes | weather snapshot |
| `.weather.condition` | string | yes | yes | condition |
| `.weather.temperature` | number | yes | yes | temperature |
| `.location` | object | yes | yes | location snapshot |
| `.location.name` | string | yes | yes | 장소 이름 |
| `.isFavorite` | boolean | yes | no | favorite |
| `.isLocked` | boolean | yes | no | AI 제외 metadata |
| `.aiInsight` | null | yes | yes | P0는 항상 `null`; P1 structured 계약 전 비활성 |
| `.revision` | positive integer | yes | no | ETag source |

`DiaryEntrySummaryDto`는 `id`, `type`, nullable `title`, non-null `excerpt`, `diaryDate`, `updatedAt`, nullable `mood`, nullable `energy`, `activities[]`, `tags[]`, nullable `coverImage`, `isFavorite`, `isLocked`, `revision`을 모두 필수 field로 가진다. 목록에는 전체 content/contentHtml을 넣지 않는다.

`DiaryEntryDetailDto`는 non-null `entry: DiaryEntryDto`, non-null `relatedEntries: DiaryEntrySummaryDto[]`(최대 3), nullable `previousEntry`, nullable `nextEntry`를 필수 field로 가진다.

### 3.7 Draft DTO

`DiaryDraftDto`는 `DiaryEntryContentWrite`에서 `shouldAnalyze`를 제외한 field와 다음 server field를 가진다. content field는 response에서 모두 명시하며 값 없음은 `null`/`[]`다.

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `id` | ID string | yes | no | draft ID |
| `entryId` | ID string | yes | yes | 편집 중 entry |
| `savedAt` | timestamp | yes | no | 저장 시각 |
| `revision` | positive integer | yes | no | ETag source |

### 3.8 AI DTO

| DTO.field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `AIConversationSummaryDto.id` | ID string | yes | no | conversation ID |
| `.title` | string | yes | no | trim 1..80 |
| `.createdAt` | timestamp | yes | no | 생성 |
| `.updatedAt` | timestamp | yes | no | 마지막 변경 |
| `JournalSourceDto.entryId` | ID string | yes | no | 검증된 source entry |
| `.entryUpdatedAt` | timestamp | yes | no | 검증 revision snapshot |
| `.diaryDate` | date | yes | no | 날짜 |
| `.title` | string | yes | yes | source 제목 |
| `.excerpt` | string | yes | no | 현재 plain text의 실제 substring, 최대 280 code point |
| `.mood` | `Mood` | yes | yes | 감정 |

`AIMessageDto` 공통 field:

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `id` | ID string | yes | no | message ID |
| `role` | `user` or `assistant` | yes | no | 역할 |
| `status` | `completed` or `redacted` | yes | no | 저장/가림 상태 |
| `content` | string | yes | redacted만 yes | user 질문 또는 assistant 답변 |
| `createdAt` | timestamp | yes | no | 생성 |
| `generator` | `local-llm` | yes | user만 null | 생성기; user는 `null` |
| `sources` | `JournalSourceDto[]` | yes | no | user/redacted는 `[]` |
| `redactionReason` | `source-updated` or `source-unavailable` | yes | completed만 null | 가림 원인 |

`AIRunDto`:

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `id` | ID string | yes | no | run ID |
| `conversationId` | ID string | yes | no | owner conversation |
| `userMessageId` | ID string | yes | no | triggering message |
| `assistantMessageId` | ID string | yes | yes | completed assistant message |
| `status` | `RunStatus` | yes | no | run 상태 |
| `streamUrl` | same-origin path | yes | no | SSE URL |
| `failure` | object | yes | yes | failed 외에는 `null` |
| `failure.code` | `RunFailureCode` | yes if failure | no | 안전한 실패 분류 |
| `failure.message` | string | yes if failure | no | 원문 없는 안내 |
| `failure.retryable` | boolean | yes if failure | no | 새 user action 가능 여부 |
| `failure.requestId` | string | yes if failure | no | 상관 ID |
| `createdAt` | timestamp | yes | no | 생성 |
| `startedAt` | timestamp | yes | yes | 시작 |
| `completedAt` | timestamp | yes | yes | terminal 시각 |

## 4. 인증·계정 API

### POST `/api/v1/auth/login-attempts`

- Auth: Public. `purpose=reauthenticate`는 active session 필요. exact origin/Fetch Metadata 검증.
- Path/query: 없음.
- JSON body:

| Field | Type | Required | Nullable | 계약 |
| --- | --- | --- | --- | --- |
| `returnTo` | relative path string | no | no | same-origin allow-list, default `/` |
| `purpose` | `login` or `reauthenticate` | no | no | default `login` |

- `201` body: 필수 non-null `attemptId: ID string`, `nonce: string`, `expiresAt: timestamp`.
- Abuse protection: remote address fingerprint별 configurable fixed window. 초과 응답은 `Retry-After`(남은 초)를 포함한다. 저장 map은 bounded이며 포화 시 신규 fingerprint가 endpoint별 overflow counter를 공유한다.
- Errors: `400 MALFORMED_REQUEST`, `401 AUTH_REQUIRED`, `422 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### POST `/api/v1/auth/google-credentials`

- Auth: Public GIS protocol. Content-Type `application/x-www-form-urlencoded`.
- Required non-null form fields: `credential`(Google ID token JWT), `g_csrf_token`(동명 cookie와 constant-time 비교), `state`(attemptId).
- 검증: attempt 미만료/미소비/context/nonce, JWT signature+`iss/aud/exp/nonce`, `email_verified=true`; identity key는 Google `sub`.
- External boundary: 공식 Google verifier/인증서 transport를 재사용하고 configurable connect/read timeout을 적용한다. callback은 login-attempt 생성과 분리된 remote address fingerprint window를 사용하며 초과 `429`에는 `Retry-After`가 있다.
- `303 See Other`: allow-listed `returnTo`; 새 session cookie 설정; body 없음.
- Errors/API client: `GOOGLE_CREDENTIAL_INVALID(401)`, `GOOGLE_EMAIL_UNVERIFIED(401)`, `LOGIN_ATTEMPT_INVALID(401)`, `CSRF_INVALID(403)`, `GOOGLE_REAUTH_ACCOUNT_MISMATCH(403)`, `LOGIN_ATTEMPT_CONSUMED(409)`, `RATE_LIMITED(429)`. Browser 실패 redirect는 고정 safe code만 포함한다.

### GET `/api/v1/auth/session`

- Auth: Optional session. path/query/body 없음.
- `200`: `SessionDto`; `Cache-Control: no-store`.
- Errors: `401 AUTH_REQUIRED`, `401 SESSION_EXPIRED`(cookie도 만료).

### DELETE `/api/v1/auth/session`

- Auth: session + `X-CSRF-Token`. path/query/body 없음.
- `204`: body 없음; server row가 이미 revoke됐어도 cookie가 있으면 idempotent하게 cookie 만료.
- Side effect: 해당 session의 SSE 전달 중단.
- Errors: `401 AUTH_REQUIRED`, `403 CSRF_INVALID`.

### DELETE `/api/v1/users/me`

- Auth: session + CSRF + 최근 5분 이내 동일 Google `sub` reauthentication. path/query/body 없음.
- `204`: 논리적 접근 차단, generation fence, 모든 session/user-owned data 삭제 경계 완료; body 없음.
- Errors: `401 AUTH_REQUIRED|SESSION_EXPIRED`, `403 CSRF_INVALID`, `403 RECENT_AUTH_REQUIRED`.

## 5. 설정 API

### GET `/api/v1/users/me/settings`

- Auth: session. path/query/body 없음.
- `200`: 전체 `UserSettingsDto`; row가 없으면 canonical defaults.
- Errors: `401 AUTH_REQUIRED|SESSION_EXPIRED`.

### PATCH `/api/v1/users/me/settings`

- Auth: session + CSRF. path/query 없음.
- JSON body: `UserSettingsDto`에서 `updatedAt`을 제외한 partial object. 최소 한 field, field별 type/enum은 3.3과 같고 null 불가.
- `200`: 전체 최신 `UserSettingsDto`.
- Errors: `401`, `403 CSRF_INVALID`, `422 VALIDATION_FAILED`.

### DELETE `/api/v1/users/me/settings`

- Auth: session + CSRF. path/query/body 없음.
- `204`: 저장 row 제거/초기화; 다음 GET은 canonical defaults. body 없음.
- Errors: `401`, `403 CSRF_INVALID`.

## 6. Diary와 draft API

### GET `/api/v1/diary-entries`

- Auth: session. path/body 없음.
- Query:

| Field | Type | Required | Nullable | 계약 |
| --- | --- | --- | --- | --- |
| `query` | string | no | no | title/plain content/short note/tag 검색 |
| `dateFrom` | date | no | no | inclusive |
| `dateTo` | date | no | no | inclusive; 함께 있으면 `dateFrom <= dateTo` |
| `monthDay` | `MM-DD` string | no | no | 유효 월일; date range와 동시 사용 불가 |
| `mood` | repeated `Mood` | no | no | 같은 key 반복, OR; comma parsing 없음 |
| `activity` | repeated `Activity` | no | no | OR |
| `tag` | repeated string | no | no | OR |
| `isFavorite` | boolean | no | no | favorite filter |
| `hasImages` | boolean | no | no | image 존재 filter |
| `entryType` | repeated `EntryType` | no | no | OR |
| `sort` | enum | no | no | `diaryDateDesc`(default), `diaryDateAsc`, `updatedAtDesc` |
| `cursor` | opaque string | no | no | 다음 page |
| `limit` | integer 1..100 | no | no | default 30 |

- `200` body: 필수 `items: DiaryEntrySummaryDto[]`, nullable `nextCursor: string`, non-null `hasNext: boolean`.
- 기본 stable order: `diaryDate DESC, updatedAt DESC, id DESC`; 모든 sort는 ID tie-break를 포함한다.
- `aiTopic` exact filter는 P1 facet/insight persistence와 함께 활성화하며 P0 query가 아니다.
- Errors: `401`, `422 VALIDATION_FAILED`.

### POST `/api/v1/diary-entries`

- Auth/headers: session, `X-CSRF-Token`, `Idempotency-Key`.
- Path/query 없음. JSON body: full `DiaryEntryContentWrite` + optional non-null `shouldAnalyze`; `type`, `diaryDate` 필수.
- `201`: `DiaryEntryDto`; `Location: /api/v1/diary-entries/{id}`, revision `ETag`.
- Side effects: owner pending images attach; dataset revision 증가. P0에서는 structured insight가 비활성이므로 `shouldAnalyze` 값과 무관하게 `aiTopics=[]`, `aiInsight=null`; 가짜 분석은 만들지 않는다.
- Errors: `401`, `403 CSRF_INVALID`, `409 IDEMPOTENCY_CONFLICT`, `413 PAYLOAD_TOO_LARGE`, `422 VALIDATION_FAILED`. LLM 장애로 entry 저장을 `503` 처리하지 않는다.

### GET `/api/v1/diary-entries/{entryId}`

- Auth: session. Path `entryId: ID string`, required/non-null. query/body 없음.
- `200`: `DiaryEntryDetailDto`, entry revision `ETag`.
- Related entries는 현재 entry를 제외한 deterministic overlap 결과 최대 3개. previous/next는 `diaryDate, updatedAt, id` stable order의 인접 entry다.
- Errors: `401`, `404 RESOURCE_NOT_FOUND`.

### PATCH `/api/v1/diary-entries/{entryId}`

- Auth/headers: session, CSRF, required `If-Match`. Path `entryId: ID string`; query 없음.
- JSON body: `DiaryEntryContentWrite` + optional `shouldAnalyze`의 partial object, 최소 한 field. 모든 field type/nullability는 3.5와 같으며 `type`, `diaryDate`도 변경 가능하다.
- `200`: 전체 최신 `DiaryEntryDto`, 새 `ETag`.
- Side effects: image attach/detach, dataset revision 증가. 원문 수정·lock은 context dependency assistant를 redaction한다. `false -> true` lock은 관련 active run을 fence/cancel한다.
- Errors: `401`, `403 CSRF_INVALID`, `404 RESOURCE_NOT_FOUND`, `412 VERSION_CONFLICT`, `413 PAYLOAD_TOO_LARGE`, `422 VALIDATION_FAILED`, `428 PRECONDITION_REQUIRED`.

### DELETE `/api/v1/diary-entries/{entryId}`

- Auth/headers: session, CSRF, required `If-Match`. Path `entryId: ID string`; query/body 없음.
- `204`: body 없음. Entry/child/image relation/dataset revision과 AI dependency redaction을 같은 신뢰 가능한 transaction/saga에서 처리한다.
- Errors: `401`, `403`, `404`, `412`, `428`.

### GET `/api/v1/diary-draft`

- Auth: session. path/query/body 없음.
- `200`: 필수 `draft: DiaryDraftDto|null`. draft가 있으면 `ETag`, 없어도 `404`가 아니다.
- Errors: `401`.

### PUT `/api/v1/diary-draft`

- Auth/headers: session, CSRF; 기존 draft가 있으면 `If-Match` 필수.
- JSON body: `DiaryEntryContentWrite`에서 `shouldAnalyze`를 제외한 field + optional nullable `entryId: ID string` + optional non-null `id: ID string`. `type`, `diaryDate` 필수. 사용자당 하나.
- `201`(처음 생성) 또는 `200`(갱신): `DiaryDraftDto`, `ETag`.
- Errors: `401`, `403`, `412`, `413`, `422`, `428`.

### DELETE `/api/v1/diary-draft`

- Auth/headers: session, CSRF; draft가 있으면 `If-Match` 필수. path/query/body 없음.
- `204`: 없어도 idempotent. body 없음.
- Errors: `401`, `403`, `412`, `428`.

## 7. 이미지 API

### POST `/api/v1/diary-images`

- Auth/headers: session, CSRF, `Idempotency-Key`. Content-Type `multipart/form-data`.
- Parts:

| Part | Type | Required | Nullable | 계약 |
| --- | --- | --- | --- | --- |
| `file` | binary | yes | no | JPEG/PNG/WebP, decode 검증, 최대 350 KiB |
| `role` | `ImageRole` string | yes | no | `cover` 또는 `inline` |
| `alt` | string | no | no | 대체 텍스트 |

- `201`: `DiaryImageDto`, `Location: /api/v1/diary-images/{id}/content`; state는 pending.
- Errors: `401`, `403 CSRF_INVALID`, `409 IDEMPOTENCY_CONFLICT`, `413 IMAGE_TOO_LARGE`, `415 IMAGE_TYPE_UNSUPPORTED`, `422 IMAGE_INVALID`.

### GET `/api/v1/diary-images/{imageId}/content`

- Auth: session. Path `imageId: ID string`; query/body 없음.
- `200`: binary body, 검증된 `Content-Type`, `X-Content-Type-Options: nosniff`, private cache.
- Errors: `401`, `404 RESOURCE_NOT_FOUND`.

### DELETE `/api/v1/diary-images/{imageId}`

- Auth/headers: session, CSRF. Path `imageId: ID string`; query/body 없음.
- `204`: pending 또는 분리 image 삭제; body 없음.
- Errors: `401`, `403`, `404`, `409 IMAGE_IN_USE`.

## 8. AI conversation과 run API

Local LLM privacy gate의 기본값은 off다. off이면 upstream 호출이 필요한 신규 message command는 durable message/run 생성 전에 `503 AI_SERVICE_UNAVAILABLE`로 fail closed한다. Diary와 기존 conversation 조회 API에는 영향을 주지 않는다.

### GET `/api/v1/ai-conversations`

- Auth: session. path/body 없음.
- Query: optional non-null `cursor: opaque string`, optional `limit: integer 1..100`(default 30).
- `200`: 필수 `items: AIConversationSummaryDto[]`, nullable `nextCursor`, non-null `hasNext`; `updatedAt DESC, id DESC`.
- Errors: `401`, invalid cursor/limit `422 VALIDATION_FAILED`.

### POST `/api/v1/ai-conversations`

- Auth/headers: session, CSRF, `Idempotency-Key`. path/query 없음.
- JSON body: optional non-null `title: string`, trim 1..80; omitted면 제품 고정 기본 제목.
- `201`: `AIConversationSummaryDto`, `Location`.
- Errors: `401`, `403`, `409 IDEMPOTENCY_CONFLICT`, `422`.

### GET `/api/v1/ai-conversations/{conversationId}`

- Auth: session. Path `conversationId: ID string`; query/body 없음.
- `200`: `AIConversationSummaryDto`.
- Errors: `401`, `404`.

### PATCH `/api/v1/ai-conversations/{conversationId}`

- Auth/headers: session, CSRF. Path `conversationId: ID string`; query 없음.
- JSON body: required non-null `title: string`, trim 1..80; 다른 field 금지.
- `200`: 최신 `AIConversationSummaryDto`.
- Active run 중에는 `409 AI_RUN_ACTIVE`로 차단한다.
- Errors: `401`, `403`, `404`, `409 AI_RUN_ACTIVE`, `422`.

### DELETE `/api/v1/ai-conversations/{conversationId}`

- Auth/headers: session, CSRF. Path `conversationId: ID string`; query/body 없음.
- `204`: generation fence를 닫고 active run cancel 후 conversation/message/source/context/event를 삭제. body 없음.
- Errors: `401`, `403`, `404`.

### GET `/api/v1/ai-conversations/{conversationId}/messages`

- Auth: session. Path `conversationId: ID string`; body 없음.
- Query: optional `cursor: opaque string`, optional `limit: integer 1..100`(default 50).
- `200`: 필수 `items: AIMessageDto[]`, nullable `nextCursor`, non-null `hasNext`. 첫 page는 최신 window지만 items는 시간/sequence 오름차순; cursor는 더 오래된 window.
- 읽을 때 owner/lock/revision을 재검증하고 invalid dependency는 redacted DTO로 반환한다.
- Errors: `401`, `404`, invalid cursor/limit `422`.

### POST `/api/v1/ai-conversations/{conversationId}/messages`

- Auth/headers: session, CSRF, `Idempotency-Key`. Path `conversationId: ID string`; query 없음.
- JSON body:

| Field | Type | Required | Nullable | 계약 |
| --- | --- | --- | --- | --- |
| `content` | string | yes | no | trim 1..1,200자 |
| `timeZone` | IANA time zone string | yes | no | 상대 날짜 해석; 주 시작 월요일 |

- `202` body: required non-null `userMessage: AIMessageDto`(user/completed variant), required non-null `run: AIRunDto`(queued). 같은 idempotency replay는 동일 두 resource.
- 한 conversation에 active run 하나. readiness/capacity/privacy gate 거절은 transaction 전 `429`/`503`; commit 뒤 orchestration 실패는 같은 `202`를 유지하고 run을 failed로 전이한다.
- Errors: `401`, `403`, `404`, `409 AI_RUN_ACTIVE|IDEMPOTENCY_CONFLICT`, `422`, `429 RATE_LIMITED`, `503 AI_SERVICE_UNAVAILABLE`.

### GET `/api/v1/ai-runs/{runId}`

- Auth: session. Path `runId: ID string`; query/body 없음.
- `200`: required non-null `run: AIRunDto`, required nullable `message: AIMessageDto|null`. message는 completed이고 검증된 경우만 값.
- Errors: `401`, `404`.

### GET `/api/v1/ai-runs/{runId}/events`

- Auth: active session와 owner. Path `runId: ID string`; body 없음.
- Header: required `Accept: text/event-stream`; optional `Last-Event-ID: <runId>:<sequence>`.
- Query: optional `after: event ID`; header가 있으면 우선. run ID 일치, 길이/형식, future sequence가 아님을 검증한다.
- `200`: `text/event-stream; charset=utf-8`; `Cache-Control: private, no-store, no-cache, no-transform`; proxy buffering/compression off.
- stream open 전 Errors: `401`, `404`, `429`. replay hard TTL 만료는 HTTP 오류가 아니라 `stream.resync-required` event 후 close.

Replay event의 `data`는 한 줄 JSON이다. 공통 field는 required `version: 1`, `runId: ID`, `sequence: positive integer`, `requestId: string`; `id`는 `<runId>:<sequence>`다. control `stream.resync-required`만 `id/sequence`가 없다.

| Event | 추가 required field | 의미 |
| --- | --- | --- |
| `run.started` | 없음 | generation 시작 |
| `message.delta` | `index: non-negative integer`, `delta: string` | 누적 본문이 아닌 새 조각 |
| `run.completed` | `message: AIMessageDto`, `suggestedQuestions: string[]`, `resultKind: answer|no-results` | 검증·저장 완료 terminal |
| `run.failed` | `code: RunFailureCode`, `message: string`, `retryable: boolean` | 안전한 terminal 실패 |
| `run.cancelled` | 없음 | terminal 취소 |
| `stream.resync-required` | `version:1`, `runId`, `requestId`, `reason:string` | partial 폐기 후 REST 재동기화 |

- terminal event는 정확히 하나. source는 completed message에만 있다. 약 15초 heartbeat comment는 replay ID가 없고 session idle TTL을 연장하지 않는다.
- `EventSource.onerror`에서는 status를 추정하지 않고 stream close → session 조회 → run 조회 → terminal message 재조회 또는 `after` backoff reconnect 순으로 복구한다. message POST를 반복하지 않는다.

### PUT `/api/v1/ai-runs/{runId}/cancellation`

- Auth/headers: session, CSRF. Path `runId: ID string`; query/body 없음.
- `200`: 현재 `AIRunDto`. cancel이 원자 경쟁에서 이기면 cancelled, 이미 terminal이면 그 상태를 그대로 반환.
- Errors: `401`, `403`, `404`.

## 9. Diary data API

### HEAD `/api/v1/diary-data`

- Auth: session. path/query/body 없음.
- `200`, body 없음. Required headers: dataset `ETag: "diary-data-<revision>"`, `X-Moodi-Entry-Count: non-negative integer`, `X-Moodi-Data-Confirmation: opaque one-time token`.
- Token은 현재 session+dataset revision+짧은 TTL에 binding한다.
- Errors: `401`.

### GET `/api/v1/diary-data`

- Auth: session. path/query/body 없음.
- `200`: streaming `application/json`, attachment disposition, dataset `ETag`.
- Version 2 envelope:

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `format` | literal `moodi-diary-export` | yes | no | format ID |
| `version` | literal integer `2` | yes | no | schema version |
| `exportedAt` | timestamp | yes | no | export 시각 |
| `entries` | `DiaryExportEntryV2[]` | yes | no | 사용자 entries |

`DiaryExportEntryV2`는 `DiaryEntryDto`의 `id,type,title,content,contentHtml,shortNote,createdAt,updatedAt,diaryDate,mood,energy,activities,tags,weather,location,isFavorite,isLocked`와 동일 type/required/nullability를 가진다. `images`는 다음 V2 schema 배열이다.

| Image field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `id` | ID string | yes | no | export-local ID |
| `dataUrl` | image data URL string | yes | no | binary와 MIME |
| `alt` | string | yes | yes | 대체 텍스트 |
| `role` | `ImageRole` | yes | no | 역할 |

AI topic/insight, identity/session/audit/pending run은 제외한다. contentHtml image URL은 data URL로 rewrite한다.
- Errors: `401`, `500 INTERNAL_ERROR`.

### PUT `/api/v1/diary-data`

- Auth/headers: session, CSRF, `Idempotency-Key`, dataset `If-Match`, `X-Data-Confirmation-Token`.
- Content-Type `application/json`; path/query 없음.
- Body: legacy version 1 또는 위 version 2 envelope. V1은 최대 12 MiB; V2는 서버가 생성한 export를 다시 받을 수 있는 quota를 보장한다.
- V1 adapter가 받는 image는 required `id:string`, required `url:data URL`, optional non-null `alt:string`, optional `role:ImageRole`; legacy `aiInsight`/`aiTopics`는 파생 데이터라 가져오지 않는다. Imported IDs는 authorization에 쓰지 않고 새 server IDs로 remap한다.
- `200` body:

| Field | Type | Required | Nullable | 의미 |
| --- | --- | --- | --- | --- |
| `importedEntryCount` | non-negative integer | yes | no | import entry 수 |
| `clearedDraft` | boolean | yes | no | 기존 draft 정리 여부 |
| `clearedConversationCount` | non-negative integer | yes | no | 삭제된 대화 수 |
| `completedAt` | timestamp | yes | no | 완료 시각 |

- 전체 payload/staging 검증 후 한 transaction으로 기존 Diary/draft/AI를 교체하고 dataset revision을 증가한다. commit 전 실패 시 기존 user-visible state를 유지한다.
- Errors: `401`, `403 CSRF_INVALID|DATA_CONFIRMATION_INVALID`, `409 IDEMPOTENCY_CONFLICT`, `412 VERSION_CONFLICT`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `422 IMPORT_INVALID`, `428 PRECONDITION_REQUIRED`.

### DELETE `/api/v1/diary-data`

- Auth/headers: session, CSRF, dataset `If-Match`, `X-Data-Confirmation-Token`. path/query/body 없음.
- `204`: generation fence 후 Diary/draft/image/conversation/message/source/context/run/event를 삭제; user/Google identity/current session/settings 유지. body 없음.
- Errors: `401`, `403 CSRF_INVALID|DATA_CONFIRMATION_INVALID`, `412 VERSION_CONFLICT`, `428 PRECONDITION_REQUIRED`.

## 10. 운영 health API

### GET `/health/live`

- Auth: public route이나 reverse proxy/internal network에서만 노출. path/query/body 없음.
- `200 application/json`: required non-null `status` literal string `UP`.
- process가 응답 불가하면 connection/5xx이며 DB/Redis/Local LLM 상태를 검사하지 않는다.

### GET `/health/ready`

- Auth: public route이나 reverse proxy/internal network에서만 노출. path/query/body 없음.
- `200 application/json`: required non-null `status` literal `UP` when DB와 필수 session store가 ready.
- `503 application/json`: required non-null `status` literal `DOWN` otherwise.
- Local LLM 장애/privacy gate off는 backend readiness를 DOWN으로 만들지 않는다. body에 host, model path, secret, connection string, 상세 component 오류를 넣지 않는다.

## 11. P1 비활성 계약

다음 route는 현재 endpoint set/controller/migration에 없다.

| Route | 활성화 조건/계약 gap |
| --- | --- |
| `GET /api/v1/diary-calendar-days?month=YYYY-MM` | deterministic 월 집계. Calendar의 `hasImages` 표시/filter 요구를 프런트와 확정 |
| `GET /api/v1/diary-insights?dateFrom&dateTo` | Local LLM과 무관한 deterministic 집계. 현재 Insights UI가 제안 DTO field를 모두 소비하지 않는 gap 확정 |
| `GET /api/v1/diary-entry-facets?dateFrom&dateTo` | tag/activity/mood/AI topic을 분리. exact `aiTopic` filter와 topic persistence 확정 |
| `POST /api/v1/diary-entries/{entryId}/ai-insights` | upstream structured output request/response/error schema와 privacy logging 수정 확인 후 별도 migration/DTO 채택 |

P1 활성화는 API 두 문서, migration/schema, state/flow, 프런트 adapter를 같은 변경에서 갱신한다. `/v1/chat/completions` 자유 텍스트를 structured insight 결과처럼 파싱하는 가짜 구현은 금지한다.
