# Public Scope

이 레포는 운영 중인 Fateflow 서비스의 전체 소스가 아닙니다.

공개 목적은 다음과 같습니다.

- LLM 없이 규칙 기반 사주 응답을 생성한 설계 설명
- NestJS 기반 API 서버 구조 일부 공개
- 인증/세션/공유 스냅샷/DB 모델링 방식 설명
- 포트폴리오 검토자가 핵심 구현 방향을 빠르게 볼 수 있게 정리

## Included

- 공개 가능한 코드 샘플
- Prisma schema
- 일부 테스트 파일
- 설계 문서
- 포트폴리오용 README

## Excluded

- `.env`
- 실제 운영 DB/Redis 접속 정보
- Terraform state
- Terraform variable values
- 운영 배포 설정 원본
- 내부 작업 메모
- 전체 비공개 서비스 히스토리

## Why Not Full Open Source

Fateflow는 실제 운영을 염두에 둔 개인 서비스입니다.

운영 서버 전체를 공개하면 API 구조, 인증 흐름, 내부 설정, 미완성 기능이 과하게 노출될 수 있습니다.

따라서 이 레포는 운영 안정성을 해치지 않는 선에서 백엔드 설계와 구현 방식을 보여주는 공개 버전으로 구성했습니다.
