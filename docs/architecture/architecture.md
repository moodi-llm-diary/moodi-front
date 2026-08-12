# 아키텍처 문서 - moodi

## 요약

Moodi는 긴 일기와 빠른 기록을 backend의 인증된 사용자 데이터로 저장하고, AI 대화와 실제 기록 출처를 연결해 보여주는 React 기반 개인 기억 일기장이다. 프런트엔드는 `VITE_API_BASE_URL`의 REST/SSE backend adapter를 사용하며, localStorage는 theme·Sidebar 같은 device-local UI preference와 이전 데이터 호환용 adapter 테스트에만 남긴다.

## 런타임과 시스템 경계

- UI: React 19, TypeScript, Vite, TipTap 3
- Typography: npm package로 번들되는 Pretendard Variable dynamic subset과 시스템 sans-serif fallback
- 전역 client state: Zustand
- 라우팅: 별도 라우터 패키지 없이 History API와 `popstate`
- 저장소: `ApiDiaryRepository`가 Diary/draft/data transfer REST resource를 소유하고 backend가 persistence를 소유한다. Vercel 배포에서는 `api/[...path].ts`가 browser-facing same-origin proxy로 동작한다.
- 분석: P0 entry 저장은 backend `DiaryEntryDto`의 `aiTopics=[]`, `aiInsight=null`을 그대로 사용한다. 구조화 insight는 P1 계약 전 생성하지 않는다.
- AI: `ApiJournalAIService`가 conversation/message/run resource와 SSE를 사용한다.
- 인증: Google Identity Services credential은 backend에서 검증하고, browser는 HttpOnly session cookie와 메모리 전용 CSRF token만 사용한다.
- 외부 API와 데이터베이스: frontend가 직접 DB에 접근하지 않는다. backend API의 실제 contract는 `docs/api`에 기록한다.

## 공개 화면 경로

| URL | Route name | 화면 | 비고 |
| --- | --- | --- | --- |
| `/` | `home` | 오늘 | 빠른 기록, 긴 일기, 임시저장, 최근 기록, 과거의 오늘 진입 |
| `/write` | `write` | 긴 일기 작성 | 신규 작성 |
| `/write?entry=:id` | `write` | 긴 일기 수정 | id가 존재하면 기존 기록을 editor에 로드 |
| `/ai` | `ai` | Moodi AI | 현재 브라우저의 잠금 해제된 사용자 기록을 검색·집계하는 로컬 대화 |
| `/entries` | `entries` | 전체 기록 | 검색, 복합 필터, 날짜 그룹 timeline; 모든 기록을 동일한 divider row로 표시 |
| `/entries/:id` | `entryDetail` | 기록 상세 | 원문, 분석, 관련 기록, 이전/다음 기록 |
| `/calendar` | `calendar` | 월간 캘린더 | 날짜별 기록과 감정 흐름 |
| `/insights` | `insights` | 회고 | 주간 차트 1개, 핵심 주제, 관련 기록 |
| `/tags` | `tags` | 태그와 주제 | 설정의 `태그와 주제` 항목에서 진입; 사용자 태그, 활동, 감정, Moodi 주제 분리 |
| `/settings` | `settings` | 설정 | 테마, 글꼴, 잠금, AI preference, 데이터 관리 |

`useDiaryRoute`가 URL을 `DiaryLocation`으로 파싱하고 `pushState` 또는 `replaceState`로 이동한다. 브라우저 뒤로/앞으로는 `popstate`로 동기화한다. 알 수 없는 경로는 `/`로 교체한다. Login/Signup/MyPage는 별도 공개 URL을 추가하지 않고 같은 URL의 `moodiAppRoute` History state overlay로 열어 Back 동작과 React 화면을 동기화한다.

## 계층과 의존성 방향

```text
App
  -> DiaryMvpPage / SettingsPage                 Presentation 조립
    -> View / feature component                  표시와 사용자 intent 전달
      -> useDiaryWorkspace / feature hook        화면 유스케이스와 상태 전이
        -> diaryStore / settingsStore            client application state
          -> DiaryRepository / settings API service
            -> ApiDiaryRepository / HTTP client  backend adapter

useDiaryWorkspace -> diaryQueryService           순수 조회·집계·view model 계산
diaryStore        -> DiaryAnalysisService         분석 application 경계
useJournalAIChat  -> ApiJournalAIService          conversation/run/SSE application 경계
                  -> HTTP client -> backend API
```

- `pages`는 route별 화면, AppShell, dialog, toast를 조립한다.
- `components/views`는 화면 표시와 이벤트 전달을 담당한다.
- `hooks`는 route, editor, quick check-in, filter, confirmation 같은 UI 유스케이스를 조합한다.
- `stores`는 비동기 mutation 상태와 Repository 호출 순서를 소유한다.
- `repositories`는 backend DTO를 domain model로 변환하고 ETag, idempotency, confirmation header를 adapter 내부에 둔다.
- `services`는 image multipart upload, AI run SSE, 조회/집계, transfer 같은 독립 application 기능을 담당한다.
- `types/diaryDomain.ts`, `diaryInputs.ts`, `diaryViewModels.ts`는 domain model, application input, UI view model을 분리한다.
- UI component는 localStorage, Blob/File parsing, 외부 API를 직접 호출하지 않는다.

## AppShell과 반응형 구조

- 1101px 이상: 264px의 낮은 대비 Sidebar와 그 오른쪽 전체를 차지하는 단일 Main area를 사용한다. 901~1100px에서는 232px compact Sidebar를 사용하며, 두 구간 모두 72px icon rail로 접을 수 있다.
- Main area는 남은 viewport 폭과 높이를 사용하는 하나의 연속 canvas다. route view 전체를 별도의 흰색 page card로 감싸거나 같은 성격의 section card를 중첩하지 않는다.
- 접기 상태는 `moodi.ui.sidebar-collapsed.v1`에 저장해 새로고침 뒤에도 유지한다. 펼친 Sidebar는 단일 활성 draft와 최근 기록 최대 5개를 표시한다.
- desktop 주요 navigation은 오늘, AI와 대화, 기록, 캘린더, 회고이며 새 기록은 별도 CTA, profile과 설정은 하단에 둔다. 우측 고정 panel과 깊은 tree는 없다.
- route별 내부 열은 화면 목적에 맞게 제한한다. 오늘·기록은 최대 1120px, 작성은 900px, 상세 본문은 820px 안팎, 캘린더는 최대 1160px을 기준으로 한다. 이 값은 가독성과 정렬을 위한 내부 content column 제약이며 Main area 자체의 surface나 사용 범위를 줄이는 규칙이 아니다.
- 오늘 화면은 기록 시작, 임시저장, 대표 기억, 최근 기록, 질문을 하나의 연속 canvas 안에서 typography, whitespace, 실제 콘텐츠 이미지와 divider로 구분한다. CTA와 감정 선택 같은 control 외의 section wrapper에는 별도 배경, radius, shadow를 사용하지 않는다.
- `/ai` desktop은 Main area의 높이와 폭을 전부 사용한다. 상단 header와 로컬 검색 고지는 compact bar로 유지하고, 대화·composer만 읽기 가능한 최대 폭 안에 정렬해 넓은 화면에서도 과도한 바깥 여백을 만들지 않는다.
- 900px 이하의 일반 route: 햄버거·route title·문맥 action으로 구성한 Mobile App Bar와 오늘, 기록, AI, 캘린더, 나의 5개 하단 탭을 사용한다. 작성은 하단 탭에서 제거하고 App Bar, drawer, 오늘·기록·캘린더의 action으로 진입한다.
- 모바일 drawer는 profile, 새 기록, 오늘·AI·기록·캘린더·회고, 작성 중인 기록, 최근 기록, 즐겨찾기, 설정과 개인정보 진입을 제공한다. 열린 동안 body scroll을 잠그고 focus를 가두며 Escape·backdrop 닫기 뒤 hamburger로 focus를 복구한다.
- `/write`에서는 Mobile App Bar와 하단 navigation을 렌더링하지 않고 editor에 화면을 양보한다. App Bar, 하단 navigation, drawer, toast, dialog, AI composer와 editor toolbar는 `env(safe-area-inset-*)`를 반영한다.
- AppShell은 `window.visualViewport`의 높이와 offset을 CSS 변수로 동기화한다. 모바일 키보드 inset이 120px을 넘으면 하단 navigation을 숨기고 AI composer와 editor toolbar를 보이는 visual viewport 위로 이동한다.
- 작성 prompt, 상세 관련 기록, 캘린더 선택 날짜 기록, 회고 요약은 별도 context column이 아니라 해당 화면의 본문 흐름 안에 둔다.
- AppShell은 skip link를 제공한다. 일반 route 이동 후 main에 focus하고, 작성 route는 main focus를 건너뛰어 editor 제목 input의 autofocus를 유지한다.

## CSS와 semantic token 경계

- 전역 import 순서는 Pretendard, `reset.css`, `tokens.css`, `globals.css`, `utilities.css`이며 feature CSS가 그 위에서 semantic token만 소비한다.
- `tokens.css`가 canvas/sidebar/surface, primary/secondary/tertiary text, border, 한 가지 Moodi accent, status, spacing, radius, shadow, motion, z-index를 소유한다. feature TypeScript나 page CSS는 같은 palette 값을 다시 정의하지 않는다.
- mood 색은 dot, badge, 작은 icon과 chart data에만 사용하고 page background나 CTA에는 사용하지 않는다.
- `paper`와 `midnight`는 같은 semantic token 이름에 light/dark 값만 제공한다. theme preview 색도 CSS token이 소유한다.
- section 구분은 typography, spacing, divider를 먼저 사용한다. 배경·border·radius를 모두 가진 surface 안에 같은 장식 surface를 다시 중첩하지 않으며, card는 독립 콘텐츠 객체·출처·상태·행동 경계를 함께 전달할 때만 사용한다.
- button, link, input과 native `summary`를 포함한 키보드 조작 요소는 일관된 `focus-visible` ring을 사용한다.
- 짧은 page/menu/modal/state motion을 제공하되 `prefers-reduced-motion`에서는 animation과 smooth scroll을 줄인다.

## Diary domain과 저장 경계

### 모델 분리

- Domain: `DiaryEntry`, `DiaryImage`, `WeatherContext`, `LocationContext`, `AIInsight`, `DailyCheckIn`
- AI 대화 contract: `AIConversation`, `JournalAIMessage`, `JournalSource`, `JournalAIService`; Diary domain이나 persistence entity와 혼용하지 않는다.
- `DiaryImage.role`은 선택적 `cover | inline`이다. 신규 이미지는 역할을 명시하고, role이 없는 기존 데이터는 `diaryImageService`가 해당 URL의 `contentHtml` 참조 여부로 legacy standalone/inline을 구분한다.
- Application input: `CreateDiaryEntryInput`, `UpdateDiaryEntryInput`, `DiaryDraft`, `SaveDiaryDraftInput`, `DiaryEntryFilters`
- View model: 월간 날짜 표시 전용 `CalendarDayViewModel`; mood label/icon/color는 `diaryUiConfig`의 UI metadata가 소유한다.
- Persistence entity: `StoredDiaryEntryV2`, `DiaryStorageEnvelopeV2`, `DiaryDraftEnvelopeV1`; Repository 파일 밖으로 노출하지 않는다.
- Repository contract: 비동기 `DiaryRepository`; 향후 API adapter도 같은 CRUD/draft contract를 구현한다.
- 블록 문서: `contentHtml`은 TipTap이 생성한 문서 구조·서식·인라인 이미지 블록을 보존하고, `content`는 검색·분석·legacy 호환용 평문을 보존한다. 둘은 같은 사용자 원문의 서로 다른 표현이며 UI view model이나 persistence entity로 혼용하지 않는다.

### Backend persistence와 device-local preference

| Key | Version | 내용 |
| --- | --- | --- |
| `moodi.mvp.theme.v1` | 기존 preference | canonical `paper | midnight` theme name |
| `moodi.ui.sidebar-collapsed.v1` | UI preference | desktop Sidebar 접기 여부를 문자열 boolean으로 저장 |

Diary/draft/AI/settings의 canonical persistence는 backend다. 프런트는 session cookie를 localStorage에 복제하지 않으며, `/api/v1/auth/session`의 csrfToken만 메모리에 둔다. 아래 legacy key 규칙은 이전 local export를 backend import v1으로 옮길 수 있게 하는 historical compatibility 범위다.

1. v2 key가 있으면 schema와 모든 필드를 검증·정규화해 읽는다.
2. v2가 없고 legacy v1이 있으면 canonical v2로 비파괴 migration하고 v2를 저장한다.
3. 두 key가 모두 없을 때만 별도 seed 파일의 샘플 기록을 저장한다.
4. v2의 빈 `entries` 배열은 전체 삭제 후의 유효한 상태다. 새로고침해도 seed를 다시 만들지 않는다.
5. malformed data, storage 접근 실패, write 실패는 `DiaryRepositoryError` code와 사용자용 message로 store에 전달한다.
6. 지원 브라우저에서는 Web Locks로 같은 origin의 여러 탭 write를 직렬화하고, 미지원 환경에서는 Repository instance queue로 직렬화한다.
7. entries와 draft는 순서대로 독립 로드한다. draft만 손상되면 entries는 `ready`로 유지하고, draft를 제외했다는 비치명적 경고를 표시한다. 전체 초기화는 entries 저장소를 읽지 못한 경우에만 제안한다.
8. theme preference는 `paper | midnight`만 canonical 값으로 사용한다. 기존 `forest | rose | ocean` 값은 사용자 데이터 삭제 없이 `paper`로 정규화한다.
9. AI 대화 Repository는 별도 v1 envelope을 검증하고 손상된 값을 빈 목록으로 오인하지 않는다. `createConversation`과 `updateConversation(id, updater)`를 분리하며, update는 사라진 대화를 다시 만드는 upsert가 아니다. 저장 전 최근 message 80개로 먼저 제한한 뒤 검증하고 전체 serialized 크기는 1.5MB로 제한한다.
10. 손상된 AI envelope은 `storage-corrupted` typed error로 전달한다. 복구 action은 AI 대화 key만 제거하며 Diary entries와 draft는 보존한다.

Legacy migration은 기존 id와 timestamp를 가능한 한 유지하고 한국어 mood를 canonical Mood로 변환한다. 기존 `tags`는 사용자가 직접 만든 태그라고 가정하지 않고 `aiTopics`와 `local-rule-mock` insight로 이동하며, 기존 score를 energy로 오인하지 않는다.

## 핵심 데이터 흐름

### 생성·수정

`DiaryEditor/QuickCheckIn -> hook validation -> diaryStore -> DiaryAnalysisService -> DiaryRepository -> localStorage`

- 긴 일기는 본문이 필요하다.
- 빠른 기록 UI는 감정을 필수로 받고 mood, energy, short note를 먼저 보여준다. 오늘 화면의 감정 선택은 해당 mood가 미리 선택된 빠른 기록으로 이어지고, activities는 같은 dialog의 선택적 disclosure에서 수집한다.
- 설정에서 AI 분석을 끄면 `shouldAnalyze: false`로 저장하고 `aiInsight`, `aiTopics`를 비운다.
- `local-rule-mock`의 반복·동시 발생 pattern은 현재 기록 하나만으로 만들지 않는다. 동일 mood·topic·activity 조합을 실제로 뒷받침하는 잠금 해제된 비-seed 과거 기록이 있을 때만 표시하며, 움직임 pattern의 감정명은 실제 선택된 행복/편안함 label만 사용한다.
- 저장 완료 후 store의 domain list를 교체하고 화면은 상세 또는 갱신된 홈 상태를 표시한다.

### 초안 자동저장

`DiaryEditor -> useDiaryEditor (650ms debounce) -> diaryStore.saveDraft -> DiaryRepository.saveDraft`

- 의미 있는 작성 값이 바뀌면 `saving -> saved` 상태가 된다.
- TipTap update마다 평문 `content`와 구조화 `contentHtml`을 함께 draft에 반영한다. 기존 `content`만 있는 기록은 안전하게 paragraph 문서로 변환하며 원본 평문을 유지한다.
- 작성 route를 떠날 때 pending draft를 flush한다.
- 신규 작성 화면은 저장된 draft를 복구하고 `restored`를 표시한다.
- 같은 entry의 편집 draft는 저장본보다 우선 복구한다. 다른 entry 또는 신규 draft가 있으면 수정 진입 전에 확인을 받아 단일 draft를 조용히 덮어쓰지 않는다.
- 명시적 일기 저장은 draft 제거를 시도한다. 신규 entry 저장 뒤 제거만 실패하면 남은 draft를 저장된 entry id에 연결해 다음 저장이 중복 create가 되지 않게 한다. 초안 비우기와 전체 삭제도 draft 제거를 시도한다.
- 작성 화면은 선택적 cover, 제목, 날짜·감정·energy·태그 한 줄 요약과 각 항목의 작은 popover, TipTap 본문을 문서 흐름 안에 둔다. 모바일 fixed toolbar는 블록·서식·목록·사진·감정·키보드 닫기를 제공하고, activity·날씨·위치·즐겨찾기·draft 삭제는 기록 옵션 disclosure에 둔다.
- browser online/offline 상태는 저장 상태 옆에 표시한다. 오프라인이어도 localStorage draft 자동저장 경계는 유지한다.
- slash command는 문단, 제목 1~3, 글머리/번호/할 일 목록, 인용문, 구분선, 인라인 이미지, Moodi 질문 블록만 새로 삽입한다. 접기와 감정 custom node는 기존 `contentHtml`을 비파괴적으로 렌더링하기 위한 legacy 호환 schema이며 신규 메뉴에는 노출하지 않는다. 코드와 코드 블록은 비활성화한다.
- 신규 이미지는 cover 또는 inline 역할로 저장한다. explicit inline은 현재 `contentHtml` 참조가 사라지면 제거한다. role 도입 전 이미지는 이전 HTML에서 참조된 경우에만 legacy inline으로 보고, 다음 HTML에서 참조가 사라질 때 metadata도 제거한다. explicit cover와 이전 HTML에서도 참조되지 않은 legacy standalone image는 본문 편집과 독립적으로 유지한다.

### 조회·회고

`diaryStore.entries -> diaryQueryService -> useDiaryWorkspace memo -> View`

검색, 복합 필터, 42개 calendar cell, 기준일 포함 최근 7일 chart, 회고용 관련 기록, 활동/태그/주제 빈도, 과거의 오늘, 관련 기록 fallback은 서버 상태를 복제하지 않고 현재 domain list에서 계산한다. 태그·주제·회고에서 `반복`, `자주`라는 표현은 같은 값이 실제로 2회 이상 확인될 때만 사용하고, 단일 기록은 기록 수를 알리는 중립 문구로 표시한다. 회고 화면은 이 결과 중 차트 1개, 핵심 주제 최대 4개, 관련 기록 최대 2개와 항상 존재하는 짧은 회고 문장을 우선 노출한다.

### AI 기록 탐색

`AIChatView -> useJournalAIChat -> JournalAIService -> JournalAIConversationRepository -> localStorage`

- Diary store가 `ready`가 되기 전에는 대화 저장소를 읽거나 source를 정리하지 않으며 화면에도 대화를 노출하지 않는다.
- `LocalJournalAIService`는 외부 모델을 호출하지 않고 현재 `DiaryEntry[]`의 한국어/ISO 날짜 범위·주·월·연도·계절, 감정, 제목·본문·태그·활동 keyword와 기간 비교를 로컬에서 검색·집계한다. 감정과 keyword가 함께 있으면 둘의 교집합만 선택하고, 한국어 복합 조사와 감정 활용형을 정규화한다. 일반 검색은 전체 일치 수와 출처로 표시하는 검색 점수 상위 대표 기록 최대 6개를 구분하며 기간 비교는 기간별 최대 3개를 출처로 사용한다.
- `isLocked`가 true인 기록과 `seed-` id의 최초 예시 기록은 후보와 출처에서 제외한다. 현재 lock은 암호화가 아니지만 검색 서비스가 지키는 명시적 privacy 경계다.
- assistant message는 `adapter: local-search`와 실제로 사용한 entry의 id·`entryUpdatedAt`, 날짜, 제목, 현재 원문 excerpt, mood를 `JournalSource`로 저장한다. 결과 없음도 추정 답변 대신 출처 없는 안내로 반환한다.
- 대화를 읽거나 전송·이름 변경할 때 source id·`entryUpdatedAt`을 현재 검색 가능한 entries와 다시 대조해 영속 대화도 갱신한다. 동시에 화면은 persistence 성공 여부와 무관한 동기 sanitizer를 거쳐 수정 source의 오래된 답변을 숨기고 삭제·잠금 source와 이전 원문을 즉시 제거한다.
- 완료된 assistant message는 최종 Repository update가 성공한 뒤에만 확정한다. 최종 저장이 실패하면 부분 응답을 비우고 미저장 답변을 반환하지 않으며 먼저 저장된 user message만 남긴다.
- UI는 제한된 heading·list·bold 문법을 React node로 렌더링하며 임의 HTML을 주입하지 않는다. 대화 생성·열기·이름 변경·삭제는 검색 전송 또는 다른 history mutation 중에 차단하고, sending·generating·실제 local chunk streaming·결과 없음·typed error와 Escape/버튼 취소는 hook이 orchestration한다.

### 가져오기·내보내기·전체 삭제

- 내보내기는 `moodi-diary-export` version 1 envelope을 JSON Blob으로 만든다.
- 가져오기는 JSON, 최대 12MB, format/version, entry 최소 계약을 검증하고 draft 삭제를 알리는 확인 dialog를 거쳐 전체 목록을 교체한다.
- 기록 하나 삭제, import 교체, 전체 삭제는 공통 접근성 ConfirmDialog를 거친다. 확정된 단일 삭제·import·전체 삭제·손상 저장소 복구는 진행 중 AI 검색에 먼저 취소 signal을 보내며, 단일 삭제는 저장된 AI source reference를 제거하고 나머지는 기존 AI 대화를 비운다.
- 전체 삭제는 draft/legacy snapshot을 잡고 해당 key를 먼저 제거한 뒤 v2 빈 배열을 마지막에 저장한다. Diary 단계가 실패하면 snapshot을 복원하며, 이후 auth profile/theme/Settings/Sidebar preference 제거가 일부 실패하면 Diary 삭제 성공을 유지하되 오류 toast로 남은 preference를 알린다. 별도로 내보낸 파일은 브라우저 밖의 사용자 파일이므로 삭제하지 않는다.

## Settings 경계

`SettingsPage -> useSettingsPreferences -> settingsStore -> settingsPreferenceService -> localStorage`

- `fontSize`: `small | medium | large`; `html[data-moodi-font-size]`의 root `font-size`에 적용해 rem 기반 화면 전체를 함께 조정한다.
- `isEntryLockEnabledByDefault`: 새 긴 일기와 빠른 기록의 기본 `isLocked`에 적용한다.
- `isAiAnalysisEnabled`: local rule 분석 실행 여부에 적용한다.
- 이 toggle은 entry 저장 시 `AIInsight` 생성만 제어한다. 외부 호출이 없는 `/ai` local-search route와 대화 저장 여부는 현재 별도 경계다.
- `aiTone`, `aiResponseLength`: 새로 저장하거나 수정하는 기록의 local rule 요약 말투와 topic/pattern/question 개수에 반영한다.
- `isPersonalizedQuestionsEnabled`: 켜면 기존 분석의 후속 질문을 우선 사용하고, 끄거나 분석 질문이 없으면 일반 질문 목록을 사용한다.
- 테마는 기존 Theme feature의 `ThemeSelector`, theme store, theme preference service를 재사용하되 선택지는 중립 라이트 `paper`와 중립 다크 `midnight` 두 가지다. `App`은 선택값을 `html`과 theme root wrapper에 함께 반영하고 `--color-canvas`를 브라우저 `theme-color` meta와 동기화한다. 저장 action은 boolean 결과를 반환해 Settings에서 성공/오류 toast로 매핑한다. 단, LoginPage와 SignupPage는 selector를 표시하지 않고 `prefers-color-scheme`을 구독해 browser/OS의 현재 light/dark 모드를 일시 적용하며, 이 과정은 저장 preference를 변경하지 않는다.
- Settings의 `계정` 행은 Google 기반 Login/Signup/MyPage overlay를 여는 명시적 profile 진입점이다. 로그인하지 않은 사용자는 Login에서 Signup으로 전환할 수 있다.
- 외부 사진, 일정, 음악, 날씨, 프로젝트, GitHub 카드는 모두 `미연결`이며 동의 안내와 disabled button만 제공한다.
- 개인정보 처리 안내는 현재 저장 위치, 처리 목적, 외부 전송 여부, 보존·삭제 범위를 Settings에 명시한다.

## Google 인증 경계

- `GoogleAuthPage`는 로그인과 회원가입을 같은 Google 계정 흐름의 서로 다른 user intent로 표시한다. 이메일·비밀번호 입력이나 자체 비밀번호 저장은 제공하지 않는다.
- LoginPage와 SignupPage에는 돌아가기 button과 theme selector를 렌더링하지 않는다.
- 권장 흐름은 `GoogleAuthPage -> useGoogleAuthPage -> authStore -> authGoogleService`다. 화면과 hook은 Google SDK, credential, cookie/session을 직접 다루지 않는다.
- 현재 `authGoogleService`는 Google client ID, callback, backend session endpoint 계약이 없어 명시적 typed error를 반환하는 TODO 경계만 제공한다. 연동 전에는 local profile을 성공 생성하지 않는다.
- 계약이 확정되면 Google ID token을 서버에서 검증하고, 브라우저에는 안전한 표시용 `AuthUser`만 전달하는 adapter로 구현한다. Google access/refresh token과 Moodi session 원문은 localStorage, URL, 로그에 남기지 않는다.

## AI와 외부 연동 경계

- `ApiJournalAIService`는 conversation/message/run REST resource와 SSE를 사용한다. user message는 durable `202` 응답 뒤 run event로 완료되며, cancellation은 `PUT /ai-runs/{id}/cancellation`을 요청한다.
- assistant 응답과 source는 backend `AIMessageDto`를 domain contract로 변환한 뒤 UI에 전달한다. redacted message는 원문 대신 안전한 안내로 표시한다.
- frontend는 local-search 또는 외부 모델을 직접 호출하지 않는다. `external-ai`는 이전 storage 호환용 예약값이다.
- 외부 context 카드도 OAuth/SDK scope와 동의 계약이 없으므로 실제 연결하지 않는다.
- Moodi 분석은 의료 상담이나 정신 건강 진단으로 표현하지 않는다.

## 실제 브라우저 검증 경계

- Playwright가 Vite 개발 서버를 자동 실행하고 설치된 Google Chrome과 Playwright Chromium을 사용한다.
- desktop Chrome 1440×900, desktop Chromium 1280×800, tablet landscape 1024×768, tablet 768×1024, touch mobile Chromium 430×932·390×844·360×800을 독립 프로젝트로 검증한다.
- 기존 visual suite는 오늘, 빠른 기록, Sidebar 펼침/접힘, 작성, slash menu, inline image, 기록 목록, 기록 상세, 캘린더, 회고, 설정과 dark theme을 촬영한다. mobile AI suite는 `artifacts/ui-review/mobile-ai`에 홈 3종, drawer, 하단 navigation, editor·keyboard, 상세, AI empty·conversation·sources·keyboard, 캘린더, 회고와 1440×900 AI 화면의 필수 15개 최종 이미지를 만든다.
- 기능 테스트는 기존 Diary CRUD·draft 복구와 함께 모바일 drawer focus/scroll lock, 오늘·기록·AI·캘린더·나 탭, 로컬 검색·출처 상세 이동·대화 관리·결과 없음·취소·저장 오류를 실제 상호작용으로 검증한다.
- auto fixture가 첫 navigation 전부터 `console.error`, `console.warning`, `pageerror`, 비정상 `requestfailed`, HTTP 400 이상 response를 수집하고 프로젝트 원인의 오류가 있으면 실패한다. Pretendard 실제 resource와 `document.fonts`도 확인한다.
- 접근성·시각 회귀는 dialog/drawer initial focus·focus trap·Escape·focus restore, 닫힌 overlay focus 차단, mobile 44px touch target·16px input, semantic text 대비 4.5:1, 가로 overflow, App Bar/main·composer/bottom navigation 겹침, safe area, visual viewport, 열린 overlay bounds, text clipping, geometry와 깨지거나 왜곡된 image를 포함한다.
- 기존 스크린샷은 `artifacts/ui-review`의 `before`, `iteration-1`, `iteration-2`, `final`에 둔다. 데스크톱 Main area 변경은 `main-area-iteration-1`, `main-area-iteration-2`에서 Chrome 1440×900과 Chromium 1280×800을 별도로 비교한다. 모바일 AI는 `test:e2e:mobile-ai:iteration-1`과 `iteration-2`로 두 차례 별도 검수한 뒤 `test:e2e:mobile-ai:final`이 `artifacts/ui-review/mobile-ai` 루트의 최종 15개 파일을 갱신한다. iteration directory는 비교 근거로 함께 보존한다.

## 아키텍처 결정 기록

| Date | Decision | Reason | Impact |
| --- | --- | --- | --- |
| 2026-07-11 | URL route를 History API 기반 custom hook으로 구현한다. | 현재 의존성을 유지하면서 직접 진입과 browser history를 지원하기 위해서다. | route parsing과 URL 변환은 `useDiaryRoute` 한 곳이 소유한다. |
| 2026-07-11 | Diary type을 domain/input/view model/persistence entity로 분리하고 비동기 Repository를 둔다. | UI, application, 저장 계약을 혼용하지 않고 향후 API adapter 교체점을 만들기 위해서다. | UI와 store는 localStorage 형식을 알지 못한다. |
| 2026-07-11 | 저장 형식을 v2 envelope로 변경하고 v1 migration과 별도 draft key를 제공한다. | 기존 기록을 보존하면서 canonical Mood와 확장된 DiaryEntry를 지원하기 위해서다. | 빈 v2 배열은 seed보다 우선하는 유효 상태다. |
| 2026-07-11 | AI는 메인 chat route가 아니라 저장 후 분석, 상세, 관련 기록, 회고에 배치한다. | 사용자 기록이 제품의 중심이어야 하기 때문이다. | 2026-07-14의 명시적 `/ai` local-search route 결정으로 superseded. 저장 시 `local-rule-mock` 분석은 유지한다. |
| 2026-07-11 | desktop은 조건부 3열 AppShell, mobile은 5탭 navigation을 사용한다. | 데스크톱 정보 밀도와 모바일 사용성을 모두 확보하기 위해서다. | 2026-07-13에 superseded. mobile 5탭 원칙만 유지한다. |
| 2026-07-11 | 제한적 glass와 cream/lavender/peach/rose/mist-blue palette를 다시 허용한다. | 당시 사용자 요청이 2026-06-18의 glass 전면 폐기·mobile-only 우선 결정을 supersede했다. | 2026-07-14 neutral semantic token 결정으로 superseded. 기록 목적으로만 남긴다. |
| 2026-07-13 | 3열 AppShell을 통합 Header와 단일 중심 content column으로 교체하고 정보는 점진적으로 공개한다. | 기록보다 메뉴·보조 패널·카드가 먼저 보이던 밀도를 낮추고 감정 기록에 집중시키기 위해서다. | desktop Sidebar와 ContextPanel, 기록 view switcher, dashboard형 통계를 제거한다. 보조 정보는 본문 disclosure 또는 profile menu로 이동하며 저장·검색·필터·분석·데이터 관리 계약은 유지한다. |
| 2026-07-13 | 빈 여백을 줄이는 대신 대표 기록, 실제 사진, 감정 check-in과 명확한 section 위계를 한 중심 흐름에 배치한다. | 콘텐츠를 삭제해 얻은 여백이 미완성 인상을 만들었고 기록의 감정적 맥락도 약해졌기 때문이다. | 당시 오늘·기록 첫 항목을 크게 표시했다. 기록 목록의 대형 첫 항목은 2026-07-15 Main area 결정으로 superseded하고, 오늘의 대표 기록 한 건과 실제 사진 강조만 유지한다. |
| 2026-07-13 | Playwright Chrome/Chromium을 UI 완료 조건의 자동 검증 경계로 둔다. | 정적 build만으로 실제 typography, responsive layout, CRUD, focus, storage persistence를 증명할 수 없기 때문이다. | 2026-07-14에 7개 viewport와 mobile AI 전용 2회 검수로 확장했다. 기존 before·iteration-1·iteration-2·final 체계는 유지한다. |
| 2026-07-14 | 긴 일기 작성기를 TipTap 기반 블록 문서로 교체하고 평문 `content`와 선택적 `contentHtml`을 함께 저장한다. | Notion처럼 유연한 키보드 중심 편집을 제공하면서 기존 검색·분석·localStorage 데이터를 비파괴적으로 유지하기 위해서다. | legacy 기록은 즉시 읽을 수 있고 신규/수정 기록만 블록 HTML을 추가한다. HTML은 Repository에서 실행 태그·event handler·외부 image source를 거부한다. |
| 2026-07-14 | 통합 Header를 접이식 Sidebar와 Document shell로 교체하고 전역 CSS를 reset/token/global/utility 계층으로 다시 구성한다. | 문서가 앱 chrome보다 중심이 되고 중복 reset·token 소유권을 제거하기 위해서다. | 같은 날의 neutral semantic token·264/232/72px 셸 결정으로 세부 규격이 superseded. |
| 2026-07-14 | UI 색상을 neutral semantic token과 하나의 Moodi accent로 수렴하고 `paper | midnight`만 canonical theme으로 유지한다. | 다색 page tint와 구형 alias가 화면별 불일치와 대비 회귀를 만들었기 때문이다. | feature CSS는 semantic/application token만 사용하고 mood 색은 dot·badge·chart에 제한한다. desktop Sidebar는 264px, 901~1100px에서는 232px, collapsed는 72px이며 상태를 localStorage에 보존한다. |
| 2026-07-14 | `/ai`를 외부 생성형 AI가 아닌 명시적 `local-search` 기록 탐색 route로 추가한다. | 외부 계약을 발명하지 않으면서 사용자가 자신의 실제 기록을 질문·비교하고 근거를 확인하게 하기 위해서다. | `JournalAIService`와 versioned 대화 Repository를 분리하고 잠금·seed를 제외한다. source는 현재 원문으로 재검증하며 삭제/import/전체 삭제가 참조 또는 대화를 정리한다. |
| 2026-07-14 | 모바일 App Bar·focus-trapped drawer와 오늘·기록·AI·캘린더·나 하단 탭을 사용한다. | 작은 화면에서 AI를 핵심 경로로 올리고 작성 화면과 키보드에 충분한 공간을 주기 위해서다. | 작성 탭을 제거하되 App Bar·drawer·화면 action으로 작성 진입을 유지한다. safe area와 visual viewport를 반영하고 Playwright를 430·390·360 모바일까지 확장한다. |
| 2026-07-15 | Sidebar 오른쪽 전체를 Main area로 정의하고 데스크톱 route·section의 장식용 외곽 card를 제거한다. | page 안에 다시 떠 있는 document/dashboard card를 만들지 않고 ChatGPT·Notion형 연속 작업 영역을 적극적으로 사용하기 위해서다. | 오늘 hero·질문, 일반 기록 목록, 작성·상세 원문, 캘린더와 회고 차트는 divider 중심으로 평면화한다. 임시저장, AI note·실제 source, 관련 기록, 입력·선택 control과 overlay처럼 독립 경계가 필요한 semantic card는 유지한다. |
| 2026-07-16 | 오늘 화면은 중립 surface 카드 중심으로 전환하고 `/ai`는 Main area 전체를 사용하는 compact chat shell로 확장한다. | 시작 화면의 행동과 기억을 더 빠르게 구분하고, 대화 화면의 불필요한 바깥 여백을 줄이기 위해서다. | 2026-07-15 결정 중 오늘 hero·질문·대표/최근 기록의 평면화만 supersede한다. 일반 기록·작성·상세·캘린더·회고의 평면형 원칙은 유지하며 AI message와 composer는 가독성 최대 폭을 유지한다. |
| 2026-07-16 | 오늘 화면의 card surface를 다시 제거하고 editorial section·divider 흐름으로 통합한다. | 사용자의 현재 요청에 따라 메인 화면에서 콘텐츠보다 외곽 카드가 먼저 보이지 않게 하기 위해서다. | 바로 앞 결정 중 오늘 hero·draft·질문·대표/최근 기록의 카드 부분만 supersede한다. `/ai` compact full-area shell은 유지하며 감정 선택과 CTA 같은 control surface만 허용한다. |
