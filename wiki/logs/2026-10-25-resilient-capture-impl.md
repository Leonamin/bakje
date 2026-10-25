---
type: Log
title: "수집 재시도·오프라인 대기열 구현"
description: "결정 011의 3단계(서버 재시도·자동 재개, 브라우저 대기열, 서비스 워커) 구현과 검증"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 수집 재시도·오프라인 대기열 구현

[결정 011](../decisions/011-resilient-capture-queue.md)의 세 단계를 순서대로 구현하고 복사본 데이터로 검증했다. 결정 상태를 Accepted로 바꿨다.

1. **서버 재시도·자동 재개**: `job.attempts`·`next_attempt_at` 추가(기동 시 컬럼 확인 후 ALTER). 형식 오류·삭제만 즉시 실패, 나머지는 1분·5분·30분·30분 간격으로 최대 5회 재시도. `instrumentation.ts`가 기동 시 끊긴 작업을 복구하고 30초마다 실행할 작업을 확인한다. 같은 작업이 중복 실행되던 문제도 고쳤다.
2. **브라우저 대기열**: 네트워크 오류면 localStorage outbox에 넣고, 앱 전체에 붙은 `OutboxSync`가 페이지 열림·화면 복귀·online 때 전송한다.
3. **서비스 워커와 웹앱 매니페스트**: `/add`와 해시 정적 파일만 캐시한다. 오프라인에서 다른 화면을 열면 수집 화면으로 보낸다. 홈 화면용 매니페스트와 apple-icon을 추가했다.

토스트 stack에서 새 알림이 이전 알림 뒤에 숨는 문제가 대기열 전송 결과를 가려서, 새 알림이 앞에 오도록 고쳤다.

검증 방법과 결과는 [수집 작업 큐](../concepts/capture-queue.md)의 검증 절에 있다. 운영 배포와 iPhone 실기기 검증은 아직이다.

- 추가: concepts/capture-queue.md, logs/2026-10-25-resilient-capture-impl.md
- 갱신: decisions/011-resilient-capture-queue.md, decisions/010-capture-first-ui.md, decisions/002-nextjs-typescript.md, decisions/index.md, concepts/ui-system.md, concepts/platform-adapters.md, concepts/data-model.md, concepts/index.md, logs/index.md, index.md
