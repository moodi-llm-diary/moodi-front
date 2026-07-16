# moodi

React 기반 AI 무드 다이어리 프론트엔드 MVP입니다. 데스크톱은 ChatGPT·Notion형의
접이식 사이드바 구조와 Apple식 중립 시각 계층을 사용합니다. 모바일은 App Bar·drawer와
오늘·기록·AI·캘린더·나의 5개 하단 탭을 사용하며 작성은 App Bar, drawer와 화면 action으로 진입합니다.

긴 일기 작성기는 TipTap 기반 블록 문서 편집기입니다. `/` 메뉴, 선택 서식, 인라인 이미지,
자동 임시저장과 legacy 평문 기록의 비파괴 호환을 지원합니다.

`/ai`는 외부 생성형 AI endpoint를 호출하지 않습니다. 명시적인 `local-search` adapter가 현재
브라우저의 잠금 해제된 사용자 기록만 검색·집계하고 실제 원문 출처를 표시합니다. 최초 seed와
잠긴 기록은 제외되며 대화는 versioned localStorage에만 저장됩니다.
Diary 저장소가 준비된 뒤에만 대화를 불러오며, 화면 출처는 저장 성공 여부와 무관한 동기 검증을 거쳐 삭제·잠금·수정된 원문을 즉시 가립니다. 로컬 검색은 감정과 키워드의 교집합, 한국어 조사·감정 활용형, 전체 일치 수와 대표 출처 수를 구분합니다.
전송·집계·실제 부분 결과·취소·결과 없음 상태를 구분하고, 최종 답변은 저장 성공 뒤에만 확정합니다. 손상된 AI 대화는 일기를 보존한 채 AI 대화 key만 초기화할 수 있습니다.
태그·주제·회고의 반복·자주 표현은 같은 값이 두 번 이상 확인된 경우에만 사용하며, 한 번뿐이면 기록 수 중심의 중립 문구를 표시합니다.

## Development

```bash
npm run dev
```

## Validation

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:e2e:visual
npm run test:e2e:mobile-ai
npm run test:e2e:mobile-ai:iteration-1
npm run test:e2e:mobile-ai:iteration-2
npm run test:e2e:mobile-ai:final
npm run test:e2e
```

Playwright는 설치된 Google Chrome과 관리되는 Chromium을 사용해 1440×900, 1280×800,
1024×768, 768×1024, 430×932, 390×844, 360×800 viewport를 검증합니다. 기존 UI 검수
이미지는 `artifacts/ui-review`의 `before`, `iteration-1`, `iteration-2`, `final`에 저장됩니다.
모바일 AI 검수는 두 iteration script를 거친 뒤 최종 15개 이미지를
`artifacts/ui-review/mobile-ai`에 저장합니다.
