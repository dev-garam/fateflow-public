# Deployment

Fateflow 운영 서비스는 private 레포에서 배포 자동화를 관리합니다.

이 공개 레포에는 실제 GitHub Actions workflow, 환경변수, Secret Manager 이름, Terraform state, tfvars 값을 포함하지 않습니다.

## 운영 배포 흐름

```text
GitHub main branch
  |
  v
GitHub Actions
  |
  |-- build
  |-- test/check
  |-- container image build
  |-- deploy
  v
GCP Cloud Run
  |
  |-- Supabase PostgreSQL
  |-- Redis/Valkey
  `-- Secret Manager
```

## 공개하지 않은 항목

- GitHub Actions workflow 원본
- GCP project id
- Secret Manager secret name
- DB/Redis 접속 정보
- Terraform backend 설정
- Terraform state/tfvars
- 운영 Swagger URL

## 공개 범위에서 설명하는 내용

이 문서에서는 실제 배포 파일 대신, 운영에서 사용한 배포 구조와 공개하지 않는 이유만 설명합니다.

포트폴리오에서 보여주고 싶은 핵심은 다음입니다.

- 서버 코드를 수동 배포가 아니라 GitHub Actions 기반으로 배포하려고 구성한 점
- API 서버는 GCP Cloud Run에서 운영하는 구조로 잡은 점
- DB와 캐시는 각각 Supabase PostgreSQL, Redis/Valkey를 사용한 점
- IaC는 Terraform 기반으로 관리하되, 운영 state와 변수는 공개하지 않는 점

운영 배포 자동화 경험은 이력서와 면접에서 설명할 수 있는 영역이지만, 보안상 실제 workflow와 secret 구성을 그대로 공개하지 않는 쪽을 선택했습니다.
