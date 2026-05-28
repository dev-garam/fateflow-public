# Database Modeling

Fateflow는 Prisma와 PostgreSQL을 사용합니다.

공개 샘플에는 전체 운영 데이터가 아니라 schema 구조만 포함합니다.

## Main Models

```text
User
  - service user
  - status, profile, lastLoginAt, deletedAt

UserIdentity
  - OAuth provider identity
  - provider, providerUserId, email, raw profile

ManseProfile
  - saved birth profile
  - birth date/time, calendar type, relation, gender

ShareSnapshot
  - fixed public share result
  - resultJson, inputJson, optionsJson, status, expiresAt

AlgorithmProfile
  - rule/policy profile for interpretation
  - weights, narrative policy, block policy
```

## Design Points

- OAuth 계정과 서비스 사용자를 분리했습니다.
- 회원탈퇴는 soft delete 상태로 처리합니다.
- 공유 결과는 재계산하지 않고 snapshot으로 저장합니다.
- 공개 공유 옵션은 `optionsJson`으로 관리해, 개인정보성 입력값 노출 여부를 제어합니다.
- 조회 패턴을 고려해 userId, status, expiresAt, type, createdAt 등에 인덱스를 둡니다.

관련 샘플:

```text
samples/server/prisma/schema.prisma
```
