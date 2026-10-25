---
type: Decision
title: "012. 서비스 이름 박제"
description: "서비스 이름을 박제(bakje)로 정하고, 운영 경로·식별자는 이전 이름 post-archive로 유지"
tags: [naming, branding, operations]
timestamp: 2026-10-25
---

# 012. 서비스 이름 박제

## Context

화면과 홈 화면 앱 이름이 일반 명사 "아카이브"였고, 저장소·패키지 이름은 `post-archive`였다. 홈 화면에 둘 앱으로 쓰기 시작하면서 짧고 구별되는 이름이 필요했다.

후보는 갈무리(정리해 간수함, PC통신의 화면 저장 기능), 박제(지워지기 전에 남겨 둠), 쟁여(쟁여 두다), Stash였다.

## Decision

**박제**로 정했다. 로마자 표기는 `bakje`다.

- 인터넷에서 "지워지기 전에 원문을 남겨 둔다"는 뜻으로 쓰는 말이라, 원문 삭제 후에도 저장본을 읽게 해 주는 이 서비스의 핵심 가치와 바로 맞는다.
- 누군가를 망신 주려고 저장한다는 뉘앙스가 있다. 개인용 도구라서 받아들였다.

바꾼 곳:

- 화면 상단 이름, 페이지 제목, 웹앱 매니페스트와 iOS 홈 화면 앱 이름
- npm 패키지 이름(`package.json`, `package-lock.json`)
- 저장소 폴더: `~/dev/post-archive` → `~/dev/bakje`
- README, 위키 첫 화면

- 운영 경로: `/opt/post-archive` → `/opt/bakje`, `/var/lib/post-archive` → `/var/lib/bakje`(SQLite·미디어), `/etc/post-archive/post-archive.env` → `/etc/bakje/bakje.env`
- compose 프로젝트 `post-archive` → `bakje`, 이미지 `post-archive-web` → `bakje-web`, 배포 잠금 파일 `/tmp/bakje-deploy.lock`

처음에는 운영 경로를 그대로 두려 했다. 운영 데이터를 옮기고 컨테이너를 교체해야 하기 때문이다. 하지만 사용자가 이름을 끝까지 맞추길 원해서 같은 날 옮겼다. 순서는 다음과 같았다: 기존 컨테이너 중지 → 데이터 백업 → 디렉터리 이동(호스트에 sudo가 없어 Docker 컨테이너로 처리) → 새 이름으로 배포 → 데이터 건수 대조.

이전 이름을 유지한 곳:

- 브라우저 저장소 키(`archive.outbox`)와 서비스 워커 캐시 이름(`archive-shell-*`). 키를 바꾸면 이미 전송을 기다리던 링크를 잃는다.
- Tailscale serve 포트(8888)와 컨테이너 포트(`127.0.0.1:3020`)는 이름과 무관해 그대로다.

## Consequences

- 사용자에게 보이는 이름과 운영 식별자가 같아졌다. 브라우저 쪽 키만 예전 이름 계열(`archive.*`)이다.
- 홈 화면 앱 이름은 iOS가 추가할 때 읽으므로, 이미 추가한 앱은 지우고 다시 추가해야 새 이름이 보인다.
- 지난 로그(`logs/`)의 경로는 당시 기록이라 고치지 않았다.

## Status

Accepted
