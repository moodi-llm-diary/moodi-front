# API 명세 - moodi

정확한 API 계약을 이 문서에 기록한다.

## 현재 계약

- 구현되거나 확정된 HTTP endpoint는 없다.
- Diary CRUD, draft, 목록 교체 계약은 프론트엔드 `DiaryRepository` interface에만 존재하며 현재 구현은 localStorage adapter다.
- `/ai`는 HTTP API가 아니다. 프론트엔드 `JournalAIService` application contract의 현재 구현인 `LocalJournalAIService`가 브라우저의 잠금 해제된 비-seed Diary entries를 `local-search`로 검색·집계한다.
- AI 대화 load와 source sanitize는 Diary store `ready` 이후에만 시작한다. 화면은 persistence 결과와 독립적인 동기 sanitizer로 현재 entry를 대조해 수정·삭제·잠금 source의 오래된 답변을 즉시 가린다.
- AI 대화 persistence는 `JournalAIConversationRepository`와 `moodi.journal-ai.conversations.v1` adapter가 담당한다. contract는 create와 `update(id, updater)`를 분리하고 update를 upsert하지 않으며, 저장 시 최근 message 80개로 먼저 제한한 뒤 검증한다.
- local query는 감정+keyword 교집합, 한국어 복합 조사·감정 활용형과 제품 직접 예문을 지원한다. 일반 검색은 전체 match와 검색 점수 상위 대표 source 최대 6개, 기간 비교는 기간별 전체 match와 대표 source 최대 3개를 구분한다.
- assistant response는 최종 저장 성공 뒤에만 확정한다. 실패하면 pending answer를 제거하고 먼저 저장된 user message만 유지한다.
- 단일 기록 삭제·Diary import 교체·전체 삭제·손상 저장소 복구는 진행 중 AI 요청을 먼저 취소한다. 단일 삭제는 source reference를 제거하고 나머지는 기존 AI 대화를 정리한다.
- 손상된 AI envelope은 `storage-corrupted` typed error다. 확인된 AI reset은 대화 key만 제거하고 Diary entries/draft를 보존한다.
- `local-rule-mock`의 반복·동시 발생 pattern은 같은 조합을 실제로 지원하는 과거 기록이 있을 때만 생성하고 움직임의 행복/편안함 label은 실제 선택값을 보존한다. 태그·주제·회고의 반복·자주 표현도 `count >= 2`일 때만 사용하며 단일 값은 중립 문구로 표시한다.
- 외부 AI, 이미지 업로드, 위치, 날씨, 외부 데이터 연결 endpoint는 계약 미확정이다. `external-ai`는 타입 예약값일 뿐 현재 request DTO, response DTO, auth header 또는 HTTP client가 없다.

## 인증 계약
- 현재 백엔드 인증 API 계약은 없다.
- 프론트엔드 MVP는 localStorage 기반 mock auth user profile만 사용한다.
- token, session, refresh token, 만료, 필수 auth header는 아직 정의하지 않는다.
- 실제 auth API가 확정되면 login/me/logout endpoint, request/response field, 401/403 error case, token/session 동작을 이 문서에 추가한다.

## 외부 API 매핑
- upstream 계약이 확인된 경우에만 내부 endpoint와 upstream 호출 관계를 기록한다.
- 현재 `local-search`는 외부 upstream으로 질문, 일기 원문 또는 대화를 전송하지 않는다.
- `JournalAIService`는 취소 signal과 `generating | streaming` progress event, `answer | no-results` 결과를 제공한다. error code는 `storage-corrupted | storage-unavailable`과 향후 adapter용 network·auth-expired·service-unavailable·source-load-failed를 구분하지만 현재 local adapter가 임의 endpoint나 외부 오류를 만들지는 않는다.

## Endpoints

현재 없음.
