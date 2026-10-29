---
type: Concept
title: "운영과 배포"
description: "/opt 릴리스 구조, 데이터 분리, Docker 실행과 접근 경로"
tags: [deploy, docker, operations, release]
timestamp: 2026-10-29
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
3. `/etc/bakje/compose.override.yml`이 있으면 함께 읽어 Compose 설정 검증 후 `current` 심볼릭 링크를 `mv -T`로 원자적 교체
4. `docker compose up -d --build --force-recreate` — 이미지를 새로 빌드하고 컨테이너를 갈아끼운다. `ARCHIVE_DEPLOY_WEB_ONLY=1`이면 `--no-deps`로 web만 교체해 기존 embedder를 유지한다
5. `/api/health`가 통과할 때까지 최대 90초 대기
6. 최근 `ARCHIVE_KEEP_RELEASES`(기본 3)개만 남기고 정리. 전역 dangling 이미지 정리는 `ARCHIVE_PRUNE_IMAGES=1`로 명시한 경우에만 실행
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

## MCP 엔드포인트 (2026-10-26)

`POST /mcp`(Streamable HTTP, 상태 없음)로 검색을 MCP 도구로 연다. 기존 `search_archive`·`get_post`·`list_tags`와 통합 라이브러리 도구를 포함해 18개를 제공한다. 폴더 조사·자료 묶음 등록·작업 관리·규격 내보내기는 [통합 라이브러리](./unified-library.md)를 참고한다. 숨긴 글은 `get_post`에서도 "not found"다. `search_archive`는 `media: image|video` 필터와 `media_count`를, `get_post`는 `media[{kind,url,width,height}]`를 준다. `url`은 `PUBLIC_URL`(env, 예 `https://hamsbox.badger-viper.ts.net:8888`)을 앞에 붙인 절대 주소이고, 값이 없으면 상대 경로다. `?w=640`으로 썸네일을 받는다(이미지 바이트를 MCP로 직접 주지는 않는다).

- 주소: 기존 tailnet 주소의 `/mcp`, 즉 `https://<기기이름>.<tailnet>.ts.net:8888/mcp`. `tailscale serve`는 바꾸지 않았다. 8888이 이미 UI 전체를 같은 tailnet에 열고 있어 `/mcp`만 따로 열어도 보안 이득이 없다.
- 인증: `/etc/bakje/bakje.env`의 `MCP_TOKEN`과 `Authorization: Bearer` 값이 같아야 한다. 변수가 없으면 엔드포인트가 꺼진다(401). 값을 바꾸면 컨테이너를 다시 만들어야 한다.
- 클라이언트 등록: `claude mcp add --transport http bakje <주소> --header "Authorization: Bearer <토큰>"`
- 클라우드 세션(claude.ai/code 웹)은 tailnet에 못 들어가므로 쓸 수 없다. tailnet 기기의 Claude Code·Desktop에서 쓴다.
- 코드: `src/app/mcp/route.ts`. 기존 게시글 검색은 `searchHybrid`, 전체 자료 검색은 `searchLibrary`를 사용한다.

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

## 웹 컨테이너 자동 재시작 (2026-10-29)

- 장애: 2026-10-29 05:21(UTC)에 외부에서 SIGTERM이 왔고, `next-server`가 포트 3000을 닫은 채 프로세스만 남았다. Next 운영 모드의 종료 처리는 `server.close()` 뒤 열린 연결이 모두 끝나야 `process.exit`를 부른다. docker-proxy의 keep-alive 연결 3개가 남아 종료가 멈췄다. 프로세스가 살아 있어 `restart: unless-stopped`가 동작하지 않았고 컨테이너는 `unhealthy`로만 표시됐다. 호스트의 다른 세션이 imager 컨테이너를 정리하며 보냈을 가능성이 높지만 확인하지 못했다.
- 대응: 서비스 사용자 crontab이 매분 `scripts/watchdog.sh`를 실행한다.

```
* * * * * /opt/bakje/current/scripts/watchdog.sh >> $HOME/bakje-backup/watchdog.log 2>&1
```

- `unhealthy`가 3번 연속일 때만 `docker restart -t 10 bakje-web-1`을 실행한다. 재생성하지 않으므로 사용자·볼륨·네트워크·재시작 정책이 그대로다. 기동 중·중지·없음 상태에는 손대지 않는다.
- `scripts/deploy.sh`의 락(`/tmp/bakje-deploy.lock`)이 잡혀 있으면 건너뛴다.
- 1시간에 3번까지만 재시작한다. 넘으면 알림을 한 번 보내고 멈춘다. 정상으로 돌아오면 풀린다.
- 재시작과 포기는 `scripts/alert.sh`로 알린다. 상태 파일은 `~/bakje-backup/watchdog/`.
- 검증: 가짜 `docker`로 임계값·상한·락·정상 복귀를 확인했다. 실제 장애에서의 동작은 미검증.
- 이 스크립트는 처음에 현재 릴리스 디렉터리에 직접 복사했다. 다음 배포부터는 릴리스에 포함된다.

## 확인된 것

- 릴리스 2회 연속 배포 성공, `current` 교체와 이전 릴리스 정리 확인
- 컨테이너 안에서 Threads 재확인(Playwright) 7.6초, X 이미지 4장 재다운로드 성공
- 데이터 3건·미디어 8건이 배포 후에도 유지


## 연결 폴더 운영 설정 (2026-10-28)

통합 라이브러리를 릴리스 `20261028T064802Z`로 배포했다. web만 교체했고, 기존 embedder 컨테이너 ID·실행 상태를 유지했다. UID/GID `1000:1000`, 데이터 볼륨 `/var/lib/bakje:/data`, `bakje_default` 네트워크, 루프백 포트 3020, `unless-stopped`와 읽기 전용 루트 파일 시스템을 보존했다.

호스트별 마운트는 릴리스 외부 `/etc/bakje/compose.override.yml`에 보관한다. `scripts/deploy.sh`가 다음 배포에도 이 파일을 적용한다. 다른 위치는 `ARCHIVE_COMPOSE_OVERRIDE`로 지정할 수 있다. Compose를 직접 실행할 때도 기본 파일과 해당 override를 모두 전달해야 마운트가 유지된다.

```yaml
services:
  web:
    volumes:
      - type: bind
        source: /home/leonamin/dev/prompt/opennana/data
        target: /library/opennana
        read_only: true
        bind:
          create_host_path: false
```

운영 웹의 `/library` → **폴더 연결**에서 이름 `OpenNana`, 경로 `/library/opennana`를 입력한다. **폴더 연결**은 저장소만 등록한다. 이어서 저장소의 **OpenNana 등록·새로고침**을 누르면 전체 JSONL의 자료 묶음과 분석 작업을 등록한다. 처리 중에도 신규 SNS 박제를 저장할 수 있다. 대량 분석만 잠시 멈추려면 **대량 분석 일시 정지**를 사용한다.

다른 폴더는 호스트에서 접근 가능한 폴더를 먼저 override에 별도의 읽기 전용 컨테이너 경로로 추가한다. 컨테이너 재생성 후 웹에는 그 컨테이너 경로를 입력한다. 일반 폴더의 묶음은 MCP 에이전트에 사용자 기준을 전달하거나 `item.json`/`items.jsonl`을 등록한다. OpenNana 전용 버튼을 일반 폴더에 적용하지 않는다.

배포 시 원본 폴더의 읽기 가능·쓰기 불가, DB 무결성, 기존 SNS 46건·미디어 89건 보존, MCP 18개 도구, 실제 모델 질의 256차원 응답, tailnet의 `/library` 화면을 확인했다. 연결 폴더 등록과 전체 임베딩은 자동 실행하지 않았다. 배포 전 DB 백업은 `/home/leonamin/bakje-backup/db/library-predeploy-20261028T064802Z.db.gz`다.


### 선택 UI 수정 배포 (2026-10-28)

선택 UI 수정 릴리스는 `20261028T072553Z`다. 공용 Select 적용을 web만 교체해 배포했다. 기존 embedder와 연결 마운트를 보존했다. OpenNana 18,142건은 사용자 등록 작업으로 성공했으며 배경 분석은 진행 중이다. 운영 새로고침 설정은 검증 과정에서 변경하지 않았다.


### 검색 목록 복귀 수정 배포 (2026-10-28)

최신 릴리스는 `20261028T074249Z`다. 연결 자료 상세의 고정 홈 링크를 공용 BackLink로 바꿔 검색어·필터·페이지를 보존한다. web만 교체했고 기존 embedder·연결 폴더·자료와 분석 작업을 유지했다. 운영에서 연결 자료와 SNS 양쪽의 목록 복귀를 확인했다.


### 묶음 편집과 원본 정리 배포 (2026-10-28)

릴리스 `20261028T091413Z`는 묶음 역할·순서·분리·합치기와 원본 정리 계획·적용·되돌리기를 포함한다. 상세의 **자료 묶음 편집**, 상세 또는 `/library` 저장소의 **원본 폴더 정리**에서 사용한다. 실행 중인 정리와 잠금은 DB에 남으므로 프로세스 재시작 뒤 이어서 처리한다. 일부 이동 후 실패하면 해당 저장소의 스캔·편집이 대기하며 정리 재시도 또는 되돌리기를 완료해야 한다.

기존 OpenNana `/library/opennana` 마운트는 읽기 전용이다. 묶음 편집과 변경 계획은 가능하지만 **원본 정리 적용은 비활성화**된다. 실제 적용을 선택할 때 관리자가 `/etc/bakje/compose.override.yml`의 해당 마운트를 쓰기 허용으로 바꾸고 UID 1000의 쓰기 권한을 제공해야 한다. 웹만 재생성해도 된다. 이 기능 배포 과정에서는 마운트 권한과 원본 파일을 바꾸지 않았다.

배포 전 온라인 DB 백업은 `~/bakje-backup/db/library-management-20261028T091324Z.db.gz`이며 무결성 검사를 통과했다. 이전 웹 이미지는 `bakje-web:pre-library-management-20261028T091324Z`로 보관했다. 스키마는 추가 테이블 방식이다. 배포는 `ARCHIVE_DEPLOY_WEB_ONLY=1`로 실행해 기존 embedder를 유지한다. 상세 동작·제약은 [묶음 편집과 원본 정리](./library-organization.md)를 참고한다.

### 코드 리뷰 반영 (2026-10-28)

- **폴더 연결 범위 제한**: `connectStorage`는 `LIBRARY_ALLOWED_ROOTS`(`:`로 구분, 기본 `/library`)와 `<데이터>/exports` 아래 폴더만 연결한다. 쓰기 가능한 `/data` 볼륨 전체를 MCP·웹에서 연결해 파일을 읽는 길을 막았다. 이미 연결된 저장소는 그대로 동작한다. 새 마운트를 `/library` 밖에 두려면 환경 변수에 경로를 추가한다. MCP 토큰은 여전히 하나이며 읽기·쓰기 권한을 나누지 않았다.
- **검색 중 쓰기 실패 수정**: 의미 검색이 `iterate()`를 연 채 `await`로 양보해서, 그 사이 같은 연결의 쓰기(분석 결과 저장·휴지통·원본 정리 단계)가 `database connection is busy`로 실패할 수 있었다. 순회를 동기로 바꿨다. 검색 결과 ID 목록은 `json_each`로 넘겨 매개변수 한도를 피하고, 의미 검색 실패는 로그를 남긴다.
- **연관 자료**: 전체 벡터를 읽는 비용 때문에 자료별 결과를 10분(최대 200건) 캐시한다.
- **합쳐진 자료**: 합치고 남은 빈 껍데기는 숨긴 자료 목록에서 빼고, 일괄 숨김 해제를 거절한다. 되돌리기는 묶음 편집의 변경 기록에서 한다.
- **휴지통 자료**: 삭제를 취소하기 전에는 `editLibraryItem`이 수정을 거절한다.
- 검색 화면 `?debug=1`의 유사도 수치를 복구했다. 검증은 `pnpm test:review-fixes`.

### UI 개선·리뷰 반영·로딩 배포 (2026-10-28)

모두 `ARCHIVE_DEPLOY_WEB_ONLY=1`로 web만 교체했다. embedder 컨테이너, 데이터 볼륨(`/data`), `/library/opennana` 마운트, `unless-stopped`, 사용자 `1000:1000`을 보존했고 배포마다 이전 이미지에 롤백 태그를 붙였다(`bakje-web:pre-<이름>-<시각>`).

| 릴리스 | 내용 | 롤백 태그 |
|---|---|---|
| `20261028T133558Z` | 필터 접기, 썸네일 없는 카드 높이 축소, 선택 아이콘 | `pre-ui-polish` |
| `20261028T135150Z` | 선택 툴바 sticky, 카드 클릭 선택, 확인 창 | `pre-selection-ui` |
| `20261028T135641Z` | 코드 리뷰 반영(검색 쓰기 실패, 허용 루트 등) | `pre-review-fixes` |
| `20261028T141033Z` | 쪽 이동 중 선택 유지, 확인 창 구분선, 툴바 띄우기 | `pre-selection-persist` |
| `20261028T141756Z` | 로딩 표시, 공용 Chip, 선택 아이콘 이동 | `pre-loading-chips` |

- DB 백업은 스키마·데이터 로직이 바뀐 `20261028T135641Z` 앞에서만 했다: `~/bakje-backup/db/review-fixes-predeploy-20261028T135610Z.db.gz`(약 250MB). 호스트에 `sqlite3`가 없어서 저장소의 better-sqlite3 온라인 백업 API로 운영 DB를 **읽기 전용으로 열어** 복사했고, 사본에서 `integrity_check`가 `ok`, 자료 18,192건·SNS 글 50건, `gzip -t` 통과를 확인했다. 나머지 UI만 바뀐 배포는 직전 백업을 그대로 기준으로 삼았다.
- 배포 뒤에는 컨테이너 `healthy`, `/`·상세·`/search`·`/library`의 200 응답, 최근 로그의 `error`·`busy` 0건을 확인했다.
- **운영에서 직접 검증하지 못한 것**: 검색 중 쓰기 실패 수정(`busy` 오류가 다시 나오는지 로그로 지켜볼 것), 실제 터치 기기의 선택·로딩 감각.
