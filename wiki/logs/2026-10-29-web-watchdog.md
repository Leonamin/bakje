---
type: Log
title: "웹 컨테이너 멈춤 원인과 자동 재시작"
description: "SIGTERM 뒤 종료가 멈춰 포트가 닫힌 사고의 원인과 watchdog 추가 기록"
timestamp: 2026-10-29
okf_version: "0.1"
---

# 웹 컨테이너 멈춤 원인과 자동 재시작

05:21(UTC)에 외부 SIGTERM으로 `bakje-web-1`이 포트를 닫은 채 살아 있었다. 원인은 Next 종료 처리가 열린 keep-alive 연결을 기다리는 것이다. `docker compose restart web`으로 복구했고, 재발에 대비해 `scripts/watchdog.sh`를 cron에 매분 등록했다. 신호를 보낸 주체는 확인하지 못했다.

- 추가: `scripts/watchdog.sh`, `logs/2026-10-29-web-watchdog.md`
- 갱신: `concepts/operations.md`, `concepts/index.md`, `logs/index.md`
