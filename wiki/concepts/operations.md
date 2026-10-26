---
type: Concept
title: "운영과 배포"
description: "/opt 릴리스 구조, 데이터 분리, Docker 실행과 접근 경로"
tags: [deploy, docker, operations, release]
timestamp: 2026-10-25
---

# 운영과 배포

> 2026-10-25에 운영 경로와 식별자를 `post-archive`에서 `bakje`로 옮겼다. 이전 경로는 남아 있지 않다. → [결정 012](../decisions/012-service-name-bakje.md)

## 릴리스 구조

```
/opt/bakje/
  releases/20261025T084223Z/   배포 시점 소스 스냅샷
  current -> releases/...      지금 실행 중인 릴리스
/var/lib/bakje/         SQLite · 미디어 · 원본 스냅샷
/etc/bakje/bakje.env
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
- tailnet: `https://<기기이름>.<tailnet>.ts.net:8888` (`tailscale serve --bg --https=8888 http://127.0.0.1:3020`). 2026-10-25에 8444에서 8888로 옮겼다.

앱에는 로그인·인증이 없다. 그래서 인터넷에 공개하지 않고 **tailnet 전용**으로만 노출한다. 컨테이너 포트는 `127.0.0.1`에만 바인딩되어 같은 LAN에서도 직접 접근할 수 없고, `tailscale serve`(funnel 아님)로 내 tailnet 기기에서만 HTTPS로 연다. tailnet을 다른 사람과 공유하면 그 사람도 열 수 있으므로, 공유한다면 Tailscale ACL로 이 포트를 막거나 앱에 인증을 붙여야 한다.

같은 호스트의 다른 serve 항목(443, 8443)은 다른 서비스 것이므로 포트를 바꿀 때 건드리지 않는다. 확인은 `tailscale serve status`.

## 최초 준비

sudo가 있으면 `sudo ARCHIVE_UID=$(id -u) ./scripts/prepare-host.sh`.

이 호스트는 sudo가 막혀 있어(no_new_privileges) Docker로 디렉터리를 만들고 소유권만 1000으로 바꿨다. 배포 스크립트는 root가 아니라 서비스 사용자로 실행한다.

## 백업 (자동, 2026-10-26)

서비스 사용자 crontab이 매일 실행한다.

```
30 3 * * * /opt/bakje/current/scripts/backup.sh        (UTC 03:30)
0 4 * * *  /opt/bakje/current/scripts/check-parsers.sh (UTC 04:00)
```

- `scripts/backup.sh`: 호스트에 sqlite3가 없어서 web 컨테이너 안에서 better-sqlite3 온라인 백업 API로 DB 사본을 만든다. 사본은 `journal_mode=DELETE`로 바꾸고 `integrity_check`를 통과해야 저장한다. 결과는 `~/bakje-backup/db/archive-<UTC>.db.gz`(최근 14개), `media`·`raw`·`browser`는 `~/bakje-backup/files/`에 rsync로 추가만 한다(`--delete` 없음). `thumbs`·`models`는 다시 만들 수 있어 뺀다.
- `~/backups`는 root 소유라 쓰지 못한다. 그래서 `~/bakje-backup`을 쓴다.
- **아직 같은 디스크다.** 디스크 고장에 대비하려면 `BAKJE_BACKUP_DEST`를 다른 기기(NAS·USB) 마운트로 바꾼다.
- 복원: `zcat archive-<UTC>.db.gz > archive.db`, `files/*`를 데이터 디렉터리에 복사. 2026-10-26에 복원본으로 `pnpm reparse -- --check`를 돌려 확인했다.

## 파서 점검과 알림

- `/api/health/parsers`: 플랫폼별 최신 글을 다시 가져와 파싱한다. 하나라도 실패하면 503. 수십 초 걸리므로 컨테이너 헬스체크에 넣지 않는다.
- `scripts/check-parsers.sh`가 이 경로를 호출하고, 실패하면 `scripts/alert.sh`로 알린다.
- `scripts/alert.sh`: `BAKJE_ALERT_WEBHOOK`(Discord·Slack 웹훅)이 있으면 보낸다. 없으면 로그(`~/bakje-backup/*.log`)에만 남는다. crontab 위에 `BAKJE_ALERT_WEBHOOK=...` 줄을 넣어 켠다.
- 파서 회귀 확인: `pnpm reparse -- --check`. 저장된 파트를 기대값으로 보고 스냅샷 재파싱 결과와 비교만 한다(쓰기 없음). 남의 게시글이라 스냅샷은 git에 넣지 않으므로 로컬·운영 데이터로 돌린다.

## 확인된 것

- 릴리스 2회 연속 배포 성공, `current` 교체와 이전 릴리스 정리 확인
- 컨테이너 안에서 Threads 재확인(Playwright) 7.6초, X 이미지 4장 재다운로드 성공
- 데이터 3건·미디어 8건이 배포 후에도 유지
