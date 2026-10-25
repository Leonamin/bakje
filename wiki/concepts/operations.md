---
type: Concept
title: "운영과 배포"
description: "/opt 릴리스 구조, 데이터 분리, Docker 실행과 접근 경로"
tags: [deploy, docker, operations, release]
timestamp: 2026-10-25
---

# 운영과 배포

## 릴리스 구조

```
/opt/post-archive/
  releases/20261025T084223Z/   배포 시점 소스 스냅샷
  current -> releases/...      지금 실행 중인 릴리스
/var/lib/post-archive/         SQLite · 미디어 · 원본 스냅샷
/etc/post-archive/post-archive.env
```

puri·nanuri와 같은 방식이다. **데이터는 릴리스 밖에** 있으므로 배포는 프로그램만 교체한다.

## 배포 절차 (`scripts/deploy.sh`)

1. `flock`으로 중복 실행 차단
2. UTC 타임스탬프 릴리스 디렉터리 생성, 소스 tar 복사(node_modules·.next·data·.env 제외)
3. `current` 심볼릭 링크를 `mv -T`로 원자적 교체
4. `docker compose up -d --build --force-recreate` — 이미지를 새로 빌드하고 컨테이너를 갈아끼운다
5. `/api/health`가 통과할 때까지 최대 90초 대기
6. 최근 `ARCHIVE_KEEP_RELEASES`(기본 3)개만 남기고 정리, dangling 이미지 prune
7. 실패하면 해당 릴리스 디렉터리를 진단용으로 남기고 종료(자동 롤백 없음)

## 컨테이너

- 베이스: `mcr.microsoft.com/playwright:v1.64.1-noble` — Chromium과 ffmpeg 포함
- `user: 1000:1000`, `read_only: true`, `/tmp`만 tmpfs 512MB
- `ARCHIVE_NO_SANDBOX=1`로 Chromium을 `--no-sandbox`로 띄운다(컨테이너에 user namespace가 없다)
- 포트: `127.0.0.1:3020 → 3000`
- 헬스체크: `node -e fetch('/api/health')`

better-sqlite3는 네이티브 바인딩이라 이미지 빌드 시 `python3 make g++`가 필요하다. deps 스테이지에만 설치한다.

## 접근

- 로컬: `http://127.0.0.1:3020`
- tailnet: `https://<기기이름>.<tailnet>.ts.net:8444` (`tailscale serve`)

## 최초 준비

sudo가 있으면 `sudo ARCHIVE_UID=$(id -u) ./scripts/prepare-host.sh`.

이 호스트는 sudo가 막혀 있어(no_new_privileges) Docker로 디렉터리를 만들고 소유권만 1000으로 바꿨다. 배포 스크립트는 root가 아니라 서비스 사용자로 실행한다.

## 백업

```bash
sqlite3 /var/lib/post-archive/archive.db ".backup /tmp/archive.db"
tar czf backup.tar.gz -C /var/lib post-archive
```

SQLite는 WAL 모드이므로 실행 중에는 `.backup`을 쓴다.

## 확인된 것

- 릴리스 2회 연속 배포 성공, `current` 교체와 이전 릴리스 정리 확인
- 컨테이너 안에서 Threads 재확인(Playwright) 7.6초, X 이미지 4장 재다운로드 성공
- 데이터 3건·미디어 8건이 배포 후에도 유지
