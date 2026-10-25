---
type: Log
title: "모바일 UI 재설계와 운영 배포"
description: "Goodcase UI 이식, ColorHunt 팔레트 적용, /opt 릴리스 배포"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 모바일 UI 재설계와 운영 배포

## UI

- 하단 탭 3개(라이브러리·검색·수집), 데스크톱은 상단 내비게이션
- 라이브러리: 2열 미디어 그리드 기본 + 리스트 토글, 칩 필터, 하단 시트 필터
- 전용 검색 화면 `/search`, 태그 제안과 검색 팁
- 상세: 읽기 폭 우선, 데스크톱 우측 보조 열, 이미지 뷰어, 태그·메모 시트
- 미디어 없는 글은 빈 썸네일 대신 타이포 타일

레퍼런스는 Pinterest 저장 화면, Reeder 5 읽기 목록, Raindrop.io 플로우, Readwise Reader에서 가져왔다. 자세한 매핑은 [design-references](../references/design-references.md).

색상은 ColorHunt Popular **#23** `#E0F8C7 #B7D894 #36415A #202734`. 슬레이트 베이스 + 형광 초록 단일 강조.

## 구현

- Goodcase UI의 Button, Badge, Card, TextField, Drawer, Toast, ImageViewer, Spinner, Skeleton을 `src/components/goodcase/`로 복사
- `src/styles/bridge.css`에서 `--gc-*` 토큰을 앱 팔레트에 매핑
- 레이아웃은 Tailwind 유지, 상호작용 요소만 Goodcase 사용

## 배포

- `Dockerfile` + `compose.yml` + `scripts/deploy.sh` + `prepare-host.sh` + `prune-releases.sh`
- `/opt/post-archive/releases/<UTC>` + `current` 심볼릭 링크, 데이터는 `/var/lib/post-archive`
- Playwright 베이스 이미지 사용, `read_only` + `/tmp` tmpfs, `--no-sandbox`
- tailnet `https://<기기이름>.<tailnet>.ts.net:8444`로 노출

## 검증

- 390×844·1280에서 화면 확인, 콘솔 오류·4xx/5xx 없음
- 시트 Escape 닫힘, 검색 제출, 이미지 뷰어 동작
- 배포 3회: 릴리스 교체·정리, 헬스체크, 데이터 유지(3건·미디어 8건)
- 컨테이너 내부 Playwright로 Threads 재확인 성공

## 남은 것

- `/etc/post-archive/post-archive.env`의 `OPENAI_API_KEY`가 비어 번역 비활성
- Threads 다단 타래 실물 검증
- Reddit 차단 빈도

## 변경 파일

- 추가: `src/components/goodcase/**`, `src/styles/**`, `src/components/{app-nav,source-card,library-toolbar,media-gallery,reading-body,source-organizer,search-input,providers}.tsx`, `Dockerfile`, `compose.yml`, `scripts/deploy.sh`, `scripts/prepare-host.sh`, `scripts/prune-releases.sh`, `DESIGN.md`
- 갱신: `src/app/**`, `src/lib/search.ts`, `src/lib/browser.ts`, `README.md`
