# 디렉토리 문서 - moodi

이 문서는 현재 존재하는 주요 소스 파일과 소유권을 기록한다. 기능 경계는 `moodi/src/features` 아래의 `diary`, `settings`, `auth`, `theme`이며 Diary 내부는 UI, hook, service, repository, store, type을 분리한다. Auth는 Google 기반 로그인·회원가입 화면과 인증 service 경계를 소유한다.

## App 경계

| Path | 책임 | 의존성 메모 |
| --- | --- | --- |
| `moodi/src/main.tsx` | React root 생성, Pretendard Variable CSS와 전역 CSS import | `App`만 렌더링 |
| `moodi/src/App.tsx` | Diary/Login/Signup/MyPage 조립, theme/font root attribute 적용 | auth overlay를 History state와 동기화하고 로그인·회원가입 화면에는 system color scheme, 나머지 화면에는 저장 theme preference를 적용 |
| `moodi/src/styles/reset.css` | browser reset과 box model 정규화 | token 또는 feature selector를 소유하지 않음 |
| `moodi/src/styles/tokens.css` | neutral 색상·간격·radius·shadow·z-index·motion semantic token의 단일 진실 공급원 | `paper` 기본값과 `data-moodi-theme='midnight'` variant, feature가 소비하는 semantic application alias 제공 |
| `moodi/src/styles/globals.css` | Pretendard root 조판, app background, focus와 reduced motion | reset과 token 이후 한 번 로드 |
| `moodi/src/styles/utilities.css` | screen-reader 전용 공통 utility | layout이나 component style을 포함하지 않음 |
| `moodi/src/assets/diary-afternoon-table.webp` | seed visual asset | 대표 오후 기록의 로컬 최적화 사진 |
| `moodi/src/assets/diary-evening-walk.webp` | seed visual asset | 저녁 산책 기록의 로컬 최적화 사진 |

## 공통 backend API 경계

| Path | 책임 |
| --- | --- |
| `moodi/.env.example` | `VITE_API_BASE_URL`과 Google client ID 환경변수의 공개 예시 |
| `moodi/vercel.json` | Vercel same-origin external rewrite; `/api/*`·`/health/*`를 운영 backend로 전달하고 SPA route를 `index.html`로 fallback |
| `vercel.json` | 저장소 루트를 Vercel Root Directory로 선택한 기존 프로젝트를 위한 동일 external rewrite 설정 |
| `moodi/.env.local` | 로컬 개발 backend origin `http://localhost:8080` (git ignore) |
| `moodi/src/shared/api/apiConfig.ts` | API origin과 backend relative URL 정규화 |
| `moodi/src/shared/api/httpClient.ts` | cookie credential, memory CSRF token, timeout, JSON/problem response, idempotency header 공통 경계 |
| `moodi/src/shared/api/apiError.ts` | RFC 9457 problem detail의 typed error와 UI-safe error mapping |

## Diary type과 data

| Path | 계층 | 책임 |
| --- | --- | --- |
| `moodi/src/features/diary/types/diaryDomain.ts` | domain | canonical Mood/Activity/EntryType, `DiaryImageRole`의 `cover | inline`, `DiaryEntry`, `AIInsight`, context model |
| `moodi/src/features/diary/types/diaryInputs.ts` | application contract | create/update input, filter, draft input |
| `moodi/src/features/diary/types/diaryViewModels.ts` | view model | 월간 캘린더 날짜 cell model |
| `moodi/src/features/diary/types/journalAI.ts` | application/view contract | `JournalAIService`, 대화·message·실제 기록 source, `storage-corrupted` 포함 typed error와 `local-search | external-ai` adapter kind |
| `moodi/src/features/diary/types/diary.ts` | type barrel | 위 타입의 feature 내부 호환 export |
| `moodi/src/features/diary/data/diarySeed.ts` | mock data | 저장 key가 전혀 없을 때만 사용하는 canonical seed entries |

## Diary persistence와 application

| Path | 계층 | 책임 |
| --- | --- | --- |
| `moodi/src/features/diary/repositories/DiaryRepository.ts` | repository contract | 비동기 CRUD, 목록 교체, draft, 전체 삭제 계약과 오류 code |
| `moodi/src/features/diary/repositories/apiDiaryRepository.ts` | backend persistence adapter | Diary/draft/data REST DTO 변환, ETag/If-Match, idempotency, HEAD confirmation token 처리 |
| `moodi/src/features/diary/repositories/localStorageDiaryRepository.ts` | legacy/test adapter | 이전 v2 envelope import 호환과 repository unit test용; 앱 기본 adapter는 아님 |
| `moodi/src/features/diary/repositories/JournalAIConversationRepository.ts` | repository contract | AI 대화 조회, 분리된 create/update(updater), 삭제, entry source 정리와 AI 대화 scoped reset |
| `moodi/src/features/diary/repositories/localStorageJournalAIConversationRepository.ts` | legacy/test adapter | 이전 local conversation envelope 호환과 unit test용; 앱 기본 AI persistence는 아님 |
| `moodi/src/features/diary/repositories/index.ts` | repository barrel | contract와 local adapter export |
| `moodi/src/features/diary/services/diaryAnalysisService.ts` | application service | `local-rule-mock` 분석, 실제 지원 기록이 있는 pattern/co-occurrence, topic/related entry/follow-up question 생성 |
| `moodi/src/features/diary/services/diaryQueryService.ts` | query service | 정렬, 검색/필터, calendar, insight, 최근 7일 회고 기록·주제·반복 생각, tag index, 과거의 오늘 계산 |
| `moodi/src/features/diary/services/diaryTransferService.ts` | transfer service | versioned JSON export와 import file 검증 |
| `moodi/src/features/diary/services/diaryDocumentService.ts` | document compatibility service | legacy 평문을 안전한 TipTap paragraph HTML로 변환하고 질문 문단을 추가 |
| `moodi/src/features/diary/services/diaryImageService.ts` | domain/application helper | cover/inline URL 참조 판정, role 없는 legacy image 분류, 목록 thumbnail 선택 |
| `moodi/src/features/diary/services/journalAIService.ts` | legacy/test service | 이전 `local-search` 대화 호환과 unit test용; 앱 기본 AI service는 아님 |
| `moodi/src/features/diary/services/apiJournalAIService.ts` | backend AI adapter | conversation/message/run REST DTO 변환, EventSource SSE 수신과 run cancellation |
| `moodi/src/features/diary/services/diaryImageUploadService.ts` | backend image adapter | multipart image upload과 API content URL domain 변환 |
| `moodi/src/features/diary/services/sidebarPreferenceService.ts` | UI preference service | `moodi.ui.sidebar-collapsed.v1` read/write/reset과 전체 초기화 event |
| `moodi/src/features/diary/stores/diaryStore.ts` | application store | entries/draft client cache, async mutation 상태, API Repository와 UI query 조합 |

## Diary 자동 회귀 테스트

| Path | 검증 범위 |
| --- | --- |
| `moodi/src/features/diary/repositories/localStorageDiaryRepository.test.ts` | 중복 ID·외부 이미지 URL 거부, 전체 삭제 성공, 저장 실패 rollback |
| `moodi/src/features/diary/stores/diaryStore.test.ts` | 초기화 부분 실패, 치명적 로드 실패, import 후 draft 정리 실패 |
| `moodi/src/features/diary/services/diaryQueryService.test.ts` | 최근 7일 회고 최대 2개와 fallback, 한국어 mood/activity 검색, count 2 미만의 반복·자주 표현 차단 |
| `moodi/src/features/diary/services/diaryAnalysisService.test.ts` | 잠금/seed 제외, 실제 지원 기록 기반 pattern/co-occurrence와 선택된 행복/편안함 label 보존 |
| `moodi/src/features/diary/services/diaryImageService.test.ts` | explicit cover 우선, role 없는 legacy HTML 참조 분류, inline thumbnail fallback |
| `moodi/src/features/diary/services/journalAIService.test.ts` | mood+keyword 교집합, 한국어 조사/활용형·직접 예문, 전체 match/대표 source, 동기 sanitizer, 최종 저장 실패와 AbortSignal 취소 |
| `moodi/src/features/diary/repositories/localStorageJournalAIConversationRepository.test.ts` | create/update 분리, non-upsert, 최근 80개 trim, source 정리, typed 손상 오류와 Diary 보존 reset |

## 실제 브라우저 회귀 테스트와 검수 산출물

| Path | 책임 |
| --- | --- |
| `moodi/playwright.config.ts` | Chrome/Chromium, 1440×900·1280×800·1024×768·768×1024·430×932·390×844·360×800의 7개 프로젝트와 Vite web server 설정 |
| `moodi/tests/e2e/testSupport.ts` | 첫 navigation 전 auto runtime 수집, HTTP/network/font/image, semantic 대비, 가로 overflow·fixed 겹침·overlay·geometry, mobile 44px touch target·16px input·visual viewport 공통 검증 |
| `moodi/tests/e2e/auth-theme.spec.ts` | 로그인에서 회원가입으로 전환할 때 html과 theme root가 같은 시스템 테마를 유지하는지 검증 |
| `moodi/tests/e2e/moodi-visual.spec.ts` | 오늘·빠른 기록·Sidebar·작성·slash·image·목록·상세·캘린더·회고·설정·dark theme 렌더링, Pretendard 실제 load, 7개 viewport 스크린샷과 desktop Main area 전체 점유·오늘 및 기타 route flat wrapper 계약 검증 |
| `moodi/tests/e2e/moodi-journal-flow.spec.ts` | 긴 일기와 빠른 기록 CRUD, draft 복구, cover/inline image role·inline 삭제 reconciliation, 태그·favorite, 검색·탐색, focus/Escape, mobile touch target 검증 |
| `moodi/tests/e2e/moodi-mobile-ai.spec.ts` | Mobile App Bar·drawer·오늘/기록/AI/캘린더/나, 작성 진입, local-search·source 이동·대화 관리·결과 없음·취소·저장 오류, keyboard visual viewport와 필수 15개 screenshot 검증 |
| `moodi/artifacts/ui-review/before` | 변경 전 기준 화면 |
| `moodi/artifacts/ui-review/iteration-1` | 1차 렌더링 검수 화면 |
| `moodi/artifacts/ui-review/iteration-2` | 2차 렌더링 검수 화면 |
| `moodi/artifacts/ui-review/final` | 기존 visual suite의 최종 7개 viewport별 화면 산출 위치 |
| `moodi/artifacts/ui-review/main-area-iteration-1` | desktop Main area 평면화 1차 Chrome 1440×900·Chromium 1280×800 비교 화면 |
| `moodi/artifacts/ui-review/main-area-iteration-2` | 1차 확인 뒤 control 폭·본문 여백을 보정한 2차 비교 화면 |
| `moodi/artifacts/ui-review/home-flat-before` | 오늘 화면 card 제거 전 1280×800·390×844 비교 기준 |
| `moodi/artifacts/ui-review/home-flat-iteration-1` | 오늘 화면을 divider 중심으로 전환한 1차 비교 화면 |
| `moodi/artifacts/ui-review/home-flat-iteration-2` | 감정 선택 7열과 모바일 간격을 보정한 2차 비교 화면 |
| `moodi/artifacts/ui-review/home-flat-final` | Chrome/Chromium 데스크톱과 390·360 모바일의 최종 오늘 화면 검수 위치 |
| `moodi/artifacts/ui-review/mobile-ai` | 홈 430/390/360과 drawer·하단 탭·editor·AI·캘린더·회고·desktop AI의 최종 필수 15개 screenshot |

`artifacts/playwright-report`와 `artifacts/test-results`는 실행 결과와 실패 진단용 산출물이며 application source로 사용하지 않는다.
`test:e2e:mobile-ai:iteration-1`과 `iteration-2`는 실행 시 `mobile-ai/iteration-1`, `mobile-ai/iteration-2` stage directory를 생성한다. final script는 stage directory를 유지한 채 `mobile-ai` 루트의 위 15개 파일을 갱신한다.

## Diary hook

| Path | 책임 |
| --- | --- |
| `moodi/src/features/diary/hooks/useDiaryRoute.ts` | URL parse, History API navigation, `popstate`, fallback route |
| `moodi/src/features/diary/hooks/useDiaryWorkspace.ts` | route별 조회 상태, filter/calendar/tag/confirmation/toast, import/export와 파괴적 Diary action 전 AI 취소 orchestration |
| `moodi/src/features/diary/hooks/useDiaryEditor.ts` | 작성 form, 650ms draft 자동저장/복구/flush, cover/inline 역할의 이미지 Data URL 변환과 inline reconciliation, 저장 validation |
| `moodi/src/features/diary/hooks/useJournalAIChat.ts` | Diary ready gate, 동기 source sanitizer, in-flight history guard, 대화 load/create/open/rename/delete와 local-search 전송·취소·reset orchestration |
| `moodi/src/features/diary/hooks/useQuickCheckIn.ts` | 빠른 기록 dialog form과 create use-case |
| `moodi/src/features/diary/hooks/useSidebarPreference.ts` | Sidebar 접기 preference 상태, toggle persistence와 전체 초기화 event 동기화 |

## Diary page와 layout

| Path | 책임 |
| --- | --- |
| `moodi/src/features/diary/pages/DiaryMvpPage.tsx` | route view, AppShell, QuickCheckIn, ConfirmDialog, Toast 조립 |
| `moodi/src/features/diary/pages/DiaryMvpPage.css` | editor, selector, quick dialog, diary feature component style |
| `moodi/src/features/diary/components/common/AppShell.tsx` | persisted 접기 hook, desktop Sidebar와 그 오른쪽 전체 Main area, Mobile App Bar·drawer·하단 탭 조립, visual viewport/keyboard CSS 변수 동기화 |
| `moodi/src/features/diary/components/common/SidebarNavigation.tsx` | 264/232/72px desktop navigation, 작성 CTA, active draft, 최근 기록 최대 5개, profile/settings 경계 |
| `moodi/src/features/diary/components/common/MobileNavigation.tsx` | safe-area Mobile App Bar, 오늘/기록/AI/캘린더/나 5탭, focus-trapped drawer와 새 기록·draft·최근·즐겨찾기·설정 진입 |
| `moodi/src/features/diary/components/common/navigation.ts` | desktop/mobile navigation item과 route key |
| `moodi/src/features/diary/components/common/common.css` | Sidebar/Main area shell, navigation, dialog, toast, 공통 control과 desktop flat empty state 반응형 style |
| `moodi/src/features/diary/components/common/index.ts` | diary common component barrel |

## Diary 공통 UI

| Path | 책임 |
| --- | --- |
| `moodi/src/features/diary/components/common/PageHeader.tsx` | route 화면 제목, 설명, action 조립 |
| `moodi/src/features/diary/components/common/SearchBar.tsx` | accessible search input과 clear event |
| `moodi/src/features/diary/components/common/EmptyState.tsx` | empty/error 안내와 선택 action |
| `moodi/src/features/diary/components/common/Skeleton.tsx` | 초기 loading placeholder |
| `moodi/src/features/diary/components/common/Toast.tsx` | success/info/error live-region feedback |
| `moodi/src/features/diary/components/common/ConfirmDialog.tsx` | 삭제/edit/new/import/all/recover 확인, pending 잠금, focus trap, Escape, focus restore |

## Diary feature component

| Path | 책임 |
| --- | --- |
| `moodi/src/features/diary/components/DiaryEditor.tsx` | 선택적 cover, 제목, 날짜·감정·energy·태그 한 줄/popover, online·자동저장 상태, mood/사진/태그/잠금 도구, 고급 metadata disclosure와 저장 UI |
| `moodi/src/features/diary/components/editor/BlockDiaryEditor.tsx` | TipTap block editor, 현재 지원 slash command, bubble menu, block action, inline image inspector 조립 |
| `moodi/src/features/diary/components/editor/BlockDiaryEditor.css` | editor/reader block typography, floating menu, image/question/details responsive style |
| `moodi/src/features/diary/components/editor/diaryEditorExtensions.ts` | 코드 계열을 제외한 허용 block/mark와 Moodi 질문·이미지 custom node, 기존 HTML 렌더링용 감정·접기 legacy schema |
| `moodi/src/features/diary/components/editor/MoodiQuestionNodeView.tsx` | 질문 새로 받기·닫기·답변·일반 문단 변환 node view |
| `moodi/src/features/diary/components/editor/DiaryDocumentReader.tsx` | Repository 검증을 통과한 block HTML 읽기 렌더링과 legacy paragraph fallback |
| `moodi/src/features/diary/components/QuickCheckIn.tsx` | mood/energy/note 우선, activity disclosure를 가진 modal/bottom sheet |
| `moodi/src/features/diary/components/MoodSelector.tsx` | canonical Mood 9개 선택 |
| `moodi/src/features/diary/components/MoodBadge.tsx` | 색상, icon, label을 함께 쓰는 Mood 표시 |
| `moodi/src/features/diary/components/EnergySelector.tsx` | 1~5 energy 선택 |
| `moodi/src/features/diary/components/ActivitySelector.tsx` | canonical Activity 9개 선택 |
| `moodi/src/features/diary/components/TagInput.tsx` | 사용자 태그 추가·삭제와 최대 개수 UI |
| `moodi/src/features/diary/components/DiaryListItem.tsx` | 날짜 그룹 timeline과 최근·회고·태그·캘린더 compact row; explicit cover 우선 thumbnail |
| `moodi/src/features/diary/components/FeaturedDiaryEntry.tsx` | 오늘 화면 대표 기록 한 건의 editorial 본문 미리보기, mood, 최대 2개 태그와 explicit cover/inline fallback 대표 사진 |
| `moodi/src/features/diary/components/FilterPopover.tsx` | 날짜, mood, activity, tag, favorite, image, type filter UI |
| `moodi/src/features/diary/components/AIInsightCard.tsx` | 원문과 분리된 분석 결과와 collapse control |
| `moodi/src/features/diary/components/RelatedEntryCard.tsx` | 관련 과거 기록 이동 카드 |
| `moodi/src/features/diary/components/JournalPromptCard.tsx` | 질문 1개 표시, 본문에 사용/새 질문 event |
| `moodi/src/features/diary/components/CalendarDayCell.tsx` | 날짜, 대표 mood, 기록/사진 indicator 최대 2개 표시 |
| `moodi/src/features/diary/components/WeeklyMoodChart.tsx` | 7일 mood/energy chart |
| `moodi/src/features/diary/components/diaryUiConfig.ts` | Mood/Activity label·icon·color, prompt, daily sentence |

## Diary route view

| Path | URL | 책임 |
| --- | --- | --- |
| `moodi/src/features/diary/components/views/TodayView.tsx` | `/` | 인사, 기록 CTA, 7개 mood check-in, 질문 1개, draft, 조건부 사진 대표 기록과 최근/과거 기록 |
| `moodi/src/features/diary/components/views/WriteWorkspaceView.tsx` | `/write` | 중복 route header 없이 DiaryEditor 조립 |
| `moodi/src/features/diary/components/views/AIChatView.tsx` | `/ai` | local-search 고지, empty·loading·searching·streaming·error, 대화와 실제 기록 source card, history/rename/delete, safe text renderer와 composer |
| `moodi/src/features/diary/components/views/AIChatView.css` | `/ai` | desktop/mobile 대화 layout, safe-area composer, keyboard visual viewport와 history drawer style |
| `moodi/src/features/diary/components/views/EntriesView.tsx` | `/entries` | 선택 공개 검색·filter, 모든 기록의 날짜 그룹과 동일한 divider row timeline, empty state |
| `moodi/src/features/diary/components/views/EntryDetailView.tsx` | `/entries/:id` | 날짜·제목·핵심 metadata·첫 standalone cover·원문·나머지 standalone 추가 사진, metadata disclosure, 짧은 AI, 관련 기록 뒤 하단 수정·삭제, 이전/다음 |
| `moodi/src/features/diary/components/views/CalendarWorkspaceView.tsx` | `/calendar` | 월 이동, 선택 공개 mood/tag filter, 날짜별 기록 |
| `moodi/src/features/diary/components/views/InsightsView.tsx` | `/insights` | 주간 chart 1개, 핵심 주제 최대 4개, 관련 기록 최대 2개, 짧은 회고 |
| `moodi/src/features/diary/components/views/TagsView.tsx` | `/tags` | user/activity/mood/aiTopic 한 category씩 탐색하고 matching entries 표시 |
| `moodi/src/features/diary/components/views/views.css` | route views | route별 desktop/mobile layout, 오늘의 연속 canvas·divider section, Sidebar 오른쪽 Main area, 내부 읽기 column과 semantic control surface 구분 |
| `moodi/src/features/diary/components/views/index.ts` | route views | view component barrel |

## Settings feature

| Path | 계층 | 책임 |
| --- | --- | --- |
| `moodi/src/features/settings/types/settings.ts` | type | font, lock, AI preference, 외부 data source option |
| `moodi/src/features/settings/services/settingsApiService.ts` | backend adapter | settings REST DTO 조회·PATCH·DELETE |
| `moodi/src/features/settings/services/settingsPreferenceService.ts` | legacy preference helper | 이전 device-local settings 호환용; 앱 기본 persistence는 아님 |
| `moodi/src/features/settings/stores/settingsStore.ts` | store | server settings cache와 저장 action |
| `moodi/src/features/settings/hooks/useSettingsPreferences.ts` | hook | SettingsPage용 상태·option·action |
| `moodi/src/features/settings/hooks/useMoodiDataReset.ts` | hook | auth/theme/settings/sidebar reset action을 전체 로컬 삭제 use-case로 조합 |
| `moodi/src/features/settings/pages/SettingsPage.tsx` | page | 계정 profile과 태그·주제 진입, theme/font/privacy/AI/external connection/data 관리 UI와 상위 callback |
| `moodi/src/features/settings/pages/SettingsPage.css` | style | Settings desktop/mobile layout |

## 기존 Auth와 Theme feature

| Path | 책임 |
| --- | --- |
| `moodi/src/features/auth/pages/LoginPage.tsx` | 돌아가기·theme selector 없이 Google 기반 로그인 화면을 조립 |
| `moodi/src/features/auth/pages/SignupPage.tsx` | 돌아가기·theme selector 없이 Google 기반 회원가입 화면을 조립 |
| `moodi/src/features/auth/pages/GoogleAuthPage.tsx` | 로그인·회원가입 공통 Google 인증 UI와 화면 상태 조립 |
| `moodi/src/features/auth/pages/MyPage.tsx` | 인증 결과 profile과 logout 화면 |
| `moodi/src/features/auth/pages/AuthPages.css` | Auth 화면 style |
| `moodi/src/features/auth/hooks/useGoogleAuthPage.ts` | Google popup button 준비 상태와 credential 교환 orchestration |
| `moodi/src/features/auth/hooks/useMyPage.ts` | profile view model과 logout action |
| `moodi/src/features/auth/stores/authStore.ts` | 인증 상태와 사용자 profile 표시 state |
| `moodi/src/features/auth/services/authSessionService.ts` | session 조회·logout, memory CSRF token 갱신 |
| `moodi/src/features/auth/services/authGoogleService.ts` | login attempt, GIS popup callback, same-origin credential 교환 경계 |
| `moodi/src/features/auth/types/auth.ts` | Auth form/domain/view type |
| `moodi/src/features/theme/components/ThemeSelector.tsx` | 재사용 theme selector |
| `moodi/src/features/theme/components/ThemeSelector.css` | theme selector style |
| `moodi/src/features/theme/hooks/useThemePreference.ts` | theme state와 option 제공 |
| `moodi/src/features/theme/hooks/useSystemThemePreference.ts` | browser/OS color scheme 변경을 구독하는 표시용 theme hook |
| `moodi/src/features/theme/stores/themeStore.ts` | active theme state |
| `moodi/src/features/theme/services/themePreferenceService.ts` | `paper | midnight` localStorage persistence, system color scheme 조회와 기존 `forest | rose | ocean`의 `paper` normalization |
| `moodi/src/features/theme/services/themePreferenceService.test.ts` | system color scheme의 canonical theme 변환과 지원하지 않는 환경 fallback 검증 |
| `moodi/src/features/theme/types/theme.ts` | canonical `paper | midnight` theme contract |

## 디렉토리 규칙

- Diary 전용 UI는 `features/diary/components`에 둔다. 현재 repository 전체에서 공유하는 `src/shared` UI는 없다.
- route view는 `components/views`, layout/control은 `components/common`이 소유한다.
- backend DTO와 domain/view model은 adapter 파일에서만 변환한다.
- device-local theme/sidebar preference를 제외한 Diary, draft, AI, user settings persistence는 backend API가 소유한다.
