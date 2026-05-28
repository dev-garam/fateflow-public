# Testing

Fateflow에서는 계산/해석 로직이 많기 때문에, 사람이 눈으로만 확인하면 회귀를 놓치기 쉽습니다.

공개 샘플에는 대표 테스트 일부를 포함했습니다.

## Test Targets

```text
Auth
  - refresh token rotation
  - invalid token/session handling

Share Snapshot
  - snapshot creation
  - public retrieval
  - status/expiration handling

Myeongri
  - timezone boundary
  - saju summary report response structure
```

## Why These Tests Matter

사주/운세 서비스에서는 단순 CRUD보다 도메인 계산 결과와 응답 구조의 안정성이 중요합니다.

특히 날짜/시간/타임존 경계값은 사용자 입력에 따라 결과가 달라질 수 있기 때문에 별도 테스트 대상으로 두었습니다.

관련 샘플:

```text
samples/server/test/auth-refresh.test.js
samples/server/test/share-snapshot.test.js
samples/server/test/myeongri-timezone-boundary.test.js
samples/server/test/saju-summary-report-v2.test.js
```
