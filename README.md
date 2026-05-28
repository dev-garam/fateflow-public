# Fateflow Public Case Study

Fateflow는 사주/운세 분석 서비스를 직접 운영해보기 위해 만든 개인 서비스입니다.

이 공개 레포는 운영 중인 private 레포 전체를 공개한 것이 아니라, 백엔드 설계와 구현 방식을 설명하기 위해 민감 정보와 운영 설정을 제거한 포트폴리오용 case study입니다.

코드는 그대로 실행 가능한 전체 서버가 아니라 선별된 샘플입니다. 대신 `npm run check`로 공개 범위에 맞는 파일 구조와 민감정보 노출 여부를 점검할 수 있도록 구성했습니다.

## Service

- 운영 서비스: [fateflow.app](https://fateflow.app)
- 공개 case study: [github.com/dev-garam/fateflow-public](https://github.com/dev-garam/fateflow-public)

## Main Point

Fateflow의 핵심 목표는 LLM API를 호출해 운세 문장을 생성하는 것이 아니라, 명리학 도메인 규칙과 해석 정책, 템플릿 조합, 문장 정제 로직을 직접 설계해 일관된 사주 응답을 만들어보는 것이었습니다.

이를 위해 서버에서는 생년월일/시간 입력을 기준으로 원국, 대운, 세운, 월운 계산에 필요한 도메인 상태를 만들고, reason code와 semantic state를 기반으로 해석 문장을 조립합니다.

## What This Shows

- LLM 의존 없이 규칙 기반으로 사주 해석 응답을 생성하는 구조
- NestJS 기반 API 서버 설계
- Prisma/PostgreSQL 기반 사용자, 프로필, 공유 스냅샷 모델링
- Google OAuth, JWT, Redis 세션 기반 인증 구조
- 공유 스냅샷 생성, 공개 조회, 만료, soft delete 처리
- 테스트를 통한 경계값, 인증 세션, 공유 스냅샷 검증
- 운영 서비스와 공개 포트폴리오의 분리 방식

## Tech Stack

- Backend: Node.js, TypeScript, NestJS
- Database: PostgreSQL, Prisma
- Cache/Session: Redis
- Auth: Google OAuth, JWT access/refresh token
- Infra: GCP Cloud Run, Supabase PostgreSQL, Terraform
- Testing: Node test runner

## Quick Check

```bash
npm install
npm run check
npm run list:samples
```

`package.json`에는 공개 샘플 코드가 사용한 NestJS, Prisma, Auth, Validation 계열의 주요 라이브러리를 함께 등록했습니다.

다만 이 레포는 운영 서버 원본이 아니기 때문에 `npm run start`로 전체 API 서버를 실행하는 구조는 제공하지 않습니다.

`npm run check`는 다음을 확인합니다.

- 공개용 문서와 샘플 코드가 필요한 위치에 있는지
- `.env`, DB URL, JWT secret, Terraform state/vars, 실제 IP, 로컬 절대경로처럼 공개 레포에 들어가면 안 되는 패턴이 있는지

이 레포는 전체 NestJS 서버 실행을 제공하지 않습니다. 운영 서비스의 Swagger 문서, 실제 배포 설정, 환경변수, Terraform state 등은 보안상 공개 범위에서 제외했습니다.

## Architecture

```text
Client
  |
  v
NestJS API Server
  |
  |-- Auth Module
  |     |-- Google OAuth
  |     |-- JWT access/refresh token
  |     `-- Redis session store
  |
  |-- Myeongri Module
  |     |-- Manse calculation
  |     |-- Semantic state
  |     |-- Reason codes
  |     `-- Rule-based narrative rendering
  |
  |-- Fortune Module
  |     |-- Today fortune
  |     |-- Monthly fortune
  |     |-- Yearly fortune
  |     `-- Decade fortune
  |
  `-- Share Snapshot Module
        |-- Result snapshot
        |-- Public share page data
        |-- Expiration/status
        `-- Privacy-aware output options
```

## Public Scope

이 레포에는 공개 가능한 코드 샘플과 설계 문서만 포함합니다.

포함하지 않는 항목은 다음과 같습니다.

- 실제 환경변수
- DB/Redis 접속 정보
- Google OAuth secret, JWT secret
- Terraform state, tfvars, backend 설정 원본
- 운영 배포 설정 원본
- 전체 private 서비스 히스토리
- 내부 작업 메모

## Repository Structure

```text
docs/
  architecture.md
  rule-based-reading.md
  auth-session.md
  database-modeling.md
  deployment.md
  testing.md
  public-scope.md

samples/server/
  src/myeongri/
  src/auth/
  src/share-snapshot/
  src/config/
  prisma/schema.prisma
  test/
```

## Key Design Decisions

### 1. Rule-based response generation instead of LLM calls

사주 응답을 외부 LLM 서비스에 위임하지 않고, 서버 내부에서 계산된 reason code와 semantic state를 기반으로 생성합니다.

이 방식은 문장의 자연스러움에서는 LLM보다 불리할 수 있지만, 응답 일관성, 비용 예측 가능성, 재현 가능성, 테스트 가능성 면에서 장점이 있습니다.

### 2. Evidence-based interpretation

응답 문장이 임의로 생성되지 않도록 각 섹션은 reason code, axis tag, semantic state를 근거로 생성됩니다.

이를 통해 어떤 규칙과 상태가 특정 문장을 만들었는지 추적할 수 있도록 설계했습니다.

### 3. Public share snapshot

사용자가 생성한 결과를 그대로 재계산하지 않고 snapshot으로 저장해 공유합니다.

공유 옵션에 따라 생년월일, 시간, 이름 등 개인정보성 입력값을 제외하거나 마스킹할 수 있도록 구성했습니다.

### 4. Auth session lifecycle

Google OAuth 로그인 이후 1회용 login code를 프론트에 전달하고, 서버에서 access/refresh token으로 교환합니다.

Refresh token은 Redis session과 연결하고 rotation 방식으로 갱신합니다. 로그아웃과 회원탈퇴 시 관련 세션을 제거합니다.

## Sample Code Map

- Rule-based narrative rendering: [`samples/server/src/myeongri/renderers/`](samples/server/src/myeongri/renderers/)
- Saju summary report: [`samples/server/src/myeongri/services/saju-summary-report.service.ts`](samples/server/src/myeongri/services/saju-summary-report.service.ts)
- Interpretation state types: [`samples/server/src/myeongri/common/interpretation-state.types.ts`](samples/server/src/myeongri/common/interpretation-state.types.ts)
- Algorithm policy normalization: [`samples/server/src/myeongri/common/algorithm-config.ts`](samples/server/src/myeongri/common/algorithm-config.ts)
- Auth session: [`samples/server/src/auth/`](samples/server/src/auth/)
- Share snapshot: [`samples/server/src/share-snapshot/`](samples/server/src/share-snapshot/)
- Database schema: [`samples/server/prisma/schema.prisma`](samples/server/prisma/schema.prisma)
- Tests: [`samples/server/test/`](samples/server/test/)
- Deployment note: [`docs/deployment.md`](docs/deployment.md)

## Notes

이 레포는 실행 가능한 전체 서비스 레포가 아니라 공개 포트폴리오용 샘플입니다.

실제 운영 서비스는 private 레포에서 관리하며, 이 공개 레포는 설계 의도와 핵심 구현 방식을 보여주기 위한 목적으로 구성했습니다.

Swagger 문서와 전체 API 실행 환경은 운영 서비스에 연결되는 정보가 포함될 수 있어 공개하지 않았습니다. 대신 관련 API 설계 의도는 [`docs/`](docs/)와 [`samples/server/`](samples/server/)에 분리해 정리했습니다.
