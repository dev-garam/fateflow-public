# Architecture

Fateflow는 사주/운세 분석 결과를 제공하는 API 서버입니다.

서비스의 핵심은 외부 LLM API가 아니라, 서버 내부의 명리학 계산 결과와 해석 규칙을 바탕으로 응답을 생성하는 구조입니다.

## High-level Flow

```text
User Input
  |
  | birth date, birth time, calendar type
  v
Manse Calculation
  |
  | pillars, ten gods, five elements, timing data
  v
Semantic State
  |
  | resource axis, environment axis, relation axis, timing axis
  v
Reason Codes
  |
  | evidence for interpretation
  v
Rule-based Narrative Renderer
  |
  | summary, strengths, cautions, balance tips
  v
API Response
```

## Server Modules

```text
Auth Module
  - Google OAuth
  - login code exchange
  - JWT access/refresh token
  - Redis session lifecycle

Myeongri Module
  - manse calculation
  - semantic state generation
  - reason code tracing
  - rule-based report generation

Fortune Module
  - today fortune
  - monthly fortune
  - yearly fortune
  - decade fortune

Share Snapshot Module
  - snapshot creation
  - public share retrieval
  - status/expiration control
  - privacy-aware output options
```

## Runtime Components

```text
Client
  |
  v
NestJS API Server
  |
  |-- PostgreSQL: users, identities, profiles, snapshots
  |-- Redis: login code, auth sessions, refresh token mapping
  |-- Google OAuth: external login provider
  `-- Cloud Run: container runtime
```

## Design Intent

운세/해석 서비스는 LLM을 붙이면 빠르게 자연어 응답을 만들 수 있습니다.

하지만 Fateflow에서는 응답의 근거와 재현 가능성을 더 중요하게 보고, 서버 내부에서 계산 가능한 상태와 규칙을 최대한 구조화했습니다.

이 구조는 다음 장점을 목표로 했습니다.

- 같은 입력에 대해 예측 가능한 응답 생성
- 특정 문장이 어떤 규칙에서 나왔는지 추적 가능
- API 비용과 외부 서비스 의존성 감소
- 테스트 가능한 도메인 로직 구성
- 추후 LLM을 붙이더라도 근거 데이터와 문장 생성 책임 분리 가능
