# Visual Benchmark - moodi

> Backend integration note: `/ai`의 UI는 local-search 고지가 아니라 backend AI run 상태(queued/generating/SSE streaming/completed/no-results/failed/cancelled)와 실제 server source를 표시한다. history mutation은 active run 중 비활성화하고, UI가 browser-local AI 결과나 가짜 stream을 만들지 않는다.

## 단일 디자인 방향

Moodi는 ChatGPT와 Notion에서 구조만, Apple 소비자용 제품에서 절제된 시각 원칙만 참고한다. 좌측의 접이식 전역 탐색, 최근 기록 접근, 넓은 중앙 작업 영역과 progressive disclosure를 사용하되 어느 제품도 픽셀 단위로 복제하지 않는다. 최종 인상은 생산성 도구보다 따뜻하고 사적인 개인 일기장이어야 한다.

## CSS 계층과 토큰

전역 스타일은 다음 순서로 한 번만 로드한다.

1. `styles/reset.css`: 브라우저 기본 여백과 box model 정규화
2. `styles/tokens.css`: semantic color, spacing, radius, shadow, motion, z-index와 light/dark 값
3. `styles/globals.css`: Pretendard 조판, root surface, focus와 reduced motion
4. `styles/utilities.css`: screen-reader 전용 utility
5. shared component → feature component → page layout 순으로 scope된 stylesheet

`--color-canvas`, `--color-surface*`, `--color-text-*`, `--color-border*`가 중립색 층위를 소유한다. 강한 제품 포인트는 `--color-accent` 한 계열뿐이며 CTA, 활성 navigation, focus와 선택 상태에 동일하게 사용한다. `--mood-*`는 점, 작은 아이콘, badge와 chart data에만 사용한다. JSX 또는 page stylesheet에 색상을 반복하거나 충돌 해결을 위해 `!important`를 추가하지 않는다.

## 레이아웃

- 1101px 이상은 264px Sidebar, 901~1100px은 232px compact Sidebar를 사용한다.
- Sidebar는 72px icon rail로 접을 수 있고 상태를 `moodi.ui.sidebar-collapsed.v1`에 기억한다.
- Sidebar를 제외한 오른쪽 grid track 전체를 Main area라고 부른다. Main area는 남은 viewport 폭과 높이를 사용하는 연속 canvas이며 page-level rounded container나 중앙에 떠 있는 dashboard shell을 두지 않는다.
- 상단에는 워드마크·접기·새 기록, 본문에는 오늘·AI와 대화·기록·캘린더·회고, 보조 영역에는 작성 중인 기록과 최근 5개, 하단에는 계정·설정을 둔다.
- 우측 고정 패널, 깊은 폴더 tree, 3단 분할은 사용하지 않는다.
- 작성·상세 본문은 680~760px의 읽기 열을 중심으로 하고, 오늘·기록·캘린더는 목적별 최대 폭 안에서 넓게 사용한다. 이 max-width는 Main area 안쪽의 가독성 정렬선이지 별도 surface 경계가 아니다.
- 900px 이하는 hamburger·route title·문맥 action의 Mobile App Bar와 오늘·기록·AI·캘린더·나의 5개 하단 navigation을 사용한다. 작성은 App Bar, drawer와 화면 안 action으로 진입하고 `/write`에서는 App Bar와 하단 navigation을 숨긴다.
- drawer는 화면 왼쪽의 modal surface로 profile, 새 기록, 전체 route, draft·최근·즐겨찾기, 설정을 한 흐름에 두며 열린 상태만 viewport 안에 렌더링한다.

## Surface와 색상

앱 canvas, Sidebar material, 연속된 document Main area와 secondary neutral surface가 기본 계층이다. document surface는 border·radius·shadow를 가진 외곽 카드가 아니라 Main area의 배경이다. 카드마다 다른 색을 부여하지 않는다. 감정은 색상과 함께 이름·아이콘·텍스트를 항상 제공하며 큰 카드·페이지·에디터 종이 전체를 tint하지 않는다. 이미지는 기록의 콘텐츠로만 강조하고 AI note는 accent soft surface 하나만 사용한다.

section은 typography, whitespace, divider를 우선해 구분한다. card는 AI 실제 출처, 관련 기록 링크, 원문과 작성 주체가 다른 AI note, modal·popover·drawer, 입력·선택 control처럼 독립된 객체·상태·행동 경계를 전달할 때만 사용한다. 오늘 화면의 임시저장은 예외적으로 주변 흐름과 같은 평면 row로 표시한다.

Light가 우선이지만 기존 dark preference는 `paper | midnight` 두 값의 semantic token으로 유지한다. legacy `forest`, `rose`, `ocean` 값은 사용자 데이터를 지우지 않고 `paper`로 정규화한다.

## 화면별 원칙

- 오늘: 날짜와 짧은 인사 아래 기록 시작, 빠른 감정 선택, 작성 중인 기록, 대표·최근 기록, 질문과 과거의 오늘을 배경 카드 없이 section spacing, 제목과 divider로 구분한다. 대표 사진은 콘텐츠로 강조하되 page/card 외곽 border·radius·shadow를 만들지 않고 CTA·감정 선택 같은 control만 surface를 가진다.
- 작성: 날짜·감정·에너지·태그 요약 한 줄, 제목과 TipTap 문서를 Main area에 직접 배치한다. 자동 저장·오프라인 상태는 toolbar에서 조용히 표시하고, 필요한 tool surface는 콘텐츠 크기만 사용한다.
- 기록: 검색과 filter를 필요할 때만 열고 모든 항목을 날짜 heading별 동일한 divider row로 그룹화한다.
- 상세: 작성 화면과 같은 조판을 공유하고 원문을 별도 paper card로 감싸지 않으며 감정은 badge나 작은 indicator로만 사용한다.
- AI: GPT·Gemini 계열처럼 Main area의 전체 폭·높이를 사용하는 compact chat shell로 구성한다. 큰 page title과 넓은 외곽 padding 대신 낮은 header·local-search bar를 사용하되 message와 composer에는 읽기 가능한 최대 폭을 유지한다. `로컬 기록 검색` 고지, 사용자 질문, 전체 검색 수와 화면에 노출한 대표 기록 수, 실제 source card의 위계를 분리하고 source 없는 생성형 답변처럼 꾸미지 않는다. empty·sending·generating·실제 local streaming·result 없음·typed error·취소 상태를 텍스트로 드러내며 in-flight에는 history 변경 control을 비활성화한다. `storage-corrupted`에는 일기 보존을 명시한 `AI 대화만 초기화` 확인 흐름을 제공한다.
- 캘린더: 전체 달력을 Main area에 직접 배치한다. 날짜 cell은 배경을 채우지 않고 기록·감정 점만 표시하며 선택한 날짜의 기록은 아래 divider row로 보여준다.
- 회고: 문장, 흐름 chart, 주제, 관련 기록, Moodi note가 카드 묶음이 아니라 이어지는 하나의 report가 되도록 구성한다.
- 설정: 계정, 화면, 일기, AI 도움, 개인정보와 데이터를 목록·구분선 중심으로 구성한다.
- 빠른 기록: 작은 dialog 또는 mobile sheet에서 감정, 에너지, 한 줄과 선택적 활동만 수집한다.

## Editor

TipTap 3을 사용한다. 신규 slash menu는 텍스트, 제목 1~3, 사진, 인용문, 구분선, 글머리·번호·체크 목록과 Moodi 질문만 노출한다. 기존 details와 emotion node는 저장된 문서를 읽기 위한 legacy schema 호환으로만 유지한다. 메뉴는 커서 위·아래의 가용 공간을 계산해 viewport 안에 배치하고 선택 toolbar와 block handle은 selection, hover 또는 focus 상태에서만 표시한다. 모바일 editor toolbar는 블록·서식·목록·사진·감정·키보드 닫기의 44px 이상 control과 safe-area inset을 사용하고 키보드가 열리면 `visualViewport`에서 계산한 inset 위로 이동한다.

## 모바일 viewport와 safe area

- App Bar, drawer, 하단 navigation, toast, bottom sheet, AI composer와 editor toolbar는 `env(safe-area-inset-*)`를 반영한다.
- AI composer는 16px textarea, 최대 124px auto-grow와 44px send button을 사용한다. `ResizeObserver`로 실제 form 높이를 대화 영역의 scroll padding에 동기화하며, 평상시 하단 navigation 위에 있고 keyboard-open 상태에서는 navigation을 숨긴 뒤 visual viewport 하단에 붙인다.
- 430×932, 390×844, 360×800에서 콘텐츠가 가로로 넘치거나 fixed UI에 가려지지 않아야 한다. 390×844는 drawer, editor, AI 대화와 keyboard 상태의 대표 검수 viewport다.

## 검증

Chrome/Chromium으로 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 360×800을 검증한다. 기존 visual 산출물은 `artifacts/ui-review`의 `before`, `iteration-1`, `iteration-2`, `final`에 둔다. desktop Main area는 `test:e2e:main-area:iteration-1`과 `iteration-2`로 Chrome 1440×900·Chromium 1280×800을 별도 비교한다. 모바일 AI는 `test:e2e:mobile-ai:iteration-1`과 `iteration-2`를 차례로 실행해 최소 두 차례 검수하고, final 실행이 `artifacts/ui-review/mobile-ai` 루트의 다음 15개 화면을 갱신한다. iteration directory는 비교 근거로 보존한다.

- 홈: 430×932, 390×844, 360×800
- 390×844: drawer, bottom navigation, editor, editor keyboard layout, entry detail, AI empty/conversation/sources/keyboard layout, calendar, reflection
- desktop AI: 1440×900

최종 파일명은 `home-430x932.png`, `home-390x844.png`, `home-360x800.png`, `drawer-390x844.png`, `bottom-nav-390x844.png`, `editor-390x844.png`, `editor-keyboard-layout-390x844.png`, `entry-detail-390x844.png`, `ai-empty-390x844.png`, `ai-conversation-390x844.png`, `ai-sources-390x844.png`, `ai-keyboard-layout-390x844.png`, `calendar-390x844.png`, `reflection-390x844.png`, `ai-desktop-1440x900.png`로 고정한다.

Playwright는 root/body 가로 overflow, Sidebar/main·App Bar/main·composer/navigation 겹침, desktop Main area의 남은 viewport 전체 점유, 오늘과 다른 route 평면화 대상의 transparent background·0 radius·no shadow, `/ai` full-height shell, safe area와 visual viewport, 닫힌 drawer focus, dialog/drawer/slash menu bounds, mobile 16px input·44px touch target, calendar overflow, 깨지거나 왜곡된 image, Sidebar reload persistence, Pretendard resource, console/page error, 실패 request와 HTTP 4xx/5xx를 검사한다. 오늘 화면은 `before`, `home-flat-iteration-1`, `home-flat-iteration-2`, `home-flat-final` 스크린샷을 동일 viewport에서 비교한다. 기존 CRUD·자동 저장·복구·검색·날짜·테마와 함께 drawer, local-search, source 상세 이동·즉시 sanitize, in-flight 대화 관리 차단, 결과 없음·취소·최종 저장 오류, 손상 AI 저장소 scoped reset과 keyboard focus 흐름을 실제 상호작용으로 확인한다.

## 금지 사항

- 문서보다 앱 chrome이 강한 상단 global navigation
- 여러 pastel과 감정 tint가 경쟁하는 화면
- 모든 section을 같은 흰 카드로 만드는 dashboard
- route 전체를 감싸는 둥근 page card, 제목만 다른 동일 surface의 반복, card 안의 장식 card
- IDE형 tree, 우측 inspector, 데이터베이스 표
- 개발자 command palette처럼 보이는 slash menu
- 장식용 font, 과도한 glass, 큰 shadow와 gradient 남발
- 사용자 원문보다 AI 분석이 강하게 보이는 구조
