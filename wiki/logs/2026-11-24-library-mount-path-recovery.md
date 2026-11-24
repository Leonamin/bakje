---
type: Log
title: "연결 폴더 원본 경로 이동으로 인한 운영 중단 복구"
description: "홈 폴더 정리로 사라진 ~/Library 경로 때문에 웹 컨테이너가 19시간 동안 뜨지 못했고, override 마운트를 새 경로로 고쳐 재생성했다"
timestamp: 2026-11-24
okf_version: "0.1"
---

# 연결 폴더 원본 경로 이동으로 인한 운영 중단 복구

사용자가 `https://hamsbox.badger-viper.ts.net:8888/`이 502로 응답한다고 알려 와 확인하고 복구했다. 앱 코드·DB·자료는 바뀌지 않았다.

## 증상

- tailnet `:8888` → `127.0.0.1:3020` 프록시는 살아 있었고 502만 돌려줬다.
- `bakje-web-1`은 `Exited (127)`, 마지막 종료 시각 `2026-11-23T12:56Z`(약 19시간 전). `restart: unless-stopped`가 재시작을 계속 시도했지만 매번 같은 지점에서 실패했다.
- `bakje-embedder-1`은 그동안 healthy로 계속 떠 있었다.

## 원인

컨테이너 생성 기록의 오류는 다음과 같다.

```
failed to fulfil mount request: open /home/leonamin/Library/ai-costume: no such file or directory
```

`/etc/bakje/compose.override.yml`이 `/home/leonamin/Library/{opennana,ai-costume,ai-pose,code-notes,ux-notes}`를 `/library/<이름>`으로 바인드 마운트한다. 이 호스트의 홈 폴더가 정리되면서 `~/Library`가 없어졌고, `bind.create_host_path: false`라서 Docker가 폴더를 임의로 만들지 않고 컨테이너 생성 자체를 거부했다. 마운트는 컨테이너 생성 시점에만 검사하므로 이미 떠 있던 컨테이너는 영향이 없었고, 재시작이 일어난 11월 23일에 처음 드러났다.

## 새 원본 경로

사라진 폴더의 내용은 홈 폴더의 새 구조로 옮겨져 있었다. DB의 `library_asset.relative_path`(예: `media/images/...`, `img/...`, `chip-selection-ring/README.md`, `airbnb-mobbin-20261116/...`)와 대조해 짝을 확인했다.

| 저장소 | DB `root_path` | 이전 호스트 경로 | 현재 호스트 경로 |
|---|---|---|---|
| Opennana (id 2) | `/library/opennana` | `~/Library/opennana` | `~/data/opennana` |
| ai-costume (id 3) | `/library/ai-costume` | `~/Library/ai-costume` | `~/data/datasets/ai-costume` |
| ai-pose (id 4) | `/library/ai-pose` | `~/Library/ai-pose` | `~/data/datasets/ai-pose` |
| code-notes (id 5) | `/library/code-notes` | `~/Library/code-notes` | `~/docs/notes/code-notes` |
| UX 자료 (id 6) | `/library/ux-notes` | `~/Library/ux-notes` | `~/docs/notes/ux-notes` |

DB는 컨테이너 안 경로(`/library/...`)만 기록하므로 저장소 행·자료·벡터는 고칠 필요가 없었다.

## 조치

1. `/etc/bakje/compose.override.yml`을 `compose.override.yml.bak-20261124074412`로 백업했다.
2. override의 다섯 `source`만 새 경로로 바꿨다. `target`, `read_only`, `create_host_path: false`는 그대로 두었다.
3. `docker compose -f /opt/bakje/current/compose.yml -f /etc/bakje/compose.override.yml --env-file /etc/bakje/bakje.env config`로 병합 결과를 먼저 확인했다.
4. 이미지 재빌드 없이 web만 다시 만들었다(`up -d --no-deps --force-recreate web`). 릴리스 `20261105T032654Z`, embedder 컨테이너, `/data` 볼륨, `bakje_default` 네트워크, `unless-stopped`, 사용자 `1000:1000`, 읽기 전용 루트 파일 시스템은 전과 같다.

## 확인

- `bakje-web-1` healthy, `/api/health`가 `{"ok":true,"sources":84}`, `:8888` 루트 200.
- 컨테이너 안에서 다섯 `/library/*` 목록과 파일 읽기가 모두 동작했다(`code-notes/chip-selection-ring/README.md` 1,538바이트).
- `/api/library/browse`는 storage 5·6이 정상 응답. storage 2·3·4는 이전부터 `enabled=0`인 저장소라 "연결 해제된 저장소"로 답하는데, 복구 전과 같은 상태다.
- `ux-notes`는 선언대로 읽기 전용(`RW=false`), 나머지는 읽기/쓰기다.

## 재발 방지

장애를 키운 것은 마운트 누락 자체보다, 아무도 모르게 19시간이 지난 점이다. 세 겹으로 막았다.

1. **원인을 이름으로 알리는 점검** — `scripts/guard.sh`를 만들어 시스템 사용자 타이머(`bakje-guard.timer`, 5분 간격, `Linger=yes`)로 돌린다. ① override의 bind 마운트 `source` 존재 ② 컨테이너 상태와 `State.Error` ③ `127.0.0.1:3020/api/health` 응답 ④ 최신 DB 백업 나이를 본다. 같은 문제는 한 번만, 지문이 같으면 6시간 간격으로만 알린다. 복구되면 복구 알림을 보낸다.
2. **배포 전 검사** — `scripts/deploy.sh`가 `up` 전에 병합된 마운트 `source`를 확인하고, 없으면 어느 경로가 없는지 출력한 뒤 멈춘다.
3. **백업·감시 경로 복구** — cron 줄이 쓰는 `~/bakje-backup`이 사라져 백업과 watchdog 로그가 함께 죽어 있었다. crontab은 이 호스트에서 고칠 수 없어(setuid 아님, sudo 차단) `~/bakje-backup`을 `~/data/backups/bakje` 심볼릭 링크로 되살렸다. `scripts/backup.sh`를 수동으로 한 번 돌려 새 스냅샷을 만들었고, cron 리다이렉트 오류가 사라진 것을 journal로 확인했다.

## 검증

- `scripts/guard.sh --check`가 운영에서 `ok`.
- 존재하지 않는 경로를 넣은 임시 override로 문제 탐지, 두 번째 실행에서 중복 알림 억제, 정상 경로로 되돌렸을 때 복구 알림을 확인했다.
- 없는 컨테이너 이름으로 컨테이너 부재 탐지를 확인했다.
- `scripts/deploy.sh`의 마운트 검사 구문을 같은 임시 override로 돌려 누락 경로를 출력하는 것을 확인했다. 실제 배포는 하지 않았다(운영 릴리스 유지).
- 타이머가 `active`이고 첫 실행이 `status=0/SUCCESS`.

## 남은 일

- 알림은 `BAKJE_ALERT_WEBHOOK`이 없으면 로그(`~/.local/state/bakje-guard/guard.log`)와 journal에만 남는다. 휴대폰으로 받으려면 값을 정해야 한다.
- 연결 폴더 원본이 계속 `~/data`·`~/docs` 아래에 있어 홈 폴더를 다시 정리하면 같은 일이 반복될 수 있다. 마운트 `source`를 `/var/lib/bakje/library/<이름>` 같은 고정 경로(심볼릭 링크)로 두면 고칠 곳이 한 곳으로 모인다. 이번에는 적용하지 않았다.
- `opennana`·`ai-costume`은 DB에서 비활성(`enabled=0`)이고 원본 삭제 허용이 켜져 있다. `opennana` 휴지통 원본 삭제 대기 1,588건은 그대로다. 다시 켜기 전에 마운트가 읽기/쓰기인 점을 확인해야 한다.
