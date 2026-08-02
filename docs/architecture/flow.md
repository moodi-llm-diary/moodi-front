# 흐름 문서 - moodi

## Backend integration 기준 흐름

이 절은 2026-07 backend integration 이후의 현재 구현이다. 아래에 남아 있는 localStorage/local-search 서술은 이전 MVP 흐름 기록이며, 현재 동작과 충돌하면 이 절과 `docs/api/specification.md`가 우선한다.

1. 앱은 `GET /api/v1/auth/session`으로 HttpOnly session을 확인하고 `csrfToken`을 메모리에만 둔다. session이 없으면 Diary 화면을 mount하지 않고 Google 로그인 화면을 표시한다.
2. 로그인 성공은 `POST /auth/login-attempts` → Google Identity Services credential → form `POST /auth/google-credentials` → session 재조회 순서다. credential/token은 React state·URL·localStorage에 저장하지 않는다.
3. `diaryStore.initialize`는 `ApiDiaryRepository.getEntries`와 `getDraft`를 호출한다. 목록 page는 detail DTO로 보완해 domain cache로 변환하며, UI가 backend DTO를 직접 사용하지 않는다.
4. 기록 create/image upload/message create는 idempotency key를, entry/draft mutation은 직전 ETag의 `If-Match`를, 모든 mutation은 memory CSRF header를 사용한다. version conflict와 problem code는 UI-safe error로 표시한다.
5. editor는 File을 `POST /diary-images`로 먼저 upload해 server image ID/content URL을 form state에 넣고, 이후 draft/entry body에는 `imageIds`만 보낸다.
6. export는 `GET /diary-data`가 만든 v2 attachment를 바로 내려받는다. import와 전체 삭제는 HEAD confirmation token과 dataset ETag를 얻은 뒤 PUT/DELETE하며 backend가 draft/conversation 정리를 원자적으로 수행한다.
7. `/ai`는 REST로 conversation/message/run을 만들고 backend SSE `message.delta`만 partial text로 표시한다. terminal event에서 message/source를 확정하며, 취소 시 stream abort와 `PUT /ai-runs/{id}/cancellation`을 함께 실행한다.
8. user setting은 GET/PATCH `/users/me/settings`으로 동기화한다. theme/sidebar만 device-local preference다.

## 1. 앱 초기화와 저장 migration

- Actor: 사용자
- Entry point: 앱 최초 mount 또는 새로고침
- Preconditions: browser localStorage 접근 가능 여부는 알 수 없음.
- Steps:
  1. `useDiaryWorkspace`가 `diaryStore.initialize`를 호출한다.
  2. store는 Repository의 `getEntries`를 먼저 읽고, 성공한 경우 `getDraft`를 독립적으로 읽는다.
  3. Repository는 `moodi.diary.entries.v2`를 먼저 찾는다.
  4. v2가 없고 `moodi.mvp.diary.entries.v1`이 있으면 canonical v2로 migration하고 저장한다.
  5. 두 entry key가 모두 없을 때만 `diarySeed.ts`의 seed를 v2로 저장한다.
  6. entries와 읽을 수 있는 draft를 Zustand에 넣고 status를 `ready`로 바꾼다.
- Validation: schema version, date/timestamp, canonical Mood/Activity/EntryType, array, boolean, energy 범위를 Repository가 검증한다.
- Empty state: v2 envelope의 `entries: []`는 유효하다. seed를 다시 만들지 않는다.
- Error state: entries storage 미지원 또는 corrupted JSON/schema는 status `error`와 message로 표시한다. draft만 손상된 경우 entries는 계속 표시하고 draft를 제외했다는 dismissible error toast를 보여준다.
- Permission behavior: 인증과 무관한 local browser data다.
- Retry or recovery: entries 오류 화면의 `다시 불러오기`가 initialize를 재호출한다. corrupted data를 자동 삭제하지 않으며, 전체 초기화는 entries를 읽을 수 없는 상태에서만 제안한다.
- Side effects: migration 또는 최초 seed에서만 v2 key를 작성한다.
- Related API: 없음.
- Related DB tables: 없음.

## 2. URL navigation

- Actor: 사용자
- Entry point: desktop Sidebar, Mobile App Bar·drawer·하단 navigation, page action, AI source card, 관련 기록 link, browser back/forward, URL 직접 진입
- Preconditions: browser History API 사용 가능.
- Steps:
  1. UI는 route key 또는 `DiaryLocation` intent를 `useDiaryRoute`에 전달한다.
  2. hook은 route를 pathname/query로 변환하고 `pushState` 또는 `replaceState`를 호출한다.
  3. location state가 바뀌면 `DiaryMvpPage`가 해당 route view를 렌더링한다.
  4. 사용자 route 이동 후 scroll을 위로 옮긴다. 최초 직접 진입은 browser의 자연스러운 Tab 순서와 skip link를 보존하고, 이후 일반 route 이동은 main content에 focus한다. 작성 route는 editor 제목 input의 autofocus를 유지한다.
  5. browser `popstate`에서는 현재 URL을 다시 파싱한다.
- Validation: entry detail/edit id는 URL decode 후 사용한다. 없는 `/entries/:id`는 detail empty state가 되고, 없는 `/write?entry=:id`는 신규 기록으로 오인해 저장하지 않도록 `/entries`로 replace 이동한다.
- Empty state: 없는 `/entries/:id`는 전체 기록으로 돌아가는 action을 표시한다.
- Error state: 알 수 없는 pathname은 `/`로 `replaceState`한다.
- Permission behavior: 현재 route별 인증 제한은 없다.
- Retry or recovery: browser back 또는 navigation으로 다른 route로 이동한다.
- Side effects: History stack, scroll, 일반 route의 main focus 변경. write route를 떠날 때 pending draft를 flush한다. `/write`에서는 Mobile App Bar와 하단 navigation을 렌더링하지 않는다.
- Related API: 없음.
- Related DB tables: 없음.

## 2-1. 데스크톱 사이드바 preference

- Actor: 사용자
- Entry point: 901px 이상 AppShell의 `사이드바 접기` 또는 `사이드바 펼치기`
- Preconditions: desktop Sidebar가 렌더링됨.
- Steps:
  1. `useSidebarPreference`가 mount 시 `moodi.ui.sidebar-collapsed.v1`을 읽는다.
  2. 값이 `true`이면 72px icon rail, 그 밖에는 1101px 이상 264px 또는 901~1100px 232px Sidebar를 렌더링한다.
  3. 사용자가 toggle하면 React state를 바꾸고 문자열 boolean을 같은 key에 저장한다.
  4. 펼친 상태에서는 단일 활성 draft와 최근 기록 최대 5개를 노출하고, 접힌 상태에서는 label을 accessible name과 title로 유지한다.
- Validation: 저장값은 문자열 `true`만 접힘으로 해석한다. 다른 값과 저장 접근 실패는 펼침으로 fallback한다.
- Empty state: draft 또는 최근 기록이 없으면 해당 보조 section만 렌더링하지 않는다.
- Error state: UI preference 읽기·쓰기는 best effort이며 실패해도 탐색과 Diary 저장을 막지 않는다.
- Permission behavior: 인증 요구 없음.
- Retry or recovery: 다음 toggle 또는 새로고침에서 다시 시도한다. 전체 데이터 삭제는 key를 제거하고 reset event로 현재 화면도 펼친다.
- Side effects: Sidebar localStorage key와 grid column 크기가 변경되고 Main area가 남은 viewport 폭 전체를 다시 점유한다.
- Related API: 없음.
- Related DB tables: 없음.

## 2-2. 모바일 App Bar, drawer, 하단 navigation과 keyboard viewport

- Actor: 사용자
- Entry point: 900px 이하의 write가 아닌 Diary route
- Preconditions: AppShell이 mobile layout을 렌더링함.
- Steps:
  1. Mobile App Bar는 hamburger, route title과 문맥 action을 표시한다. AI에서는 새 대화, 캘린더에서는 오늘 날짜, 오늘·기록·회고에서는 새 기록 action을 사용한다.
  2. 하단 navigation은 오늘, 기록, AI, 캘린더, 나 순서의 5개 button을 표시하고 현재 route에 `aria-current="page"`를 적용한다. 작성은 하단 탭에 두지 않는다.
  3. hamburger 또는 나는 modal drawer를 연다. drawer는 profile, 새 기록, 주요 route, 작성 중 draft, 최근 기록 최대 4개, 즐겨찾기 최대 3개, 설정과 개인정보 진입을 제공한다.
  4. 열린 drawer는 body scroll을 잠그고 첫 control에 focus하며 Tab/Shift+Tab을 내부에서 순환시킨다. Escape, 닫기 button 또는 backdrop은 drawer를 닫고 명시적 닫기에서는 hamburger로 focus를 복구한다.
  5. `AppShell`은 `visualViewport` resize/scroll, window resize와 orientation change에서 viewport height와 keyboard inset CSS 변수를 갱신한다.
  6. keyboard inset이 120px을 넘으면 keyboard-open layout으로 전환해 하단 navigation을 숨긴다. AI composer와 모바일 editor toolbar는 safe area와 keyboard inset 위에 배치한다.
- Validation: touch target 최소 44px, mobile input 최소 16px, fixed 영역과 콘텐츠·composer·toolbar가 겹치지 않아야 한다. drawer와 popover는 visual viewport 안에 있어야 한다.
- Empty state: draft/recent/favorite가 없으면 drawer의 해당 library section만 생략한다.
- Error state: visual viewport API가 없으면 `window.innerHeight`를 사용한다. navigation은 저장소와 무관하게 계속 동작한다.
- Permission behavior: drawer의 profile은 현재 mock auth 경계만 연다.
- Retry or recovery: orientation/viewport event에서 layout을 다시 계산하고 drawer를 다시 열 수 있다.
- Side effects: body overflow, focus, `--moodi-visual-viewport-height`, `--moodi-keyboard-inset`, keyboard-open class 변경.
- Related API: 없음.
- Related DB tables: 없음.

## 3. 빠른 기록 생성

- Actor: 사용자
- Entry point: 오늘 화면의 빠른 기록 button 또는 7개 감정 중 하나
- Preconditions: Diary store `ready`.
- Steps:
  1. `useQuickCheckIn.open`이 오늘 날짜의 빈 `DailyCheckIn`을 만들거나, `openWithMood`가 선택한 감정을 미리 넣고 dialog를 연다.
  2. 사용자는 Mood, energy, 선택적 한 줄 메모를 먼저 입력하고 필요할 때 같은 dialog의 disclosure에서 activities를 추가한다.
  3. hook은 Settings의 기본 lock과 AI 분석 사용 여부를 create input에 넣는다.
  4. store는 필요한 경우 local rule analysis를 만들고 Repository에 `type: quick` entry 생성을 요청한다.
  5. 성공하면 dialog를 닫고 form을 비우며 toast를 표시한다.
- Validation: 현재 UI는 Mood 선택을 필수로 한다. Repository는 quick entry에 mood, activity, shortNote 중 하나 이상을 요구하고 energy는 1~5 정수만 허용한다.
- Empty state: 아무 Mood도 선택하지 않으면 저장하지 않고 error toast를 표시한다.
- Error state: 분석 또는 Repository 실패 시 dialog를 유지하고 error toast를 표시한다.
- Permission behavior: 인증 요구 없음. 기본 lock은 암호화가 아닌 entry metadata다.
- Retry or recovery: 입력을 유지한 채 다시 저장한다. 저장 중에는 Escape, 닫기, backdrop으로 dialog를 닫을 수 없다.
- Side effects: entries state와 v2 localStorage 갱신, 선택한 설정에 따라 `local-rule-mock` insight 생성.
- Related API: 없음. 외부 AI API 미확정.
- Related DB tables: 없음.

## 4. 긴 일기 작성, 자동저장, 수정

- Actor: 사용자
- Entry point: `/write`, desktop 작성 CTA, Mobile App Bar·drawer·오늘/empty/calendar의 작성 action, `/write?entry=:id`
- Preconditions: Diary store `ready`.
- Steps:
  1. 신규 작성은 persisted draft가 있으면 복구하고, 없으면 오늘 날짜와 Settings 기본 lock으로 빈 editor를 만든다.
  2. 수정은 같은 entry의 persisted draft가 있으면 이를 우선 복구한다. 다른 entry/new draft가 있으면 확인 dialog에서 명시적으로 비운 뒤 기존 domain 값을 editor input으로 변환한다.
  3. title, TipTap block document, mood, energy, activities, tags, cover/inline images, weather, location, favorite, lock 변경은 hook state에 반영된다. block update는 평문 `content`와 구조화 `contentHtml`을 함께 만든다.
  4. 의미 있는 변경이 있으면 auto-save 상태를 `saving`으로 바꾸고 650ms 후 draft를 저장한다.
  5. 비오늘 날짜나 질문 본문으로 시작하면 route 이동 전에 즉시 draft를 저장한다. 실패하면 `error`와 재시도 revision을 남긴다.
  6. `/` 메뉴에서 텍스트·제목 1~3·사진·인용문·구분선·글머리/번호/체크 목록·Moodi 질문을 검색하고 키보드로 삽입한다. code/code block은 비활성화하고, 접기·감정 custom node는 기존 HTML rendering만 유지한다. 선택 텍스트 bubble menu와 선택적 block handle로 서식·이동·삭제·변환한다.
  7. 문서 상단에는 선택적 cover를 두고, 제목 아래 날짜·감정·energy·태그를 한 줄로 표시한다. 각 항목을 누르면 viewport 안의 작은 popover에서 수정하고 Escape로 닫으면 trigger에 focus를 복구한다.
  8. 본문 아래에서 mood, 인라인 사진, 태그, 잠금 도구를 사용한다. activity·날씨·위치·즐겨찾기와 draft 삭제는 기록 옵션에서 필요할 때 연다.
  9. cover와 inline image는 각각 `role`을 명시한다. TipTap에서 explicit inline block을 삭제하면 현재 `contentHtml`에 없는 metadata를 제거한다. role 없는 image는 이전 HTML에서 참조되었던 경우에만 legacy inline으로 보고 다음 HTML에서 참조가 사라질 때 제거한다. explicit cover와 legacy standalone은 유지한다.
  10. browser가 offline이면 toolbar 상태를 `오프라인 · 브라우저에 저장`으로 바꾸고 같은 localStorage draft 저장을 계속 사용한다.
  11. 모바일에서는 App Bar와 하단 navigation을 숨기고 전용 editor toolbar를 safe area 위에 둔다. keyboard가 열리면 visual viewport와 keyboard inset을 사용해 toolbar를 키보드 위로 옮긴다.
  12. Moodi 질문 block은 질문 새로 받기, 닫기, 바로 답변, 일반 문단 변환을 제공한다.
  13. 저장 시 journal 평문 본문을 검증하고 store create/update를 호출한다.
  14. 설정이 허용하면 분석을 생성하거나 갱신한다. 허용하지 않으면 insight/topic을 제거한다.
  15. 명시 저장 시작 시 대기 중인 650ms timer를 취소한다. entry 저장 성공 뒤 draft 제거를 별도 시도하고 `/entries/:id`로 이동한다. 신규 entry의 draft 제거만 실패하면 남은 draft를 저장된 entry id에 연결해 다음 저장이 update가 되게 한다.
- Validation: journal은 trim한 content 한 줄 이상, quick 수정은 감정·활동·한 줄 중 하나가 필요하다. cover와 inline을 합친 image는 최대 3장이고 role은 `cover | inline`만 허용한다. 사용자 첨부는 base64 image Data URL과 디코딩 기준 장당 350KB 경계를 적용하고, seed는 앱이 소유한 루트 상대 로컬 자산 경로만 허용한다. UI와 Repository가 사용자 첨부에 같은 경계를 검증한다. block HTML의 실행 가능 태그/속성과 외부 image source도 Repository가 거부한다. energy는 1~5 정수다.
- Empty state: 빈 신규 editor는 draft로 저장하지 않는다.
- Error state: field/entry Repository 오류는 editor error와 toast로 표시하며 draft 또는 form을 유지한다. entry 저장 뒤 draft 정리만 실패하면 상세로 이동하고, 신규 draft는 저장 entry에 연결한 결과까지 오류 toast로 알린다.
- Permission behavior: 인증 요구 없음. 위치와 날씨는 사용자 직접 입력이며 자동 수집하지 않는다.
- Retry or recovery: 자동저장 실패 후 추가 변경 또는 route 이탈 flush로 재시도할 수 있다. 새로고침 후 draft를 복구한다. 임시저장 비우기로 제거할 수 있다.
- Side effects: draft key 또는 v2 entries 갱신, inline block 삭제 시 연관 metadata 정리, entry 저장 성공 시 draft key 제거 시도, History route 변경. draft 정리 실패 시 key를 유지하고 오류 toast를 표시한다.
- Related API: 없음. image upload, 위치, 날씨 endpoint 없음.
- Related DB tables: 없음.

## 5. 전체 기록 검색과 필터

- Actor: 사용자
- Entry point: `/entries`
- Preconditions: entries가 store에 로드됨.
- Steps:
  1. `useDiaryWorkspace`가 entries와 `DiaryEntryFilters`를 query service에 전달한다.
  2. query는 날짜와 updatedAt 역순으로 정렬한다.
  3. 검색어를 title, content, shortNote, user tag, AI topic, activity의 canonical 값과 한국어 label, 감정의 한국어 label, location, weather에서 찾는다.
  4. date range, moods, activities, user tags, favorite, image, EntryType filter를 함께 적용한다.
  5. 모든 결과를 `diaryDate`별 section으로 그룹화하고 첫 항목을 포함한 모든 기록을 같은 divider row 체계로 잇는다. 조건부 thumbnail은 explicit cover를 우선하며 없으면 본문 inline image를 fallback으로 사용한다.
  6. 검색과 복합 filter는 사용자가 요청할 때만 열고, 목록 항목마다 둥근 card를 반복하지 않는다.
  7. 날짜 그룹의 기록 선택은 `/entries/:id`로 이어진다.
- Validation: filter 값은 typed option만 UI에서 제공한다.
- Empty state: 전체 data가 없거나 조건에 맞는 결과가 없을 때 각각 작성 또는 filter clear action을 표시한다.
- Error state: 조회는 순수 계산이며 저장 오류가 없다.
- Permission behavior: 인증 요구 없음.
- Retry or recovery: 검색어/필터를 수정하거나 전체 filter를 지운다.
- Side effects: filter는 현재 session React state만 변경한다.
- Related API: 없음.
- Related DB tables: 없음.

## 6. 기록 상세, 관련 기억, 수정·삭제

- Actor: 사용자
- Entry point: `/entries/:id`, 최근 기록, calendar, tag result, related entry
- Preconditions: URL id와 일치하는 entry 조회.
- Steps:
  1. PageHeader는 날짜를 먼저, 그다음 제목과 기록 유형, mood·energy·태그 최대 2개·잠금 요약을 표시한다. favorite는 상단의 보조 action이다.
  2. standalone image 중 첫 장을 본문 앞 cover로 표시하고, 같은 TipTap typography로 사용자 원문과 inline image를 읽는다.
  3. 나머지 standalone image는 원문 뒤 추가 사진으로 표시하며, 이는 주로 role 도입 전 legacy gallery를 보존한다. 이어서 activity·날씨·장소·전체 user tags·Moodi aiTopics 같은 추가 metadata를 `기록 정보` disclosure에서 빈 값 없이 표시한다.
  4. AIInsightCard는 짧은 summary를 우선 표시하고 pattern/question은 해당 entry에서만 접고 펼친다.
  5. 명시적 related id가 있으면 해당 entries를, 없으면 mood/topic overlap fallback 최대 3개를 표시한다.
  6. 관련 기록 뒤의 `기록 관리` section에서 더보기 메뉴를 열어 수정하면 `/write?entry=:id`로 이동한다. 삭제는 confirmation을 열고 confirm 후 Repository에서 제거한다.
  7. 마지막에는 날짜순 previous/next entry로 이동할 수 있다.
- Validation: 삭제할 entry가 store에 있어야 한다.
- Empty state: id가 없거나 삭제된 entry면 `기록을 찾을 수 없어요`와 목록 복귀 action을 표시한다. insight가 없으면 AI empty 안내를 표시한다.
- Error state: delete/favorite 실패는 error toast와 기존 화면을 유지한다.
- Permission behavior: `isLocked`는 잠금 표시만 제공하며 현재 인증/암호 검증은 없다.
- Retry or recovery: dialog 취소, 재시도, 전체 기록 복귀.
- Side effects: favorite/delete 시 v2 저장 갱신, delete 성공 시 AI 대화의 해당 source reference와 오래된 답변 원문을 가린 뒤 `/entries` 이동. AI 정리만 실패하면 Diary 삭제는 유지하고 warning을 표시한다.
- Related API: 없음.
- Related DB tables: 없음.

## 7. 월간 캘린더 탐색

- Actor: 사용자
- Entry point: `/calendar`
- Preconditions: entries가 store에 로드됨.
- Steps:
  1. query service가 월요일 시작 42개 `CalendarDayViewModel`을 만든다.
  2. 각 날짜는 기록 수, 대표 mood, journal/quick count, image 여부를 계산하지만 cell에는 대표 mood와 기록/사진 indicator 최대 2개만 표시한다.
  3. 사용자는 이전/다음 월, 오늘, 특정 날짜를 선택한다.
  4. Mood와 user tag/AI topic filter는 필요할 때 disclosure에서 적용한다.
  5. 선택 날짜 entries는 캘린더 아래 본문 section에서 표시되고 상세로 이동할 수 있다.
  6. 선택 날짜 작성은 active draft가 없으면 해당 날짜 editor를 준비하고, 있으면 기존 draft를 우선 복구한다.
- Validation: selected date는 `YYYY-MM-DD` key다.
- Empty state: 선택 날짜에 기록이 없으면 해당 날짜 작성 action을 표시한다.
- Error state: 순수 query 계산에는 외부 실패가 없다. 작성 준비 중 draft clear 실패는 toast를 표시한다.
- Permission behavior: 인증 요구 없음.
- Retry or recovery: filter를 바꾸거나 오늘로 이동한다.
- Side effects: cursor/selection/filter는 session state만 변경한다. 작성 action은 draft 상태를 정리할 수 있다.
- Related API: 없음.
- Related DB tables: 없음.

## 8. 회고와 태그 탐색

- Actor: 사용자
- Entry point: `/insights`, `/tags`
- Preconditions: entries가 store에 로드됨.
- Steps:
  1. query service가 전체/이번 달 data와 기준일을 포함한 최근 7일 rolling window를 분리해 집계하고, 최근 7일 기록을 우선하는 관련 기록을 계산한다.
  2. 회고는 사람이 읽는 요약, 보조 수치, 최근 7일 chart 1개, 핵심 주제 최대 4개, 관련 기록 최대 2개를 표시한다. 핵심 주제와 `자주` 표현은 동일 값이 2회 이상 확인될 때만 노출한다.
  3. 반복 pattern·주제·감정은 `count >= 2`일 때만 반복으로 표현한다. 단일 기록뿐이면 기록 수를 알리는 중립 문구를 사용하고, 최근 7일 기록이 없을 때도 안내 문장을 반환한다.
  4. 기록이 적으면 초기 사용자 안내와 작성 action을 함께 표시한다.
  5. Tag index는 user/activity/mood/aiTopic category를 별도로 계산한다.
  6. 태그 화면은 한 번에 한 category만 표시하며 item 선택 시 matching entries를 보여주고 상세로 이동한다.
- Validation: 집계는 canonical domain field만 사용한다. AI topic을 user tag로 합치지 않는다.
- Empty state: entries 0이면 첫 기록 action, category data가 없으면 설명형 empty state를 표시한다.
- Error state: client-side query이므로 외부 오류 없음. invalid persistence data는 초기화 단계에서 차단한다.
- Permission behavior: 인증 요구 없음.
- Retry or recovery: 기록을 추가하거나 선택을 해제한다.
- Side effects: 선택 category는 session state만 변경한다.
- Related API: 없음. analytics endpoint 없음.
- Related DB tables: 없음.

## 9. Settings preference

- Actor: 사용자
- Entry point: `/settings`
- Preconditions: Settings store가 service 기본값 또는 저장값으로 동기 초기화됨.
- Steps:
  1. `계정` 행은 Google 기반 Login/Signup/MyPage overlay를 열고, `태그와 주제` 행은 `/tags`로 이동한다.
  2. 사용자는 기본으로 열린 화면 설정 disclosure에서 `paper | midnight` ThemeSelector와 font size를 선택한다.
  3. 새 entry 기본 lock, AI analysis, AI tone, response length, personalized question preference와 외부 연결·데이터 관리·개인정보 안내는 필요할 때 각 disclosure를 연다.
  4. hook action은 settings service에 versioned envelope 저장을 요청한다.
  5. 저장 성공 후 Zustand preference를 갱신하고 toast를 표시한다.
  6. App root가 font size를 반영하고, 신규 entry hook이 lock/AI enable 값을 사용한다.
  7. 개인정보 처리 안내는 localStorage 저장, 로컬 집계 목적, 외부 미전송, 보존·삭제 범위를 표시한다.
- Validation: 각 string preference는 정의된 option 목록만 허용하고 invalid stored 값은 기본값으로 복구한다.
- Theme compatibility: 저장된 `forest | rose | ocean`은 사용자 데이터를 지우지 않고 `paper`로 정규화하고, `App`은 canonical theme을 `html`과 theme root wrapper에 함께 반영한 뒤 현재 `--color-canvas`를 브라우저 `theme-color` meta와 동기화한다.
- Empty state: 저장값이 없으면 medium font, lock off, AI on, calm guide, balanced, personalized questions on을 사용한다.
- Error state: write 실패 시 기존 preference를 유지하고 persistence error toast를 표시한다.
- Permission behavior: 인증 요구 없음. Settings의 계정 action은 Google Login/Signup/MyPage 경계로 전달하며 shell의 profile action도 같은 경계를 재사용한다.
- Retry or recovery: 같은 option을 다시 선택할 수 있다.
- Side effects: settings/theme localStorage와 root CSS attribute 갱신.
- Related API: 없음.
- Related DB tables: 없음.

`aiTone`과 `aiResponseLength`는 신규/수정 기록의 local-rule-mock 요약 말투와 결과 항목 수에 적용한다. 개인화 질문을 켜면 저장된 insight의 후속 질문을 우선 사용하고, 끄거나 사용할 질문이 없으면 일반 질문 목록을 사용한다. 외부 AI contract는 여전히 미확정이다.

## 10. 외부 데이터 연결

- Actor: 사용자
- Entry point: `/settings` 외부 데이터 연결 section
- Preconditions: provider 계약 미확정.
- Steps:
  1. 사진, 일정, 음악, 날씨, 프로젝트, GitHub source를 하나의 설정 group 안 divider row로 배치하고 `미연결`로 표시한다.
  2. source별로 동의 후 어떤 범위를 연결할지 안내한다.
  3. 연결 button은 disabled 상태로 표시한다.
- Validation: 실제 token, permission, data를 요청하지 않는다.
- Empty state: 모든 provider는 미연결이 정상 상태다.
- Error state: 실제 호출이 없으므로 provider 오류 없음.
- Permission behavior: 사용자 동의 전 자동 수집으로 표현하지 않는다.
- Retry or recovery: 계약 확정 전에는 없음.
- Side effects: 없음.
- Related API: 미확정. OAuth/SDK endpoint, scope, field, timeout, retry, failure mapping 필요.
- Related DB tables: 없음.

## 11. 데이터 내보내기, 가져오기, 전체 삭제

- Actor: 사용자
- Entry point: `/settings` 내 데이터 관리
- Preconditions: Diary store `ready`.
- Steps:
  1. 내보내기는 현재 entries를 `moodi-diary-export` version 1 JSON Blob으로 내려받는다.
  2. 가져오기는 선택한 file을 읽고 type/name, 12MB 제한, JSON, format/version, entry 최소 필드를 검증한다.
  3. 검증 성공 시 import confirmation에서 현재 목록과 draft 정리를 알린다. confirm 시 진행 중 AI 요청에 먼저 취소 signal을 보낸 뒤 Repository `replaceEntries`로 전체 목록을 교체하고, 이전 entry를 근거로 한 AI 대화를 모두 지운 뒤 draft 제거를 별도 시도한다.
  4. 전체 삭제는 all confirmation을 연다. confirm 시 진행 중 AI 요청을 먼저 취소한 뒤 draft/legacy snapshot을 잡아 두 key를 제거하고 v2 빈 envelope을 마지막에 저장한다. Diary 단계 실패 시 snapshot을 복원한다.
  5. Diary 삭제 성공 뒤 AI 대화 전체를 지우고 profile/theme/settings/sidebar key를 각각 제거해 메모리 기본값을 적용한다. Sidebar는 reset event로 현재 화면에서도 즉시 펼친다. 손상 Diary 저장소 복구도 AI 대화를 함께 정리한다.
- Validation: import id/type/date/timestamp/mood/energy/array/image/favorite/lock 최소 계약. Repository가 전체 field를 다시 정규화하고 중복 id를 차단한다.
- Empty state: entries가 0이어도 유효한 export file을 만들 수 있다.
- Error state: file parse/validation, duplicate id, 목록 storage write 실패는 toast를 표시하며 현재 목록을 유지한다. 목록 교체 후 AI 대화 또는 draft 정리만 실패하면 imported entries를 유지하고 warning/error toast 후 `/entries`로 이동한다. 전체 Diary 삭제 실패는 snapshot 복원을 시도하며, Diary는 삭제됐지만 AI 대화/profile/theme/settings/sidebar 일부 제거가 실패하면 부분 성공을 명시한다.
- Permission behavior: browser local file 선택과 download만 사용한다.
- Retry or recovery: confirm 취소, 올바른 file 재선택, 삭제 전 export.
- Side effects: object URL 생성/해제, file download, confirm 시 v2 entries 교체와 AI 대화·draft 정리 시도 또는 empty persist, profile/theme/settings store와 Sidebar preference reset.
- Related API: 없음.
- Related DB tables: 없음.

## 12. Local rule mock 분석

- Actor: store/application
- Entry point: AI 분석이 켜진 entry create 또는 분석 관련 field update
- Preconditions: `isAiAnalysisEnabled === true`.
- Steps:
  1. store가 title/content/shortNote/mood/activities/tags를 `DiaryAnalysisInput`으로 변환한다.
  2. local service가 regex topic, emotion label, pattern, follow-up question을 계산한다. 반복 또는 동시 발생 pattern은 현재 기록만으로 단정하지 않고 동일 조합을 실제로 지원하는 `relatedEntries`가 있을 때만 만든다. 움직임 pattern은 지원 기록과 현재 기록에 실제 선택된 행복/편안함 label만 사용한다.
  3. current entries에서 잠금 해제된 비-seed 사용자 기록만 대상으로 mood/topic/activity/tag overlap related ids 최대 3개를 계산하고, 화면에서도 저장된 related id를 현재 상태로 다시 검증한다.
  4. `source: local-rule-mock`과 generatedAt을 포함한 AIInsight를 Repository input에 넣는다.
- Validation: 사용자 원문과 분석 result를 별도 field로 유지한다.
- UI behavior: 상세에서는 summary 1개를 먼저 보여주고, 펼쳤을 때 pattern 1개와 follow-up question 1개까지만 표시한다.
- Empty state: 분석할 text가 적어도 mood/activity 기반 summary를 반환한다. 분석이 꺼져 있으면 insight/topic을 저장하지 않는다.
- Error state: service/저장 실패는 create/update 전체 실패로 전달한다.
- Permission behavior: 외부 전송이 없으며 현재 browser entries만 사용한다.
- Retry or recovery: 사용자는 내용을 수정해 다시 저장하거나 AI 분석을 끌 수 있다.
- Side effects: aiInsight와 aiTopics가 entry에 저장된다.
- Related API: 없음. 외부 AI endpoint/auth/timeout/retry/cancellation/rate limit/error mapping 미확정.
- Related DB tables: 없음.

## 12-1. Journal AI 로컬 기록 탐색

- Actor: 사용자
- Entry point: `/ai`, desktop `AI와 대화`, mobile `AI` tab 또는 drawer
- Preconditions: Diary store `status === ready`이고 AI 대화 localStorage에 접근 가능. `ready` 전에는 대화 load와 source sanitize를 수행하지 않는다.
- Steps:
  1. `useJournalAIChat`이 `JournalAIService.getConversations`로 v1 대화 envelope을 읽고 최신 대화를 활성화한다. 화면에 전달할 때마다 현재 ready entries 기준 동기 sanitizer를 적용해 persistence refresh 실패와 무관하게 수정·삭제·잠금 source의 오래된 원문을 가린다.
  2. 사용자는 최대 1,200자의 질문을 직접 입력하거나 추천 질문을 선택한다. active 대화가 없으면 새 대화를 만들고 첫 질문으로 title을 만든다.
  3. service는 `adapter: local-search` user message를 먼저 저장해 `sending`을 끝낸 뒤 `generating` event와 650ms의 취소 가능한 로컬 검색을 시작한다.
  4. `LocalJournalAIService`는 현재 entries에서 `isLocked` 또는 `seed-` id를 제외하고 날짜 범위, 감정, 제목·본문·태그·주제·활동 keyword와 기간 비교를 계산한다. 감정+keyword는 교집합이며 한국어 복합 조사·감정 활용형을 정규화한다. `이번 주 기록을 세 문장으로 정리해줘`, `최근에 편안하다고 쓴 날들의 공통점은 뭐야?`, `내가 자주 걱정한 주제를 찾아줘`, `작년과 올해의 학교생활 관련 기록을 비교해줘` 같은 직접 예문을 지원한다.
  5. 결과가 있으면 일반 검색의 전체 match 수와 출처로 표시할 검색 점수 상위 대표 기록 최대 6개를 구분한다. 기간 비교는 각 기간의 전체 match 수와 대표 source 최대 3개씩을 구분하고, 실제 사용 entry의 id·`entryUpdatedAt`, 날짜, 제목, 현재 원문 excerpt와 mood를 source로 만든다.
  6. local adapter가 실제 누적 content chunk를 전달하는 동안 `streaming`으로 안전하게 렌더링한다. 완료된 assistant message와 source의 Repository update가 성공한 뒤에만 응답을 확정하며, 최종 저장 실패 시 pending answer를 제거하고 먼저 저장한 user message만 유지한다.
  7. source card를 선택하면 `/entries/:id`로 이동하고 browser Back으로 `/ai`의 대화 상태를 복구한다.
  8. 대화 history에서 새 대화, 기존 대화 열기, 이름 변경, 삭제 confirmation을 수행한다. 전송 또는 다른 history mutation 중에는 이 동작을 모두 차단하고, 중단 button은 AbortSignal을 취소한다.
  9. 대화를 다시 읽을 때 저장 source를 현재 검색 가능한 entries와 대조한다. 수정된 source는 snapshot을 갱신하고 오래된 답변을 숨기며, 삭제·잠금 전환 source는 제거하고 영속화를 별도 시도한다.
- Validation: 빈 질문, 1,200자 초과 질문, trim 후 빈/80자 초과 title을 차단한다. Repository는 create와 update(updater)를 분리하고 update를 upsert하지 않으며, 저장 mutation은 최근 message 80개로 먼저 제한한 뒤 검증한다. source는 실제 entry id와 현재 원문의 substring이어야 하며 source 없이 사건·원인을 추정하지 않는다.
- Query examples: `지난달 프로젝트 때문에 힘들었던 날을 찾아줘`는 프로젝트 keyword와 피곤함 감정의 교집합으로, `학교에서는 친구에게는 어떤 생각이 반복적으로 등장했는지 확인해줘`는 복합 조사를 제거해 검색한다. `최근 한 달 동안 기분이 좋아진 계기를 찾아줘`는 감정 활용형을 행복으로 해석한다.
- Empty state: 대화 없음, 질문 결과 없음은 정상 완료 상태다. 결과 없음은 잠금 기록이 제외됨을 알리고 검색어/기간 변경을 안내한다.
- Error state: 손상된 conversation envelope은 `storage-corrupted`, 그 밖의 storage 접근·저장 실패와 존재하지 않는 conversation은 typed error message와 retry를 표시한다. UI 계약은 network·auth-expired·service-unavailable·source-load-failed도 구분하지만 현재 local adapter는 발생하지 않는 외부 오류를 가장하지 않는다.
- Permission behavior: 현재 lock은 인증 permission이 아니지만 local-search 후보에서 강제로 제외한다. 최초 seed도 사용자 원문으로 취급하지 않는다.
- Retry or recovery: retry로 저장소를 다시 읽고, `storage-corrupted` 확인 dialog에서는 AI 대화 key만 초기화해 Diary entries/draft를 보존한다. 취소한 검색은 user message를 유지하고 composer에 질문을 복원한다.
- Side effects: `moodi.journal-ai.conversations.v1`만 갱신한다. 단일 Diary 삭제는 source reference를 제거하고 import/전체 삭제/복구는 대화를 모두 비운다.
- Related API: 없음. 외부 AI endpoint, request/response DTO, auth, consent, timeout, retry, rate limit, error mapping 계약은 미확정이다.
- Related DB tables: 없음.

## 13. Google 기반 자체 계정

- Actor: 사용자
- Entry point: Settings의 `계정` 행, desktop Sidebar profile action 또는 mobile `나` menu
- Preconditions: Google client ID, callback, 백엔드 session API 계약이 아직 구현되지 않았다.
- Steps:
  1. 로그인하지 않은 사용자는 LoginPage로 이동한다.
  2. App은 login/signup/profile overlay를 History state에 push해 브라우저 Back과 화면 닫기를 동기화한다.
  3. LoginPage와 SignupPage는 `GoogleAuthPage`를 공유하며 각각 `login` 또는 `signup` intent를 auth hook으로 전달한다. 두 인증 화면은 돌아가기·theme selector를 표시하지 않고 `prefers-color-scheme`에 따른 light/dark theme을 사용하며 저장 preference는 바꾸지 않는다.
  4. `useGoogleAuthPage -> authStore -> authGoogleService` 경계에서 Google 인증을 시작한다.
  5. 현재 service 계약이 없으므로 typed error를 표시하고 local profile을 임의로 생성하지 않는다.
  6. 향후 계약이 확정되면 성공한 서버 응답의 표시용 `AuthUser`만 profile service에 전달한다.
  7. 로그인 사용자는 MyPage에서 profile을 확인하거나 logout한다.
- Validation: 인증 provider와 백엔드 session 계약의 성공·실패 mapping을 auth service에서 검증한다.
- Empty state: auth user가 없으면 LoginPage와 SignupPage 진입 action을 표시한다.
- Error state: Google 연동 미설정 typed error를 화면의 alert로 표시한다.
- Permission behavior: 실제 role/permission은 서버 계약 전까지 없다. credential과 session 원문은 브라우저 저장하지 않는다.
- Retry or recovery: 오류 확인 후 Google action을 다시 시도한다.
- Side effects: 계약 확정 전 성공 side effect 없음; 계약 확정 후 안전한 표시용 profile만 저장한다.
- Related API: 없음. auth endpoint 계약 미확정.
- Related DB tables: 없음.

## 14. Playwright 실제 브라우저 회귀 검증

- Actor: 개발자 또는 CI
- Entry point: `npm run test:e2e`, `npm run test:e2e:visual`, `npm run test:e2e:mobile-ai`, mobile AI iteration/final scripts
- Preconditions: npm dependency 설치와 Google Chrome 또는 Playwright Chromium 사용 가능.
- Steps:
  1. Playwright web server가 `http://localhost:5173`의 Vite 앱을 실행하거나 기존 서버를 재사용한다.
  2. 각 browser project가 독립 context를 열고 Moodi localStorage를 초기화해 canonical seed를 로드한다.
  3. 7개 project가 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 360×800을 렌더링한다. 430/390/360은 touch와 mobile emulation을 사용한다.
  4. journal flow suite가 긴 일기의 draft 복구부터 CRUD, cover/inline image role과 inline block 삭제 reconciliation, 태그·favorite까지 실행한다.
  5. quick flow가 빠른 기록을 만든 뒤 홈·목록·캘린더·새로고침에서 동일 data를 확인한다.
  6. navigation flow가 검색, calendar 월 이동, 회고, 설정, desktop/mobile navigation과 44px touch target을 검증한다. mobile AI suite는 App Bar, drawer focus/scroll lock, 오늘·기록·AI·캘린더·나, 대체 작성 진입을 추가 검증한다.
  7. dialog/popover flow가 initial focus, focus trap, Escape close, focus restore와 viewport 배치를 검증한다.
  8. auto fixture가 첫 navigation 전부터 console warning/error, page error, 비정상 request failure와 HTTP 400 이상 response를 수집하고 하나라도 있으면 실패한다.
  9. mobile AI suite는 local-search·source 상세 이동·대화 이름 변경/삭제·결과 없음·취소·손상 저장 오류와 focused editor/composer의 visual viewport layout을 검증한다.
  10. 기존 visual screenshot은 `before`, `iteration-1`, `iteration-2`, `final` stage로 분리한다. desktop Main area는 `main-area-iteration-1`, `main-area-iteration-2`의 Chrome 1440×900·Chromium 1280×800을 사람이 비교하고, 모바일 AI는 `iteration-1`, `iteration-2` 두 차례를 별도 subdirectory에 촬영해 검수한 뒤 final 실행이 `artifacts/ui-review/mobile-ai` 루트의 필수 15개 이미지를 갱신한다. stage directory는 비교 근거로 보존한다.
- Validation: viewport별 가로 overflow 없음, Sidebar/main·App Bar/main·bottom navigation/main·AI composer/navigation 겹침 없음, desktop Main area의 남은 viewport 전체 점유, 오늘 hero·대표/최근 기록·질문의 transparent background·0 radius·no shadow, 다른 route의 불필요한 outer/nested card 부재, `/ai`의 full-height shell과 compact header, safe area와 visual viewport 안의 composer/editor toolbar, overlay bounds, 닫힌 drawer focus 차단, text clipping/transparency, mobile input 16px, touch target 44px, calendar overflow, 깨지거나 왜곡된 image, Pretendard resource, semantic text 4.5:1 대비, route/state/localStorage와 accessible role/name.
- Empty state: localStorage key가 없으면 앱의 최초 seed 규칙을 그대로 사용한다.
- Error state: 실패 screenshot, trace, HTML report를 `moodi/artifacts`에 남긴다.
- Permission behavior: 실제 외부 서비스나 운영 data를 호출하지 않으며 browser-local test data만 사용한다.
- Retry or recovery: 실패 원인을 수정한 뒤 같은 project 또는 전체 suite를 다시 실행한다.
- Side effects: test browser context의 localStorage와 검수 screenshot/report만 생성한다.
- Related API: 없음.
- Related DB tables: 없음.
