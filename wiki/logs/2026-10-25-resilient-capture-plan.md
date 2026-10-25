---
type: Log
title: "수집 재시도·오프라인 대기열 계획"
description: "페이지 이탈·오프라인 상황의 수집 동작 요구와 현재 한계, 3단계 도입 계획 기록"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 수집 재시도·오프라인 대기열 계획

사용자가 "링크를 한 번 등록하면 페이지를 떠나도 알아서 재시도하고, 오프라인에서도 대기시켰다가 연결되면 앱을 열 때 전송"되기를 기대했다. 현재 코드를 확인하니 페이지 이탈 후 처리는 이미 되지만, 실패 재시도·재시작 후 자동 재개·오프라인 대기열·서비스 워커는 없었다.

iOS 제약(Background Sync 미지원, Safari 탭 저장소 7일 정책)을 정리하고, 서버 재시도 → 브라우저 대기열 → 서비스 워커 순서로 도입하기로 했다. 구현 전이라 결정 상태는 Proposed다.

- 추가: decisions/011-resilient-capture-queue.md, logs/2026-10-25-resilient-capture-plan.md
- 갱신: decisions/index.md, logs/index.md, index.md
