# DB Schema - moodi

프런트엔드는 backend DB에 직접 연결하거나 table/entity를 정의하지 않는다. 이 저장소가 의존하는 영속 계약은 `docs/api/specification.md`의 User/Session, Settings, DiaryEntry/Draft/Image, AIConversation/Message/Run, Diary data resource다.

- canonical persistence와 migration은 backend가 소유한다.
- 프런트는 persistence entity를 만들거나 API response를 DB model로 취급하지 않고, adapter에서 domain model로 변환한다.
- 브라우저 localStorage에는 theme와 Sidebar 같은 device-local UI preference만 남는다. session, CSRF token, Google credential, refresh/access token은 저장하지 않는다.
- backend의 실제 table, column, FK, index, soft delete, migration은 backend repository의 DB 명세가 권위다. 현재 frontend API 참고자료에는 table-level schema가 없으므로 이를 추정해 작성하지 않는다.
