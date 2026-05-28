# Auth and Session

Fateflow의 인증은 Google OAuth, JWT, Redis session을 조합해 구성했습니다.

## Flow

```text
1. Client requests Google login
2. Server redirects to Google OAuth
3. Google callback reaches server
4. Server creates one-time login code in Redis
5. Client exchanges login code for access/refresh token
6. Server stores auth session in Redis
7. Refresh token rotation updates Redis session
8. Logout/withdraw removes related sessions
```

## Why Login Code

OAuth callback에서 토큰을 URL에 직접 노출하지 않기 위해 1회용 login code를 사용했습니다.

프론트는 callback URL로 받은 code를 서버에 전달하고, 서버는 Redis에 저장된 code payload를 access/refresh token으로 교환합니다.

## Refresh Token Rotation

Refresh token은 Redis session과 연결됩니다.

재발급 요청 시 다음 조건을 확인합니다.

- refresh token 검증
- refresh token과 session id 매핑 확인
- Redis에 저장된 session의 user id 일치 여부 확인
- 기존 refresh token과 요청 refresh token 일치 여부 확인

검증 후 새로운 access/refresh token을 발급하고 session 값을 갱신합니다.

## Session Cleanup

로그아웃 시 현재 session을 제거합니다.

회원탈퇴 시 사용자 상태를 `DELETED`로 변경하고, 해당 사용자에게 연결된 모든 Redis session을 제거합니다.

관련 샘플:

```text
samples/server/src/auth/auth.service.ts
samples/server/src/auth/auth.controller.ts
samples/server/test/auth-refresh.test.js
```
