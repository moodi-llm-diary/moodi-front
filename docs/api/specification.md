# API 명세 - moodi

프런트엔드는 browser-facing `VITE_API_BASE_URL`을 사용한다. 로컬과 Vercel에서는 이를 `/`로 둔다. 로컬은 `VITE_BACKEND_ORIGIN=http://localhost:8080`을 Vite same-origin proxy target으로 사용하고, Vercel은 server-only `MOODI_BACKEND_ORIGIN`을 `/api/*` proxy target으로 사용한다. 브라우저에서 backend origin을 직접 호출하지 않아 GIS `g_csrf_token`, login-binding, host-only session cookie가 모두 같은 browser origin에 귀속되도록 한다. 개발 서버와 Playwright의 browser origin은 backend·Google login 허용 목록과 일치하는 `http://localhost:5173`이며, `127.0.0.1` 또는 다른 포트로 접근하지 않는다. 모든 제품 API prefix는 `/api/v1`이며 field는 `camelCase` JSON이다.

## 공통 계약

- 성공 응답의 ID는 non-null UUID string, timestamp는 UTC ISO-8601, 날짜는 `YYYY-MM-DD`다.
- 값이 없는 nullable field는 생략하지 않고 `null`, collection은 `[]`로 응답한다. PATCH의 omitted field는 유지하고 nullable field의 `null`은 제거다.
- private response는 `Cache-Control: private, no-store`, 모든 response는 `X-Request-Id`를 가진다.
- 오류는 `application/problem+json` RFC 9457 body다. `type`, `title`, `status`, `detail`, `instance`, `code`, `requestId`는 필수이며 validation 오류만 `errors[].field/code/message`를 가진다.
- session cookie는 HttpOnly이며 browser는 `credentials: include`를 사용한다. `SessionDto.csrfToken`만 메모리에 보관하고 POST/PUT/PATCH/DELETE에 `X-CSRF-Token`을 보낸다.
- `Idempotency-Key`는 entry/image/conversation/message POST 및 diary-data PUT에 필요하다. entry/draft 수정·삭제에는 backend가 직전 응답으로 돌려준 `ETag`를 `If-Match`로 보낸다.
- diary-data PUT/DELETE는 먼저 HEAD를 호출해 받은 `ETag`, `X-Moodi-Data-Confirmation`을 각각 `If-Match`, `X-Data-Confirmation-Token`으로 보낸다.

공통 error code는 `MALFORMED_REQUEST(400)`, `AUTH_REQUIRED|SESSION_EXPIRED(401)`, `CSRF_INVALID|FORBIDDEN(403)`, `RESOURCE_NOT_FOUND(404)`, `IDEMPOTENCY_CONFLICT|AI_RUN_ACTIVE(409)`, `VERSION_CONFLICT(412)`, `PAYLOAD_TOO_LARGE(413)`, `UNSUPPORTED_MEDIA_TYPE(415)`, `VALIDATION_FAILED(422)`, `PRECONDITION_REQUIRED(428)`, `RATE_LIMITED(429)`, `AI_SERVICE_UNAVAILABLE(503)`, `INTERNAL_ERROR(500)`이다.

## DTO 계약

| DTO | 필수 field | nullable / enum 및 제한 |
| --- | --- | --- |
| `UserDto` | `id`, `email`, `displayName`, `joinedAt`, `lastLoginAt` | 모두 non-null |
| `SessionDto` | `user`, `authenticatedAt`, `expiresAt`, `absoluteExpiresAt`, `csrfToken` | 모두 non-null; csrf token은 memory only |
| `UserSettingsDto` | `fontSize`, `isEntryLockEnabledByDefault`, `isAiAnalysisEnabled`, `aiTone`, `aiResponseLength`, `isPersonalizedQuestionsEnabled`, `updatedAt` | `fontSize=small|medium|large`; tone과 response length는 API enum; 모두 non-null |
| `DiaryEntryContentWrite` | create 시 `type`, `diaryDate` | `type=journal|quick`; mood 9개, activity 9개, title 최대 80, plain/HTML content 최대 2,500,000, quick note 최대 180, energy 1..5, tag 최대 8, `imageIds` 최대 3, nullable scalar는 `null`로 제거 |
| `DiaryEntryDto` | write field와 `id`, `createdAt`, `updatedAt`, `aiTopics`, `images`, `isFavorite`, `isLocked`, `aiInsight`, `revision` | response는 title/content/contentHtml/shortNote/mood/energy/weather/location/aiInsight nullable; P0 `aiTopics=[]`, `aiInsight=null` |
| `DiaryEntrySummaryDto` | `id`, `type`, `title`, `excerpt`, `diaryDate`, `updatedAt`, mood/energy, activities/tags, `coverImage`, favorite/lock, `revision` | 목록에는 full content를 넣지 않음 |
| `DiaryDraftDto` | write fields, `id`, `entryId`, `savedAt`, `revision` | `entryId` nullable; 사용자당 하나 |
| `DiaryImageDto` | `id`, `contentUrl`, `alt`, `role`, `createdAt` | `alt` nullable, `role=cover|inline`; JPEG/PNG/WebP, 최대 350 KiB, entry당 3장 |
| `AIConversationSummaryDto` | `id`, `title`, `createdAt`, `updatedAt` | title 1..80 |
| `AIMessageDto` | `id`, `role`, `status`, `content`, `createdAt`, `generator`, `sources`, `redactionReason` | role user/assistant, status completed/redacted, completed assistant만 source, redacted content/reason nullability는 status에 따름 |
| `AIRunDto` | `id`, `conversationId`, `userMessageId`, `assistantMessageId`, `status`, `streamUrl`, `failure`, timestamps | status queued/running/completed/failed/cancelled; failed의 failure는 code/message/retryable/requestId |

## 인증과 설정

| Method / URL | Request | Success | 오류 / 부수효과 |
| --- | --- | --- | --- |
| POST `/auth/login-attempts` | optional `returnTo`, `purpose=login|reauthenticate` | `201 {attemptId, nonce, expiresAt}` | 401(reauth), 422, 429; Google credential 전 nonce 발급 |
| POST `/auth/google-credentials` | form `credential`, `g_csrf_token`, `state` | `303` allow-listed returnTo + session cookie | 401 Google credential/attempt, 403 CSRF, 409 consumed attempt, 429 |
| GET `/auth/session` | 없음 | `200 SessionDto` | 401 auth/session expired |
| DELETE `/auth/session` | CSRF | `204` | 401, 403; session revoke와 cookie 만료 |
| DELETE `/users/me` | CSRF + 5분 이내 reauth | `204` | 401, 403; user-owned data 삭제 |
| GET `/users/me/settings` | 없음 | `200 UserSettingsDto` | 401 |
| PATCH `/users/me/settings` | 최소 하나의 non-null partial setting | `200 UserSettingsDto` | 401, 403, 422 |
| DELETE `/users/me/settings` | CSRF | `204` | 401, 403; 다음 GET은 canonical defaults |

## Diary, draft, image

| Method / URL | Request | Success | 오류 / 부수효과 |
| --- | --- | --- | --- |
| GET `/diary-entries` | query: `query`, date range, repeated mood/activity/tag/type, favorite/image, sort, cursor, limit 1..100 | `200 {items: DiaryEntrySummaryDto[], nextCursor, hasNext}` | 401, 422; stable pagination |
| POST `/diary-entries` | CSRF + idempotency + full `DiaryEntryContentWrite` | `201 DiaryEntryDto`, Location, ETag | 401, 403, 409, 413, 422; image attach/dataset revision |
| GET `/diary-entries/{entryId}` | path id | `200 {entry, relatedEntries, previousEntry, nextEntry}`, ETag | 401, 404 |
| PATCH `/diary-entries/{entryId}` | CSRF + If-Match + non-empty partial write | `200 DiaryEntryDto`, new ETag | 401, 403, 404, 412, 413, 422, 428; image attach/detach, dataset revision, invalid AI source redaction |
| DELETE `/diary-entries/{entryId}` | CSRF + If-Match | `204` | 401, 403, 404, 412, 428; child/image relation and AI dependency cleanup |
| GET `/diary-draft` | 없음 | `200 {draft: DiaryDraftDto|null}`, ETag if draft | 401 |
| PUT `/diary-draft` | CSRF; existing draft requires If-Match; full write + optional `id`,`entryId` | `201` create or `200` update, Draft + ETag | 401, 403, 412, 413, 422, 428 |
| DELETE `/diary-draft` | CSRF; existing draft requires If-Match | `204` | 401, 403, 412, 428; absent draft is idempotent |
| POST `/diary-images` | CSRF + idempotency + multipart `file`, `role`, optional `alt` | `201 DiaryImageDto`, Location | 401, 403, 409, 413, 415, 422; pending image |
| GET `/diary-images/{imageId}/content` | path id | binary content with nosniff/private cache | 401, 404 |
| DELETE `/diary-images/{imageId}` | CSRF | `204` | 401, 403, 404, 409 image-in-use |

## AI conversation과 run

| Method / URL | Request | Success | 오류 / 부수효과 |
| --- | --- | --- | --- |
| GET/POST `/ai-conversations` | GET cursor/limit; POST CSRF+idempotency optional title | `200 page` / `201 summary` | 401, POST 403/409/422 |
| GET/PATCH/DELETE `/ai-conversations/{conversationId}` | PATCH CSRF `{title}`; DELETE CSRF | `200 summary` / `204` | 401, 403, 404, PATCH 409 active run, 422 |
| GET `/ai-conversations/{conversationId}/messages` | cursor/limit | `200 {items: AIMessageDto[],nextCursor,hasNext}` | 401,404,422; source is revalidated/read-redacted |
| POST `/ai-conversations/{conversationId}/messages` | CSRF+idempotency `{content: 1..1200, timeZone: IANA}` | `202 {userMessage, run}` | 401,403,404,409,422,429,503; one active run per conversation |
| GET `/ai-runs/{runId}` | 없음 | `200 {run, message}` | 401,404 |
| GET `/ai-runs/{runId}/events` | `Accept: text/event-stream`, optional Last-Event-ID/after | SSE `run.started`, `message.delta`, terminal `run.completed|run.failed|run.cancelled` | stream-open 401,404,429; EventSource error는 run 조회 후 복구 |
| PUT `/ai-runs/{runId}/cancellation` | CSRF | `200 AIRunDto` | 401,403,404; terminal run은 현재 상태 반환 |

## Export, import, health

| Method / URL | Request | Success | 오류 / 부수효과 |
| --- | --- | --- | --- |
| HEAD `/diary-data` | 없음 | `200` headers ETag, entry count, confirmation token | 401 |
| GET `/diary-data` | 없음 | `200` streaming `moodi-diary-export` v2 JSON attachment | 401, 500; identity/session/AI run 제외 |
| PUT `/diary-data` | CSRF + idempotency + dataset If-Match + confirmation token; v1/v2 export envelope | `200 {importedEntryCount, clearedDraft, clearedConversationCount, completedAt}` | 401,403,409,412,413,415,422,428; validation 후 atomic replace |
| DELETE `/diary-data` | CSRF + dataset If-Match + confirmation token | `204` | 401,403,412,428; Diary/draft/image/conversation/run 삭제, settings/session은 유지 |
| GET `/health/live` | internal/proxy route | `200 {status:"UP"}` | process down이면 connection/5xx |
| GET `/health/ready` | internal/proxy route | `200 {status:"UP"}` or `503 {status:"DOWN"}` | DB/session store readiness만 확인 |
