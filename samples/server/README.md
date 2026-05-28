# Server Samples

이 디렉토리는 Fateflow 운영 서버의 전체 소스가 아니라, 공개 가능한 핵심 백엔드 구현 일부를 선별한 샘플입니다.

샘플 코드는 다음 관점을 보여주기 위해 포함했습니다.

- LLM 호출 없이 사주 응답을 생성하기 위한 rule-based rendering 구조
- reason code와 semantic state 중심의 해석 근거 설계
- Google OAuth, JWT, Redis session 기반 인증 흐름
- 공유 스냅샷 생성/조회/만료/삭제 처리
- Prisma 기반 DB 모델링
- 인증, 공유, 날짜/시간 경계값 관련 테스트

## Important

이 디렉토리는 그대로 실행 가능한 NestJS 프로젝트가 아닙니다.

운영 설정, 민감 정보, 전체 모듈, 내부 문서, 미완성 작업은 제외했습니다.

전체 실행 서버처럼 보이게 만들기보다, 공개 가능한 구현 단위를 기준으로 읽을 수 있게 정리했습니다. 최상위 `npm run check`는 이 샘플 구조와 공개 범위를 점검하기 위한 명령입니다.

Swagger, 실제 OAuth callback URL, Redis/DB 연결값, 운영 배포 설정은 보안상 포함하지 않았습니다.

최상위 `package.json`에는 샘플 코드가 기대하는 최소 서버 라이브러리를 등록했습니다. 다만 전체 NestJS 모듈, DTO, provider, env 파일은 제외되어 있으므로 이 디렉토리는 그대로 실행되는 서버가 아니라 코드 검토용 샘플입니다.

## Code Map

```text
src/myeongri/common/
  interpretation-state.types.ts
  reading-policy.types.ts
  algorithm-config.ts

src/myeongri/renderers/
  block-reading.renderer.ts
  generative-rule-reading.renderer.ts

src/myeongri/services/
  saju-summary-report.service.ts

src/auth/
  auth.service.ts
  auth.controller.ts

src/share-snapshot/
  share-snapshot.service.ts
  share-snapshot.controller.ts

src/config/
  env.validation.ts
  origin-policy.ts

prisma/
  schema.prisma

test/
  auth-refresh.test.js
  share-snapshot.test.js
  myeongri-timezone-boundary.test.js
  saju-summary-report-v2.test.js
```
