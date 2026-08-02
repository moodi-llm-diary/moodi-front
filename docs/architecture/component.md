# 컴포넌트 및 모듈 문서 - moodi

> Backend integration note: Diary view/component는 browser storage, fetch, EventSource, multipart를 직접 호출하지 않는다. `useDiaryWorkspace`/`useJournalAIChat`이 use-case를 조합하고, `diaryStore`·`settingsStore`와 `ApiDiaryRepository`·`ApiJournalAIService`·`diaryImageUploadService`가 backend DTO, CSRF, ETag, SSE, image upload를 소유한다. 이 note는 이전 localStorage/local-search 설명보다 우선한다.

## 소유권과 분리 기준

- `DiaryMvpPage`는 route별 view와 전역 overlay만 조립한다.
- `components/views`는 route 화면을 구성하고 모든 사용자 intent를 callback으로 올린다.
- `components/common`은 Diary AppShell 안에서 여러 route가 재사용하는 layout, navigation, feedback UI다.
- 그 밖의 `components`는 Diary feature가 소유하는 editor, selector, card, chart다.
- hook은 화면 상태와 비동기 orchestration을 담당하고 component는 Repository와 localStorage를 알지 못한다.
- store는 domain state와 mutation을 소유하고 persistence 세부사항은 Repository/service에 위임한다.
- Settings와 Theme은 별도 feature다. SettingsPage는 기존 ThemeSelector를 import하지만 Diary component를 import하지 않는다.
- domain model, application input, persistence entity, view model은 서로 대체해서 사용하지 않는다.

## Route 조립 계약

| Module | 입력 | event/output | 책임 |
| --- | --- | --- | --- |
| `App` | auth/theme/settings stores | Login/Signup/MyPage/Diary 전환 | `html`과 wrapper의 theme, root font attribute, feature page 조립 |
| `DiaryMvpPage` | theme/profile props, `useDiaryWorkspace` result | route view, overlay 조립 | Presentation 경계; AppShell에 draft, 최근 기록 최대 5개, 즐겨찾기 최대 3개와 route별 App Bar action을 view data로 전달 |
| `AppShell` | active route, children, profile, draft/recent/favorite view data와 callbacks | navigation/recent/draft/profile/새 기록/새 AI 대화 intent | persisted Sidebar preference와 desktop Sidebar를 조립하고 그 오른쪽 semantic `<main>` 전체를 연속 Main area로 제공하며 Mobile App Bar·drawer·하단 navigation과 visual viewport CSS 변수를 동기화 |
| `TodayView` | 오늘/최근/과거의 오늘 entries, draft, daily sentence, prompt | mood-prefilled quick/write/detail/entries/insights 이동 | 인사, 감정 check-in, 임시저장, 대표·최근 기억, 질문을 배경·radius·shadow 없는 editorial section과 divider로 연결하고 CTA·선택 control만 독립 surface로 표시 |
| `WriteWorkspaceView` | editor value/status/error와 editor callbacks | form change, image, save, discard, back | 작성 화면과 DiaryEditor 조립 |
| `AIChatView` | active conversation, conversation 목록, phase/error/status/suggestion, 실제 local stream preview와 callbacks | 질문 전송·Escape/버튼 취소, 새/열기/이름 변경/삭제 대화, source entry·최근 회고 이동 | Main area 전체를 쓰는 compact chat shell 안에서 `/ai`의 empty·sending·generating·streaming·cancelled·no-results·typed error·conversation UI, local-search 고지, safe text rendering, 실제 높이를 반영하는 auto-growing composer와 대화 history dialog를 제공 |
| `EntriesView` | filtered entries와 filters | search/filter/detail/write | 검색·필터를 필요할 때 열고 모든 결과를 날짜별 동일한 divider row로 그룹화해 첫 항목만 임의의 대형 card가 되는 예외를 만들지 않음 |
| `EntryDetailView` | entry, sibling/related entries, AI expanded state | back/edit/delete/favorite/AI toggle/detail 이동 | 날짜·제목·핵심 metadata·cover·원문·추가 정보·AI·관련 기록·하단 관리 순서로 사용자 원문과 분석을 분리해 읽기 |
| `CalendarWorkspaceView` | 42 day cells, selected date entries, filters | month/today/date/filter/write/detail | 날짜별 기록 탐색 |
| `InsightsView` | `DiaryInsights`, 핵심 주제, 회고 관련 entries | empty-state write/detail 이동 | 주간 chart 1개와 짧은 회고 문장, 관련 기록 표시 |
| `TagsView` | category groups, selected tag, matching entries | select/clear/detail | user/activity/mood/aiTopic 분리 탐색 |
| `SettingsPage` | theme props, profile/tag route, data action callbacks | profile/tag route, preference update, export/import/delete intent | 계정·태그 진입과 disclosure 기반 설정 UI; Diary data를 직접 읽거나 쓰지 않음 |

## AppShell 공통 UI 계약

| Component | 주요 props | event | 접근성/상태 책임 |
| --- | --- | --- | --- |
| `SidebarNavigation` | active route, profile, collapse state, draft title, recent entry 최대 5개 | 주요 route/write/draft/recent/profile/settings 선택 | 264px Sidebar, 901~1100px의 232px compact Sidebar와 72px icon rail, 현재 문서 위치 표시 |
| `MobileNavigation` | active route, profile, draft/recent/favorite view data, route별 action | 오늘/기록/AI/캘린더/나, 새 기록·새 AI 대화·오늘 날짜, drawer 항목 선택 | Mobile App Bar와 5개 하단 탭 조립, drawer body scroll lock·focus trap·Escape/backdrop 닫기·trigger focus 복원; `/write`에서는 AppShell이 렌더링하지 않음 |
| `PageHeader` | title, description, leading, meta, actions | callback은 전달받은 element가 소유 | route title 구조를 통일하고 Main area 배경에 직접 배치해 아래 본문과 spacing·divider로 연결 |
| `SearchBar` | value, placeholder | change/clear | input label과 clear accessible name |
| `EmptyState` | title, description, optional icon/primary/secondary action | action | loading과 구분되는 완성된 empty/error state |
| `Skeleton` | variant, line count | 없음 | store 초기 loading 표시 |
| `Toast` | message, tone, duration | dismiss | `polite` 또는 error `assertive` live region |
| `ConfirmDialog` | open, copy, tone, pending | confirm/cancel | alertdialog, initial focus, focus trap, Escape, focus restore |

## Diary 입력 컴포넌트 계약

| Component | 값 계약 | event | 규칙 |
| --- | --- | --- | --- |
| `DiaryEditor` | `SaveDiaryDraftInput`, auto-save status, online 상태, error | typed metadata/document change, cover/inline image add와 remove, prompt insert/refresh, save, discard | 선택적 cover, 제목, 날짜·감정·energy·태그 한 줄과 각 popover, TipTap 문서를 우선하고 mood·사진·태그·잠금 도구와 activity·날씨·위치·즐겨찾기 disclosure를 제공 |
| `BlockDiaryEditor` | 검색/분석용 평문, TipTap HTML | document change, validated inline image request, 모바일 감정 picker 요청 | 문단·제목 1~3·사진·인용·구분선·글머리/번호/체크 목록·Moodi 질문 slash 삽입과 키보드 선택, block 이동·삭제·변환, 제품 스타일 URL 입력을 포함한 선택 서식 bubble menu, 모바일 블록·서식·목록·사진·감정·키보드 닫기 toolbar, image caption/alt/width/alignment; code는 지원하지 않고 감정/접기 node는 legacy rendering만 유지 |
| `DiaryDocumentReader` | optional block HTML, legacy plain content | 없음 | 편집 도구 없이 동일한 문서 typography와 inline image/question/details 구조를 출력 |
| `QuickCheckIn` | `DailyCheckIn`, open/saving | mood/energy/activity/note change, save/close | mood·energy·note 우선, activities 선택 공개, dialog focus trap과 mobile bottom sheet |
| `MoodSelector` | optional canonical `Mood` | Mood 선택 | 9개 값에 icon, label, color를 함께 사용 |
| `EnergySelector` | optional integer | 1~5 선택 | 텍스트와 단계 표시를 함께 사용 |
| `ActivitySelector` | `Activity[]` | toggle | 9개 canonical activity만 반환 |
| `TagInput` | `string[]` | add/remove | 공백·선행 `#` 정규화와 중복 방지 UI |
| `JournalPromptCard` | 현재 prompt | 본문에 사용/새 질문 | 고정 설문이 아닌 질문 1개짜리 선택적 작성 단서 |

`DiaryEditor`는 cover와 inline image 요청을 분리해 hook에 전달한다. `useDiaryEditor`는 FileReader 결과에 `DiaryImageRole`을 부여하고 파일 제한을 검증하며, persistence 검증은 Repository 책임이다. inline block이 문서에서 제거되면 hook은 `diaryImageService`의 URL 참조 판정으로 explicit inline과 이전 문서에서 참조된 legacy inline metadata를 함께 제거한다.

## Diary 표시 컴포넌트 계약

| Component | 입력 | event | 표시 책임 |
| --- | --- | --- | --- |
| `DiaryListItem` | `DiaryEntry`, compact | open | transparent background와 divider를 기본으로, noncompact는 날짜·조건부 첫 사진·제목·2줄 미리보기·mood·태그 최대 2개, compact는 사진·태그를 숨긴 최근·회고·태그·캘린더 row |
| `FeaturedDiaryEntry` | `DiaryEntry` | open | 오늘 화면의 대표 기록 한 건을 외곽 카드 없이 실제 이미지와 본문이 이어지는 editorial media section으로 강조하고 감정 색은 작은 metadata에만 사용 |
| `MoodBadge` | optional Mood | 없음 | color-only가 아닌 icon과 label 표시 |
| `FilterPopover` | `DiaryEntryFilters`, tag options | change/clear | 날짜/mood/activity/tag/favorite/image/type 복합 filter |
| `AIInsightCard` | optional `AIInsight`, expanded | toggle | 사용자 원문과 작성 주체가 다른 local-rule 분석을 accent note로 구분하고 짧은 summary를 먼저 표시하며 pattern/question은 각 entry별로 선택 공개 |
| `RelatedEntryCard` | related `DiaryEntry` | open | 별도 route로 이동하는 독립 관련 기억 객체이므로 semantic card 경계를 유지 |
| `CalendarDayCell` | `CalendarDayViewModel` | date 선택 | 날짜와 대표 mood, 기록/사진 indicator 최대 2개 표시 |
| `WeeklyMoodChart` | 7개 `WeeklyMoodPoint` | 없음 | mood와 energy를 label이 있는 chart로 표시 |

## Hook 계약

### `useDiaryRoute`

- 입력 없이 현재 `window.location`을 파싱한다.
- `location`, `navigate`, `goBack`을 반환한다.
- URL 변환은 `getDiaryRoutePath`만 담당한다.
- direct path, `pushState`, `replaceState`, `popstate`를 한 경계에서 관리한다.

### `useDiaryWorkspace`

- Diary store와 Settings store를 구독한다.
- route, filter, calendar cursor/selection, tag selection, prompt, entry별 AI collapse, `useJournalAIChat`, toast, confirmation state를 조합한다.
- query service의 계산 결과를 route view props로 변환한다.
- 회고용 관련 기록, 최근 7일 핵심 주제와 반복 생각을 query/hook 계층에서 계산해 View가 domain 판단을 하지 않게 한다.
- editor와 quick check-in hook을 연결한다.
- import file parsing, export trigger, delete/import confirmation을 service/store에 위임한다.
- 단일 삭제·import·전체 삭제·손상 저장소 복구 confirmation을 실행하기 직전에 진행 중인 Journal AI 요청을 취소한다.

### `useJournalAIChat`

- 현재 `DiaryEntry[]`를 `LocalJournalAIService`에 전달하고 entries가 바뀌면 service의 검색 기준을 갱신한다. 단, Diary store `ready` 전에는 대화를 load하거나 source를 sanitize하지 않고 visible 목록을 비운다.
- `loading | idle | sending | generating | streaming | cancelling | cancelled | no-results | error`, active conversation id, conversation 목록, 실제 부분 응답, suggested question, typed error/status message를 소유한다.
- 대화 생성·열기·이름 변경·삭제·재시도와 message 전송을 `JournalAIService`에 위임한다.
- 화면에 반환하는 conversation은 persistence refresh와 독립적인 동기 `sanitizeJournalConversations`를 항상 통과한다. 현재 entry가 수정·삭제·잠금되면 저장 실패 여부와 무관하게 오래된 답변과 민감한 source를 즉시 가린다.
- 전송마다 `AbortController`를 만들고 Escape·취소 버튼 또는 unmount에서 abort한다. in-flight 요청 또는 다른 conversation mutation 중에는 create/open/rename/delete를 모두 차단한다.
- `LocalJournalAIService`가 실제로 전달한 누적 local-search chunk만 부분 응답으로 표시하며 외부 token stream으로 가장하지 않는다. 최종 assistant 저장 실패 시 pending content를 비우고 error로 전이한다.

### `useDiaryEditor`

- `SaveDiaryDraftInput` form을 소유한다.
- 신규 entry, edit entry, persisted draft를 서로 다른 editor source로 로드하며 같은 entry의 draft를 저장본보다 우선한다.
- 의미 있는 변경을 650ms debounce로 draft 저장한다.
- TipTap transaction은 검색·분석용 `content`와 구조·서식 보존용 `contentHtml`을 하나의 atomic document change로 반영한다.
- 선택한 비오늘 날짜나 질문 본문처럼 의미 있는 초기값은 route 진입 전에 바로 draft 저장하며, 실패하면 `error`와 revision을 남겨 다음 debounce/이탈에서 재시도한다.
- pagehide와 editor unmount 시 debounce 전 최신 변경도 즉시 draft에 반영한다.
- journal 본문을 UI에서 검증하고 create/update action을 호출한다.
- image는 최대 3장, 장당 350KB 이하, image MIME만 허용한다.
- cover 추가는 기존 cover를 교체하고 `role: cover`로 저장한다. inline image 추가는 hook이 File을 검증하고 `role: inline` Data URL/domain image를 만든 뒤 editor node와 metadata를 함께 갱신한다. caption, alt, width, alignment는 TipTap node attribute로 저장한다.
- TipTap document update마다 explicit inline은 현재 `contentHtml` 참조가 사라지면 제거한다. role 없는 이미지는 이전 `contentHtml`에서 참조된 경우에만 legacy inline으로 보고, 다음 HTML에서 참조가 사라질 때 제거한다. explicit cover와 이전에도 참조되지 않은 legacy standalone image는 유지한다.
- 명시 저장 시작 시 대기 중인 debounce를 취소한다. entry create/update 성공 뒤 draft 정리를 별도 시도하고, 신규 entry의 정리만 실패하면 남은 draft를 저장된 entry id에 연결해 중복 create를 방지한다. 저장된 entry 상세 이동은 유지한다.

### `useSidebarPreference`

- `sidebarPreferenceService`를 통해 `moodi.ui.sidebar-collapsed.v1`의 문자열 boolean을 읽고 접기 toggle을 저장한다.
- 저장 접근이 실패하면 펼친 상태를 기본값으로 사용하며 Diary 탐색과 저장을 막지 않는다.
- 전체 데이터 초기화 event를 구독해 메모리 상태도 즉시 펼침으로 되돌린다.

### `useQuickCheckIn`

- dialog 열림과 `DailyCheckIn` form을 소유한다.
- UI에서는 Mood 선택을 필수로 검증한다.
- Settings의 기본 lock과 AI 사용 여부를 create input에 반영한다.

### `useSettingsPreferences`

- Settings store의 preference, option list, typed action을 SettingsPage에 제공한다.
- preference 저장 성공 여부는 boolean으로 반환해 toast feedback에 사용한다.

### `useMoodiDataReset`

- Auth logout, Theme reset, Settings preference reset, Sidebar collapse reset action을 조합한다.
- Diary 전체 삭제 action 뒤 auth/theme/settings/sidebar reset을 각각 시도하고 boolean 결과를 반환한다. 일부 preference key가 남으면 메모리 기본값은 유지하며 오류 toast로 부분 실패를 알린다.

## Store 계약

### Diary store

- `entries`: Repository에서 초기화한 canonical domain list
- `draft`: 단일 활성 draft 또는 null
- `status`: `idle | loading | ready | error`
- `mutationStatus`: `idle | saving | deleting | importing | clearing`
- `initializationWarning`: draft만 읽지 못했을 때 entries를 유지하면서 보여주는 비치명적 경고
- actions: initialize, create/update/delete, favorite, draft save/clear, replace, delete all, storage recover, error/warning clear
- store의 import는 `DiaryImportResult { entries, draftCleanupFailed }`를 반환한다. 목록 교체 뒤 draft 정리만 실패하면 imported entries와 기존 draft를 모두 유지한다.
- create/update는 `shouldAnalyze`에 따라 DiaryAnalysisService를 호출하거나 분석 필드를 비운다.
- 단일 entry 삭제 뒤 AI 대화 Repository의 해당 source reference를 제거한다. import 목록 교체, 전체 삭제, 손상 저장소 복구 뒤에는 기존 AI 대화를 비우며 정리 실패는 Diary mutation을 되돌리지 않고 `initializationWarning`으로 알린다.
- initialize는 entries를 먼저 읽고 draft를 독립적으로 읽는다. draft 실패는 `ready`, entries 실패만 `error`다.
- Repository 오류는 `errorMessage`에 UI-safe message로 저장하고 호출자에게 다시 throw한다.

### Settings store

- `preferences`: font, default lock, AI enable/tone/length/personalized question
- `persistenceError`: localStorage write 실패 message
- 각 setter는 service persist 성공 후 state를 바꾸고 boolean 결과를 반환한다.
- `resetPreferences`는 저장 key 제거 성공 여부를 boolean으로 반환하고 기본 preference를 메모리 상태에 반영한다.

## Service와 Repository 계약

### `DiaryRepository`

```ts
interface DiaryRepository {
  getEntries(): Promise<DiaryEntry[]>
  getEntry(entryId: string): Promise<DiaryEntry | null>
  createEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry>
  updateEntry(entryId: string, input: UpdateDiaryEntryInput): Promise<DiaryEntry>
  deleteEntry(entryId: string): Promise<void>
  replaceEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]>
  getDraft(): Promise<DiaryDraft | null>
  saveDraft(input: SaveDiaryDraftInput): Promise<DiaryDraft>
  clearDraft(): Promise<void>
  deleteAllData(): Promise<void>
}
```

- `LocalStorageDiaryRepository`만 현재 구현되어 있다.
- persistence entity는 Repository 내부에서 domain model로 변환한다.
- 향후 API adapter는 endpoint/auth/pagination/timeout/retry/conflict/error mapping 계약 확정 후 추가한다.

### Diary analysis

- `DiaryAnalysisService.analyze(input, existingEntries)`는 `Promise<AIInsight>`를 반환한다.
- 현재 구현은 `LocalRuleBasedDiaryAnalysisService`뿐이며 `source: local-rule-mock`을 보장한다.
- 반복 topic/mood와 프로젝트·피곤함, 움직임·행복/편안함 같은 동시 발생 pattern은 `relatedEntries`의 실제 지원 기록이 있을 때만 생성한다. 움직임 pattern은 실제 선택된 행복/편안함 label을 보존한다.
- external AI adapter, request DTO, response DTO는 아직 존재하지 않는다.

### Journal AI local search

```ts
interface JournalAIService {
  createConversation(): Promise<AIConversation>
  getConversations(): Promise<AIConversation[]>
  getConversation(id: string): Promise<AIConversation | null>
  sendMessage(input: SendAIMessageInput): Promise<AIMessageResponse>
  cancelMessage?(requestId: string): Promise<void>
  deleteConversation(id: string): Promise<void>
  renameConversation(id: string, title: string): Promise<AIConversation>
  resetConversationStorage(): Promise<void>
}
```

- `LocalJournalAIService`만 현재 구현되어 있으며 adapter kind는 `local-search`다. 날짜·감정·keyword·기간 비교를 현재 browser entries에서 계산하고 HTTP endpoint를 호출하지 않는다. 감정과 keyword는 교집합으로 검색하며 한국어 복합 조사·감정 활용형과 제품 예문을 해석한다.
- 검색 후보는 잠금 해제된 사용자 기록으로 제한하고 `seed-` id의 최초 예시 기록을 제외한다. source는 실제 entry id와 현재 원문 excerpt를 포함한다.
- 일반 검색은 전체 match 수와 검색 점수 상위 대표 source 최대 6개를 구분하고, 기간 비교는 각 기간의 전체 수와 대표 source 최대 3개를 함께 표시한다.
- `getConversation(s)`은 저장된 source의 entry id·`entryUpdatedAt`을 현재 entries와 다시 대조하고 정리 결과를 Repository에 다시 저장한다. source가 수정되면 snapshot을 갱신하고 이전 답변을 숨기며, 삭제 또는 잠금 전환이면 source를 제거한다. 화면용 동기 sanitizer는 이 persist와 별개다.
- `JournalAIConversationRepository`는 `createConversation`과 `updateConversation(id, updater)`를 분리한다. update는 존재하는 대화만 바꾸고 삭제·초기화된 대화를 upsert하지 않으며, 최근 message 80개로 먼저 자른 뒤 저장 검증한다. 손상된 envelope은 `storage-corrupted`로 전달하고 `clearConversations`는 AI key만 제거한다.
- `AIChatView`는 service/repository를 직접 호출하지 않는다. 제한된 heading·list·bold만 React node로 렌더링하고 임의 HTML이나 `dangerouslySetInnerHTML`을 사용하지 않는다.

### Diary image classification

- `diaryImageService.isDiaryImageReferenced`가 image URL의 `contentHtml` 참조 여부를 한 곳에서 판정한다.
- `getStandaloneDiaryImages`는 explicit cover와 HTML에서 참조되지 않는 role 없는 legacy image를 본문 밖 cover/gallery로 반환한다.
- `getDiaryCoverImage`는 standalone 첫 이미지를 우선하고, 없으면 본문에서 참조되는 첫 image를 목록 thumbnail fallback으로 반환한다.
- 상세 화면은 standalone 첫 이미지를 본문 전 cover로, 나머지를 본문 뒤 추가 사진으로 배치한다.

### Query와 transfer

- query service는 입력 배열을 mutation하지 않는 순수 계산 함수다.
- 회고 관련 기록은 최근 7일을 우선하고 부족하면 최신 기록으로 보완해 최대 2개를 반환한다.
- 회고 핵심 주제와 반복 생각은 전체 기간이 아니라 최근 7일 기록에서만 계산한다. `반복`, `자주` label은 집계 `count >= 2`일 때만 사용하고 단일 값은 기록 수 중심의 중립 문구로 반환한다.
- transfer service는 `moodi-diary-export` version 1 JSON envelope만 import한다.
- Blob 생성과 File parsing은 component가 아니라 transfer service가 담당한다.

## SettingsPage props 계약

```ts
type SettingsPageProps = {
  activeTheme: ThemeName
  themeOptions: ThemeOption[]
  onSelectTheme: (themeName: ThemeName) => boolean
  onOpenProfile: () => void
  onOpenTags: () => void
  onExport: () => Promise<void> | void
  onImportFile: (file: File) => Promise<void> | void
  onDeleteAll: () => Promise<void> | void
  onToast: (message: string, tone?: 'success' | 'info' | 'error') => void
}
```

SettingsPage는 Diary entries를 import하지 않는다. `onOpenProfile`은 Google Login/Signup/MyPage overlay intent, `onOpenTags`는 Diary route intent만 상위로 전달한다. export/import/delete 구현과 확인 상태는 `useDiaryWorkspace`가 소유한다. 외부 data 연결 button은 계약 미확정으로 disabled이며 어떤 SDK도 호출하지 않는다.

## 재사용과 금지 기준

- 동일 feature의 두 route 이상에서 재사용하면 독립 component를 우선 검토한다.
- 다른 feature가 실제로 사용하지 않는 Diary component를 `shared`로 올리지 않는다.
- view가 store 또는 localStorage를 직접 호출하지 않는다.
- `DiaryEntry`를 form state나 persistence envelope로 직접 재사용하지 않는다.
- 사용자 본문과 `AIInsight`를 같은 typography/author surface로 혼합하지 않는다.
- `local-search` 결과를 외부 생성형 AI 답변으로 표시하지 않고, source 없는 내용을 사용자 기록의 사실처럼 표현하지 않는다.
- click handler가 없는 활성 button을 만들지 않는다. 미확정 외부 연결은 명시적으로 disabled 처리한다.
- 독립 콘텐츠 객체·출처·상태·행동 경계가 없으면 card를 만들지 않는다. route와 section wrapper는 Main area에 직접 놓고 typography·spacing·divider로 구분한다.
