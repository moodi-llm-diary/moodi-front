# 외부 연동 규칙 - moodi

외부 시스템 연동은 반드시 명시적인 client 또는 adapter 경계 뒤에 둔다.

[대상]
- LLM API
- Lab, simulation, batch, worker server
- Third-party HTTP API 또는 SDK
- 현재 저장소 프로세스 밖의 모든 시스템

[규칙]
- 인증 정보, 계약, timeout, 실패 매핑이 확인되지 않은 연동은 완성 구현으로 작성하지 않는다.
- 계약이 없으면 class/method 경계만 작성하고 본문은 `pass` 또는 해당 언어의 미구현 표현으로 둔다.
- TODO 주석에는 필요한 입력, 기대 출력, upstream endpoint 또는 SDK method, timeout, retry, error mapping을 명확히 적는다.
- Service는 비즈니스 의도를 드러내는 좁은 메서드로 외부 연동을 호출한다.
- Upstream DTO는 내부 DTO로 변환한 뒤 호출자에게 반환한다.

[Python 뼈대]
```python
def request_external_job(self, request_dto: ExternalJobRequestDto) -> ExternalJobResponseDto:
    """외부 시스템에 작업 생성을 요청한다."""
    # TODO: upstream endpoint, request field, response field, timeout, retry, failure mapping 정의 필요.
    pass
```

[금지]
- 외부 API fake 구현
- upstream 데이터처럼 보이는 임의 샘플 데이터 생성
- controller 또는 UI component에서 외부 HTTP/SDK 직접 호출

[React 연동 메모]
- Component는 raw external API가 아니라 local service/hook을 호출한다.
- API error는 화면에 도달하기 전에 service layer에서 정규화한다.
- 브라우저 token 처리는 명시적 auth service/store 경계 한 곳에서 관리한다.
