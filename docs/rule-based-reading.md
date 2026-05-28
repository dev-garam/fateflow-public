# Rule-based Reading

Fateflow의 가장 중요한 실험은 LLM 서비스 없이 사주 응답을 생성하는 것입니다.

문장을 외부 모델에 위임하지 않고, 서버 내부에서 계산한 상태와 규칙 기반 템플릿을 조합해 응답을 만듭니다.

## Why Not LLM-first

LLM은 자연스러운 문장을 빠르게 만들 수 있지만, 운세/해석 서비스에서는 다음 문제가 생길 수 있습니다.

- 같은 입력에 대한 응답 일관성 부족
- 어떤 근거로 특정 문장이 나왔는지 추적하기 어려움
- API 비용과 외부 서비스 장애에 대한 의존성
- 테스트 케이스 작성과 품질 기준 수립의 어려움
- 도메인 규칙보다 말투가 먼저 보이는 문제

Fateflow에서는 먼저 규칙 기반 응답 구조를 만들고, 필요하다면 나중에 LLM을 문장 다듬기 계층으로만 붙일 수 있도록 책임을 분리했습니다.

## Core Concepts

### Semantic State

입력값에서 계산된 원국과 운의 상태를 API 응답용 문장으로 바로 변환하지 않고, 먼저 해석 가능한 중간 상태로 정리합니다.

예시:

- resource axis
- environment axis
- structure axis
- relation axis
- timing axis
- semantic themes
- reason codes

관련 샘플:

```text
samples/server/src/myeongri/common/interpretation-state.types.ts
```

### Reason Code

reason code는 문장 생성의 근거입니다.

응답이 단순 템플릿 조합처럼 보이지 않도록, 특정 상태가 어떤 섹션의 어떤 문장으로 이어졌는지 추적할 수 있게 구성했습니다.

### Algorithm Policy

해석 방향은 하드코딩된 하나의 방식으로 고정하지 않고, algorithm profile과 policy로 조정할 수 있게 설계했습니다.

예시:

- 해석 축별 가중치
- 이벤트 민감도
- 관계/커리어 해석 bias
- 문장 톤
- strength/caution/tip 우선순위

관련 샘플:

```text
samples/server/src/myeongri/common/algorithm-config.ts
samples/server/src/myeongri/common/reading-policy.types.ts
```

## Rendering Flow

```text
Semantic State
  |
  v
Reason Codes
  |
  v
Narrative Plan
  |
  v
Block Renderer
  |
  v
Generative Rule Renderer
  |
  v
Washed Response Text
```

`BlockReadingRenderer`는 기본 블록을 안정적으로 조합합니다.

`GenerativeRuleReadingRenderer`는 LLM을 호출하지 않고, lead/follow-up/template asset을 이용해 조금 더 자연스러운 문장으로 재구성합니다.

관련 샘플:

```text
samples/server/src/myeongri/renderers/block-reading.renderer.ts
samples/server/src/myeongri/renderers/generative-rule-reading.renderer.ts
```

## Trade-offs

장점:

- 응답 일관성
- 비용 예측 가능성
- 테스트 가능성
- 근거 추적 가능성
- 외부 LLM 장애와 무관한 기본 응답 제공

단점:

- 문장 다양성은 LLM보다 약함
- 템플릿/규칙 관리 비용이 큼
- 도메인 규칙이 늘어날수록 정책 관리가 복잡해짐

이 프로젝트에서는 이 trade-off를 감수하고, 먼저 재현 가능한 해석 엔진을 만드는 쪽을 선택했습니다.
