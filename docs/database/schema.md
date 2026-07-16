# DB Schema - moodi

현재 프론트엔드 MVP에는 데이터베이스와 정의된 테이블이 없다.

- Diary와 draft는 versioned localStorage Repository에 저장한다.
- Settings, theme, mock profile도 각 feature의 localStorage service가 소유한다.
- 현재 저장 key, domain/persistence 분리, migration과 invariant는 `docs/architecture/architecture.md`와 `docs/architecture/state.md`에 기록한다.
- users, roles, sessions, tokens, audit table 계약은 없다.

백엔드와 DB 계약이 확정되면 실제 table, column, relation, enum, migration을 이 문서에 추가한다. 계약 전에는 schema를 추정하지 않는다.
