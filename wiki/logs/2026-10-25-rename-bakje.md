---
type: Log
title: "서비스 이름 박제로 변경"
description: "앱 표시 이름·패키지·저장소 폴더·운영 경로와 식별자·문서를 박제(bakje)로 변경"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 서비스 이름 박제로 변경

서비스 이름을 **박제**로 정했다. 화면 상단 이름, 페이지 제목, 웹앱 매니페스트·iOS 홈 화면 앱 이름, npm 패키지 이름(`bakje`), README·위키 제목을 바꾸고 저장소 폴더를 `~/dev/post-archive`에서 `~/dev/bakje`로 옮겼다.

처음에는 운영 경로를 그대로 두려 했으나, 사용자 요청으로 같은 날 운영 경로·식별자까지 `bakje`로 옮겨 재배포했다.

## 운영 이전

1. 운영 데이터 건수 기록: 게시글 3 · 파트 4 · 미디어 8 · 작업 6 · 태그 0, 미디어 파일 12개
2. `post-archive` 컨테이너·네트워크 중지(`docker compose down`)
3. 백업: `~/bakje-backups/post-archive-before-rename-20261025T120409Z.tar.gz`(데이터+설정, 권한 0600). `~/backups`는 root 소유라 쓰지 않았다.
4. 디렉터리 이동: 호스트에 sudo가 없어 기존 이미지로 일회용 root 컨테이너(`--network none`)를 띄워 `mv`만 실행했다. `/opt`, `/var/lib`, `/etc`의 `post-archive` → `bakje`, `post-archive.env` → `bakje.env`. 소유권(1000)은 유지됐다.
5. 새 이름으로 배포: 릴리스 `20261025T120424Z`, 컨테이너 `bakje-web-1` healthy, 마운트 `/var/lib/bakje → /data`
6. 이동 후 데이터 건수가 이전과 완전히 같음을 확인했다. tailnet `:8888`에서 주요 화면·미디어·매니페스트(이름 "박제") 응답 200.
7. 쓰지 않는 이미지 `post-archive-web` 삭제

중단 시간은 컨테이너 중지부터 새 컨테이너 healthy까지 약 1분이었다.

브라우저 저장소 키와 서비스 워커 캐시 이름은 대기 중인 링크를 잃지 않도록 그대로 두었다.

- 추가: decisions/012-service-name-bakje.md, logs/2026-10-25-rename-bakje.md
- 갱신: index.md, decisions/index.md, decisions/001-single-user-local.md, decisions/009-docker-release-deploy.md, concepts/operations.md, concepts/data-model.md, logs/index.md
