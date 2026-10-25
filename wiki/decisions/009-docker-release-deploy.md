---
type: Decision
title: "009. /opt 릴리스 + 심볼릭 링크 배포"
description: "데이터는 남기고 실행 파일만 교체하는 운영 방식"
tags: [deploy, docker, release]
timestamp: 2026-10-25
---

# 009. /opt 릴리스 + 심볼릭 링크 배포

## Context

요구사항은 "업데이트할 때 데이터는 남기고 실행 파일은 새것으로 깔끔하게 덮어쓰기". 이 호스트의 puri·nanuri가 쓰는 방식과도 맞춰야 했다.

제약:
- sudo를 쓸 수 없다(`no_new_privileges`). Docker 소켓만 접근 가능.
- systemd가 없다(컨테이너 환경).
- Playwright Chromium과 ffmpeg가 런타임에 필요하다.

## Decision

puri와 같은 릴리스 구조를 Docker Compose로 구현한다.

- `/opt/bakje/releases/<UTC>`에 소스 스냅샷
- `/opt/bakje/current` 심볼릭 링크를 `mv -T`로 원자적 교체
- `/var/lib/bakje`에 모든 상태(SQLite·미디어·원본)를 두고 릴리스와 분리
- 매 배포마다 이미지를 새로 빌드하고 `--force-recreate`로 컨테이너 교체
- 최근 3개 릴리스만 유지, 실패한 릴리스는 디버깅용으로 보존

베이스 이미지는 Playwright 공식 이미지를 쓴다. Chromium·ffmpeg가 이미 들어 있어 호스트 의존성이 사라진다.

## Consequences

- 배포 한 번에 이미지 빌드가 포함되어 수 분이 걸린다. 대신 런타임 의존성 드리프트가 없다.
- 롤백은 `current` 링크를 이전 릴리스로 되돌리고 다시 `up -d`하면 된다. 자동 롤백은 만들지 않았다.
- MySQL/Postgres 같은 외부 DB가 없으므로 마이그레이션 실패로 인한 데이터 손실 위험이 낮다. 스키마는 `CREATE TABLE IF NOT EXISTS`로만 전진한다.
- `read_only` 컨테이너 + `/tmp` tmpfs라 Chromium이 쓸 수 있는 경로가 제한된다. `HOME=/tmp`로 맞췄다.
- 이미지가 크다(Playwright 베이스 + node_modules). 개인 서버에서는 허용 가능한 비용이다.

## Status

Accepted
