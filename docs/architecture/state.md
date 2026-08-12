# 상태 문서 - moodi

## 상태 소유권

2026-07 backend integration 이후 Diary/draft/AI/settings의 canonical persisted state는 localStorage가 아니라 backend다. Zustand와 hook state는 화면 cache와 in-flight 상태만 소유한다. theme·Sidebar는 device-local UI preference로 남는다.

| State | Owner | Source of truth | Persisted | 설명 |
| --- | --- | --- | --- | --- |
| Diary entries | `diaryStore` + `ApiDiaryRepository` | backend `DiaryEntryDto` → `DiaryEntry[]` | Yes, backend | 긴 일기와 빠른 기록의 client cache |
| Active draft | `diaryStore` + `ApiDiaryRepository` | backend `DiaryDraftDto` → `DiaryDraft|null` | Yes, backend | 한 번에 하나의 활성 draft |
| Store status | `diaryStore` | Zustand | No | 최초 load 상태 |
| Mutation status | `diaryStore` | Zustand | No | save/delete/import/clear 진행 상태 |
| Store error | `diaryStore` | Zustand | No | Repository/application 오류의 UI-safe message |
| Initialization warning | `diaryStore` | Zustand | No | draft만 읽지 못했을 때 entries를 보존하고 알리는 비치명적 message |
| Diary location | `useDiaryRoute` | URL pathname/query | Browser history | route name과 optional entry id |
| Editor form | `useDiaryEditor` | React state | draft를 통해 Yes | title/content와 metadata 전체 |
| Block document | `useDiaryEditor` + TipTap | `contentHtml` + 검색용 `content` | draft/entry를 통해 Yes | block 구조·mark·inline image와 plain text를 동기화 |
| Auto-save status | `useDiaryEditor` | React state | No | idle/saving/saved/error/restored |
| Browser connectivity | `DiaryEditor` | `navigator.onLine` + online/offline event | No | auto-save 상태 옆의 `오프라인 · 브라우저에 저장` 표시를 파생하며 localStorage 저장 경계는 유지 |
| Quick check-in form | `useQuickCheckIn` | React state | 저장 전 No | modal open과 `DailyCheckIn` |
| Entry filters | `useDiaryWorkspace` | React state | No | search/date/mood/activity/tag/favorite/image/type |
| Calendar state | `useDiaryWorkspace` | React state | No | cursor, selected date, mood/tag filter |
| Today key | `useDiaryWorkspace` | React state | No | local 자정 직후 갱신되는 오늘 날짜 기준 |
| Prompt state | `useDiaryWorkspace` | React state | No | 현재 prompt index |
| AI insight collapse | `useDiaryWorkspace` | React state | No | 펼친 상세 분석 entry id; 다른 entry로 이동하면 기본 닫힘 |
| AI conversations | `useJournalAIChat` + `ApiJournalAIService` | backend conversation/message DTO → `AIConversation[]` | Yes, backend | server-run message와 실제 기록 source snapshot |
| AI chat UI | `useJournalAIChat` | React state | No | active conversation id, phase, SSE partial content, active run id, error/status, AbortController |
| Mobile drawer | `MobileNavigation` | React state | No | App Bar 또는 `나`에서 열고, 열린 동안 body scroll lock과 focus trap 적용 |
| Mobile visual viewport | `AppShell` | `window.visualViewport`에서 파생 | No | viewport height·keyboard inset CSS 변수와 keyboard-open class; 120px 초과 inset에서 하단 nav 숨김 |
| Confirmation | `useDiaryWorkspace` | React state | No | entry/edit/all/import/new/recover pending action |
| Toast | `useDiaryWorkspace` | React state | No | message와 tone |
| Selected tag index | `useDiaryWorkspace` | React state | No | category/value와 matching entries 기준 |
| Settings preference | `settingsStore` | Zustand initialized from settings API | Yes, backend | font, lock, AI preference |
| Theme preference | `themeStore` | Zustand initialized from service | Yes, `moodi.mvp.theme.v1` | `paper | midnight`; 로그인·회원가입 화면에서는 저장값 대신 system color scheme을 일시 적용하고, `html`과 theme root wrapper의 semantic token set을 갱신 |
| Sidebar preference | `useSidebarPreference` + service | React state initialized from localStorage | Yes, `moodi.ui.sidebar-collapsed.v1` | desktop Sidebar의 264/232px 펼침 또는 72px 접힘 상태 |
| Auth profile | `authStore` | session API `UserDto` | HttpOnly cookie | Google credential과 session 원문은 JS/localStorage에 없음 |
| App auth screen | `App` | React state | No | diary/login/signup/myPage 전환 |

## Domain enum과 상수

### AuthIntent

| Value | 의미 |
| --- | --- |
| `login` | 기존 Moodi 자체 계정에 Google 계정으로 진입하려는 의도 |
| `signup` | Google 계정으로 Moodi 자체 계정을 만들려는 의도 |

로그인과 회원가입은 같은 Google provider 흐름을 공유한다. `authGoogleService`는 짧은 login attempt와 nonce를 발급받아 GIS redirect button의 `login_uri`와 `state`를 구성한다. Google credential은 full-page redirect POST로 backend에 전달되고, 복귀 후 `authStore`가 session DTO의 표시용 `UserDto`만 반영한다. credential·session 원문은 브라우저 저장소에 남기지 않는다.

### Mood

| Value | 사용자 label | 의미 |
| --- | --- | --- |
| `happy` | 행복 | 긍정적이고 기쁜 상태 |
| `calm` | 편안함 | 안정되고 차분한 상태 |
| `excited` | 설렘 | 기대와 활력이 있는 상태 |
| `neutral` | 무난함 | 뚜렷한 고저가 없는 상태 |
| `tired` | 피곤함 | 에너지가 낮은 상태 |
| `anxious` | 불안함 | 걱정과 긴장이 있는 상태 |
| `frustrated` | 답답함 | 막힘과 복잡함이 있는 상태 |
| `sad` | 슬픔 | 가라앉고 슬픈 상태 |
| `angry` | 화남 | 분노와 짜증이 있는 상태 |

Mood는 domain에서 영어 canonical value를 사용하고 한국어 label, icon, color는 view config가 소유한다.

### Activity

| Value | 사용자 label |
| --- | --- |
| `work` | 일·프로젝트 |
| `people` | 사람들과 함께 |
| `exercise` | 운동 |
| `study` | 공부·독서 |
| `walk` | 산책·이동 |
| `rest` | 휴식 |
| `music` | 음악 |
| `meal` | 식사 |
| `self-care` | 나를 돌봄 |

### EntryType

| Value | 의미 | 저장 validation |
| --- | --- | --- |
| `journal` | 긴 일기 | trim한 `content`가 필요함 |
| `quick` | 빠른 기록 | Repository는 mood, activity, shortNote 중 하나 이상 필요; 현재 QuickCheckIn UI는 mood를 필수로 받음 |

### AIInsightSource

| Value | 현재 사용 | 의미 |
| --- | --- | --- |
| `local-rule-mock` | Yes | 브라우저 내부 규칙 기반 demo 분석 |
| `external-ai` | No | 향후 계약된 외부 AI adapter 결과를 위한 예약값 |

### JournalAIAdapterKind

| Value | 현재 사용 | 의미 |
| --- | --- | --- |
| `backend-ai` | Yes | backend conversation/run/SSE가 만든 assistant message |
| `local-search` | No | 이전 localStorage 대화 데이터 호환값 |
| `external-ai` | No | 이전 storage 호환을 위한 예약값 |

### DiaryImageRole

| Value | 의미 | 호환 규칙 |
| --- | --- | --- |
| `cover` | 문서 상단의 선택적 대표 이미지 | 본문 block 삭제와 독립적으로 유지하며 새 cover를 추가하면 기존 cover를 교체 |
| `inline` | TipTap 본문 안의 image block | 현재 `contentHtml`에서 URL 참조가 사라지면 editor form의 image metadata도 제거 |

`role`은 기존 저장 데이터 호환을 위해 optional이다. role 없는 legacy image는 URL이 `contentHtml`에 참조되면 inline, 참조되지 않으면 standalone cover/gallery로 읽고 저장 role을 자동으로 덮어쓰지 않는다. 문서 편집에서는 이전 HTML에서 참조됐던 role 없는 이미지만 legacy inline reconciliation 대상으로 삼는다.

## UI와 application 상태 enum

### Route

| Route name | URL | 활성 navigation |
| --- | --- | --- |
| `home` | `/` | 오늘 |
| `write` | `/write`, `/write?entry=:id` | 일기 쓰기 |
| `ai` | `/ai` | AI와 대화 |
| `entries` | `/entries` | 전체 기록 |
| `entryDetail` | `/entries/:id` | 전체 기록 |
| `calendar` | `/calendar` | 캘린더 |
| `insights` | `/insights` | 회고 |
| `tags` | `/tags` | 태그 |
| `settings` | `/settings` | 설정 |

### DiaryStoreStatus

| Value | 의미 |
| --- | --- |
| `idle` | 초기화 전 |
| `loading` | entries를 읽고 성공하면 draft를 독립적으로 읽는 중 |
| `ready` | 조회와 mutation 가능 |
| `error` | entries 초기화 실패, retry 가능; draft만 실패하면 ready와 warning 유지 |

### DiaryMutationStatus

| Value | 의미 |
| --- | --- |
| `idle` | mutation 없음 |
| `saving` | entry/favorite/draft 저장 중 |
| `deleting` | 단일 entry 삭제 중 |
| `importing` | import 목록 교체 중 |
| `clearing` | 전체 data 삭제 중 |

### DiaryAutoSaveStatus

| Value | 의미 |
| --- | --- |
| `idle` | 변경 또는 저장 대기 없음 |
| `saving` | 변경 후 debounce 또는 저장 중 |
| `saved` | draft가 localStorage에 반영됨 |
| `error` | draft 저장 실패 |
| `restored` | 저장된 draft를 editor로 복구함 |

`offline`은 `DiaryAutoSaveStatus` enum이 아니라 browser connectivity에서 파생한 표시 상태다. offline에서도 draft는 같은 origin localStorage에 저장되며, online 복귀 시 별도 server sync는 수행하지 않는다.

### JournalAIChatPhase

| Value | 의미 |
| --- | --- |
| `loading` | versioned 대화 저장소를 읽거나 retry 중 |
| `idle` | 질문 입력·대화 관리 가능 |
| `sending` | user message를 versioned 대화 저장소에 기록 중 |
| `generating` | 650ms 취소 가능한 local-search와 집계 수행 중 |
| `streaming` | local adapter가 실제로 전달한 누적 결과 chunk 표시 중; 외부 token stream이 아님 |
| `cancelling` / `cancelled` | AbortSignal 전달 중 / 검색 중단 완료와 질문 복원 |
| `no-results` | 실제 기록 source가 없는 정상 완료 상태 |
| `error` | `network | auth-expired | service-unavailable | source-load-failed | storage-corrupted | storage-unavailable | unknown` code와 message·retry 표시; 현재 local adapter는 외부 오류를 만들지 않음 |

### AI conversation persistence

| 항목 | 제한 / 규칙 |
| --- | --- |
| 저장 key | `moodi.journal-ai.conversations.v1` |
| envelope | `{ schemaVersion: 1, conversations: AIConversation[] }` |
| 목록/대화 한도 | 최근 대화 최대 40개; 저장 mutation은 message를 최근 80개로 먼저 자른 뒤 검증 |
| 전체 serialized 한도 | 1,500,000자 |
| title/query/content | 대화 title 최대 80자, 질문 최대 1,200자, 저장 message content 최대 12,000자 |
| source | 현재 사용 entry의 id·`entryUpdatedAt`, 날짜, 제목, 원문 excerpt 최대 280자, optional mood |

손상된 envelope, 중복 conversation id, 허용 범위 밖 필드는 빈 대화로 fallback하지 않고 `storage-corrupted` error로 전달한다. 사용자가 확인한 reset은 AI 대화 key만 제거하고 Diary entries/draft는 보존한다. Repository update는 updater로 현재 대화를 다시 읽어 바꾸며, 삭제·초기화된 id를 upsert하지 않는다. `external-ai` adapter 값은 저장 호환을 위한 예약값일 뿐 현재 service가 생성하지 않는다.

### ThemeName

| Value | 의미 | 저장 호환 |
| --- | --- | --- |
| `paper` | 중립 라이트 semantic token set | 기본값; 기존 `forest`, `rose`, `ocean`은 load 시 이 값으로 정규화 |
| `midnight` | 중립 다크 semantic token set | canonical dark 값으로 그대로 복구 |

### ConfirmationState

| Kind | Payload | 확인 후 동작 |
| --- | --- | --- |
| `entry` | entry id, title | 단일 삭제 후 `/entries` |
| `edit` | target entry id, title | 다른 active draft를 명시적으로 비운 뒤 edit route |
| `all` | 없음 | Diary, draft, profile, theme, Settings, Sidebar preference 삭제 후 `/` |
| `import` | 검증된 entries | 현재 목록을 교체하고 draft 제거를 시도한 뒤 `/entries`; draft 정리 실패는 기존 draft 유지와 오류 toast |
| `new` | 없음 | active draft를 비우고 새 editor 준비 |
| `recover` | 없음 | entries를 읽을 수 없는 경우 Diary entries/draft storage 전체 초기화 |
| `null` | 없음 | dialog 닫힘 |

### Tag category

| Value | 소유 데이터 |
| --- | --- |
| `user` | `DiaryEntry.tags` |
| `activity` | `DiaryEntry.activities` |
| `mood` | `DiaryEntry.mood` |
| `aiTopic` | `DiaryEntry.aiTopics` |

## Settings preference

| Field | 허용값 / 기본값 | 실제 적용 범위 |
| --- | --- | --- |
| `fontSize` | `small`, `medium`, `large`; 기본 `medium` | `html[data-moodi-font-size]` root size로 rem 기반 UI 전체 조정 |
| `isEntryLockEnabledByDefault` | boolean, 기본 `false` | 신규 journal/quick의 초기 `isLocked` |
| `isAiAnalysisEnabled` | boolean, 기본 `true` | create/update의 `shouldAnalyze` |
| `aiTone` | `kind-friend`, `calm-guide`, `analytical-observer`, `minimal-feedback`; 기본 `calm-guide` | 신규/수정 기록의 local rule 요약 말투 |
| `aiResponseLength` | `brief`, `balanced`, `detailed`; 기본 `balanced` | 신규/수정 기록의 local rule topic/pattern/question 개수 |
| `isPersonalizedQuestionsEnabled` | boolean, 기본 `true` | 켜면 기존 insight 후속 질문 우선, 끄면 일반 질문 사용 |

AI 분석을 끄면 SettingsPage의 tone/length/personalized question control은 disabled된다. 이미 저장된 preference 값은 유지된다.

## 주요 상태 전이

| From | Trigger | To | Validator / Side effect |
| --- | --- | --- | --- |
| Store `idle` | app mount | `loading` | Repository entries를 먼저 조회 |
| Store `loading` | entries와 draft load 성공 | `ready` | v2 read, v1 migration 또는 최초 seed와 draft 복구 |
| Store `loading` | entries 성공, draft 실패 | `ready` + warning | entries 유지, draft 제외, dismissible error toast |
| Store `loading` | entries load 실패 | `error` | errorMessage 표시, retry/전체 복구 action 제공 |
| Empty editor | field change | auto-save `saving` | 의미 있는 값일 때 650ms debounce 시작 |
| Auto-save `saving` | draft persist 성공 | `saved` | draft key 갱신 |
| Auto-save `saving` | persist 실패 | `error` | entry는 생성하지 않음 |
| Persisted draft | 신규 write route | `restored` editor | draft 값을 form에 복구 |
| 같은 entry의 persisted draft | edit route | `restored` editor | 저장본보다 draft 우선 |
| 다른 active draft | edit request | edit confirmation | confirm 전 draft 유지 |
| 비오늘 날짜/질문으로 준비한 editor | write 진입 전 | saved draft 또는 auto-save `error` | 즉시 persist; 실패 시 revision 1로 다음 debounce/이탈 재시도 |
| Editor | journal 저장 | saved entry | pending debounce 취소, content non-empty, optional analysis, 상세 route; draft clear는 별도 시도 |
| New saved entry | draft clear 실패 | entry detail + error toast | 남은 draft를 saved entry id에 연결해 다음 저장을 update로 제한 |
| Edited saved entry | draft clear 실패 | entry detail + error toast | 기존 linked draft를 유지하고 entry 성공은 되돌리지 않음 |
| Quick dialog | 빠른 저장 | quick entry | UI mood 필수, settings lock/AI 적용, dialog close |
| Diary store `idle | loading | error` | AI route/render | AI chat `loading`, visible conversation 없음 | `ready` 전 대화 load와 source sanitize 금지 |
| AI chat `loading` | 저장소 load 성공 | `idle` + conversation 목록 | updatedAt 역순, 첫 대화를 active로 선택 |
| AI chat `idle` | 질문 전송 | `sending` -> `generating` | 빈 값/1,200자 초과 차단, user message를 먼저 versioned 저장소에 저장 |
| AI chat `generating` | local result chunk 수신 | `streaming` | service callback의 실제 누적 local-search content만 표시 |
| AI chat `streaming` | final assistant 저장 성공 | `idle` 또는 `no-results` | 저장된 assistant message와 실제 source만 확정하고 suggestion 갱신 |
| AI chat `streaming` | final assistant 저장 실패 | `error` | pending assistant content 제거, 미저장 답변 미반환, 먼저 저장된 user message만 유지 |
| AI chat in-flight | Escape/취소 버튼 | `cancelling` -> `cancelled` | AbortSignal로 검색·부분 표시 중단; 이미 저장된 user message는 유지하고 질문 복원 |
| AI chat load/mutation | 저장소/application 실패 | `error` | UI-safe message와 retry 제공 |
| Stored AI conversation | ready entries 변경 또는 조회 | sanitized/refreshed conversation | 화면은 동기 sanitizer로 즉시 가리고 persistence refresh는 별도 시도; 수정 source 갱신, 삭제/잠금 source 제거, 오래된 답변 숨김 |
| AI history | create/open/rename/delete | next active conversation | title은 trim 후 80자 검증, 삭제 confirmation |
| AI history | send 또는 history mutation in-flight | current conversation 유지 | create/open/rename/delete 중복 mutation 차단 |
| AI chat `error: storage-corrupted` | 확인 후 AI reset | `idle`, 빈 conversation 목록 | AI 대화 key만 제거하고 Diary entries/draft 유지 |
| Saved entry | favorite toggle | updated entry | Repository update 후 list 교체 |
| Saved entry | edit | write editor | `/write?entry=:id`, 기존 값 로드 |
| Saved entry | delete request | entry confirmation | confirm 전 mutation 없음 |
| Entry confirmation | confirm | deleted | 진행 중 AI 요청에 먼저 abort, Diary Repository 삭제 후 AI 대화의 해당 source reference 제거, toast, `/entries` |
| Import file | parse 성공 | import confirmation | 아직 목록 교체하지 않음 |
| Import confirmation | confirm | imported list | 진행 중 AI 요청에 먼저 abort, Repository replace, AI 대화 전체 정리, draft clear 별도 시도, `/entries`; 정리 실패는 warning/error toast |
| All/recover confirmation | confirm | 기본 앱 상태 | 진행 중 AI 요청에 먼저 abort, Diary 저장소 mutation 뒤 AI 대화를 정리; profile/theme/settings/sidebar는 boolean 부분 성공 보고 |
| Non-write route | navigate | next URL/location | History API update, scroll top, main focus |
| Write route | navigate | editor | main focus를 건너뛰고 제목 autofocus 유지; 같은 write route 재선택은 no-op |
| Browser history | `popstate` | parsed location | state를 현재 URL과 동기화 |
| Settings | preference action 성공 | next preference | localStorage persist 후 Zustand update |
| Settings | preference action 실패 | previous preference | persistenceError와 error toast |
| Theme preference | `paper | midnight` 선택 | next theme | `moodi.mvp.theme.v1` 저장 후 `html`과 theme root wrapper attribute 갱신 |
| Authentication screen color scheme | 로그인·회원가입 화면 표시 중 browser/OS color scheme 변경 | `paper | midnight` | `prefers-color-scheme`을 즉시 반영하며 `moodi.mvp.theme.v1`은 변경하지 않음 |
| Legacy theme preference | app initialize | `paper` | `forest | rose | ocean`을 사용자 데이터 삭제 없이 neutral light로 정규화 |
| Desktop Sidebar | 접기/펼치기 | 72px 또는 264/232px | `moodi.ui.sidebar-collapsed.v1`에 문자열 boolean 저장; 접근 실패는 UI 동작을 막지 않음 |
| Mobile App Bar/나 tab | drawer open | modal drawer | body scroll lock, 첫 control focus, Tab loop |
| Open mobile drawer | Escape/backdrop/close | drawer closed | body scroll 복원, 명시적 닫기에서는 hamburger focus 복구 |
| Mobile visual viewport | keyboard inset > 120px | keyboard-open layout | bottom navigation 숨김, AI composer/editor toolbar를 keyboard 위로 이동 |
| 전체 삭제 | preference reset | Sidebar 펼침 | Sidebar key 제거와 reset event로 메모리 상태 동기화 |

## 데이터 invariant와 제한

- `diaryDate`는 `YYYY-MM-DD` local date key다.
- `createdAt`, `updatedAt`, `generatedAt`, `savedAt`은 유효한 timestamp string이어야 한다.
- energy는 선택적 1~5 정수다.
- Mood와 Activity는 canonical 목록 밖의 값을 허용하지 않는다.
- tags와 aiTopics는 trim, 빈 값 제거, 중복 제거 후 저장한다.
- user tags와 AI topics를 서로 변환하지 않는다.
- journal은 content가 필요하다.
- `contentHtml`은 선택적이므로 기존 평문 기록이 그대로 유효하다. 값이 있으면 2.5MB 이하이며 script/style/iframe/object/embed/form, inline event handler, javascript URL, 외부 image source를 허용하지 않는다.
- QuickCheckIn UI는 Mood가 없으면 저장하지 않는다.
- editor image는 cover와 inline을 합쳐 최대 3장, base64 image Data URL, 디코딩 기준 장당 350KB 이하다. seed image에는 앱이 소유한 루트 상대 로컬 자산 경로를 허용한다. Repository는 외부 URL을 저장하지 않으며, Data URL이라 브라우저 저장 용량 제한을 받을 수 있다.
- 신규 image role은 `cover | inline`만 허용한다. explicit inline은 현재 `contentHtml`에서 URL 참조가 사라지면 제거하고 cover는 유지한다. role 없는 legacy image는 이전 HTML에서 참조되었다가 다음 HTML에서 사라진 경우에만 제거하며, 이전부터 참조되지 않은 standalone image는 유지한다.
- v2 저장 envelope과 가져오기 교체 목록의 entry id는 중복될 수 없다. 중복 id가 있는 v2 데이터는 손상된 저장 상태로 차단한다.
- import file은 JSON이며 최대 12MB, `format: moodi-diary-export`, `version: 1`이어야 한다.
- v2 `entries: []`는 유효한 empty state이며 seed 생성 조건이 아니다.
- 단일 active draft가 다른 entry 편집으로 전환될 때는 confirmation 없이는 덮어쓰지 않는다.
- Web Locks 지원 환경은 동일 origin의 여러 탭 Diary/draft 초기화와 write를 직렬화하며, 다른 탭 화면 상태 반영은 새 조회 또는 새로고침 시점이다.
- 현재 lock은 UI preference/metadata이지 암호화 또는 server permission이 아니다.
- `LocalJournalAIService`는 이 한계와 무관하게 `isLocked` 기록과 `seed-` id 기록을 검색·집계·source에서 제외한다.
- assistant source의 excerpt는 검색 시점에 실제 entry 원문에서 만든 substring이어야 한다. Diary `ready` 이후 화면은 persistence와 무관한 동기 sanitizer로 `entryUpdatedAt`과 현재 검색 가능 여부를 대조하고, 정리된 대화의 영속화도 별도로 시도한다.
- 감정과 keyword가 함께 있는 local query는 두 조건의 교집합만 반환한다. 한국어 복합 조사와 감정 활용형을 정규화하고, 전체 match 수와 source로 노출한 검색 점수 상위 대표 기록 수를 구분한다.
- AI 대화 update는 존재하는 id에만 적용되며 삭제·전체 초기화와 경합해도 대화를 되살릴 수 없다. assistant 최종 저장 실패 시 UI pending answer도 제거한다.
- 태그·주제·회고의 `반복`, `자주` 표현은 동일 값의 `count >= 2` 증거가 필요하다. 단일 값은 중립적인 기록 수 문구로 표시하며, 움직임 pattern의 행복/편안함 label은 실제 선택값만 사용한다.
- 단일 entry 삭제는 AI 대화의 해당 reference와 오래된 답변 원문을 가린다. import 교체, 전체 삭제, 손상 Diary 저장소 복구는 기존 AI 대화 전체를 정리한다.
- 현재 auth profile에는 password, token, session, role을 저장하지 않는다.
